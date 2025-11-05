// src/services/googleSheetsCache.js
// -------------------------------------------------------------
//  Google Sheets Offline Cache (AsyncStorage + Firestore metadata)
// -------------------------------------------------------------
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { PLAYMOBIL_CONFIG } from '../config/playmobil';

const SHEET_URLS = PLAYMOBIL_CONFIG.sheetUrls;
const CACHE_COLLECTION = PLAYMOBIL_CONFIG.collections.sheetsCache;
const CACHE_DURATION_HOURS = PLAYMOBIL_CONFIG.cache.durationHours;
const MAX_CACHE_BYTES = 1_500_000; // ~1.5MB safeguard per sheet

const FILE_CACHE_DIR =
  (FileSystem.cacheDirectory || FileSystem.documentDirectory || '') + 'playmobil-sheets/';
const SKIP_LOCAL_CACHE = new Set(['balance2025']);

const SALES_SHEETS = new Set(['sales2025', 'sales2024']);
const ORDERS_SHEETS = new Set(['orders2025', 'orders2024']);
const BALANCE_SHEETS = new Set(['balance2025']);

const { columnNames } = PLAYMOBIL_CONFIG;

const SALES_COLUMNS = [
  columnNames.sales.customerCode,
  columnNames.sales.customerName,
  columnNames.sales.revenue,
  columnNames.sales.billingDate,
];

const ORDERS_COLUMNS = [
  columnNames.orders.customerCode,
  columnNames.orders.customerName,
  columnNames.orders.grossValue,
  columnNames.orders.documentDate,
];

const BALANCE_COLUMNS = [
  columnNames.balance.customerCode,
  columnNames.balance.customerName,
  columnNames.balance.balance,
];

const LOG_PREFIX = '[SheetsCache]';

function resolveSheetKeys(options = {}) {
  const includeKeys = Array.isArray(options?.includeKeys) ? options.includeKeys : null;
  const excludeKeys = Array.isArray(options?.excludeKeys) ? new Set(options.excludeKeys) : null;

  let keys = includeKeys
    ? includeKeys.filter((key) => Object.prototype.hasOwnProperty.call(SHEET_URLS, key))
    : Object.keys(SHEET_URLS);

  if (excludeKeys && excludeKeys.size) {
    keys = keys.filter((key) => !excludeKeys.has(key));
  }

  return keys;
}

// -------------------------------------------------------------
// CSV parsing helpers
// -------------------------------------------------------------
const DELIMITER_CANDIDATES = [',', ';', '\t'];

function detectDelimiter(sample) {
  const text = sample || '';
  let best = ',';
  let bestCount = -1;

  DELIMITER_CANDIDATES.forEach((delimiter) => {
    const regex = new RegExp(`\\${delimiter}`, 'g');
    const count = (text.match(regex) || []).length;
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  });

  return best;
}

function splitCSVRows(text, delimiter) {
  const rows = [];
  let currentField = '';
  let currentRow = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        currentField += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') {
        i += 1;
      }
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

function sanitizeCell(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/^\uFEFF/, '').trim();
}

function compactRow(row, columns) {
  if (!columns) return row;
  const projected = {};
  columns.forEach((column) => {
    if (row[column] !== undefined) {
      projected[column] = row[column];
    } else {
      projected[column] = '';
    }
  });
  return projected;
}

function compactSheetRows(sheetKey, rows) {
  if (!Array.isArray(rows)) return [];

  let columns = null;
  if (SALES_SHEETS.has(sheetKey)) {
    columns = SALES_COLUMNS;
  } else if (ORDERS_SHEETS.has(sheetKey)) {
    columns = ORDERS_COLUMNS;
  } else if (BALANCE_SHEETS.has(sheetKey)) {
    columns = BALANCE_COLUMNS;
  }

  if (!columns) {
    return rows;
  }

  return rows
    .map((row) => compactRow(row, columns))
    .filter((row) => Object.values(row).some((value) => String(value || '').trim().length));
}

