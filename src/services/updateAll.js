// /src/services/updateAll.js
// Unified "Update All" service with INCREMENTAL Firestore sync that supports
// mixed timestamp fields: updatedAt, lastUpdated, importedAt, (fallback) createdAt.
//
// - Firestore: incremental by any of the supported fields (union of results per field)
// - Spreadsheets: 24h checksum cache via loadSpreadsheet()
// - Supermarket data: full fetch (usually small) with brand filtering
// - Images: best-effort download & local cache
//
// Assumptions:
// * Timestamps are Firestore Timestamp values. If some docs are missing these fields,
//   they'll still be caught on initial full sync; later, any doc updated will gain a timestamp
//   in one of the supported fields and be picked up by incremental runs.

import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

import { loadSpreadsheet } from './spreadsheetCache';
import { SPREADSHEETS } from '../config/spreadsheets';
import {
  PRODUCT_COLLECTIONS,
  CUSTOMER_COLLECTIONS,
  AVAILABLE_BRANDS,
  BRAND_LABEL,
  normalizeBrandKey,
} from '../constants/brands';
import {
  saveProductsToLocal,
  getProductsFromLocal,
  saveCustomersToLocal,
  getCustomersFromLocal,
  saveSuperMarketStoresToLocal,
  saveSuperMarketListingsToLocal,
} from '../utils/localData';
import { fetchSuperMarketStores, fetchSuperMarketListings } from './supermarketData';

// ---------------------------------------------
// Config
// ---------------------------------------------
const SUPPORTED_TS_FIELDS = ['updatedAt', 'lastUpdated', 'importedAt', 'createdAt']; // priority order

// ---------------------------------------------
// Storage helpers
// ---------------------------------------------
const SYNC_PREFIX = 'sync:last';
const dk = (...parts) => parts.join(':');

async function getLastSyncISO(brandKey, collectionKey) {
  const k = dk(SYNC_PREFIX, brandKey, collectionKey);
  const v = await AsyncStorage.getItem(k);
  return v || null;
}
async function setLastSyncISO(brandKey, collectionKey, isoString) {
  const k = dk(SYNC_PREFIX, brandKey, collectionKey);
  await AsyncStorage.setItem(k, isoString);
}

// ---------------------------------------------
// Spreadsheets per brand (keys must exist in SPREADSHEETS)
// ---------------------------------------------
function spreadsheetKeysForBrand(brandKey) {
  switch (brandKey) {
    case 'playmobil':
      return ['playmobilSales', 'playmobilStock'];
    case 'kivos':
      return ['kivosCustomers', 'kivosCredit'];
    case 'john':
      return []; // add john-specific sheets when registered
    default:
      return [];
  }
}

// ---------------------------------------------
// Image cache/downloader
// ---------------------------------------------
async function downloadImage(url, brandKey) {
  if (!url || typeof url !== 'string') return null;

  const safeName = url.replace(/[^\w.-]+/g, '_').slice(-120);
  const dir = `${FileSystem.cacheDirectory}brand-images/${brandKey}/`;
  const fileUri = `${dir}${safeName}`;

  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    if (info.exists && info.size > 0) return fileUri;

    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const res = await FileSystem.downloadAsync(url, fileUri);
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    return fileUri;
  } catch {
    return null;
  }
}

