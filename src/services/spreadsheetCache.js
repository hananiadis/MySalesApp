// /src/services/spreadsheetCache.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { fetchSpreadsheetData, parseCSV, getSpreadsheetMetaEntry, clearSpreadsheetMeta, clearAllSpreadsheetMeta } from '../utils/sheets';
import { SPREADSHEETS } from '../config/spreadsheets';

const DATA_PREFIX = 'sheetdata';
const CACHE_DIR = `${FileSystem.documentDirectory}spreadsheet-cache/`;
const inflightLoads = new Map();
let cacheDirInitialized = false;
let asyncStorageCleanedUp = false;

// One-time cleanup: remove large sheetdata entries that are blocking new metadata writes
async function cleanupOldSheetdata() {
  if (asyncStorageCleanedUp) return;
  asyncStorageCleanedUp = true;
  
  try {
    console.log('[spreadsheetCache] Cleaning up old sheetdata entries...');
    const keysToRemove = [
      'sheetdata:sales2025',
      'sheetdata:orders2025',
      'sheetdata:sales2024',
      'sheetdata:orders2024',
      'sheetdata:playmobilSales',
      'sheetdata:playmobilStock',
    ];
    
    let removed = 0;
    for (const key of keysToRemove) {
      try {
        const item = await AsyncStorage.getItem(key);
        if (item) {
          await AsyncStorage.removeItem(key);
          const sizeKB = Math.round((item.length || 0) / 1024);
          console.log(`[spreadsheetCache] Cleared ${key} (${sizeKB} KB)`);
          removed++;
        }
      } catch (e) {
        // Ignore individual removal errors
      }
    }
    
    if (removed > 0) {
      console.log(`[spreadsheetCache] ✓ Cleaned up ${removed} sheetdata entries`);
    }
  } catch (error) {
    console.warn('[spreadsheetCache] Cleanup failed:', error.message);
  }
}

// Ensure cache directory exists (runs once per session)
async function ensureCacheDir() {
  if (cacheDirInitialized) return;
  
  try {
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
      console.log('[spreadsheetCache] Created cache directory:', CACHE_DIR);
    }
    cacheDirInitialized = true;
    // Also clean up old AsyncStorage entries on first cache dir check
    await cleanupOldSheetdata();
  } catch (error) {
    console.warn('[spreadsheetCache] Cannot create cache directory:', error.message);
    cacheDirInitialized = true; // Mark as attempted to avoid repeated failures
  }
}

export async function clearAllMetaEntries() {
  try {
    const res = await clearAllSpreadsheetMeta();
    return res;
  } catch (err) {
    console.warn('[spreadsheetCache.clearAllMetaEntries] Failed:', err.message);
    return { removed: 0 };
  }
}
/**
 * Fetch and cache a spreadsheet with per-key deduping to avoid thundering herds.
 */
export function loadSpreadsheet(key, options = {}) {
  const force = Boolean(options?.force);
  const inflightKey = `${key}:${force ? '1' : '0'}`;
  if (inflightLoads.has(inflightKey)) {
    return inflightLoads.get(inflightKey);
  }

  const promise = loadSpreadsheetUncached(key, { force }).finally(() => {
    inflightLoads.delete(inflightKey);
  });

  inflightLoads.set(inflightKey, promise);
  return promise;
}

/**
 * Fetch and cache a spreadsheet.
 * Returns parsed rows (array of arrays for CSV, or JSON payload for gviz).
 */
