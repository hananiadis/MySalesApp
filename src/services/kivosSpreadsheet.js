const SPREADSHEET_ID = '1pCVVgFiutK92nZFYSCkQCQbedqaKgvQahnix6bHSRIU';
const SHEET_GID = '0';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const COLUMN_KEYS = [
  'code',           // A - Κωδικός
  'name',           // B - Επωνυμία
  'street',         // C - Διεύθυνση
  'postalCode',     // D - Τ.Κ.
  'city',           // E - Πόλη
  'telephone1',     // F - Τηλ.1
  'telephone2',     // G - Τηλ.2
  'fax',            // H - Fax
  'email',          // I - email
  'profession',     // J - Επάγγελμα
  'vat',            // K - Α.Φ.Μ.
  'taxOffice',      // L - Δ.Ο.Υ.
  'salesman',       // M - Πωλητής
  'sales2022',      // N - Τζίρος ΧΡΗΣΗ 2022
  'sales2023',      // O - Τζίρος ΧΡΗΣΗ 2023
  'sales2024',      // P - Τζίρος ΧΡΗΣΗ 2024
  'sales2025',      // Q - Τζίρος ΧΡΗΣΗ 2025 (from spreadsheet only)
  'balance',        // R - Υπόλοιπο (from spreadsheet only)
];

const cache = new Map();

const buildQueryUrl = (customerCode) => {
  const escapedCode = String(customerCode).replace(/'/g, "''");
  const selectClause = 'select A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R';
  const whereClause = ` where A='${escapedCode}'`;
  const query = `${selectClause}${whereClause}`;

  const params = [
    'tqx=out:json',
    'headers=1',
    `gid=${encodeURIComponent(SHEET_GID)}`,
    `tq=${encodeURIComponent(query)}`,
  ].join('&');

  return `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?${params}`;
};

const parseGvizResponse = (payload) => {
  if (!payload || !payload.table || !Array.isArray(payload.table.rows)) {
    return null;
  }

  const [row] = payload.table.rows;
  if (!row || !Array.isArray(row.c)) {
    return null;
  }

  const record = {};
  COLUMN_KEYS.forEach((key, index) => {
    const cell = row.c[index];
    record[key] = cell && cell.v != null ? String(cell.v).trim() : null;
  });

  return record.code ? record : null;
};

const extractPayload = (rawText) => {
  if (typeof rawText !== 'string') {
    throw new Error('Unexpected response format from spreadsheet');
  }

  const match = rawText.match(/google\.visualization\.Query\.setResponse\((.*)\);?/s);
  if (!match || !match[1]) {
    throw new Error('Unable to parse spreadsheet response payload');
  }

  return JSON.parse(match[1]);
};

async function fetchRow(customerCode, forceRefresh = false) {
  if (!customerCode) {
    return null;
  }

  const code = String(customerCode).trim();
  if (!code) {
    return null;
  }

  if (!forceRefresh && cache.has(code)) {
    const cached = cache.get(code);
    if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  const response = await fetch(buildQueryUrl(code));
  if (!response.ok) {
    throw new Error(`Failed to query spreadsheet (HTTP ${response.status})`);
  }

  const text = await response.text();
  const payload = extractPayload(text);
  const record = parseGvizResponse(payload);

  const entry = { data: record, timestamp: Date.now() };
  cache.set(code, entry);

  return record;
}

export async function getKivosSpreadsheetRow(customerCode, options = {}) {
  try {
    return await fetchRow(customerCode, options.forceRefresh === true);
  } catch (error) {
    console.error('getKivosSpreadsheetRow failed', error);
    throw error;
  }
}

export function clearKivosSpreadsheetCache() {
  cache.clear();
}
