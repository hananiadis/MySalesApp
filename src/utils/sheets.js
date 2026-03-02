// /src/utils/sheets.js
// Lightweight spreadsheet fetcher with 24h TTL + checksum guard
// Used by /src/services/spreadsheetCache.js
//
// API:
//   fetchSpreadsheetData(url, { force?: boolean })
//     -> { rowsText: string|null, refreshed: boolean, meta: { url, lastFetchedAt, checksum } }
//   parseCSV(text) -> string[][]

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPermanentMeta, setPermanentMeta } from './permanentMetaStorage';

const SHEET_META_PREFIX = 'sheetmeta'; // AsyncStorage key prefix

const k = (...parts) => parts.join(':');
const metaKey = ({ sheetKey, url }) => k(SHEET_META_PREFIX, sheetKey || url);

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

function computeExpiresAt(lastFetchedAt, ttlHours, permanent) {
  if (permanent || !lastFetchedAt || !Number.isFinite(ttlHours)) return null;
  const expires = new Date(new Date(lastFetchedAt).getTime() + ttlHours * 36e5);
  return expires.toISOString();
}

async function getSheetMeta({ sheetKey, url, isPermanent }) {
  // For permanent sheets, use file storage; for cache sheets, use AsyncStorage
  if (isPermanent) {
    const fileMeta = await getPermanentMeta(sheetKey);
    if (fileMeta) {
      console.log(`[getSheetMeta] Loaded permanent meta for ${sheetKey} from file`);
      return fileMeta;
    }
    return null;
  }

  // Try sheetKey first, fallback to URL (for cache sheets in AsyncStorage)
  const keysToTry = [];
  if (sheetKey) keysToTry.push(k(SHEET_META_PREFIX, sheetKey));
  if (url) keysToTry.push(k(SHEET_META_PREFIX, url));
  
  for (const key of keysToTry) {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (err) {
      console.warn(`[getSheetMeta] Error reading ${key}:`, err.message);
    }
  }
  return null;
}

async function setSheetMeta({ sheetKey, url, meta }) {
  // Always use current timestamp when setting metadata (force refresh should show fresh time)
  const lastFetchedAt = new Date().toISOString();
  const ttlHours = Number.isFinite(meta?.ttlHours) ? meta.ttlHours : null;
  const permanent = Boolean(meta?.permanent);
  const payload = {
    url,
    sheetKey: sheetKey || null,
    lastFetchedAt,
    checksum: meta?.checksum || null,
    ttlHours,
    permanent,
    expiresAt: computeExpiresAt(lastFetchedAt, ttlHours, permanent),
    sizeBytes: meta?.sizeBytes ?? null,
  };

  // For permanent sheets, use file storage
  if (permanent && sheetKey) {
    try {
      await setPermanentMeta(sheetKey, payload);
      console.log(`[setSheetMeta] ✓ Permanent sheet ${sheetKey} stored to file`, { lastFetchedAt });
      return payload;
    } catch (err) {
      console.warn(`[setSheetMeta] Failed to store permanent meta for ${sheetKey}:`, err.message);
      return payload;
    }
  }

  // For cache sheets, use AsyncStorage (now without large sheetdata competing)
  const primaryKey = sheetKey ? k(SHEET_META_PREFIX, sheetKey) : (url ? k(SHEET_META_PREFIX, url) : null);
  const secondaryKey = sheetKey && url ? k(SHEET_META_PREFIX, url) : null;

  if (primaryKey) {
    try {
      await AsyncStorage.setItem(primaryKey, JSON.stringify(payload));
      console.log(`[setSheetMeta] Stored metadata (primary) for key: ${primaryKey.substring(0, 60)}...`, { lastFetchedAt: payload.lastFetchedAt, ttlHours: payload.ttlHours, permanent: payload.permanent });
      return payload;
    } catch (err) {
      console.warn(`[setSheetMeta] Primary store failed: ${primaryKey}`, err.message);
      // If DB is full, attempt to free space and retry once
      if (String(err.message || '').toLowerCase().includes('full')) {
        console.log('[setSheetMeta] Storage full, attempting to free space...');
        const freed = await freeSpaceForMeta();
        console.log(`[setSheetMeta] Freed ${freed} keys, now retrying...`);
        
        if (freed > 0) {
          try {
            await AsyncStorage.setItem(primaryKey, JSON.stringify(payload));
            console.log(`[setSheetMeta] ✓ Retry after free succeeded for ${primaryKey.substring(0, 60)}...`, { lastFetchedAt: payload.lastFetchedAt });
            return payload;
          } catch (retryErr) {
            console.warn(`[setSheetMeta] ✗ Retry after free failed for ${primaryKey.substring(0, 60)}...`, retryErr.message);
            return payload;
          }
        } else {
          console.warn('[setSheetMeta] No keys freed, metadata not saved');
          return payload;
        }
      }
      // Try secondary only if not FULL error
      if (secondaryKey) {
        try {
          await AsyncStorage.setItem(secondaryKey, JSON.stringify(payload));
          console.log(`[setSheetMeta] Stored metadata (secondary) for key: ${secondaryKey.substring(0, 60)}...`, { lastFetchedAt: payload.lastFetchedAt });
          return payload;
        } catch (err2) {
          console.warn(`[setSheetMeta] Secondary store failed: ${secondaryKey}`, err2.message);
          return payload;
        }
      }
      return payload;
    }
  }

  // If no primary key, try URL-only
  if (!primaryKey && secondaryKey) {
    try {
      await AsyncStorage.setItem(secondaryKey, JSON.stringify(payload));
      console.log(`[setSheetMeta] Stored metadata (url-only) for key: ${secondaryKey.substring(0, 60)}...`, { lastFetchedAt: payload.lastFetchedAt });
    } catch (err3) {
      console.warn(`[setSheetMeta] URL-only store failed: ${secondaryKey}`, err3.message);
    }
  }

  return payload;
}

