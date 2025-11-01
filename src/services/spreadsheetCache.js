// /src/services/spreadsheetCache.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchSpreadsheetData, parseCSV } from '../utils/sheets';
import { SPREADSHEETS } from '../config/spreadsheets';

const DATA_PREFIX = 'sheetdata';

/**
 * Fetch and cache a spreadsheet.
 * Returns parsed rows (array of arrays for CSV, or JSON payload for gviz).
 */
export async function loadSpreadsheet(key, { force = false } = {}) {
  const entry = SPREADSHEETS[key];
  if (!entry) throw new Error(`Unknown spreadsheet key: ${key}`);

  const { url, type } = entry;

  // 1️⃣ try to fetch (or skip if fresh)
  const { rowsText, refreshed } = await fetchSpreadsheetData(url, { force });

  // 2️⃣ if not refreshed, return cached data from storage
  if (!refreshed) {
    const stored = await AsyncStorage.getItem(`${DATA_PREFIX}:${key}`);
    return stored ? JSON.parse(stored) : null;
  }

  // 3️⃣ parse and store
  let parsed;
  if (type === 'csv') {
    parsed = parseCSV(rowsText);
  } else if (type === 'gviz') {
    parsed = rowsText; // raw text → let caller parse gviz JSON (they already do)
  } else {
    parsed = rowsText;
  }

  await AsyncStorage.setItem(`${DATA_PREFIX}:${key}`, JSON.stringify(parsed));
  return parsed;
}
