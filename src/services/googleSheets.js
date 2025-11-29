// src/services/googleSheets.js
// Google Sheets CSV fetching and parsing service

import axios from 'axios';
import { PLAYMOBIL_CONFIG } from '../config/playmobil';

console.log('[googleSheets] Module loaded');

/**
 * Parse CSV text to array of objects
 * @param {string} csvText - CSV text content
 * @param {Object} columnMapping - Column name mappings
 * @returns {Array} Parsed records
 */
function parseCSV(csvText, columnMapping = {}, delimiter = ',') {
  console.log('[parseCSV] START');
  console.log('[parseCSV] CSV length:', csvText.length);
  console.log('[parseCSV] Column mapping:', columnMapping);
  console.log('[parseCSV] Delimiter:', delimiter);

  try {
    const lines = csvText.split('\n').filter(line => line.trim());
    console.log('[parseCSV] Total lines:', lines.length);

    if (lines.length === 0) {
      console.warn('[parseCSV] No lines to parse');
      return [];
    }

  // Parse header row
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
    console.log('[parseCSV] Headers:', headers);

    // Create index mapping
    const indexMap = {};
    Object.entries(columnMapping).forEach(([targetField, sourceField]) => {
      const index = headers.indexOf(sourceField);
      if (index !== -1) {
        indexMap[index] = targetField;
        console.log(`[parseCSV] Mapped column "${sourceField}" (index ${index}) -> "${targetField}"`);
      } else {
        console.warn(`[parseCSV] Column "${sourceField}" not found in headers`);
      }
    });

    console.log('[parseCSV] Index map:', indexMap);

    // Parse data rows
    const records = [];
    let skippedRows = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) {
        skippedRows++;
        continue;
      }

      // Simple CSV parsing (handles quoted values)
      const values = [];
      let currentValue = '';
      let insideQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];

        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === delimiter && !insideQuotes) {
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim()); // Push last value

      // Map to object
      const record = {};
      let hasData = false;

      Object.entries(indexMap).forEach(([index, field]) => {
        const value = values[parseInt(index)];
        if (value !== undefined && value !== null && value !== '') {
          record[field] = value.replace(/^"|"$/g, ''); // Remove quotes
          hasData = true;
        }
      });

      if (hasData) {
        record._rowIndex = i + 1;
        records.push(record);

        if (records.length <= 3) {
          console.log(`[parseCSV] Parsed row ${i + 1}:`, record);
        }
      } else {
        skippedRows++;
      }
    }

    console.log('[parseCSV] Parsed records:', records.length);
    console.log('[parseCSV] Skipped empty rows:', skippedRows);
    console.log('[parseCSV] SUCCESS');
    console.log('[parseCSV] END');

    return records;
  } catch (error) {
    console.error('[parseCSV] ERROR:', error);
    console.error('[parseCSV] Error message:', error.message);
    throw error;
  }
}

/**
 * Parse date string in format D/M/YYYY
 * @param {string} dateStr - Date string
 * @returns {Date|null} Parsed date
 */
function parseDate(dateStr) {
  if (!dateStr) return null;

  try {
    // Format: D/M/YYYY or DD/MM/YYYY
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
    const year = parseInt(parts[2], 10);

    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

    const date = new Date(year, month, day);
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    console.error('[parseDate] Error parsing date:', dateStr, error);
    return null;
  }
}

/**
 * Try to parse a header date token that may be numeric (D/M/YYYY)
 * or Greek short month form like "5-Νοε" (uses current year if missing)
 */
