import AsyncStorage from '@react-native-async-storage/async-storage';
import { canonicalCode, toNumberSafe } from '../utils/codeNormalization';

const INVENTORY_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1A1HlA27aaamZy-smzvbr6DckmH7MGME2NNwMMNOnZVI/export?format=csv&gid=1490385526';

const CACHE_KEY = 'supermarket_inventory_cache_v4';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const memoryCache = new Map();

const HEADER_MAP = {
  storeCode: ["Κωδικός Καταστήματος", "Κωδ. Καταστ.", "Store Code", "Κωδικός"],
  masterCode: ["Μητρικός Κωδ.", "Master Code", "Μητρικός", "Μητρικός Κωδικός"],
  supplierCode: [
    "Κωδ.Είδους Προμηθευτή",
    "Κωδ. Είδους Προμηθευτή",
    "Supplier Product Code",
    "Κωδ.Ειδους Προμηθευτή",
  ],
  description: ["Περιγραφή", "Description"],
  stockQty: [
    "Τελικό Απόθεμα (Τεμ.)",
    "Τελικό Απόθεμα (pcs)",
    "Final Stock (pcs)",
    "Stock Qty",
    "Τελικό Απόθεμα Τεμ",
  ],
};

const normalizeStoreCode = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim().toUpperCase();
};

const buildStoreCodeVariants = (raw) => {
  const variants = new Set();
  const base = normalizeStoreCode(raw);
  if (!base) return [];

  variants.add(base);
  variants.add(base.replace(/\s+/g, ''));

  const digits = base.replace(/\D+/g, '');
  if (digits) {
    variants.add(digits);
    variants.add(String(Number(digits)));
    for (let len = digits.length; len <= Math.max(digits.length, 6); len += 1) {
      variants.add(digits.padStart(len, '0'));
    }
  }

  return Array.from(variants);
};

const getField = (row, keys) => {
  for (const key of keys) {
    if (row[key] != null) {
      const text = String(row[key]).trim();
      if (text) return text;
    }
  }
  return '';
};

async function loadDiskCache() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.timestamp || !parsed.data) return null;
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch (error) {
    console.warn('[inventory] Failed to read cache', error);
    return null;
  }
}

async function saveDiskCache(data) {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
    console.log('💾 Inventory cache saved');
  } catch (error) {
    console.warn('[inventory] Failed to persist cache', error);
  }
}

function parseCSV(text) {
  if (!text) return [];

  const rows = [];
  let currentValue = '';
  let currentRow = [];
  let inQuotes = false;

  const pushValue = () => {
    currentRow.push(currentValue);
    currentValue = '';
  };

  const pushRow = () => {
    pushValue();
    const hasContent = currentRow.some((value) => value.trim() !== '');
    if (hasContent) {
      rows.push(currentRow);
    }
    currentRow = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (char === '"') {
      const nextChar = text[i + 1];
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      pushValue();
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') {
        i += 1;
      }
      pushRow();
      continue;
    }

    currentValue += char;
  }

  if (currentValue.length > 0 || currentRow.length) {
    pushRow();
  }

  if (!rows.length) return [];

  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).reduce((acc, values) => {
    if (!values || !values.length) return acc;
    const row = {};
    headers.forEach((header, idx) => {
      if (!header) return;
      const rawValue = values[idx] ?? '';
      row[header] = String(rawValue).trim();
    });
    const hasValues = Object.values(row).some((value) => value !== '');
    if (hasValues) {
      acc.push(row);
    }
    return acc;
  }, []);
}