// -------------------------------------------------------------
// Parse CSV text into array of objects (robust version)
// -------------------------------------------------------------
function parseCSV(csvText) {
  if (!csvText || typeof csvText !== 'string') {
    console.warn(`${LOG_PREFIX} Empty or invalid CSV text`);
    return [];
  }

  const cleanText = csvText.replace(/\r\n/g, '\n');
  const delimiter = detectDelimiter(cleanText.slice(0, 2000));
  const rows = splitCSVRows(cleanText, delimiter).filter(
    (row) => row && row.some((cell) => sanitizeCell(cell).length)
  );

  if (!rows.length) {
    console.warn(`${LOG_PREFIX} No valid rows discovered in CSV payload`);
    return [];
  }

  const headers = rows[0].map((header) =>
    sanitizeCell(header)
      .replace(/\s+/g, ' ')
      .trim()
  );

  const data = rows.slice(1).map((values) => {
    const row = {};
    headers.forEach((header, index) => {
      row[header] = sanitizeCell(values[index]);
    });
    return row;
  });

  console.log(`${LOG_PREFIX} Parsed ${data.length} rows, headers:`, headers);
  return data;
}

// -------------------------------------------------------------
// File cache helpers
// -------------------------------------------------------------
async function ensureFileCacheDir() {
  if (!FILE_CACHE_DIR) return;
  try {
    const dirInfo = await FileSystem.getInfoAsync(FILE_CACHE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(FILE_CACHE_DIR, { intermediates: true });
    }
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to ensure cache directory`, error?.message || error);
  }
}

async function removeFileIfExists(path) {
  if (!path) return;
  try {
    await FileSystem.deleteAsync(path, { idempotent: true });
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to delete cache file ${path}`, error?.message || error);
  }
}

async function readFileCache(path) {
  if (!path) return null;
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) {
      return null;
    }
    const content = await FileSystem.readAsStringAsync(path, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to read cache file ${path}`, error?.message || error);
    return null;
  }
}

async function loadLocalCache(localKey, metaSnap, sheetKey) {
  const payload = await AsyncStorage.getItem(localKey);
  if (!payload) return null;

  try {
    const parsed = JSON.parse(payload);
    if (Array.isArray(parsed)) {
      if (!isCacheValid(metaSnap)) return null;
      console.log(`${LOG_PREFIX} Using AsyncStorage cache for ${sheetKey} (${parsed.length} rows)`);
      return compactSheetRows(sheetKey, parsed);
    }

    if (parsed && parsed.type === 'file' && parsed.path) {
      if (!isCacheValid(metaSnap)) return null;
      const fileData = await readFileCache(parsed.path);
      if (fileData) {
        console.log(`${LOG_PREFIX} Using file cache for ${sheetKey} (${fileData.length} rows)`);
        return compactSheetRows(sheetKey, fileData);
      }
    }
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to parse stored cache for ${sheetKey}`, error?.message || error);
  }

  return null;
}

