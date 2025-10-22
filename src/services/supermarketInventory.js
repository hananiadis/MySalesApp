import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  SUPERMARKET_INVENTORY_SHEET_URL,
} from '../config/firebase';

const CACHE_KEY = 'supermarket_inventory_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const COLUMN_MATCHERS = {
  storeCode: ['κωδικός καταστήματος', 'store code'],
  storeName: ['κατάστημα', 'store name'],
  productCode: ['κωδ.είδους προμηθευτή', 'κωδ. είδους προμηθευτή', 'supplier item code', 'product code'],
  masterCode: ['μητρικός κωδ.', 'μητρικός κωδ', 'master code'],
  description: ['περιγραφή', 'description'],
  stockQty: ['τελικό απόθεμα (τεμ.)', 'stock qty', 'stock quantity'],
  stockCost: ['τελικό απόθεμα (κόστος)', 'stock cost'],
};

const GREEK_MAP = {
  α: 'a', ά: 'a',
  β: 'b',
  γ: 'g',
  δ: 'd',
  ε: 'e', έ: 'e',
  ζ: 'z',
  η: 'i', ή: 'i',
  θ: 'th',
  ι: 'i', ί: 'i', ϊ: 'i', ΐ: 'i',
  κ: 'k',
  λ: 'l',
  μ: 'm',
  ν: 'n',
  ξ: 'x',
  ο: 'o', ό: 'o',
  π: 'p',
  ρ: 'r',
  σ: 's', ς: 's',
  τ: 't',
  υ: 'y', ύ: 'y', ϋ: 'y', ΰ: 'y',
  φ: 'f',
  χ: 'ch',
  ψ: 'ps',
  ω: 'o', ώ: 'o',
};

const sanitizeText = (value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
};

const normalizeLabel = (label) => {
  if (!label) return '';
  const lower = String(label)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return lower.replace(/[\u0370-\u03FF]/g, (char) => GREEK_MAP[char] ?? char);
};

const normalizeCode = (value) => {
  const text = sanitizeText(value);
  return text ? text.replace(/\s+/g, '').toUpperCase() : null;
};

const parseNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const numeric = String(value)
    .replace(/€|%/g, '')
    .replace(/\s+/g, '')
    .replace(/\./g, '.')
    .replace(/,/g, '.')
    .replace(/[^0-9.-]/g, '');
  if (!numeric) return null;
  const parsed = Number(numeric);
  return Number.isFinite(parsed) ? parsed : null;
};

const safeCellValue = (cell) => {
  if (!cell) return null;
  if (cell.v !== null && cell.v !== undefined) return cell.v;
  if (cell.f !== null && cell.f !== undefined) return cell.f;
  return null;
};

const stripVisualizationWrapper = (payload) => {
  if (!payload) return '';
  const prefixIndex = payload.indexOf('(');
  const suffixIndex = payload.lastIndexOf(')');
  if (prefixIndex === -1 || suffixIndex === -1) {
    return payload;
  }
  return payload.slice(prefixIndex + 1, suffixIndex);
};

const findColumnIndex = (columns, candidates) => {
  if (!Array.isArray(columns) || !columns.length) return -1;
  const normalizedColumns = columns.map((col) => normalizeLabel(col?.label || col?.id || ''));
  for (const candidate of candidates) {
    const target = normalizeLabel(candidate);
    if (!target) continue;
    const index = normalizedColumns.findIndex((col) => col.includes(target));
    if (index !== -1) {
      return index;
    }
  }
  return -1;
};