async function loadSpreadsheetUncached(key, { force = false } = {}) {
  try {
    const entry = SPREADSHEETS[key];
    if (!entry) throw new Error(`Unknown spreadsheet key: ${key}`);

    const { url, type, keepColumns, ttlHours, permanent } = entry;
    console.log(`[loadSpreadsheet] Loading ${key}, force=${force}, type=${type}, keepColumns=${keepColumns?.length || 'all'}`);

    await ensureCacheDir();
    const cacheFilePath = `${CACHE_DIR}${key}.json`;

    // 1️⃣ try to fetch (or skip if fresh/permanent)
    const { rowsText, refreshed } = await fetchSpreadsheetData(url, {
      force,
      ttlHours,
      sheetKey: key,
      permanent,
    });
    console.log(`[loadSpreadsheet] ${key} - refreshed=${refreshed}, hasText=${!!rowsText}`);

    // 2️⃣ if not refreshed, return cached data from file storage
    if (!refreshed) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(cacheFilePath);
        if (fileInfo.exists) {
          const stored = await FileSystem.readAsStringAsync(cacheFilePath);
          console.log(`[loadSpreadsheet] ${key} - using cached file, size=${fileInfo.size} bytes`);
          return JSON.parse(stored);
        }
      } catch (fileError) {
        console.warn(`[loadSpreadsheet] ${key} - cannot read cache file:`, fileError.message);
      }
      
      // Fallback to AsyncStorage if file doesn't exist
      try {
        const stored = await AsyncStorage.getItem(`${DATA_PREFIX}:${key}`);
        if (stored) {
          console.log(`[loadSpreadsheet] ${key} - using AsyncStorage fallback`);
          return JSON.parse(stored);
        }
      } catch (storageError) {
        console.warn(`[loadSpreadsheet] ${key} - AsyncStorage fallback failed:`, storageError.message);
      }
      
      return null;
    }

    // 3️⃣ parse and store
    if (!rowsText) {
      console.warn(`[loadSpreadsheet] ${key} - refreshed but no rowsText!`);
      return null;
    }

    let parsed;
    if (type === 'csv') {
      parsed = parseCSV(rowsText);
      console.log(`[loadSpreadsheet] ${key} - parsed CSV, rows=${parsed?.length || 0}`);
      
      // Filter columns if keepColumns is specified
      // Keep original indices but set unwanted columns to null to reduce size
      if (keepColumns && Array.isArray(keepColumns) && parsed && parsed.length > 0) {
        const keepSet = new Set(keepColumns);
        const maxCol = Math.max(...keepColumns);
        
        // Calculate original size more safely for large datasets
        const originalRowCount = parsed.length;
        
        parsed = parsed.map(row => {
          if (!Array.isArray(row)) return row;
          const filtered = new Array(maxCol + 1);
          for (let i = 0; i <= maxCol; i++) {
            filtered[i] = keepSet.has(i) ? (row[i] !== undefined ? row[i] : null) : null;
          }
          return filtered;
        });
        
        console.log(`[loadSpreadsheet] ${key} - filtered columns from ${originalRowCount} rows, keeping columns: ${keepColumns.join(',')}`);
      }
    } else if (type === 'gviz') {
      parsed = rowsText; // raw text → let caller parse gviz JSON (they already do)
    } else {
      parsed = rowsText;
    }

    // Try to save to file storage
    try {
      // For large datasets, use streaming approach to avoid stack overflow
      let jsonString;
      
      if (Array.isArray(parsed) && parsed.length > 1000) {
        // Large dataset: build JSON string manually to avoid deep recursion
        console.log(`[loadSpreadsheet] ${key} - large dataset (${parsed.length} rows), using manual JSON serialization`);
        
        const parts = ['['];
        for (let i = 0; i < parsed.length; i++) {
          if (i > 0) parts.push(',');
          
          const row = parsed[i];
          if (Array.isArray(row)) {
            // Manually serialize array to avoid JSON.stringify deep recursion
            parts.push('[');
            for (let j = 0; j < row.length; j++) {
              if (j > 0) parts.push(',');
              const cell = row[j];
              if (cell === null || cell === undefined) {
                parts.push('null');
              } else if (typeof cell === 'string') {
                // Escape quotes and backslashes
                parts.push('"' + cell.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"');
              } else if (typeof cell === 'number' || typeof cell === 'boolean') {
                parts.push(String(cell));
              } else {
                parts.push('null');
              }
            }
            parts.push(']');
          } else {
            parts.push('null');
          }
        }
        parts.push(']');
        
        jsonString = parts.join('');
      } else {
        // Normal dataset: use standard stringify
        try {
          jsonString = JSON.stringify(parsed);
        } catch (stringifyError) {
          console.warn(`[loadSpreadsheet] ${key} - JSON.stringify failed, using fallback:`, stringifyError.message);
          // If stringify fails even on small dataset, skip caching but return data
          return parsed;
        }
      }
      
      try {
        await FileSystem.writeAsStringAsync(cacheFilePath, jsonString);
        console.log(`[loadSpreadsheet] ${key} - saved to file cache (${jsonString.length} bytes, ${parsed.length || 0} rows)`);
        
        // Clean up old AsyncStorage entry if exists
        try {
          await AsyncStorage.removeItem(`${DATA_PREFIX}:${key}`);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      } catch (writeError) {
        // Catch all write errors including stack overflow (swallow and continue)
        if (String(writeError?.message || '').toLowerCase().includes('stack')) {
          console.warn(`[loadSpreadsheet] ${key} - stack overflow on file write, data still in memory`);
        } else {
          console.warn(`[loadSpreadsheet] ${key} - file write error:`, writeError?.message);
        }
      }
    } catch (fileError) {
      console.warn(`[loadSpreadsheet] ${key} - failed to save to file cache:`, fileError.message);
      // Don't try AsyncStorage for large datasets, just return the data uncached
    }
    
    // Return parsed data regardless of storage success
    return parsed;
  } catch (error) {
    console.error(`[loadSpreadsheet] ERROR loading ${key}:`, error.message);
    
    // Try to return cached data from file or AsyncStorage
    const cacheFilePath = `${CACHE_DIR}${key}.json`;
    try {
      const fileInfo = await FileSystem.getInfoAsync(cacheFilePath);
      if (fileInfo.exists) {
        const stored = await FileSystem.readAsStringAsync(cacheFilePath);
        console.log(`[loadSpreadsheet] ${key} - returning cached file after error`);
        return JSON.parse(stored);
      }
    } catch (fileError) {
      console.warn(`[loadSpreadsheet] ${key} - cannot read cache file:`, fileError.message);
    }
    
    try {
      const stored = await AsyncStorage.getItem(`${DATA_PREFIX}:${key}`);
      if (stored) {
        console.log(`[loadSpreadsheet] ${key} - returning AsyncStorage data after error`);
        return JSON.parse(stored);
      }
    } catch (storageError) {
      console.error(`[loadSpreadsheet] ${key} - cannot read any cache:`, storageError.message);
    }
    
    return null;
  }
}