async function persistSheetData(sheetKey, rows, localKey) {
  const serialized = JSON.stringify(rows);
  const filePath = `${FILE_CACHE_DIR}${sheetKey}.json`;

  if (SKIP_LOCAL_CACHE.has(sheetKey)) {
    await AsyncStorage.removeItem(localKey);
    await removeFileIfExists(filePath);
    console.log(`${LOG_PREFIX} Skipping local persistence for ${sheetKey}`);
    return;
  }

  if (serialized.length <= MAX_CACHE_BYTES) {
    try {
      await AsyncStorage.setItem(localKey, serialized);
      await removeFileIfExists(filePath);
      console.log(`${LOG_PREFIX} Saved ${sheetKey} to AsyncStorage (${rows.length} rows, ${(serialized.length / 1024).toFixed(1)} KB)`);
    } catch (error) {
      console.warn(`${LOG_PREFIX} Failed to persist ${sheetKey} to AsyncStorage`, error?.message || error);
      if (String(error?.message || '').includes('SQLITE_FULL')) {
        await AsyncStorage.removeItem(localKey);
        console.warn(`${LOG_PREFIX} Removed AsyncStorage cache for ${sheetKey} after SQLITE_FULL`);
      }
    }
    return;
  }

  try {
    await ensureFileCacheDir();
    await FileSystem.writeAsStringAsync(filePath, serialized, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    await AsyncStorage.setItem(localKey, JSON.stringify({ type: 'file', path: filePath }));
    console.log(`${LOG_PREFIX} Saved ${sheetKey} to file cache (${rows.length} rows, ${(serialized.length / 1024).toFixed(1)} KB)`);
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to persist ${sheetKey} to file cache`, error?.message || error);
    await AsyncStorage.removeItem(localKey);
    await removeFileIfExists(filePath);
  }
}

async function removeCacheEntry(key, payload) {
  try {
    if (payload) {
      const parsed = JSON.parse(payload);
      if (!Array.isArray(parsed) && parsed?.type === 'file' && parsed.path) {
        await removeFileIfExists(parsed.path);
      }
    }
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to inspect cache entry ${key}`, error?.message || error);
  }
  await AsyncStorage.removeItem(key);
}

async function analyzeCacheEntry(payload) {
  if (!payload) {
    return { type: 'empty', sizeBytes: 0, pointerPath: null };
  }

  let sizeBytes = payload.length;
  let pointerPath = null;
  let type = 'string';

  try {
    const parsed = JSON.parse(payload);
    if (Array.isArray(parsed)) {
      type = 'array';
      sizeBytes = JSON.stringify(parsed).length;
    } else if (parsed && parsed.type === 'file' && parsed.path) {
      type = 'file';
      pointerPath = parsed.path;
      try {
        const info = await FileSystem.getInfoAsync(parsed.path);
        if (info?.exists) {
          sizeBytes = info.size ?? sizeBytes;
        }
      } catch (error) {
        console.warn(`${LOG_PREFIX} Failed to inspect file cache ${parsed.path}`, error?.message || error);
      }
    } else {
      type = typeof parsed;
    }
  } catch {
    // payload could be a plain JSON string; keep defaults
  }

  return { type, sizeBytes, pointerPath };
}



// -------------------------------------------------------------
// Fetch sheet from Google
// -------------------------------------------------------------
async function fetchSheetData(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch sheet: ${res.statusText}`);
  const text = await res.text();
  return parseCSV(text);
}

// -------------------------------------------------------------
// Check Firestore timestamp validity
// -------------------------------------------------------------
function isCacheValid(metaDoc) {
  if (!metaDoc.exists) return false;
  const data = metaDoc.data();
  if (!data.lastFetchedAt) return false;
  const ageHours = (new Date() - data.lastFetchedAt.toDate()) / (1000 * 60 * 60);
  return ageHours < CACHE_DURATION_HOURS;
}

// -------------------------------------------------------------
// Load one sheet (from AsyncStorage or network)
// -------------------------------------------------------------
async function getCachedSheetData(db, sheetKey, url) {
  const ref = db.collection(CACHE_COLLECTION).doc(sheetKey);
  const metaSnap = await ref.get();
  const localKey = `sheetcache:${sheetKey}`;

  const localData = await loadLocalCache(localKey, metaSnap, sheetKey);
  if (localData) {
    return localData;
  }

  console.log(`${LOG_PREFIX} Fetching fresh data for ${sheetKey}`);
  const rawData = await fetchSheetData(url);
  const rows = compactSheetRows(sheetKey, rawData);

  await persistSheetData(sheetKey, rows, localKey);

  try {
    await ref.set({
      sheetKey,
      rowCount: rows.length,
      lastFetchedAt: firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to update Firestore metadata for ${sheetKey}`, error?.message || error);
  }

  return rows;
}