const parseInventorySheet = (text) => {
  const wrapped = stripVisualizationWrapper(text);
  const parsed = JSON.parse(wrapped);
  const table = parsed?.table ?? {};
  const columns = table.cols || [];
  const rows = table.rows || [];

  const colIndexes = {
    storeCode: findColumnIndex(columns, COLUMN_MATCHERS.storeCode),
    storeName: findColumnIndex(columns, COLUMN_MATCHERS.storeName),
    productCode: findColumnIndex(columns, COLUMN_MATCHERS.productCode),
    masterCode: findColumnIndex(columns, COLUMN_MATCHERS.masterCode),
    description: findColumnIndex(columns, COLUMN_MATCHERS.description),
    stockQty: findColumnIndex(columns, COLUMN_MATCHERS.stockQty),
    stockCost: findColumnIndex(columns, COLUMN_MATCHERS.stockCost),
  };

  if (colIndexes.productCode === -1 || colIndexes.storeCode === -1) {
    throw new Error('SuperMarket inventory sheet is missing required columns.');
  }

  const result = {};
  rows.forEach((row) => {
    const cells = Array.isArray(row?.c) ? row.c : [];

    const storeCodeRaw = colIndexes.storeCode !== -1 ? safeCellValue(cells[colIndexes.storeCode]) : null;
    const productCodeRaw = colIndexes.productCode !== -1 ? safeCellValue(cells[colIndexes.productCode]) : null;
    const masterCodeRaw = colIndexes.masterCode !== -1 ? safeCellValue(cells[colIndexes.masterCode]) : null;

    const storeCode = sanitizeText(storeCodeRaw);
    const productCode = sanitizeText(productCodeRaw);
    if (!storeCode || !productCode) {
      return;
    }

    const normalizedStoreCode = normalizeCode(storeCode);
    const normalizedProductCode = normalizeCode(productCode);

    const key = `${normalizedStoreCode || storeCode}_${normalizedProductCode || productCode}`;

    result[key] = {
      storeCode,
      storeCodeNormalized: normalizedStoreCode,
      storeName: sanitizeText(colIndexes.storeName !== -1 ? safeCellValue(cells[colIndexes.storeName]) : null),
      productCode,
      productCodeNormalized: normalizedProductCode,
      masterCode: sanitizeText(masterCodeRaw),
      description: sanitizeText(colIndexes.description !== -1 ? safeCellValue(cells[colIndexes.description]) : null),
      stockQty: parseNumber(colIndexes.stockQty !== -1 ? safeCellValue(cells[colIndexes.stockQty]) : null),
      stockCost: parseNumber(colIndexes.stockCost !== -1 ? safeCellValue(cells[colIndexes.stockCost]) : null),
    };
  });

  return result;
};

export async function getInventoryData(forceRefresh = false) {
  try {
    if (!forceRefresh) {
      const cachedValue = await AsyncStorage.getItem(CACHE_KEY);
      if (cachedValue) {
        try {
          const parsed = JSON.parse(cachedValue);
          if (parsed?.expiresAt && parsed.expiresAt > Date.now() && parsed?.data) {
            return parsed.data;
          }
        } catch {
          // ignore parsing errors and refresh cache
        }
      }
    }

    const response = await fetch(SUPERMARKET_INVENTORY_SHEET_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch inventory sheet: HTTP ${response.status}`);
    }
    const text = await response.text();
    const data = parseInventorySheet(text);

    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        lastFetched: Date.now(),
        expiresAt: Date.now() + CACHE_DURATION,
        data,
      })
    );

    return data;
  } catch (error) {
    console.warn('Failed to load supermarket inventory data', error);
    throw error;
  }
}

export async function getStoreInventory(storeCode, { forceRefresh = false } = {}) {
  const data = await getInventoryData(forceRefresh);
  if (!storeCode || !data) {
    return {};
  }
  const target = normalizeCode(storeCode);
  const result = {};

  Object.values(data).forEach((entry) => {
    if (!entry) return;
    const entryStoreCode = entry.storeCodeNormalized || normalizeCode(entry.storeCode);
    if (entryStoreCode && entryStoreCode === target) {
      result[entry.productCode] = entry;
    }
  });

  return result;
}

export async function clearSupermarketInventoryCache() {
  await AsyncStorage.removeItem(CACHE_KEY);
}