const hoursSince = (iso) => {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  return (Date.now() - then) / 36e5;
};

export async function getSpreadsheetMeta(key) {
  console.log(`[spreadsheetCache.getSpreadsheetMeta] START for key: ${key}`);
  const entry = SPREADSHEETS[key];
  if (!entry) {
    console.log(`[spreadsheetCache.getSpreadsheetMeta] No entry found for ${key}`);
    return null;
  }

  const { url, ttlHours, permanent } = entry;
  
  let meta = null;
  try {
    meta = await getSpreadsheetMetaEntry({ sheetKey: key, url, ttlHours, permanent });
  } catch (metaErr) {
    console.warn(`[getSpreadsheetMeta] Error getting meta for ${key}:`, metaErr?.message);
  }
  
  // Only log if meta was successfully retrieved to reduce console spam
  if (meta) {
    console.log(`[spreadsheetCache.getSpreadsheetMeta] Meta retrieved for ${key}:`, {
      lastFetched: meta?.lastFetchedAt,
      expiresAt: meta?.expiresAt,
      permanent,
      ttlHours,
    });
  }

  // Skip file info retrieval to avoid stack overflow RangeErrors from FileSystem.getInfoAsync
  // File cache existence is verified separately during load/refresh operations

  const expiresInHours = meta?.expiresAt
    ? (new Date(meta.expiresAt).getTime() - Date.now()) / 36e5
    : null;

  return {
    key,
    url,
    ttlHours: permanent ? null : ttlHours,
    permanent: Boolean(permanent),
    meta,
    cacheFile: null,
    ageHours: meta?.lastFetchedAt ? hoursSince(meta.lastFetchedAt) : null,
    expiresInHours,
  };
}

let isListingMeta = false;

export async function listSpreadsheetMeta() {
  // Guard against concurrent/re-entrant calls
  if (isListingMeta) {
    console.log('[spreadsheetCache.listSpreadsheetMeta] Already in progress, returning early');
    return [];
  }
  
  isListingMeta = true;
  try {
    const keys = Object.keys(SPREADSHEETS);
    const results = [];
    
    // Sequential processing to avoid stack overflow and re-entrancy
    for (let i = 0; i < keys.length; i++) {
      try {
        const meta = await getSpreadsheetMeta(keys[i]);
        if (meta) {
          results.push(meta);
        }
      } catch (err) {
        console.warn(`[spreadsheetCache.listSpreadsheetMeta] Failed to get meta for ${keys[i]}:`, err.message);
      }
    }
    
    console.log('[spreadsheetCache.listSpreadsheetMeta] Completed for', keys.length, 'sheets');
    return results;
  } finally {
    isListingMeta = false;
  }
}

/**
 * Get cache storage statistics
 * Returns information about cache size and files
 */
