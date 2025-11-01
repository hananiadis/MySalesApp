// /src/services/kivosSpreadsheet.js
import { loadSpreadsheet } from './spreadsheetCache';

// Define column order based on the sheet
const COLUMN_KEYS = [
  'code', 'name', 'street', 'postalCode', 'city', 'telephone1', 'telephone2', 'fax',
  'email', 'profession', 'vat', 'taxOffice', 'salesman',
  'sales2022', 'sales2023', 'sales2024', 'sales2025', 'balance',
];

// In-memory cache to reduce re-parsing
const cache = new Map();

/**
 * Fetch a customer's row from the Kivos customers spreadsheet (GViz format)
 * @param {string} customerCode - The customer code (as stored in Firestore)
 * @param {object} options - { forceRefresh?: boolean }
 * @returns {object|null} Customer record or null
 */
export async function getKivosSpreadsheetRow(customerCode, options = {}) {
  const code = String(customerCode || '').trim();
  if (!code) return null;

  // ✅ Check in-memory cache (1 hour)
  if (!options.forceRefresh && cache.has(code)) {
    const cached = cache.get(code);
    if (Date.now() - cached.timestamp < 60 * 60 * 1000) return cached.data;
  }

  // ✅ Fetch cached GViz payload
  const rawText = await loadSpreadsheet('kivosCustomers', { force: options.forceRefresh });
  if (!rawText) return null;

  // Parse the GViz payload
  const match = rawText.match(/google\.visualization\.Query\.setResponse\((.*)\);?/s);
  if (!match) return null;

  const payload = JSON.parse(match[1]);
  const rows = payload.table?.rows ?? [];
  if (!rows.length) return null;

  // ✅ Convert all rows to JS objects
  const parsed = rows.map((row) => {
    const record = {};
    COLUMN_KEYS.forEach((key, i) => {
      const cell = row.c[i];
      record[key] = cell && cell.v != null ? String(cell.v).trim() : null;
    });
    return record;
  });

  // ✅ Find customer by code (case-insensitive)
  const record = parsed.find(
    (r) => String(r.code || '').trim().toUpperCase() === code.toUpperCase()
  );

  if (!record) return null;

  // ✅ Cache & return
  cache.set(code, { data: record, timestamp: Date.now() });
  return record;
}