function parseHeaderDateToken(token) {
  if (!token) return null;
  const raw = String(token).trim().replace(/^"|"$/g, '');
  // Try numeric first: D/M/YYYY or DD/MM/YYYY
  const numeric = parseDate(raw);
  if (numeric) return numeric;

  // Try Greek month short format: D-ΜΜΜ (e.g., 5-Νοε)
  const greekMonths = {
    'ιαν': 1, 'φεβ': 2, 'μαρ': 3, 'απρ': 4, 'μάι': 5, 'μαι': 5, 'ιουν': 6,
    'ιουλ': 7, 'αυγ': 8, 'σεπ': 9, 'οκτ': 10, 'νοε': 11, 'δεκ': 12,
  };
  const m = raw.split(/[-–]/); // dash variations
  if (m.length === 2) {
    const day = parseInt(m[0], 10);
    const deAcc = (s) => s
      .toLowerCase()
      .replace(/ά/g, 'α')
      .replace(/έ/g, 'ε')
      .replace(/ή/g, 'η')
      .replace(/ί/g, 'ι')
      .replace(/ϊ/g, 'ι')
      .replace(/ΐ/g, 'ι')
      .replace(/ό/g, 'ο')
      .replace(/ύ/g, 'υ')
      .replace(/ϋ/g, 'υ')
      .replace(/ΰ/g, 'υ')
      .replace(/ώ/g, 'ω');
    const monthKey = deAcc(m[1]);
    const month = greekMonths[monthKey];
    if (!isNaN(day) && month) {
      const year = new Date().getFullYear();
      const d = new Date(year, month - 1, day);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

/**
 * Detect delimiter from header line (';' preferred over ',')
 */
function detectDelimiter(csvText) {
  const firstLine = csvText.split('\n')[0] || '';
  const semi = (firstLine.match(/;/g) || []).length;
  const comma = (firstLine.match(/,/g) || []).length;
  return semi > comma ? ';' : ',';
}

/**
 * Extract date from the last header cell
 */
function extractHeaderDate(csvText) {
  const delimiter = detectDelimiter(csvText);
  const firstLine = csvText.split('\n')[0] || '';
  const headers = firstLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
  const last = headers[headers.length - 1];
  const dt = parseHeaderDateToken(last);
  if (dt) {
    console.log('[extractHeaderDate] Parsed header date:', dt.toISOString());
  } else {
    console.warn('[extractHeaderDate] Could not parse header date from:', last);
  }
  return dt;
}

/**
 * Normalize parsed records
 * @param {Array} records - Parsed records
 * @param {string} dataType - 'sales' or 'orders'
 * @returns {Array} Normalized records
 */
function normalizeRecords(records, dataType) {
  console.log('[normalizeRecords] START');
  console.log('[normalizeRecords] Records to normalize:', records.length);
  console.log('[normalizeRecords] Data type:', dataType);

  const normalized = records
    .map((record, index) => {
      const norm = { ...record };

      // Normalize based on data type
      if (dataType === 'sales') {
        // Parse billing date
        if (norm.billingDate) {
          norm.date = parseDate(norm.billingDate);
        }
        // Parse revenue (European format: 1.234.567,89 -> remove dots, replace comma with period)
        if (norm.revenue) {
          let amount = parseFloat(norm.revenue.replace(/\./g, '').replace(',', '.')) || 0;
          // Apply negative multiplier for credit memos, cancellations, etc.
          // Only "Invoice" adds to revenue, all other types subtract
          const docType = (norm.documentType || '').toLowerCase();
          if (docType && !docType.includes('invoice')) {
            amount = -Math.abs(amount); // Make it negative
          }
          norm.amount = amount;
        }
        // Keep original document type for filtering
        norm.documentType = norm.documentType || null;
        norm.documentNumber = norm.documentNumber || null;
      } else if (dataType === 'orders') {
        // Parse document date
        if (norm.documentDate) {
          norm.date = parseDate(norm.documentDate);
        }
        // Parse gross value (European format: 1.234.567,89 -> remove dots, replace comma with period)
        if (norm.grossValue) {
          norm.amount = parseFloat(norm.grossValue.replace(/\./g, '').replace(',', '.')) || 0;
        }
      }

  // Convert undefined to null for Firestore compatibility
      norm.customerCode = norm.customerCode ? String(norm.customerCode).trim() : null;
      norm.customerName = norm.customerName ? String(norm.customerName).trim() : null;
  norm.date = norm.date || null;
  // Keep negative and zero amounts; only coerce non-numeric to 0
  const parsedAmount = Number(norm.amount);
  norm.amount = Number.isFinite(parsedAmount) ? parsedAmount : 0;

      if (index < 3) {
        console.log(`[normalizeRecords] Record ${index}:`, {
          customerCode: norm.customerCode,
          customerName: norm.customerName,
          amount: norm.amount,
          date: norm.date?.toISOString?.() || norm.date
        });
      }

      return norm;
    })
    .filter(record => {
      // Filter out records without essential data (keep negatives and zeros)
      return record.customerCode && typeof record.amount === 'number' && !Number.isNaN(record.amount);
    });

  console.log('[normalizeRecords] Normalized records:', normalized.length);
  const pos = normalized.filter(r => r.amount > 0).length;
  const zero = normalized.filter(r => r.amount === 0).length;
  const neg = normalized.filter(r => r.amount < 0).length;
  console.log('[normalizeRecords] Amount distribution:', { positive: pos, zero, negative: neg });
  console.log(`[normalizeRecords] Filtered out ${records.length - normalized.length} records without customerCode or invalid amount`);
  console.log('[normalizeRecords] SUCCESS');
  console.log('[normalizeRecords] END');

  return normalized;
}

/**
 * Fetch and parse CSV from Google Sheets
 * @param {string} sheetKey - Key from PLAYMOBIL_CONFIG.sheetUrls
 * @param {string} dataType - 'sales' or 'orders'
 * @returns {Promise<Array>} Parsed records
 */
export async function fetchGoogleSheetCSV(sheetKey, dataType) {
  console.log('[fetchGoogleSheetCSV] START');
  console.log('[fetchGoogleSheetCSV] Sheet key:', sheetKey);
  console.log('[fetchGoogleSheetCSV] Data type:', dataType);

  try {
    // Get URL from config
    const url = PLAYMOBIL_CONFIG.sheetUrls[sheetKey];
    if (!url) {
      throw new Error(`Unknown sheet key: ${sheetKey}. Available: ${Object.keys(PLAYMOBIL_CONFIG.sheetUrls).join(', ')}`);
    }

    console.log('[fetchGoogleSheetCSV] Fetching from URL:', url.substring(0, 80) + '...');

    // Fetch CSV
    const startTime = Date.now();
    const response = await axios.get(url, {
      timeout: 30000,
      responseType: 'text',
    });

    const fetchDuration = Date.now() - startTime;
    console.log(`[fetchGoogleSheetCSV] Fetch completed in ${fetchDuration}ms`);
    console.log('[fetchGoogleSheetCSV] Response status:', response.status);
    console.log('[fetchGoogleSheetCSV] Response length:', response.data.length);

    // Get column mapping for this data type
    const columnMapping = PLAYMOBIL_CONFIG.columnNames[dataType];
    if (!columnMapping) {
      throw new Error(`No column mapping found for data type: ${dataType}`);
    }

    console.log('[fetchGoogleSheetCSV] Using column mapping:', columnMapping);

  // Detect delimiter and header date
  const delimiter = detectDelimiter(response.data);
  const headerDate = extractHeaderDate(response.data);

  // Parse CSV
  console.log('[fetchGoogleSheetCSV] Parsing CSV...');
  const parsed = parseCSV(response.data, columnMapping, delimiter);

    // Normalize records
    console.log('[fetchGoogleSheetCSV] Normalizing records...');
    const normalized = normalizeRecords(parsed, dataType);

    console.log('[fetchGoogleSheetCSV] Final record count:', normalized.length);
    const pos = normalized.filter(r => r.amount > 0).length;
    const zero = normalized.filter(r => r.amount === 0).length;
    const neg = normalized.filter(r => r.amount < 0).length;
    console.log('[fetchGoogleSheetCSV] Data quality check:', {
      totalRecords: normalized.length,
      withCustomerCode: normalized.filter(r => r.customerCode).length,
      withDate: normalized.filter(r => r.date).length,
      amounts: { positive: pos, zero, negative: neg },
    });

    console.log('[fetchGoogleSheetCSV] SUCCESS', { headerDate: headerDate?.toISOString?.() });
    console.log('[fetchGoogleSheetCSV] END');

    // For backward compatibility, return just rows but attach headerDate as a non-enumerable property
    try {
      Object.defineProperty(normalized, '_headerDate', { value: headerDate || null, enumerable: false });
    } catch (e) {
      // ignore if defineProperty fails
    }
    return normalized;
  } catch (error) {
    console.error('[fetchGoogleSheetCSV] ERROR:', error);
    console.error('[fetchGoogleSheetCSV] Error message:', error.message);
    console.error('[fetchGoogleSheetCSV] Error stack:', error.stack);

    if (error.response) {
      console.error('[fetchGoogleSheetCSV] Response status:', error.response.status);
      console.error('[fetchGoogleSheetCSV] Response data:', error.response.data?.substring(0, 200));
    }

    throw error;
  }
}

/**
 * Validate Google Sheets configuration
 * @returns {boolean} True if configured correctly
 */
export function validateGoogleSheetsConfig() {
  console.log('[validateGoogleSheetsConfig] START');

  const hasSheetUrls = PLAYMOBIL_CONFIG.sheetUrls && Object.keys(PLAYMOBIL_CONFIG.sheetUrls).length > 0;
  const hasColumnMappings = PLAYMOBIL_CONFIG.columnNames && Object.keys(PLAYMOBIL_CONFIG.columnNames).length > 0;

  console.log('[validateGoogleSheetsConfig] Has sheet URLs:', hasSheetUrls);
  console.log('[validateGoogleSheetsConfig] Has column mappings:', hasColumnMappings);

  if (!hasSheetUrls) {
    console.error('[validateGoogleSheetsConfig] No sheet URLs configured');
  }

  if (!hasColumnMappings) {
    console.error('[validateGoogleSheetsConfig] No column mappings configured');
  }

  const isValid = hasSheetUrls && hasColumnMappings;
  console.log('[validateGoogleSheetsConfig] Configuration valid:', isValid);
  console.log('[validateGoogleSheetsConfig] END');

  return isValid;
}
