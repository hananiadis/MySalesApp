import { loadSpreadsheet } from './spreadsheetCache';
import { parseLocaleNumber } from '../utils/numberFormat';

const COLUMN_KEYS = [
  'code',
  'name',
  'street',
  'postalCode',
  'city',
  'telephone1',
  'telephone2',
  'fax',
  'email',
  'profession',
  'vat',
  'taxOffice',
  'salesman',
  'sales2022',
  'sales2023',
  'sales2024',
  'sales2025',
  'balance',
  'isActive',
  'channel',
];

const NUMERIC_FIELDS = new Set(['sales2022', 'sales2023', 'sales2024', 'sales2025', 'balance']);
const CACHE_TTL_MS = 60 * 60 * 1000;

const cache = new Map();

const normalizeCode = (value) => String(value || '').trim().toUpperCase();

const extractRows = (rawText) => {
  if (!rawText) return [];
  const match = rawText.match(/google\.visualization\.Query\.setResponse\((.*)\);?/s);
  if (!match) return [];

  try {
    const payload = JSON.parse(match[1]);
    return Array.isArray(payload?.table?.rows) ? payload.table.rows : [];
  } catch (error) {
    console.warn('[kivosSpreadsheet] Failed to parse GViz payload', error);
    return [];
  }
};

const mapRowToRecord = (row) => {
  const record = {};

  COLUMN_KEYS.forEach((key, index) => {
    const cell = row?.c?.[index];
    const value = cell?.v ?? null;

    if (NUMERIC_FIELDS.has(key)) {
      const numeric = parseLocaleNumber(value, { defaultValue: NaN });
      record[key] = Number.isFinite(numeric) ? numeric : null;
    } else if (typeof value === 'string') {
      record[key] = value.trim();
    } else {
      record[key] = value;
    }
  });

  return record;
};

/**
 * Fetch a customer's record from the cached Kivos spreadsheet.
 * Includes sales figures, balance, active flag, and sales channel.
 */
export async function getKivosSpreadsheetRow(customerCode, options = {}) {
  const code = normalizeCode(customerCode);
  if (!code) return null;

  if (!options.forceRefresh && cache.has(code)) {
    const cached = cache.get(code);
    if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  const rawText = await loadSpreadsheet('kivosCustomers', { force: Boolean(options.forceRefresh) });
  const rows = extractRows(rawText);
  if (!rows.length) return null;

  const record = rows.map(mapRowToRecord).find((item) => normalizeCode(item.code) === code);
  if (!record) return null;

  cache.set(code, { data: record, timestamp: Date.now() });
  return record;
}