async function downloadBrandImages(
  brandKey,
  {
    imageFieldCandidates = ['imageUrl', 'photoUrl', 'Front Cover', 'frontCover', 'image'],
    concurrency = 6,
  } = {}
) {
  try {
    const products = await getProductsFromLocal(brandKey);
    if (!Array.isArray(products) || !products.length) return { downloaded: 0 };

    let done = 0;
    let idx = 0;

    async function worker() {
      while (idx < products.length) {
        const i = idx++;
        const p = products[i] || {};
        const url =
          imageFieldCandidates
            .map((f) => (p && typeof p[f] === 'string' ? p[f] : null))
            .find(Boolean) || null;

        if (url) {
          const localPath = await downloadImage(url, brandKey);
          if (localPath) done += 1;
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    return { downloaded: done };
  } catch {
    return { downloaded: 0 };
  }
}

// ---------------------------------------------
// Supermarket (Firestore → local)
// ---------------------------------------------
// ---------------------------------------------
// Merge helpers
// ---------------------------------------------
function upsertById(localArr, incomingArr, idField = 'id') {
  const map = new Map((localArr || []).map((x) => [x[idField], x]));
  for (const it of incomingArr || []) {
    const id = it?.[idField];
    if (!id) continue;
    const prev = map.get(id) || {};
    map.set(id, { ...prev, ...it });
  }
  return Array.from(map.values());
}

// Extract the best available timestamp (as ms since epoch) from a doc.
function docTimestampMs(doc) {
  for (const f of SUPPORTED_TS_FIELDS) {
    const ts = doc?.[f];
    if (ts && typeof ts.toDate === 'function') {
      return ts.toDate().getTime();
    }
  }
  return 0;
}

function newestTimestampISO(docs) {
  let max = 0;
  for (const d of docs || []) {
    const ms = docTimestampMs(d);
    if (ms > max) max = ms;
  }
  return max ? new Date(max).toISOString() : new Date().toISOString();
}

async function fetchFullCollection(collectionName) {
  const snap = await firestore().collection(collectionName).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---------------------------------------------
// Incremental Firestore fetch for multiple timestamp fields
// (unions results from separate per-field queries; paginated)
// ---------------------------------------------
async function incrementalFetchMultiField(collectionName, lastSyncISO) {
  const fallbackFull = async (reason) => {
    const docs = await fetchFullCollection(collectionName);
    return {
      mode: 'full',
      reason,
      docs,
      newestISO: newestTimestampISO(docs),
    };
  };

  if (!lastSyncISO) {
    return fallbackFull('initial');
  }

  const lastDate = new Date(lastSyncISO);
  if (Number.isNaN(lastDate.getTime())) {
    return fallbackFull('invalid_last_sync');
  }

  const lastTs = firestore.Timestamp.fromDate(lastDate);

  const colRef = firestore().collection(collectionName);
  const LIMIT = 500;

  // Run a separate incremental query per field, then union by doc ID
  const perFieldFetch = async (field) => {
    let results = [];
    let cursor = null;

    try {
      // We need an index on `field` to order + range; if it doesn't exist, this will error.
      let q = colRef.orderBy(field).startAfter(lastTs).limit(LIMIT);

      // paginate
      while (true) {
        const snap = await (cursor ? q.startAfter(cursor).get() : q.get());
        if (snap.empty) break;

        const page = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        results = results.concat(page);

        const lastDoc = snap.docs[snap.docs.length - 1];
        const lastVal = lastDoc?.get(field);
        if (!lastVal) break;
        cursor = lastVal;

        if (snap.size < LIMIT) break;
      }
    } catch (e) {
      // If query fails (e.g., missing index or field absent on most docs), skip this field
      // console.warn(`[incremental] Skipping field ${field} for ${collectionName}:`, e?.message);
      results = [];
    }

    return results;
  };

  // Execute sequentially to avoid hammering indexes (can parallelize if you prefer)
  let unionMap = new Map();
  for (const field of SUPPORTED_TS_FIELDS) {
    const batch = await perFieldFetch(field);
    for (const doc of batch) {
      unionMap.set(doc.id, doc);
    }
    for (const doc of batch) {
      unionMap.set(doc.id, doc);
    }
  }

  const unionDocs = Array.from(unionMap.values());
  if (unionDocs.length) {
    return {
      mode: 'incremental',
      reason: 'delta',
      docs: unionDocs,
      newestISO: newestTimestampISO(unionDocs),
    };
  }

  return fallbackFull('empty_delta');
}

// ---------------------------------------------
// One-brand update (Firestore + sheets + supermarket + images)
// ---------------------------------------------
async function updateBrand(brandKey, { supportsSuperMarketBrand }) {
  const safeBrand = normalizeBrandKey(brandKey);
  const productCollection = PRODUCT_COLLECTIONS[safeBrand] || PRODUCT_COLLECTIONS.playmobil;
  const customerCollection = CUSTOMER_COLLECTIONS[safeBrand] || CUSTOMER_COLLECTIONS.playmobil;

  const brandSummary = {
    brand: safeBrand,
    label: BRAND_LABEL[safeBrand] || safeBrand.toUpperCase(),
    products: { status: 'skipped' },
    customers: { status: 'skipped' },
    supermarket: { enabled: false, stores: null, listings: null },
    sheets: [],
    images: null,
  };

  // PRODUCTS
  try {
    const lastISO = await getLastSyncISO(safeBrand, productCollection);
    const fetchResult = await incrementalFetchMultiField(productCollection, lastISO);
    const changed = fetchResult.docs.length;
    let total = 0;

    if (fetchResult.mode === 'incremental') {
      const local = await getProductsFromLocal(safeBrand);
      const merged = upsertById(local, fetchResult.docs, 'id');
      total = merged.length;
      await saveProductsToLocal(merged, safeBrand);
    } else {
      await saveProductsToLocal(fetchResult.docs, safeBrand);
      total = fetchResult.docs.length;
      if (!total) {
        const currentLocal = await getProductsFromLocal(safeBrand);
        total = currentLocal.length;
      }
    }

    if (fetchResult.newestISO) {
      await setLastSyncISO(safeBrand, productCollection, fetchResult.newestISO);
    }

    brandSummary.products = {
      status: 'ok',
      mode: fetchResult.mode,
      reason: fetchResult.reason,
      changed,
      total,
    };
  } catch (error) {
    brandSummary.products = {
      status: 'error',
      message: error?.message || 'Unknown error',
    };
  }

  // CUSTOMERS
  try {
    const lastISO = await getLastSyncISO(safeBrand, customerCollection);
    const fetchResult = await incrementalFetchMultiField(customerCollection, lastISO);
    const changed = fetchResult.docs.length;
    let total = 0;

    if (fetchResult.mode === 'incremental') {
      const local = await getCustomersFromLocal(safeBrand);
      const merged = upsertById(local, fetchResult.docs, 'id');
      total = merged.length;
      await saveCustomersToLocal(merged, safeBrand);
    } else {
      await saveCustomersToLocal(fetchResult.docs, safeBrand);
      total = fetchResult.docs.length;
      if (!total) {
        const currentLocal = await getCustomersFromLocal(safeBrand);
        total = currentLocal.length;
      }
    }

    if (fetchResult.newestISO) {
      await setLastSyncISO(safeBrand, customerCollection, fetchResult.newestISO);
    }

    brandSummary.customers = {
      status: 'ok',
      mode: fetchResult.mode,
      reason: fetchResult.reason,
      changed,
      total,
    };
  } catch (error) {
    brandSummary.customers = {
      status: 'error',
      message: error?.message || 'Unknown error',
    };
  }

  // SUPERMARKET (optional; smaller volumes → full fetch is fine)
  const canSyncSupermarket =
    typeof supportsSuperMarketBrand === 'function' ? supportsSuperMarketBrand(safeBrand) : false;
  brandSummary.supermarket.enabled = !!canSyncSupermarket;

  if (brandSummary.supermarket.enabled) {
    try {
      const stores = await fetchSuperMarketStores(safeBrand);
      await saveSuperMarketStoresToLocal(stores, safeBrand);
      brandSummary.supermarket.stores = { status: 'ok', total: stores.length };
    } catch (error) {
      brandSummary.supermarket.stores = {
        status: 'error',
        message: error?.message || 'Unknown error',
      };
    }
    try {
      const listings = await fetchSuperMarketListings(safeBrand);
      await saveSuperMarketListingsToLocal(listings, safeBrand);
      brandSummary.supermarket.listings = { status: 'ok', total: listings.length };
    } catch (error) {
      brandSummary.supermarket.listings = {
        status: 'error',
        message: error?.message || 'Unknown error',
      };
    }
  } else {
    brandSummary.supermarket.stores = { status: 'skipped' };
    brandSummary.supermarket.listings = { status: 'skipped' };
  }

  // SPREADSHEETS (24h cache; refresh if TTL or checksum changed)
  const sheetKeys = spreadsheetKeysForBrand(safeBrand).filter((k) => SPREADSHEETS[k]);
  for (const key of sheetKeys) {
    try {
      await loadSpreadsheet(key, { force: true });
      brandSummary.sheets.push({ key, status: 'ok' });
    } catch (error) {
      brandSummary.sheets.push({
        key,
        status: 'error',
        message: error?.message || 'Unknown error',
      });
    }
  }

  // IMAGES (best-effort)
  try {
    const imageResult = await downloadBrandImages(safeBrand);
    brandSummary.images = {
      status: 'ok',
      downloaded: imageResult?.downloaded || 0,
    };
  } catch (error) {
    brandSummary.images = {
      status: 'error',
      message: error?.message || 'Unknown error',
    };
  }

  return brandSummary;
}

// ---------------------------------------------
// Public API — call from GlobalUserMenu (or anywhere)
// ---------------------------------------------
export async function updateAllDataForUser({
  brandAccess = [], // e.g. ['playmobil','kivos']
  supportsSuperMarketBrand = () => false,
} = {}) {
  const summary = {
    startedAt: Date.now(),
    brands: [],
    global: [],
    errors: [],
  };

  const rawBrands = Array.isArray(brandAccess) && brandAccess.length ? brandAccess : AVAILABLE_BRANDS;
  const brandSet = new Set(
    rawBrands
      .map((b) => normalizeBrandKey(b))
      .filter(Boolean)
  );
  if (!brandSet.size) {
    AVAILABLE_BRANDS.forEach((b) => brandSet.add(normalizeBrandKey(b)));
  }
  const resolvedBrands = Array.from(brandSet);

  for (const brand of resolvedBrands) {
    try {
      const brandResult = await updateBrand(brand, { supportsSuperMarketBrand });
      summary.brands.push(brandResult);

      const stepErrors = [];
      if (brandResult.products?.status === 'error') {
        stepErrors.push({ brand, step: 'products', message: brandResult.products.message });
      }
      if (brandResult.customers?.status === 'error') {
        stepErrors.push({ brand, step: 'customers', message: brandResult.customers.message });
      }
      if (
        brandResult.supermarket?.enabled &&
        brandResult.supermarket.stores?.status === 'error'
      ) {
        stepErrors.push({ brand, step: 'supermarketStores', message: brandResult.supermarket.stores.message });
      }
      if (
        brandResult.supermarket?.enabled &&
        brandResult.supermarket.listings?.status === 'error'
      ) {
        stepErrors.push({ brand, step: 'supermarketListings', message: brandResult.supermarket.listings.message });
      }
      if (brandResult.images?.status === 'error') {
        stepErrors.push({ brand, step: 'images', message: brandResult.images.message });
      }
      if (Array.isArray(brandResult.sheets)) {
        brandResult.sheets
          .filter((s) => s.status === 'error')
          .forEach((s) => {
            stepErrors.push({ brand, step: `sheet:${s.key}`, message: s.message });
          });
      }

      summary.errors.push(...stepErrors);
    } catch (error) {
      const label = BRAND_LABEL[brand] || brand.toUpperCase();
      const fail = {
        brand,
        label,
        error: error?.message || 'Unknown error',
      };
      summary.brands.push(fail);
      summary.errors.push({ brand, step: 'updateBrand', message: fail.error });
    }
  }

  if (SPREADSHEETS.supermarketInventory) {
    try {
      await loadSpreadsheet('supermarketInventory', { force: true });
      summary.global.push({ key: 'supermarketInventory', status: 'ok' });
    } catch (error) {
      const message = error?.message || 'Unknown error';
      summary.global.push({ key: 'supermarketInventory', status: 'error', message });
      summary.errors.push({ brand: 'global', step: 'supermarketInventory', message });
    }
  }

  summary.finishedAt = Date.now();
  summary.durationMs = summary.finishedAt - summary.startedAt;
  return summary;
}

// ---------------------------------------------
// OPTIONAL: force full re-sync helper (ignores lastSync)
// ---------------------------------------------
export async function forceFullResyncForUser({
  brandAccess = [],
  supportsSuperMarketBrand = () => false,
} = {}) {
  const rawBrands = Array.isArray(brandAccess) && brandAccess.length ? brandAccess : AVAILABLE_BRANDS;
  const resolvedBrands = Array.from(
    new Set(
      rawBrands
        .map((b) => normalizeBrandKey(b))
        .filter(Boolean)
    )
  );

  for (const brand of resolvedBrands) {
    const productCollection = PRODUCT_COLLECTIONS[brand] || PRODUCT_COLLECTIONS.playmobil;
    const customerCollection = CUSTOMER_COLLECTIONS[brand] || CUSTOMER_COLLECTIONS.playmobil;
    await setLastSyncISO(brand, productCollection, '');
    await setLastSyncISO(brand, customerCollection, '');
    await updateBrand(brand, { supportsSuperMarketBrand });
  }
}

const formatStatusLine = (label, payload) => {
  if (!payload) {
    return `${label}: -`;
  }
  if (payload.status === 'error') {
    const message = payload.message ? ` – ${payload.message}` : '';
    return `${label}: ΣΦΑΛΜΑ${message}`;
  }
  if (payload.status === 'skipped') {
    return `${label}: Παραλείφθηκε`;
  }
  const pieces = [];
  if (payload.mode) {
    pieces.push(`λειτουργία ${payload.mode}`);
  }
  if (typeof payload.total === 'number') {
    pieces.push(`σύνολο ${payload.total}`);
  }
  if (typeof payload.changed === 'number') {
    pieces.push(`μεταβλήθηκαν ${payload.changed}`);
  }
  if (typeof payload.downloaded === 'number') {
    pieces.push(`λήφθηκαν ${payload.downloaded}`);
  }
  if (!pieces.length) {
    pieces.push('ΟΚ');
  }
  return `${label}: ${pieces.join(', ')}`;
};

const brandDisplayName = (brandSummary) => {
  if (brandSummary?.label) return brandSummary.label;
  if (brandSummary?.brand) {
    return BRAND_LABEL[brandSummary.brand] || brandSummary.brand.toUpperCase();
  }
  return 'UNKNOWN';
};

export function formatUpdateAllSummary(summary) {
  if (!summary || !Array.isArray(summary.brands) || !summary.brands.length) {
    return 'Δεν υπάρχουν διαθέσιμα αποτελέσματα.';
  }

  const lines = [];
  summary.brands.forEach((brandSummary) => {
    const title = `• ${brandDisplayName(brandSummary)}`;
    lines.push(title);

    if (brandSummary.error) {
      lines.push(`  ◦ Σφάλμα: ${brandSummary.error}`);
      return;
    }

    lines.push(`  ◦ ${formatStatusLine('Προϊόντα', brandSummary.products)}`);
    lines.push(`  ◦ ${formatStatusLine('Πελάτες', brandSummary.customers)}`);

    if (brandSummary.supermarket?.enabled) {
      lines.push(`  ◦ ${formatStatusLine('SM Καταστήματα', brandSummary.supermarket.stores)}`);
      lines.push(`  ◦ ${formatStatusLine('SM Listings', brandSummary.supermarket.listings)}`);
    } else {
      lines.push('  ◦ SuperMarket: Παραλείφθηκε');
    }

    lines.push(`  ◦ ${formatStatusLine('Εικόνες', brandSummary.images)}`);

    if (Array.isArray(brandSummary.sheets) && brandSummary.sheets.length) {
      const sheetParts = brandSummary.sheets.map((sheet) => {
        if (sheet.status === 'error') {
          return `${sheet.key}=ΣΦΑΛΜΑ${sheet.message ? ` – ${sheet.message}` : ''}`;
        }
        return `${sheet.key}=ΟΚ`;
      });
      lines.push(`  ◦ Φύλλα: ${sheetParts.join(', ')}`);
    } else {
      lines.push('  ◦ Φύλλα: -');
    }
  });

  if (Array.isArray(summary.global) && summary.global.length) {
    lines.push('• Γενικά');
    summary.global.forEach((item) => {
      if (item.status === 'error') {
        lines.push(`  ◦ ${item.key}: ΣΦΑΛΜΑ${item.message ? ` – ${item.message}` : ''}`);
      } else {
        lines.push(`  ◦ ${item.key}: ΟΚ`);
      }
    });
  }

  if (typeof summary.durationMs === 'number') {
    const seconds = Math.max(1, Math.round(summary.durationMs / 1000));
    lines.push(`\nΔιάρκεια: ${seconds}s`);
  }

  return lines.join('\n');
}