export async function getCacheStats() {
  try {
    await ensureCacheDir();
    
    const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
    const stats = {
      totalFiles: files.length,
      totalSize: 0,
      files: [],
    };
    
    for (const file of files) {
      try {
        const filePath = `${CACHE_DIR}${file}`;
        const info = await FileSystem.getInfoAsync(filePath);
        
        if (info.exists && info.size) {
          stats.totalSize += info.size;
          stats.files.push({
            name: file,
            size: info.size,
            modificationTime: info.modificationTime,
          });
        }
      } catch (fileError) {
        console.warn(`[getCacheStats] Cannot read file ${file}:`, fileError.message);
      }
    }
    
    // Sort by size (largest first)
    stats.files.sort((a, b) => b.size - a.size);
    
    console.log(`[getCacheStats] Total: ${stats.totalFiles} files, ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
    return stats;
  } catch (error) {
    console.error('[getCacheStats] ERROR:', error.message);
    return { totalFiles: 0, totalSize: 0, files: [] };
  }
}

/**
 * Clear specific cached spreadsheet
 */
export async function clearCache(key) {
  try {
    await ensureCacheDir();
    const cacheFilePath = `${CACHE_DIR}${key}.json`;
    
    // Remove from file storage
    const fileInfo = await FileSystem.getInfoAsync(cacheFilePath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(cacheFilePath);
      console.log(`[clearCache] Deleted file cache for ${key}`);
    }
    
    // Remove from AsyncStorage (data + meta)
    await AsyncStorage.removeItem(`${DATA_PREFIX}:${key}`);
    await clearSpreadsheetMeta({ sheetKey: key, url: SPREADSHEETS[key]?.url });
    console.log(`[clearCache] Cleared cache for ${key}`);
    
    return true;
  } catch (error) {
    console.error(`[clearCache] ERROR clearing ${key}:`, error.message);
    return false;
  }
}

/**
 * Clear all cached spreadsheets
 */
export async function clearAllCache() {
  try {
    await ensureCacheDir();
    
    // Clear file storage
    const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
    let deletedFiles = 0;
    
    for (const file of files) {
      try {
        const filePath = `${CACHE_DIR}${file}`;
        await FileSystem.deleteAsync(filePath);
        deletedFiles++;
      } catch (fileError) {
        console.warn(`[clearAllCache] Cannot delete ${file}:`, fileError.message);
      }
    }
    
    // Clear AsyncStorage
    const allKeys = await AsyncStorage.getAllKeys();
    const dataKeys = allKeys.filter(key => key.startsWith(DATA_PREFIX));
    if (dataKeys.length > 0) {
      await AsyncStorage.multiRemove(dataKeys);
    }
    
    console.log(`[clearAllCache] Cleared ${deletedFiles} files and ${dataKeys.length} AsyncStorage entries`);
    return { filesDeleted: deletedFiles, storageKeysDeleted: dataKeys.length };
  } catch (error) {
    console.error('[clearAllCache] ERROR:', error.message);
    return { filesDeleted: 0, storageKeysDeleted: 0 };
  }
}

/**
 * Get list of all cached spreadsheet keys
 */
export async function getCachedKeys() {
  try {
    await ensureCacheDir();
    
    const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
    const keys = files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
    
    console.log(`[getCachedKeys] Found ${keys.length} cached spreadsheets`);
    return keys;
  } catch (error) {
    console.error('[getCachedKeys] ERROR:', error.message);
    return [];
  }
}

export async function refreshSpreadsheet(key) {
  try {
    console.log(`[spreadsheetCache.refreshSpreadsheet] START for key: ${key}`);
    const result = await loadSpreadsheet(key, { force: true });
    console.log(`[spreadsheetCache.refreshSpreadsheet] SUCCESS for key: ${key}, rows: ${Array.isArray(result) ? result.length : 'N/A'}`);
    // Debug: read back meta to verify timestamp update
    try {
      const metaAfter = await getSpreadsheetMeta(key);
      console.log('[spreadsheetCache.refreshSpreadsheet] Meta after refresh', {
        key,
        lastFetchedAt: metaAfter?.meta?.lastFetchedAt || metaAfter?.lastFetchedAt,
        expiresAt: metaAfter?.meta?.expiresAt || metaAfter?.expiresAt,
        ttlHours: metaAfter?.ttlHours,
        permanent: metaAfter?.permanent,
      });
    } catch (e) {
      console.warn('[spreadsheetCache.refreshSpreadsheet] Failed to read meta after refresh for', key, e?.message);
    }
    return true;
  } catch (error) {
    console.error(`[refreshSpreadsheet] ERROR refreshing ${key}:`, error.message);
    return false;
  }
}

export async function purgeSpreadsheet(key) {
  await clearCache(key);
  return clearSpreadsheetMeta({ sheetKey: key, url: SPREADSHEETS[key]?.url });
}
