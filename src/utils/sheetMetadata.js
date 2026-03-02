// src/utils/sheetMetadata.js
// Utility to extract metadata from Google Sheets (e.g., last update date from AD1)

import { fetchGoogleSheetCSV } from '../services/googleSheets';
import { PLAYMOBIL_CONFIG } from '../config/playmobil';

/**
 * Extract last update date from AD1 (column 30, 0-indexed as 29) of a sales sheet
 * @param {string} sheetKey - Key like 'sales2026', 'sales2025', 'sales2024'
 * @returns {Promise<Date|null>} Parsed date or null if not found
 */
export async function getLastUpdateDateFromSheet(sheetKey) {
  console.log(`[getLastUpdateDateFromSheet] Fetching metadata for ${sheetKey}`);
  
  try {
    // Get the sheet URL
    const sheetUrl = PLAYMOBIL_CONFIG.sheetUrls[sheetKey];
    if (!sheetUrl) {
      console.warn(`[getLastUpdateDateFromSheet] No URL found for ${sheetKey}`);
      return null;
    }

    // Fetch first row only (headers + metadata row)
    // We'll get all rows but only process the first one
    const records = await fetchGoogleSheetCSV(sheetUrl, PLAYMOBIL_CONFIG.columnNames.sales);
    
    if (!records || records.length === 0) {
      console.warn(`[getLastUpdateDateFromSheet] No records found for ${sheetKey}`);
      return null;
    }

    // The CSV parser creates a '_headerDate' field if it found a date in unusual position
    // But we need to access column AD (index 29) directly from the raw parse
    // For now, we'll check if there's a date-like field in the first record
    
    const firstRecord = records[0];
    console.log(`[getLastUpdateDateFromSheet] First record keys for ${sheetKey}:`, Object.keys(firstRecord).slice(0, 10));
    
    // Look for any date field that might be in AD column
    // Since CSV parsing maps columns to field names, we need to check the raw data
    // The sheet metadata is typically in the header row, so we'll extract it differently
    
    // For now, return null and we'll handle this in the component
    return null;
  } catch (error) {
    console.error(`[getLastUpdateDateFromSheet] Error for ${sheetKey}:`, error.message);
    return null;
  }
}

/**
 * Get the maximum (most recent) last update date across all active sales sheets
 * @returns {Promise<Date>} The most recent update date, or current date if not found
 */
export async function getLastUpdateDate() {
  console.log('[getLastUpdateDate] Fetching last update date from all sheets');
  
  const sheetKeys = ['sales2026', 'sales2025', 'sales2024'];
  const dates = [];

  for (const key of sheetKeys) {
    const date = await getLastUpdateDateFromSheet(key);
    if (date) {
      dates.push(date);
      console.log(`[getLastUpdateDate] ${key}: ${date.toISOString()}`);
    }
  }

  if (dates.length === 0) {
    console.warn('[getLastUpdateDate] No update dates found, using current date');
    return new Date();
  }

  // Return the most recent date
  const maxDate = dates.reduce((max, date) => date > max ? date : max);
  console.log('[getLastUpdateDate] Latest update date:', maxDate.toISOString());
  return maxDate;
}
