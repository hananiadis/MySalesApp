// /src/services/spreadsheetCache.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { fetchSpreadsheetData, parseCSV } from '../utils/sheets';
import { SPREADSHEETS } from '../config/spreadsheets';

const DATA_PREFIX = 'sheetdata';
const CACHE_DIR = `${FileSystem.documentDirectory}spreadsheet-cache/`;

// Ensure cache directory exists
async function ensureCacheDir() {
  try {
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
      console.log('[spreadsheetCache] Created cache directory:', CACHE_DIR);
    }
  } catch (error) {
    console.warn('[spreadsheetCache] Cannot create cache directory:', error.message);
  }
}

/**
 * Fetch and cache a spreadsheet.
 * Returns parsed rows (array of arrays for CSV, or JSON payload for gviz).
 */
export async function loadSpreadsheet(key, { force = false } = {}) {
  try {
    const entry = SPREADSHEETS[key];
    if (!entry) throw new Error(`Unknown spreadsheet key: ${key}`);

    const { url, type, keepColumns } = entry;
    console.log(`[loadSpreadsheet] Loading ${key}, force=${force}, type=${type}, keepColumns=${keepColumns?.length || 'all'}`);

    await ensureCacheDir();
    const cacheFilePath = `${CACHE_DIR}${key}.json`;

    // 1️⃣ try to fetch (or skip if fresh)
    const { rowsText, refreshed } = await fetchSpreadsheetData(url, { force });
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
        const originalSize = JSON.stringify(parsed).length;
        const keepSet = new Set(keepColumns);
        const maxCol = Math.max(...keepColumns);
        
        parsed = parsed.map(row => {
          if (!Array.isArray(row)) return row;
          const filtered = new Array(maxCol + 1);
          for (let i = 0; i <= maxCol; i++) {
            filtered[i] = keepSet.has(i) ? (row[i] !== undefined ? row[i] : null) : null;
          }
          return filtered;
        });
        
        const filteredSize = JSON.stringify(parsed).length;
        console.log(`[loadSpreadsheet] ${key} - filtered columns, size: ${originalSize} -> ${filteredSize} bytes (${Math.round(filteredSize/originalSize*100)}%)`);
      }
    } else if (type === 'gviz') {
      parsed = rowsText; // raw text → let caller parse gviz JSON (they already do)
    } else {
      parsed = rowsText;
    }

    // Try to save to file storage
    try {
      const jsonString = JSON.stringify(parsed);
      await FileSystem.writeAsStringAsync(cacheFilePath, jsonString);
      console.log(`[loadSpreadsheet] ${key} - saved to file cache (${jsonString.length} bytes)`);
      
      // Clean up old AsyncStorage entry if exists
      try {
        await AsyncStorage.removeItem(`${DATA_PREFIX}:${key}`);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    } catch (fileError) {
      console.warn(`[loadSpreadsheet] ${key} - failed to save to file cache:`, fileError.message);
      // Try AsyncStorage as fallback
      try {
        await AsyncStorage.removeItem(`${DATA_PREFIX}:${key}`);
        await AsyncStorage.setItem(`${DATA_PREFIX}:${key}`, JSON.stringify(parsed));
        console.log(`[loadSpreadsheet] ${key} - saved to AsyncStorage fallback`);
      } catch (storageError) {
        console.warn(`[loadSpreadsheet] ${key} - cannot save to any storage:`, storageError.message);
      }
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