// Attempt to free AsyncStorage space by removing large cached payloads
// Returns count of removed keys
async function freeSpaceForMeta() {
  try {
    // Target largest sheets first (sales2025, orders2025, sales2024, orders2024)
    const targetKeys = [
      'sheetdata:sales2025',
      'sheetdata:orders2025',
      'sheetdata:sales2024',
      'sheetdata:orders2024',
      'sheetcache:playmobilSales',
      'sheetcache:playmobilStock',
    ];
    
    // Try removing targets first, no need to getAllKeys
    const toRemove = [];
    for (const key of targetKeys) {
      try {
        const item = await AsyncStorage.getItem(key);
        if (item) toRemove.push(key);
      } catch {
        // Ignore check errors
      }
    }
    
    if (toRemove.length) {
      await AsyncStorage.multiRemove(toRemove);
      console.warn('[sheets.freeSpaceForMeta] Removed target keys to free space:', toRemove.length, toRemove);
      return toRemove.length;
    }
    
    // Fallback: get all keys and remove any sheetdata/sheetcache (slower)
    const keys = await AsyncStorage.getAllKeys();
    const candidates = keys.filter((key) => key.startsWith('sheetdata:') || key.startsWith('sheetcache:'));
    if (candidates.length > 0) {
      const batch = candidates.slice(0, 10);
      await AsyncStorage.multiRemove(batch);
      console.warn('[sheets.freeSpaceForMeta] Removed fallback keys:', batch.length, batch);
      return batch.length;
    }
    
    return 0;
  } catch (err) {
    console.warn('[sheets.freeSpaceForMeta] Failed to free space:', err?.message || err);
    return 0;
  }
}

export async function clearAllSpreadsheetMeta() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const metaKeys = keys.filter((key) => key.startsWith(SHEET_META_PREFIX));
    if (metaKeys.length) {
      await AsyncStorage.multiRemove(metaKeys);
    }
    console.log(`[clearAllSpreadsheetMeta] Removed ${metaKeys.length} meta entries`);
    return { removed: metaKeys.length };
  } catch (err) {
    console.warn('[clearAllSpreadsheetMeta] Failed:', err.message);
    return { removed: 0 };
  }
}

/**
 * Fetches a Google Sheet (CSV or gviz or any text endpoint) with 24h TTL + checksum.
 * - If force=false and the cached meta is <24h & checksum unchanged → returns { refreshed:false }.
 * - If refreshed, returns rowsText and updates meta.
 */
