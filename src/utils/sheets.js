// /src/utils/sheets.js
// Lightweight spreadsheet fetcher with 24h TTL + checksum guard
// Used by /src/services/spreadsheetCache.js
//
// API:
//   fetchSpreadsheetData(url, { force?: boolean })
//     -> { rowsText: string|null, refreshed: boolean, meta: { url, lastFetchedAt, checksum } }
//   parseCSV(text) -> string[][]

import AsyncStorage from '@react-native-async-storage/async-storage';

const SHEET_META_PREFIX = 'sheetmeta'; // AsyncStorage key prefix

const k = (...parts) => parts.join(':');

function textChecksum(s) {
  // Simple fast checksum (non-crypto)
  let hash = 0, i, chr;
  if (!s || s.length === 0) return '0';
  for (i = 0; i < s.length; i++) {
    chr = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return String(hash);
}

function hoursSince(iso) {
  if (!iso) return Infinity;
  const then = new Date(iso).getTime();
  const now = Date.now();
  return (now - then) / 36e5;
}

async function getSheetMeta(url) {
  try {
    const raw = await AsyncStorage.getItem(k(SHEET_META_PREFIX, url));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function setSheetMeta(url, meta) {
  const payload = {
    url,
    lastFetchedAt: meta?.lastFetchedAt || new Date().toISOString(),
    checksum: meta?.checksum || null,
  };
  try {
    await AsyncStorage.setItem(k(SHEET_META_PREFIX, url), JSON.stringify(payload));
  } catch {
    // ignore storage failures
  }
  return payload;
}

/**
 * Fetches a Google Sheet (CSV or gviz or any text endpoint) with 24h TTL + checksum.
 * - If force=false and the cached meta is <24h & checksum unchanged → returns { refreshed:false }.
 * - If refreshed, returns rowsText and updates meta.
 */
export async function fetchSpreadsheetData(sheetUrl, { force = false } = {}) {
  const meta = await getSheetMeta(sheetUrl);
  const shouldRefetch =
    force || !meta || !meta.lastFetchedAt || hoursSince(meta.lastFetchedAt) >= 24;

  if (!shouldRefetch) {
    return { rowsText: null, refreshed: false, meta };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  const res = await fetch(sheetUrl, { signal: controller.signal });
  clearTimeout(timer);

  if (!res.ok) {
    throw new Error(`Sheet fetch failed (${res.status})`);
  }

  const rowsText = await res.text();
  const checksum = textChecksum(rowsText);

  // If checksum unchanged and last fetch <24h, treat as not refreshed
  if (meta && meta.checksum === checksum && hoursSince(meta.lastFetchedAt) < 24) {
    return { rowsText: null, refreshed: false, meta };
  }

  const newMeta = await setSheetMeta(sheetUrl, { checksum });
  return { rowsText, refreshed: true, meta: newMeta };
}

/**
 * Minimal CSV parser (handles quotes and commas in quotes).
 * Returns an array of rows, each row = array of string cells.
 */
export function parseCSV(text) {
  const rows = [];
  let i = 0, field = '', row = [], insideQuotes = false;

  while (i < text.length) {
    const c = text[i];

    if (insideQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        insideQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }

    if (c === '"') { insideQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); field = ''; row = []; i++; continue; }
    if (c === '\r') { i++; continue; }

    field += c; i++;
  }

  row.push(field);
  rows.push(row);
  return rows;
}
