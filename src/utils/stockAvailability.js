// src/utils/stockAvailability.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const SHEET_ID = '1VG7QzMgj0Ib0jNXZM5dLFgDyyer8gvSmkkaVZzMZcEM';
const SHEET_NAME = 'Sheet1';
const HEADER_RANGE = 'A2:U2';
const DATA_RANGE = 'A3:U';

const GVIZ_PREFIX = 47;
const STORAGE_KEY = 'immediate_stock_map_v4';

function normalizeCode(value) {
  if (value == null) return '';
  const str = String(value).trim();
  if (!str) return '';
  if (/^\d+\.0+$/.test(str)) return str.replace(/\.0+$/, '');
  return str;
}

function generateCodeVariants(value) {
  const variants = new Set();
  if (value == null) return variants;
  const raw = String(value).trim();
  if (raw) variants.add(raw);
  const normalized = normalizeCode(value);
  if (normalized) variants.add(normalized);
  const digits = normalized || raw;
  if (digits && /^\d+$/.test(digits)) variants.add(`${digits}.0`);
  const rawDigits = raw && /^\d+$/.test(raw) ? raw : null;
  if (rawDigits) variants.add(`${rawDigits}.0`);
  return Array.from(variants).filter(Boolean);
}

function addToMapWithVariants(map, code, value) {
  if (value == null || value === '') return;
  const variants = generateCodeVariants(code);
  for (const key of variants) {
    map.set(key, value);
  }
}
function parseSheetJSON(text = '') {
  try {
    const trimmed = text.substring(GVIZ_PREFIX, text.length - 2);
    const json = JSON.parse(trimmed);
    const rows = json?.table?.rows || [];
    return rows.map((row) => row.c.map((cell) => (cell ? cell.v : '')));
  } catch (e) {
    return [];
  }
}

function normalizeHeader(value) {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

const IMMEDIATE_MATCHES = [
  'amesa diathesima',
  'amesa diathesima (gia paraggelies pros amesi ektelesi)',
  'Î±Î¼ÎµÏƒÎ± Î´Î¹Î±Î¸ÎµÏƒÎ¹Î¼Î±',
  'Î±Î¼ÎµÏƒÎ± Î´Î¹Î±Î¸ÎµÏƒÎ¹Î¼Î± (Î³Î¹Î± Ï€Î±ÏÎ±Î³Î³ÎµÎ»Î¹ÎµÏ‚ Ï€ÏÎ¿Ï‚ Î±Î¼ÎµÏƒÎ· ÎµÎºÏ„ÎµÎ»ÎµÏƒÎ·)',
  'Î±Î¼ÎµÏƒÎ± Î´Î¹Î±Î¸Î­ÏƒÎ¹Î¼Î±',
  'Î±Î¼ÎµÏƒÎ± Î´Î¹Î±Î¸ÎµÏƒÎ¹Î¼Î¿',
];

let memoryMap = null;
let pendingPromise = null;

async function fetchRange(range) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}&range=${range}`;
  const response = await fetch(url);
  return response.text();
}

function mapToObject(map) {
  return Object.fromEntries(Array.from(map.entries()));
}

function objectToMap(obj) {
  if (!obj || typeof obj !== 'object') return new Map();
  return new Map(Object.entries(obj));
}

async function fetchImmediateMapFromNetwork() {
  const [headerText, dataText] = await Promise.all([
    fetchRange(HEADER_RANGE),
    fetchRange(DATA_RANGE),
  ]);
  const headerRows = parseSheetJSON(headerText);
  const dataRows = parseSheetJSON(dataText);
  if (!headerRows.length) return new Map();
  const headerRow = headerRows[0];

  let productCodeIndex = headerRow.findIndex(
    (h) => typeof h === 'string' && normalizeHeader(h).includes('product code'),
  );
  if (productCodeIndex < 0) productCodeIndex = 1;

  let immediateIndex = headerRow.findIndex((header) => {
    const normalized = normalizeHeader(header);
    return IMMEDIATE_MATCHES.some((match) => normalized.includes(match));
  });

  if (immediateIndex < 0) immediateIndex = 13; // Column N (zero-based index)

  if (immediateIndex < 0 || immediateIndex >= headerRow.length) return new Map();

  const map = new Map();
  for (const row of dataRows) {
    const code = row?.[productCodeIndex];
    addToMapWithVariants(map, code, row?.[immediateIndex]);
  }
  return map;
}

async function readMapFromStorage() {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return new Map();
    const obj = JSON.parse(stored);
    return objectToMap(obj);
  } catch {
    return new Map();
  }
}

async function writeMapToStorage(map) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(mapToObject(map)));
  } catch {
    // ignore storage failures
  }
}

export async function cacheImmediateAvailabilityMap(force = false) {
  const map = await fetchImmediateMapFromNetwork();
  memoryMap = map;
  await writeMapToStorage(map);
  return map;
}

export async function getImmediateAvailabilityMap({ forceRefresh = false } = {}) {
  if (forceRefresh) {
    return cacheImmediateAvailabilityMap(true);
  }

  if (memoryMap) return memoryMap;
  if (pendingPromise) return pendingPromise;

  const fromStorage = await readMapFromStorage();
  if (fromStorage.size) {
    memoryMap = fromStorage;
    return memoryMap;
  }

  pendingPromise = (async () => {
    try {
      const map = await fetchImmediateMapFromNetwork();
      memoryMap = map;
      await writeMapToStorage(map);
      return map;
    } finally {
      pendingPromise = null;
    }
  })();

  return pendingPromise;
}

export async function loadImmediateAvailabilityFromCache() {
  if (memoryMap) return memoryMap;
  const map = await readMapFromStorage();
  memoryMap = map;
  return map;
}


export function lookupImmediateStockValue(map, code) {
  if (!map || typeof map.has !== 'function') return null;
  const variants = generateCodeVariants(code);
  for (const key of variants) {
    if (key && map.has(key)) {
      const value = map.get(key);
      if (value != null && value !== '') return value;
    }
  }
  return null;
}

export async function getImmediateStockValue(code, { fallbackToNetwork = true } = {}) {
  let map = await getImmediateAvailabilityMap();
  let value = lookupImmediateStockValue(map, code);
  if (value != null || !fallbackToNetwork) return value;
  map = await cacheImmediateAvailabilityMap(true);
  return lookupImmediateStockValue(map, code);
}

export function normalizeStockCode(value) {
  return normalizeCode(value);
}