export async function fetchSpreadsheetData(sheetUrl, {
  force = false,
  ttlHours = 24,
  sheetKey = null,
  permanent = false,
  // downloadOptions reserved for future chunked/resume strategies
  downloadOptions = null,
} = {}) {
  const resolvedTtl = Number.isFinite(ttlHours) && ttlHours > 0 ? ttlHours : 24;
  const meta = await getSheetMeta({ sheetKey, url: sheetUrl, isPermanent: permanent });

  const cachedAgeIsStale = meta ? hoursSince(meta.lastFetchedAt) >= resolvedTtl : true;
  const hasCache = Boolean(meta?.lastFetchedAt);
  const shouldRefetch = force || !hasCache || (!permanent && cachedAgeIsStale);

  if (!shouldRefetch) {
    console.log('[fetchSpreadsheetData] Using cached (not stale), refreshed=false');
    const expiresAt = computeExpiresAt(meta.lastFetchedAt, resolvedTtl, permanent);
    return { rowsText: null, refreshed: false, meta: { ...meta, ttlHours: resolvedTtl, permanent, expiresAt } };
  }

  console.log(`[fetchSpreadsheetData] Fetching ${sheetUrl.substring(0, 80)}...`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(sheetUrl, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      console.error(`[fetchSpreadsheetData] HTTP ${res.status} for ${sheetUrl}`);
      throw new Error(`Sheet fetch failed (${res.status})`);
    }

    const rowsText = await res.text();
    console.log(`[fetchSpreadsheetData] Fetched ${rowsText.length} chars`);
    const checksum = textChecksum(rowsText);

    // If checksum unchanged and data is within TTL and NOT forced, treat as not refreshed
    if (!force && hasCache && !permanent && meta && meta.checksum === checksum && hoursSince(meta.lastFetchedAt) < resolvedTtl) {
      console.log('[fetchSpreadsheetData] Checksum unchanged, refreshed=false');
      const expiresAt = computeExpiresAt(meta.lastFetchedAt, resolvedTtl, permanent);
      return { rowsText: null, refreshed: false, meta: { ...meta, ttlHours: resolvedTtl, permanent, expiresAt } };
    }

    // If force=true OR checksum changed OR stale, always update metadata with fresh timestamp
    // Even if content unchanged, update lastFetchedAt when force=true so UI shows fresh timestamp
    const newMeta = await setSheetMeta({
      sheetKey,
      url: sheetUrl,
      meta: {
        checksum,
        ttlHours: resolvedTtl,
        permanent,
        sizeBytes: rowsText.length,
      },
    });
    console.log(`[fetchSpreadsheetData] Success, refreshed=true, force=${force}, checksum=${checksum.substring(0, 8)}...`);
    return { rowsText, refreshed: true, meta: newMeta };
  } catch (error) {
    clearTimeout(timer);
    console.error('[fetchSpreadsheetData] Fetch error:', error.message);
    throw error;
  }
}

export async function getSpreadsheetMetaEntry({ sheetKey = null, url, ttlHours = null, permanent = null }) {
  const resolvedPermanent = permanent !== null ? permanent : (sheetKey ? (await getPermanentMeta(sheetKey)) !== null : false);
  const meta = await getSheetMeta({ sheetKey, url, isPermanent: resolvedPermanent });
  if (!meta) return null;

  const resolvedTtl = Number.isFinite(ttlHours) && ttlHours > 0
    ? ttlHours
    : (Number.isFinite(meta.ttlHours) ? meta.ttlHours : 24);

  return {
    ...meta,
    ttlHours: resolvedPermanent ? null : resolvedTtl,
    permanent: resolvedPermanent,
    expiresAt: computeExpiresAt(meta.lastFetchedAt, resolvedTtl, resolvedPermanent),
  };
}

export async function clearSpreadsheetMeta({ sheetKey = null, url }) {
  const keys = new Set();
  if (sheetKey) keys.add(metaKey({ sheetKey }));
  if (url) keys.add(metaKey({ url }));
  if (!keys.size) return false;
  try {
    await AsyncStorage.multiRemove(Array.from(keys));
    return true;
  } catch {
    return false;
  }
}

/**
 * Minimal CSV parser (handles quotes and commas/semicolons in quotes).
 * Auto-detects delimiter (comma or semicolon) from first line.
 * Returns an array of rows, each row = array of string cells.
 */
export function parseCSV(text) {
  // Auto-detect delimiter from first line (before first newline)
  const firstLineEnd = text.indexOf('\n');
  const sampleLine = firstLineEnd > 0 ? text.substring(0, firstLineEnd) : text;
  
  // Count commas and semicolons outside quotes in first line
  let commaCount = 0, semiCount = 0, inQuote = false;
  for (let j = 0; j < sampleLine.length; j++) {
    if (sampleLine[j] === '"') inQuote = !inQuote;
    else if (!inQuote) {
      if (sampleLine[j] === ',') commaCount++;
      else if (sampleLine[j] === ';') semiCount++;
    }
  }
  
  // Choose delimiter with higher count (default to comma if tied)
  const delimiter = semiCount > commaCount ? ';' : ',';
  console.log(`[parseCSV] Detected delimiter: "${delimiter}" (commas: ${commaCount}, semicolons: ${semiCount})`);

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
    if (c === delimiter) { row.push(field); field = ''; i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); field = ''; row = []; i++; continue; }
    if (c === '\r') { i++; continue; }

    field += c; i++;
  }

  row.push(field);
  rows.push(row);
  
  console.log(`[parseCSV] Parsed ${rows.length} rows, first row has ${rows[0]?.length || 0} columns`);
  return rows;
}