async function fetchInventoryFromServer() {
  try {
    console.log('🌐 Fetching inventory from:', INVENTORY_SHEET_URL);
    const response = await fetch(INVENTORY_SHEET_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const csvText = await response.text();
    console.log('📄 CSV fetched, size:', csvText.length, 'bytes');

    const rows = parseCSV(csvText);
    console.log('📊 Parsed rows:', rows.length);
    if (rows.length) {
      console.log('📋 Sample row:', rows[0]);
    }

    const storeInventories = {};

    rows.forEach((row, index) => {
      const storeCodeRaw = getField(row, HEADER_MAP.storeCode);
      const masterCodeRaw = getField(row, HEADER_MAP.masterCode);
      const supplierCodeRaw = getField(row, HEADER_MAP.supplierCode);
      const stockQtyRaw = getField(row, HEADER_MAP.stockQty);
      const stockQty = toNumberSafe(stockQtyRaw, 0);
      const description = getField(row, HEADER_MAP.description);

      if (!storeCodeRaw || (!masterCodeRaw && !supplierCodeRaw)) {
        if (index < 5) {
          console.log('WARN Inventory row skipped (missing store/master code):', row);
        }
        return;
      }

      const codes = new Set();
      const masterCode = canonicalCode(masterCodeRaw);
      const supplierCode = canonicalCode(supplierCodeRaw);

      if (storeCodeRaw === '101' && (supplierCodeRaw?.includes('03980') || supplierCodeRaw?.includes('03823'))) {
        console.log('🔎 Tracking row for store 101:', {
          masterCodeRaw,
          supplierCodeRaw,
          stockQtyRaw,
          stockQty,
          normalizedCodes: { masterCode, supplierCode },
        });
      }
      if (masterCode) codes.add(masterCode);
      if (supplierCode) codes.add(supplierCode);
      if (!codes.size) {
        if (index < 5) {
          console.log('WARN Inventory row skipped (unusable product codes):', row);
        }
        return;
      }

      buildStoreCodeVariants(storeCodeRaw).forEach((variant) => {
        if (!variant) return;
        if (!storeInventories[variant]) {
          storeInventories[variant] = {};
        }
        codes.forEach((codeKey) => {
          storeInventories[variant][codeKey] = {
            masterCode: masterCodeRaw || supplierCodeRaw || codeKey,
            supplierCode: supplierCodeRaw || masterCodeRaw || codeKey,
            description,
            stockQty,
            stockQtyRaw,
            storeCode: variant,
            rawStoreCode: storeCodeRaw,
            codes: Array.from(codes),
          };
        });
      });
    });

    console.log('📦 Processed inventory for stores:', Object.keys(storeInventories).length);
    return storeInventories;
  } catch (error) {
    console.error('❌ Inventory fetch failed:', error);
    return {};
  }
}

const resolveStoreInventory = (allStores, storeCode) => {
  if (!storeCode || !allStores) return {};
  const variantsTried = buildStoreCodeVariants(storeCode);
  for (const key of variantsTried) {
    if (key && allStores[key]) {
      console.log('✅ Matched inventory key variant:', key);
      return allStores[key];
    }
  }

  const normalized = normalizeStoreCode(storeCode);
  if (normalized && allStores[normalized]) {
    console.log('✅ Matched normalized inventory key:', normalized);
    return allStores[normalized];
  }

  console.log('⚠️ No inventory match for store code:', storeCode, 'variants:', variantsTried);
  return {};
};

export async function getStoreInventory(storeCode) {
  if (!storeCode) {
    console.warn('⚠️ getStoreInventory called without storeCode');
    return {};
  }

  console.log('📦 Loading inventory for store:', storeCode);

  const memEntry = memoryCache.get('all_stores');
  if (memEntry && Date.now() - memEntry.timestamp < CACHE_TTL_MS) {
    console.log('✅ Using memory cache');
    const cached = resolveStoreInventory(memEntry.data, storeCode);
    if (Object.keys(cached).length) {
      return cached;
    }
  }

  const diskCache = await loadDiskCache();
  if (diskCache) {
    console.log('✅ Using disk cache');
    memoryCache.set('all_stores', { data: diskCache, timestamp: Date.now() });
    const cached = resolveStoreInventory(diskCache, storeCode);
    if (Object.keys(cached).length) {
      return cached;
    }
  }

  console.log('🌐 Fetching fresh inventory...');
  const allInventories = await fetchInventoryFromServer();
  memoryCache.set('all_stores', { data: allInventories, timestamp: Date.now() });
  await saveDiskCache(allInventories);

  const resolved = resolveStoreInventory(allInventories, storeCode);
  console.log('📦 Returning inventory:', Object.keys(resolved).length, 'items');
  return resolved;
}

export async function clearSupermarketInventoryCache() {
  try {
    memoryCache.clear();
    await AsyncStorage.removeItem(CACHE_KEY);
    console.log('🗑️ Supermarket inventory cache cleared.');
  } catch (error) {
    console.warn('[inventory] Failed to clear cache', error);
  }
}

export async function refreshInventory() {
  console.log('🔄 Force refreshing inventory...');
  await clearSupermarketInventoryCache();
  return fetchInventoryFromServer();
}