// -------------------------------------------------------------
// Get all Sheets data in parallel
// -------------------------------------------------------------
export async function getAllSheetsData(db, options = {}) {
  const keys = resolveSheetKeys(options);
  const results = await Promise.all(
    keys.map((key) => getCachedSheetData(db, key, SHEET_URLS[key]))
  );

  const output = {};
  keys.forEach((key, index) => {
    output[key] = results[index];
  });
  return output;
}

// -------------------------------------------------------------
// Manual refresh: ignore cache and re-download all
// -------------------------------------------------------------
export async function refreshAllCaches(db, options = {}) {
  const keys = resolveSheetKeys(options);
  for (const key of keys) {
    console.log(`${LOG_PREFIX} Refreshing ${key} (network)`);
    const rawData = await fetchSheetData(SHEET_URLS[key]);
    const rows = compactSheetRows(key, rawData);
    await persistSheetData(key, rows, `sheetcache:${key}`);
    try {
      await db.collection(CACHE_COLLECTION).doc(key).set({
        sheetKey: key,
        rowCount: rows.length,
        lastFetchedAt: firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.warn(`${LOG_PREFIX} Failed to update Firestore metadata for ${key}`, error?.message || error);
    }
  }
  console.log(`${LOG_PREFIX} Refresh complete for ${keys.length} sheet(s).`);
}


// -------------------------------------------------------------
// 🔧 Cache Maintenance Utilities
// -------------------------------------------------------------

// 1️⃣ Clear all sheet caches (manual reset)
export async function clearAllSheetCaches() {
  const keys = await AsyncStorage.getAllKeys();
  const sheetKeys = keys.filter((key) => key.startsWith('sheetcache:'));
  if (sheetKeys.length) {
    await AsyncStorage.multiRemove(sheetKeys);
  }
  try {
    await FileSystem.deleteAsync(FILE_CACHE_DIR, { idempotent: true });
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to reset file cache directory`, error?.message || error);
  } finally {
    await ensureFileCacheDir();
  }
  console.log(`${LOG_PREFIX} Cleared ${sheetKeys.length} AsyncStorage entries and reset file cache directory`);
}



// 2️⃣ Keep only latest years (e.g., 2024 & 2025)
export async function trimOldCaches(keepYears = ['2024', '2025']) {
  const keys = await AsyncStorage.getAllKeys();
  const sheetKeys = keys.filter((key) => key.startsWith('sheetcache:'));
  const removed = [];

  for (const key of sheetKeys) {
    const year = key.match(/\d{4}/)?.[0];
    if (year && keepYears.includes(year)) {
      continue;
    }
    const payload = await AsyncStorage.getItem(key);
    await removeCacheEntry(key, payload);
    removed.push(key);
  }

  if (removed.length) {
    console.log(`${LOG_PREFIX} Removed ${removed.length} outdated cache(s):`, removed);
  } else {
    console.log(`${LOG_PREFIX} No outdated caches detected`);
  }
}



// 3️⃣ Optional: trim oversize caches (> 1MB)
export async function trimLargeCaches(maxBytes = 1_000_000) {
  const keys = await AsyncStorage.getAllKeys();
  const sheetKeys = keys.filter((key) => key.startsWith('sheetcache:'));
  let removed = 0;

  for (const key of sheetKeys) {
    const payload = await AsyncStorage.getItem(key);
    const { sizeBytes } = await analyzeCacheEntry(payload);
    if (sizeBytes > maxBytes) {
      await removeCacheEntry(key, payload);
      removed += 1;
      console.log(`${LOG_PREFIX} Removed oversize cache ${key} (~${(sizeBytes / 1024).toFixed(1)} KB)`);
    }
  }

  if (!removed) {
    console.log(`${LOG_PREFIX} No caches exceeded ${(maxBytes / 1024).toFixed(0)} KB threshold`);
  } else {
    console.log(`${LOG_PREFIX} Trimmed ${removed} oversized cache(s)`);
  }
}
