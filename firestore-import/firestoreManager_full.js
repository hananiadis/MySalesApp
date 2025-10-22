// firestoreManager_full.js
// Unified CLI for Firestore imports and maintenance per brand
const admin = require('firebase-admin');
const axios = require('axios');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// --- Firebase Init ---
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id || 'mysalesapp-38ccf',
  ignoreUndefinedProperties: true,
});
const db = admin.firestore();

// --- CLI I/O ---
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function askQuestion(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

const axiosInstance = axios.default || axios;
const CONFIG_PATH = path.join(__dirname, 'firestore-import-config.json');
let externalConfig = {};
try {
  if (fs.existsSync(CONFIG_PATH)) {
    const rawConfig = fs.readFileSync(CONFIG_PATH, 'utf8');
    externalConfig = JSON.parse(rawConfig);
  }
} catch (error) {
  console.warn('[WARN] Unable to read firestore-import-config.json:', error.message);
  externalConfig = {};
}

function extractSheetId(input) {
  if (!input) return null;
  const value = String(input).trim();
  if (!value) return null;
  if (/^[a-zA-Z0-9_-]{20,}$/.test(value)) {
    return value;
  }
  const matchBySlash = value.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (matchBySlash) {
    return matchBySlash[1];
  }
  const matchByKey = value.match(/[?&]key=([a-zA-Z0-9_-]+)/);
  if (matchByKey) {
    return matchByKey[1];
  }
  return null;
}

const NORMALIZED_KEY_MAP = Symbol('normalizedKeyMap');

function normalizeHeaderKey(input) {
  if (input === null || input === undefined) return '';
  return String(input)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s'"`,.;:/\\_-]+/gu, '');
}

function getNormalizedKeyMap(row) {
  let map = row[NORMALIZED_KEY_MAP];
  if (!map) {
    map = {};
    for (const key of Object.keys(row)) {
      const normalized = normalizeHeaderKey(key);
      if (normalized && !(normalized in map)) {
        map[normalized] = key;
      }
    }
    Object.defineProperty(row, NORMALIZED_KEY_MAP, { value: map, enumerable: false });
  }
  return map;
}

function printProgress(current, total, label = '') {
  if (!total || total <= 0) {
    process.stdout.clearLine?.();
    process.stdout.cursorTo?.(0);
    process.stdout.write(`${label} ? processed: ${current}\r`);
    return;
  }
  const percent = Math.min(100, Math.round((current / total) * 100));
  const barLength = 20;
  const filledLength = Math.round((percent / 100) * barLength);
  const bar = '?'.repeat(filledLength) + '-'.repeat(barLength - filledLength);
  process.stdout.clearLine?.();
  process.stdout.cursorTo?.(0);
  process.stdout.write(`?? ${label} [${bar}] ${percent}% (${current}/${total})`);
}

function normalizeDecimal(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const text = String(value).trim();
  if (!text) return null;
  const compact = text.replace(/\s+/g, '');
  if (!compact) return null;
  const negative = compact.startsWith('-');
  const unsigned = negative ? compact.slice(1) : compact;
  const digitsOnly = unsigned.replace(/[^0-9.,]/g, '');
  if (!digitsOnly) return null;
  const lastComma = digitsOnly.lastIndexOf(',');
  const lastDot = digitsOnly.lastIndexOf('.');
  const decimalIndex = Math.max(lastComma, lastDot);
  const buildNumber = (intPart, fracPart = '') => {
    const integerDigits = intPart.replace(/[^0-9]/g, '') || '0';
    const fractionalDigits = fracPart.replace(/[^0-9]/g, '');
    const normalized = fractionalDigits ? `${integerDigits}.${fractionalDigits}` : integerDigits;
    const parsed = parseFloat((negative ? '-' : '') + normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };
  if (decimalIndex === -1) {
    return buildNumber(digitsOnly);
  }
  const integerPart = digitsOnly.slice(0, decimalIndex);
  const fractionalPart = digitsOnly.slice(decimalIndex + 1);
  return buildNumber(integerPart, fractionalPart);
}

function roundCurrency(value) {
  if (value === null || value === undefined) return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.round(numeric * 100) / 100;
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined) return false;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return false;
  return ['true', 'yes', '1', 'y'].includes(normalized);
}

async function fetchCsvRows(csvUrl) {
  const response = await axiosInstance({
    url: csvUrl,
    method: 'GET',
    responseType: 'stream',
    validateStatus: () => true,
  });
  if (response.status !== 200) {
    throw new Error(`HTTP ${response.status} while fetching CSV from ${csvUrl}`);
  }
  const rows = [];
  await new Promise((resolve, reject) => {
    response.data
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', resolve)
      .on('error', reject);
  });
  return rows;
}

async function fetchXlsxWorkbook(spreadsheetId) {
  if (!spreadsheetId) {
    throw new Error('Spreadsheet ID is not configured for this action.');
  }
  const response = await axiosInstance({
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`,
    method: 'GET',
    responseType: 'arraybuffer',
    validateStatus: () => true,
  });
  if (response.status !== 200) {
    throw new Error(`HTTP ${response.status} while fetching XLSX for ${spreadsheetId}`);
  }
  try {
    return XLSX.read(response.data, { type: 'buffer' });
  } catch (error) {
    throw new Error(`Failed to parse XLSX for ${spreadsheetId}: ${error.message}`);
  }
}

function sheetRowsFromWorkbook(workbook, sheetName, columnRange = null) {
  if (!workbook || !sheetName || !workbook.Sheets?.[sheetName]) return [];
  
  const options = {
    defval: null,
    raw: false,
  };
  
  // If columnRange is specified, limit the columns
  if (columnRange) {
    options.range = columnRange;
  }
  
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], options);
}

function sanitizeText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  const invalidTokens = new Set(['#REF!', '#ERROR!', '#VALUE!', 'N/A', 'NULL', 'null', 'undefined']);
  if (invalidTokens.has(text)) return null;
  return text;
}

function sanitizeUrl(value) {
  const text = sanitizeText(value);
  if (!text) return null;
  const matchImageFormula = text.match(/^=IMAGE\((['"])(.+?)\1/i);
  if (matchImageFormula) {
    return matchImageFormula[2];
  }
  if (/^https?:\/\//i.test(text)) {
    return text;
  }
  return null;
}

function pick(row, aliases = []) {
  if (!row) return null;
  for (const alias of aliases) {
    if (alias in row && row[alias] !== undefined && row[alias] !== null) {
      const value = row[alias];
      if (typeof value === 'string' && value.trim() === '') continue;
      return value;
    }
  }
  const map = getNormalizedKeyMap(row);
  for (const alias of aliases) {
    const normalizedAlias = normalizeHeaderKey(alias);
    if (!normalizedAlias) continue;
    const key = map[normalizedAlias];
    if (key !== undefined && row[key] !== undefined && row[key] !== null) {
      const value = row[key];
      if (typeof value === 'string' && value.trim() === '') continue;
      return value;
    }
  }
  return null;
}

const GREEK_TO_LATIN = {
  α: 'a', ά: 'a',
  β: 'b',
  γ: 'g',
  δ: 'd',
  ε: 'e', έ: 'e',
  ζ: 'z',
  η: 'i', ή: 'i',
  θ: 'th',
  ι: 'i', ί: 'i', ϊ: 'i', ΐ: 'i',
  κ: 'k',
  λ: 'l',
  μ: 'm',
  ν: 'n',
  ξ: 'x',
  ο: 'o', ό: 'o',
  π: 'p',
  ρ: 'r',
  σ: 's', ς: 's',
  τ: 't',
  υ: 'y', ύ: 'y', ϋ: 'y', ΰ: 'y',
  φ: 'f',
  χ: 'ch',
  ψ: 'ps',
  ω: 'o', ώ: 'o',
};

function toAsciiLower(value) {
  if (value === null || value === undefined) return '';
  const base = String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return base.replace(/[\u0370-\u03FF]/g, (char) => GREEK_TO_LATIN[char] ?? '');
}

function normalizeHeaderToken(value) {
  return toAsciiLower(value).replace(/[^a-z0-9]/g, '');
}

function findColumnIndex(headerRow, candidates) {
  if (!Array.isArray(headerRow)) return -1;
  const normalizedHeader = headerRow.map((cell) => normalizeHeaderToken(cell));
  for (const candidate of candidates) {
    const token = normalizeHeaderToken(candidate);
    const idx = normalizedHeader.indexOf(token);
    if (idx !== -1) {
      return idx;
    }
  }
  return -1;
}

function makeIdSegment(value) {
  const ascii = toAsciiLower(value);
  if (!ascii) return '';
  return ascii.replace(/[^a-z0-9]/g, '');
}

function rowIsEmpty(row) {
  if (!Array.isArray(row)) return true;
  return !row.some((cell) => {
    if (cell === null || cell === undefined) return false;
    if (typeof cell === 'number' && Number.isFinite(cell)) return true;
    if (typeof cell === 'string' && cell.trim() !== '') return true;
    return false;
  });
}

function isActiveFlag(value) {
  const text = sanitizeText(value);
  if (!text) return false;
  const normalized = text.trim().toLowerCase();
  return ['x', 'χ', 'yes', 'true', '1', 'a', 'b', 'c', 'on', 'ok', 'ναι'].includes(normalized);
}

function asNumber(value) {
  const parsed = normalizeDecimal(value);
  return parsed !== null ? parsed : null;
}

const BRAND_CONFIG = {
  playmobil: {
    label: 'Playmobil',
    productCollection: 'products',
    customerCollection: 'customers',
    orderCollection: 'orders',
  },
  kivos: {
    label: 'Kivos',
    productCollection: 'products_kivos',
    customerCollection: 'customers_kivos',
    orderCollection: 'orders_kivos',
  },
  john: {
    label: 'John',
    productCollection: 'products_john',
    customerCollection: 'customers_john',
    orderCollection: 'orders_john',
  },
};

const GOOGLE_SHEETS = {
  PLAYMOBIL_PRODUCTS: '101kDd35o6MBky5KYx0i8MNA5GxIUiNGgYf_01T_7I4c',
  PLAYMOBIL_CUSTOMERS: '15iBRyUE0izGRi7qY_VhZgbdH7tojL1hq3F0LI6oIjqQ',
  KIVOS_PRODUCTS: '18qaTqILCUFuEvqcEM47gc-Ytj3GyNS1LI3Xkfx46Z48',
  KIVOS_CUSTOMERS: '1pCVVgFiutK92nZFYSCkQCQbedqaKgvQahnix6bHSRIU',
  JOHN_PRODUCTS: '18IFOPzzFvzXEgGOXNN0X1_mfZcxk2LlT_mRQj3Fqsv8',
  JOHN_CUSTOMERS: '16E6ErNMb_kTyCYQIzpjaODo3aye0VQq9u_MbyNsd38o',
};

const SUPERMARKET_DEFAULT_SHEETS = {
  LISTINGS: '1GPfMydqVMyDjjmhEIjWLP5kN2Vs21v8YdJgr15ins0c',
  STORES: '1pr6HRuTRbRUpqYVYKLuiV7qZ2uqR-bm0sObZom6_m1s',
  INVENTORY: '1A1HlA27aaamZy-smzvbr6DckmH7MGME2NNwMMNOnZVI',
};

const SUPER_MARKET_CONFIG = externalConfig.supermarket || {};

const SUPERMARKET_SHEETS = {
  LISTINGS: extractSheetId(SUPER_MARKET_CONFIG.listings) || SUPERMARKET_DEFAULT_SHEETS.LISTINGS,
  STORES: extractSheetId(SUPER_MARKET_CONFIG.stores) || SUPERMARKET_DEFAULT_SHEETS.STORES,
  INVENTORY: extractSheetId(SUPER_MARKET_CONFIG.inventory) || SUPERMARKET_DEFAULT_SHEETS.INVENTORY,
};

const SUPERMARKET_COLLECTIONS = {
  stores: 'supermarket_stores',
  listings: 'supermarket_listings',
};

const SALES_PERSON_FIELD_PATHS = [
  'merch', 'Merch', 'salesman', 'Salesman', 'salesmanName', 'salesmanFullName',
  'salesInfo.merch', 'salesInfo.salesman', 'salesInfo.salesmanName', 'salesInfo.salesmanFullName',
  'salesInfo.merchandiser', 'salesInfo.owner',
  '????t??', '????t??a', 'Merchandiser',
  'merchandiser', 'assignedMerch', 'assignedSalesman',
];
// ---------------------------------------------------------------------------
// Product Imports (Playmobil -> Kivos -> John)
// ---------------------------------------------------------------------------
async function importPlaymobilProducts() {
  console.log('\n?? Importing Playmobil products...');
  const rows = await fetchCsvRows(`https://docs.google.com/spreadsheets/d/${GOOGLE_SHEETS.PLAYMOBIL_PRODUCTS}/export?format=csv&gid=0`);
  if (!Array.isArray(rows) || rows.length === 0) {
    console.log('?? No rows detected in Playmobil products CSV.');
    return;
  }

  let processed = 0;
  let skipped = 0;
  const batchSize = 500;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const batch = db.batch();

    for (const rawRow of chunk) {
      try {
        const row = rawRow || {};
        const code = sanitizeText(
          pick(row, [
            'Product Code',
            'ProductCode',
            'Code',
            '\u039a\u03a9\u0394\u0399\u039a\u039f\u03a3 \u03a0\u03a1\u039f\u03aa\u039f\u039d\u03a4\u039f\u03a3',
            '\u039a\u03a9\u0394\u0399\u039a\u039f\u03a3',
          ])
        );
        if (!code) { skipped += 1; continue; }

        const docRef = db.collection(BRAND_CONFIG.playmobil.productCollection).doc(code);
        const payload = {
          productCode: code,
          barcode: sanitizeText(pick(row, ['Barcode', 'BARCODE'])),
          playingTheme: sanitizeText(pick(row, ['Playing Theme'])),
          description: sanitizeText(pick(row, ['Product Description', 'Description'])),
          launchDate: sanitizeText(pick(row, ['Launch Date'])),
          package: sanitizeText(pick(row, ['Package'])),
          wholesalePrice: roundCurrency(normalizeDecimal(pick(row, ['Wholesales Price', 'Wholesale Price']))),
          srp: roundCurrency(normalizeDecimal(pick(row, ['SRP']))),
          cataloguePage: sanitizeText(pick(row, ['Catalogue Page'])),
          suggestedAge: sanitizeText(pick(row, ['Suggested playing Age'])),
          gender: sanitizeText(pick(row, ['Gender'])),
          frontCover: sanitizeUrl(pick(row, ['Front Cover', 'Front Cover Url', 'Front Cover URL'])),
          availableStock: normalizeDecimal(pick(row, ['Available Stock GR'])),
          isActive: parseBoolean(pick(row, ['IsActive'])),
          aa2025: sanitizeText(pick(row, ['2025AA'])),
          brand: 'playmobil',
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (payload.availableStock === null || Number.isNaN(payload.availableStock)) {
          delete payload.availableStock;
        }

        const snap = await docRef.get();
        if (!snap.exists) {
          batch.set(docRef, { ...payload, importedAt: admin.firestore.FieldValue.serverTimestamp() });
        } else {
          const existing = snap.data() || {};
          const updates = {};
          for (const key of Object.keys(payload)) {
            if (payload[key] !== undefined && JSON.stringify(payload[key]) !== JSON.stringify(existing[key])) {
              updates[key] = payload[key];
            }
          }
          if (Object.keys(updates).length > 0) {
            updates.lastUpdated = admin.firestore.FieldValue.serverTimestamp();
            batch.update(docRef, updates);
          } else {
            skipped += 1;
            continue;
          }
        }
        processed += 1;
      } catch (error) {
        console.error('Playmobil product row error:', error.message);
        skipped += 1;
      }
    }

    await batch.commit();
    printProgress(Math.min(processed + skipped, rows.length), rows.length, 'Playmobil products');
  }

  process.stdout.write('\n');
  console.log(`Playmobil products import complete: processed=${processed}, skipped=${skipped}`);
}async function importKivosProducts() {
  console.log('\n?? Importing Kivos products...');
  const workbook = await fetchXlsxWorkbook(GOOGLE_SHEETS.KIVOS_PRODUCTS);
  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) throw new Error('No worksheet found inside the Kivos products file.');
  const rows = sheetRowsFromWorkbook(workbook, sheetName);

  if (!Array.isArray(rows) || rows.length === 0) {
    console.log('?? No rows detected in Kivos products workbook.');
    return;
  }

  let processed = 0;
  let skipped = 0;
  const batchSize = 300;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const batch = db.batch();

    for (const rawRow of chunk) {
      try {
        const row = rawRow || {};
        const code = sanitizeText(
          pick(row, [
            '\u039a\u03a9\u0394\u0399\u039a\u039f\u03a3 \u03a0\u03a1\u039f\u0399\u039f\u039d\u03a4\u039f\u03a3',
            '\u039a\u03a9\u0394\u0399\u039a\u039f\u03a3 \u03a0\u03a1\u039f\u03aa\u039f\u039d\u03a4\u039f\u03a3',
            '\u039a\u03a9\u0394\u0399\u039a\u039f\u03a3',
            'Product Code',
            'ProductCode',
            'Code',
          ])
        );
        if (!code) { skipped += 1; continue; }

        const description = sanitizeText(pick(row, ['\u03a0\u0395\u03a1\u0399\u0393\u03a1\u0391\u03a6\u0397', 'Description']));
        const supplierBrand = sanitizeText(pick(row, ['Brand', '\u039c\u03ac\u03c1\u03ba\u03b1']));
        const category = sanitizeText(pick(row, ['\u039a\u03b1\u03c4\u03b7\u03b3\u03bf\u03c1\u03af\u03b1 \u03b5\u03af\u03b4\u03bf\u03c5\u03c2', 'Category']));
        const mm = sanitizeText(pick(row, ['MM']));
        const piecesPerBoxRaw = pick(row, [
          '\u03a4\u0395\u039c\u0391\u03a7\u0399\u0391 \u0391\u039d\u0391 \u039a\u039f\u03a5\u03a4\u0399',
          '\u03a4\u0395\u039c\u0391\u03a7\u0399\u0391 \u0391\u039d\u0391 \u039a\u039f\u03a5\u03a4\u0399/\u03a4\u0395\u039c.',
          'Pieces per box',
          'Pieces Per Box',
        ]);
        const piecesPerCartonRaw = pick(row, [
          '\u03a4\u0395\u039c\u0391\u03a7\u0399\u0391 \u0391\u039d\u0391 \u039a\u0399\u0392\u03a9\u03a4\u0399\u039f',
          'Pieces per carton',
          'Pieces Per Carton',
        ]);
        const piecesPerBox = sanitizeText(piecesPerBoxRaw);
        const piecesPerCarton = sanitizeText(piecesPerCartonRaw);
        let packaging = sanitizeText(pick(row, ['\u03a3\u03a5\u03a3\u039a\u0395\u03a5\u0391\u03a3\u0399\u0391']));
        if (!packaging) {
          const packagingParts = [sanitizeText(piecesPerBoxRaw), sanitizeText(piecesPerCartonRaw)].filter(Boolean);
          if (packagingParts.length) packaging = packagingParts.join('/');
        }
        const piecesPerPack =
          sanitizeText(
            pick(row, [
              'Pieces per pack',
              'Pieces Per Pack',
              '\u03a4\u0395\u039c\u0391\u03a7\u0399\u0391 \u0391\u039d\u0391 \u03a3\u03a5\u03a3\u039a\u0395\u03a5\u0391\u03a3\u0399\u0391',
            ])
          ) || packaging;

        const wholesalePrice = roundCurrency(
          normalizeDecimal(
            pick(row, [
              '\u03a4\u0399\u039c\u0397 \u03a4\u0395\u039c\u0391\u03a7\u0399\u039f\u03a5\n  \u0395\u03a5\u03a1\u03a9',
              '\u03a4\u0399\u039c\u0397 \u03a4\u0395\u039c\u0391\u03a7\u0399\u039f\u03a5\n \u0395\u03a5\u03a1\u03a9',
              '\u03a4\u0399\u039c\u0397 \u03a4\u0395\u039c\u0391\u03a7\u0399\u039f\u03a5 \u0395\u03a5\u03a1\u03a9',
              '\u03a4\u0399\u039c\u0397 \u03a4\u0395\u039c\u0391\u03a7\u0399\u039f\u03a5 \u0391\u039d\u0391 \u039c\u0391\u03a3',
              '\u03a4\u0399\u039c\u0397 \u03a4\u0395\u039c\u0391\u03a7\u0399\u039f\u03a5',
              'Wholesale Price',
            ])
          )
        );

        const offerPrice = roundCurrency(
          normalizeDecimal(
            pick(row, [
              '\u03a4\u0399\u039c\u0397 \u03a4\u0395\u039c\u0391\u03a7\u0399\u039f\u03a5\n  \u03a0\u03a1\u039f\u03a3\u03a6\u039f\u03a1\u0391\u03a3 \u0395\u03a5\u03a1\u03a9',
              '\u03a4\u0399\u039c\u0397 \u03a4\u0395\u039c\u0391\u03a7\u0399\u039f\u03a5\n \u03a0\u03a1\u039f\u03a3\u03a6\u039f\u03a1\u0391\u03a3 \u0395\u03a5\u03a1\u03a9',
              '\u03a4\u0399\u039c\u0397 \u03a4\u0395\u039c\u0391\u03a7\u0399\u039f\u03a5 \u03a0\u03a1\u039f\u03a3\u03a6\u039f\u03a1\u0391\u03a3 \u0395\u03a5\u03a1\u03a9',
              'Offer Price',
            ])
          )
        );

        const barcodeUnit = sanitizeText(
          pick(row, ['BARCODE \u03a4\u0395\u039c\u0391\u03a7\u0399\u039f\u03a5', 'Barcode'])
        );
        const barcodeBox = sanitizeText(
          pick(row, ['BARCODE \u039a\u039f\u03a5\u03a4\u0399\u039f\u03a5', 'BARCODE Box'])
        );
        const barcodeCarton = sanitizeText(
          pick(row, ['BARCODE \u039a\u0399\u0392\u03a9\u03a4\u0399\u039f\u03a5', 'BARCODE Carton'])
        );
        const discount = roundCurrency(normalizeDecimal(pick(row, ['Discount'])));
        const discountEndsAt = sanitizeText(pick(row, ['Discount.End.Date']));
        const descriptionFull = sanitizeText(pick(row, ['Description']));
        const productUrl = sanitizeUrl(pick(row, ['Product Url', 'URL']));
        const frontCover = sanitizeUrl(
          pick(row, ['Cloudinary Image Url', 'Cloudinary Url', 'Product Image Url'])
        );

        const docRef = db.collection(BRAND_CONFIG.kivos.productCollection).doc(code);
        const payload = {
          productCode: code,
          description,
          descriptionFull,
          supplierBrand,
          category,
          mm,
          packaging,
          piecesPerPack,
          piecesPerBox,
          piecesPerCarton,
          wholesalePrice,
          barcodeUnit,
          barcodeBox,
          barcodeCarton,
          productUrl,
          frontCover,
          brand: 'kivos',
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (offerPrice !== null) {
          payload.offerPrice = offerPrice;
        }
        if (discount !== null) {
          payload.discount = discount;
        }
        if (discountEndsAt) {
          payload.discountEndsAt = discountEndsAt;
        }

        const snap = await docRef.get();
        if (!snap.exists) {
          batch.set(docRef, { ...payload, importedAt: admin.firestore.FieldValue.serverTimestamp() });
        } else {
          const existing = snap.data() || {};
          const updates = {};
          for (const key of Object.keys(payload)) {
            if (payload[key] !== undefined && JSON.stringify(payload[key]) !== JSON.stringify(existing[key])) {
              updates[key] = payload[key];
            }
          }
          if (Object.keys(updates).length > 0) {
            updates.lastUpdated = admin.firestore.FieldValue.serverTimestamp();
            batch.update(docRef, updates);
          } else {
            skipped += 1;
            continue;
          }
        }
        processed += 1;
      } catch (error) {
        console.error('Kivos product row error:', error.message);
        skipped += 1;
      }
    }

    await batch.commit();
    printProgress(Math.min(processed + skipped, rows.length), rows.length, 'Kivos products');
  }

  process.stdout.write('\n');
  console.log(`Kivos products import complete: processed=${processed}, skipped=${skipped}`);
}async function importJohnProducts() {
  console.log('\n?? Importing John products (multi-sheet)...');
  const workbook = await fetchXlsxWorkbook(GOOGLE_SHEETS.JOHN_PRODUCTS);
  const sheetNames = Array.isArray(workbook.SheetNames) ? workbook.SheetNames : [];
  if (!sheetNames.length) throw new Error('No worksheets found inside the John products file.');

  const rows = [];
  sheetNames.forEach((sheetName) => {
    const sheetRows = sheetRowsFromWorkbook(workbook, sheetName);
    sheetRows.forEach((row) => rows.push({ sheetName, row }));
  });

  if (!rows.length) {
    console.log('?? No rows detected in John products workbook.');
    return;
  }

  let processed = 0;
  let skipped = 0;
  const batchSize = 300;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const batch = db.batch();

    for (const entry of chunk) {
      const { sheetName, row } = entry;
      try {
        const code = sanitizeText(
          pick(row, [
            'Product Code',
            'Code',
            '\u039a\u03a9\u0394.',
            '\u039a\u03a9\u0394\u0399\u039a\u039f\u03a3',
            '\u039a\u03a9\u0394\u0399\u039a\u039f\u03a3 \u03a0\u03a1\u039f\u0399\u039f\u039d\u03a4\u039f\u03a3',
            '\u039a\u03a9\u0394\u0399\u039a\u039f\u03a3 \u03a0\u03a1\u039f\u03aa\u039f\u039d\u03a4\u039f\u03a3',
          ])
        );
        if (!code) { skipped += 1; continue; }

        const generalCategory = sanitizeText(
          pick(row, [
            'General Category',
            'GeneralCategory',
            '\u0393\u03b5\u03bd\u03b9\u03ba\u03ae \u039a\u03b1\u03c4\u03b7\u03b3\u03bf\u03c1\u03af\u03b1',
          ])
        );
        const subCategory = sanitizeText(
          pick(row, [
            'Sub Category',
            'SubCategory',
            '\u03a5\u03c0\u03bf\u03ba\u03b1\u03c4\u03b7\u03b3\u03bf\u03c1\u03af\u03b1',
          ])
        );
        const barcode = sanitizeText(
          pick(row, ['Barcode', 'BARCODE', '\u039a\u03c9\u03b4.Barcode', '\u039a\u03a9\u0394.Barcode'])
        );
        const description = sanitizeText(
          pick(row, ['Description', '\u03a0\u03b5\u03c1\u03b9\u03b3\u03c1\u03b1\u03c6\u03ae', '\u0395\u03bb\u03bb\u03b7\u03bd\u03b9\u03ba\u03ae \u03a0\u03b5\u03c1\u03b9\u03b3\u03c1\u03b1\u03c6\u03ae'])
        );
        const packaging = sanitizeText(
          pick(row, ['Packaging', '\u03a3\u03c5\u03c3\u03ba\u03b5\u03c5\u03b1\u03c3\u03af\u03b1', '\u03a3\u03c5\u03c3\u03ba.'])
        );

        const priceList = roundCurrency(
          normalizeDecimal(
            pick(row, [
              'Price List',
              '\u03a4\u03b9\u03bc\u03bf\u03ba\u03b1\u03c4\u03ac\u03bb\u03bf\u03b3\u03bf\u03c2',
              '\u03a4\u03b9\u03bc\u03ae \u03c4\u03b9\u03bc\u03bf\u03ba\u03b1\u03c4\u03b1\u03bb\u03cc\u03b3\u03bf\u03c5',
              '\u03a4\u03b9\u03bc\u03ae \u03c4\u03b9\u03bc\u03bf\u03ba\u03b1\u03c4\u03b1\u03bb\u03cc\u03b3\u03bf\u03c5 NET',
              '\u03a4\u03b9\u03bc\u03ae \u03c4\u03b9\u03bc/\u03b3\u03bf\u03c5',
            ])
          )
        );
        const wholesalePrice = roundCurrency(normalizeDecimal(pick(row, ['Wholesale Price', '\u03a7\u03bf\u03bd\u03b4\u03c1\u03b9\u03ba\u03ae \u03a4\u03b9\u03bc\u03ae'])));
        const srp = roundCurrency(
          normalizeDecimal(
            pick(row, ['Suggested Retail Price', '\u03a4\u03b9\u03bc\u03ae \u039b\u03b9\u03b1\u03bd\u03b9\u03ba\u03ae', '\u03a0\u03c1\u03bf\u03c4\u03b5\u03b9\u03bd\u03cc\u03bc\u03b5\u03bd\u03b7 \u039b\u03b9\u03b1\u03bd\u03b9\u03ba\u03ae \u03a4\u03b9\u03bc\u03ae'])
          )
        );
        const productDimensions = sanitizeText(
          pick(row, ['Product Dimensions (cm)', '\u0394\u03b9\u03b1\u03c3\u03c4\u03ac\u03c3\u03b5\u03b9\u03c2 \u03a0\u03c1\u03bf\u03ca\u03cc\u03bd\u03c4\u03bf\u03c2 (cm)'])
        );
        const packageDimensions = sanitizeText(
          pick(row, ['Package Dimensions (cm)', '\u0394\u03b9\u03b1\u03c3\u03c4\u03ac\u03c3\u03b5\u03b9\u03c2 \u03a3\u03c5\u03c3\u03ba\u03b5\u03c5\u03b1\u03c3\u03af\u03b1\u03c2 (cm)'])
        );
        const frontCover = sanitizeUrl(pick(row, ['Cloudinary Url', 'Cloudinary URL', 'Photo', '\u03a6\u03c9\u03c4\u03bf\u03b3\u03c1\u03b1\u03c6\u03af\u03b1']));

        const docRef = db.collection(BRAND_CONFIG.john.productCollection).doc(code);
        const payload = {
          productCode: code,
          description,
          generalCategory,
          subCategory,
          barcode,
          packaging,
          sheetCategory: sheetName,
          brand: 'john',
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (priceList !== null) payload.priceList = priceList;
        if (wholesalePrice !== null) payload.wholesalePrice = wholesalePrice;
        if (srp !== null) payload.srp = srp;
        if (productDimensions) payload.productDimensions = productDimensions;
        if (packageDimensions) payload.packageDimensions = packageDimensions;
        if (frontCover) payload.frontCover = frontCover;

        const snap = await docRef.get();
        if (!snap.exists) {
          batch.set(docRef, { ...payload, importedAt: admin.firestore.FieldValue.serverTimestamp() });
        } else {
          const existing = snap.data() || {};
          const updates = {};
          for (const key of Object.keys(payload)) {
            if (payload[key] !== undefined && JSON.stringify(payload[key]) !== JSON.stringify(existing[key])) {
              updates[key] = payload[key];
            }
          }
          if (Object.keys(updates).length > 0) {
            updates.lastUpdated = admin.firestore.FieldValue.serverTimestamp();
            batch.update(docRef, updates);
          } else {
            skipped += 1;
            continue;
          }
        }
        processed += 1;
      } catch (error) {
        console.error('John product row error:', error.message);
        skipped += 1;
      }
    }

    await batch.commit();
    printProgress(Math.min(processed + skipped, rows.length), rows.length, 'John products');
  }

  process.stdout.write('\n');
  console.log(`? John products import complete: processed=${processed}, skipped=${skipped}`);
}// ---------------------------------------------------------------------------
// Customer Imports (Playmobil -> Kivos -> John)
// ---------------------------------------------------------------------------
async function importPlaymobilCustomers() {
  const rows = await fetchCsvRows(`https://docs.google.com/spreadsheets/d/${GOOGLE_SHEETS.PLAYMOBIL_CUSTOMERS}/export?format=csv&gid=0`);
  console.log('\n?? Importing Playmobil customers...');
  let processed = 0;
  let skipped = 0;
  const batchSize = 500;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const batch = db.batch();

    for (const row of chunk) {
      try {
        const code = sanitizeText(row['Customer Code']);
        if (!code) { skipped += 1; continue; }
        const vat = sanitizeText(row['VAT Registration No.']);

        const docRef = db.collection(BRAND_CONFIG.playmobil.customerCollection).doc(code);
        const payload = {
          customerCode: code,
          name: sanitizeText(row['Name']),
          name3: sanitizeText(row['Name 3']),
          address: {
            street: sanitizeText(row['Street']),
            postalCode: sanitizeText(row['Postal Code']),
            city: sanitizeText(row['City']),
          },
          contact: {
            telephone1: sanitizeText(row['Telephone 1']),
            telephone2: sanitizeText(row['Telephone 2']),
            fax: sanitizeText(row['Fax Number']),
            email: sanitizeText(row['E-Mail Address']),
          },
          vatInfo: {
            registrationNo: vat,
            office: sanitizeText(row['VAT Office']),
          },
          salesInfo: {
            description: sanitizeText(row['Description Sales Group']),
            groupKey: sanitizeText(row['Group key']),
            groupKeyText: sanitizeText(row['Group key 1 Text']),
          },
          region: {
            id: sanitizeText(row['Region ID']),
            name: sanitizeText(row['Region']),
          },
          transportation: {
            zoneId: sanitizeText(row['Transportation Zone ID']),
            zone: sanitizeText(row['Transportation Zone']),
          },
          merch: sanitizeText(row['Merch']),
          brand: 'playmobil',
          importedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        const snap = await docRef.get();
        if (!snap.exists) {
          batch.set(docRef, payload);
        } else {
          const existing = snap.data() || {};
          const updates = {};
          for (const key of Object.keys(payload)) {
            if (payload[key] !== undefined && JSON.stringify(payload[key]) !== JSON.stringify(existing[key])) {
              updates[key] = payload[key];
            }
          }
          if (Object.keys(updates).length > 0) {
            batch.update(docRef, updates);
          } else {
            skipped += 1;
            continue;
          }
        }
        processed += 1;
      } catch (error) {
        console.error('? Playmobil customer row error:', error.message);
        skipped += 1;
      }
    }

    await batch.commit();
    printProgress(Math.min(processed + skipped, rows.length), rows.length, 'Playmobil customers');
  }

  process.stdout.write('\n');
  console.log(`? Playmobil customers import complete: processed=${processed}, skipped=${skipped}`);
}

async function importKivosCustomers() {
  if (!GOOGLE_SHEETS.KIVOS_CUSTOMERS) {
    console.log('?? Kivos customers sheet ID not configured. Update GOOGLE_SHEETS.KIVOS_CUSTOMERS to enable this import.');
    return;
  }
  console.log('\n?? Importing Kivos customers...');
  const workbook = await fetchXlsxWorkbook(GOOGLE_SHEETS.KIVOS_CUSTOMERS);
  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) throw new Error('No worksheet found for Kivos customers.');
  const rows = sheetRowsFromWorkbook(workbook, sheetName);

  if (!Array.isArray(rows) || rows.length === 0) {
    console.log('?? No rows detected in Kivos customers worksheet.');
    return;
  }

  const codeAliases = [
    '\u039a\u03a9\u0394\u0399\u039a\u039f\u03a3 \u03a0\u0395\u039b\u0391\u03a4\u0397',
    '\u039a\u03a9\u0394\u0399\u039a\u039f\u03a3 \u03a0\u0395\u039b\u0386\u03a4\u0397',
    '\u039a\u03c9\u03b4\u03b9\u03ba\u03cc\u03c2',
    '\u039a\u03c9\u03b4\u03b9\u03ba\u03cc\u03c2 \u03a0\u03b5\u03bb\u03ac\u03c4\u03b7',
    'Customer Number',
    'Customer Code',
    'Code',
  ];

  let processed = 0;
  let skipped = 0;
  const batchSize = 400;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const batch = db.batch();

    for (const rawRow of chunk) {
      try {
        const row = rawRow || {};
        const code = sanitizeText(pick(row, codeAliases));
        if (!code) { skipped += 1; continue; }

        const docRef = db.collection(BRAND_CONFIG.kivos.customerCollection).doc(code);
        const merchName = sanitizeText(pick(row, ['\u03a0\u03c9\u03bb\u03b7\u03c4\u03ae\u03c2', 'Merch', 'Salesman']));
        const sales2022 = roundCurrency(normalizeDecimal(pick(row, ['\u03a4\u03b6\u03af\u03c1\u03bf\u03c2 \u03a7\u03a1\u0397\u03a3\u0397 2022', 'Sales 2022'])));
        const sales2023 = roundCurrency(normalizeDecimal(pick(row, ['\u03a4\u03b6\u03af\u03c1\u03bf\u03c2 \u03a7\u03a1\u0397\u03a3\u0397 2023', 'Sales 2023'])));
        const sales2024 = roundCurrency(normalizeDecimal(pick(row, ['\u03a4\u03b6\u03af\u03c1\u03bf\u03c2 \u03a7\u03a1\u0397\u03a3\u0397 2024', 'Sales 2024'])));
        const sales2025 = roundCurrency(normalizeDecimal(pick(row, ['\u03a4\u03b6\u03af\u03c1\u03bf\u03c2 \u03a7\u03a1\u0397\u03a3\u0397 2025', 'Sales 2025'])));
        const balance = roundCurrency(normalizeDecimal(pick(row, ['\u03a5\u03c0\u03cc\u03bb\u03bf\u03b9\u03c0\u03bf', 'Balance'])));

        const payload = {
          customerCode: code,
          name: sanitizeText(pick(row, ['\u0395\u03c0\u03c9\u03bd\u03c5\u03bc\u03af\u03b1', 'Name'])),
          address: {
            street: sanitizeText(pick(row, ['\u0394\u03b9\u03b5\u03cd\u03b8\u03c5\u03bd\u03c3\u03b7', 'Street'])),
            postalCode: sanitizeText(pick(row, ['\u03a4.\u039a.', 'Postal Code'])),
            city: sanitizeText(pick(row, ['\u03a0\u03cc\u03bb\u03b7', 'City'])),
          },
          contact: {
            telephone1: sanitizeText(pick(row, ['\u03a4\u03b7\u03bb.1', 'Telephone 1'])),
            telephone2: sanitizeText(pick(row, ['\u03a4\u03b7\u03bb.2', 'Telephone 2'])),
            fax: sanitizeText(pick(row, ['Fax'])),
            email: sanitizeText(pick(row, ['email', 'Email', 'E-mail'])),
          },
          vatInfo: {
            registrationNo: sanitizeText(pick(row, ['\u0391.\u03a6.\u039c.', 'VAT Registration No.'])),
            office: sanitizeText(pick(row, ['\u0394.\u039f.\u03a5.', 'VAT Office'])),
          },
          profession: sanitizeText(pick(row, ['\u0395\u03c0\u03ac\u03b3\u03b3\u03b5\u03bb\u03bc\u03b1', 'Profession'])),
          merch: merchName,
          salesmanName: merchName,
          InvSales2022: sales2022,
          InvSales2023: sales2023,
          InvSales2024: sales2024,
          InvSales2025: sales2025,
          balance,
          isActive: parseBoolean(pick(row, ['\u0395\u03bd\u03b5\u03c1\u03b3\u03cc\u03c2', 'Active'])),
          channel: sanitizeText(pick(row, ['\u039a\u0391\u039d\u0391\u039b\u0399', 'Channel'])),
          brand: 'kivos',
          importedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        const snap = await docRef.get();
        if (!snap.exists) {
          batch.set(docRef, payload);
        } else {
          const existing = snap.data() || {};
          const updates = {};
          for (const key of Object.keys(payload)) {
            if (payload[key] !== undefined && JSON.stringify(payload[key]) !== JSON.stringify(existing[key])) {
              updates[key] = payload[key];
            }
          }
          if (Object.keys(updates).length > 0) {
            batch.update(docRef, updates);
          } else {
            skipped += 1;
            continue;
          }
        }
        processed += 1;
      } catch (error) {
        console.error('? Kivos customer row error:', error.message);
        skipped += 1;
      }
    }

    await batch.commit();
    printProgress(Math.min(processed + skipped, rows.length), rows.length, 'Kivos customers');
  }

  process.stdout.write('\n');
  console.log(`? Kivos customers import complete: processed=${processed}, skipped=${skipped}`);
}async function importJohnCustomers() {
  console.log('\n?? Importing John customers...');
  const workbook = await fetchXlsxWorkbook(GOOGLE_SHEETS.JOHN_CUSTOMERS);
  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) throw new Error('No worksheet found for John customers.');
  const rows = sheetRowsFromWorkbook(workbook, sheetName);

  if (!Array.isArray(rows) || rows.length === 0) {
    console.log('?? No rows detected in John customers worksheet.');
    return;
  }

  const codeAliases = [
    '\u039a\u03a9\u0394.',
    '\u039a\u03a9\u0394\u0399\u039a\u039f\u03a3 \u03a0\u0395\u039b\u0391\u03a4\u0397',
    '\u039a\u03a9\u0394\u0399\u039a\u039f\u03a3 \u03a0\u0395\u039b\u0386\u03a4\u0397',
    '\u039a\u03c9\u03b4\u03b9\u03ba\u03cc\u03c2',
    '\u039a\u03c9\u03b4\u03b9\u03ba\u03cc\u03c2 \u03a0\u03b5\u03bb\u03ac\u03c4\u03b7',
    'Customer Number',
    'Customer Code',
    'Code',
  ];

  let processed = 0;
  let skipped = 0;
  const batchSize = 400;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const batch = db.batch();

    for (const rawRow of chunk) {
      try {
        const row = rawRow || {};
        const code = sanitizeText(pick(row, codeAliases));
        if (!code) { skipped += 1; continue; }

        const docRef = db.collection(BRAND_CONFIG.john.customerCollection).doc(code);
        const payload = {
          customerCode: code,
          name: sanitizeText(pick(row, ['\u0395\u03c0\u03c9\u03bd\u03c5\u03bc\u03af\u03b1', 'Name'])),
          address: {
            street: sanitizeText(pick(row, ['\u0394\u03b9\u03b5\u03cd\u03b8\u03c5\u03bd\u03c3\u03b7', 'Street'])),
            postalCode: sanitizeText(pick(row, ['\u03a4.\u039a.', 'Postal Code'])),
            city: sanitizeText(pick(row, ['\u03a0\u03cc\u03bb\u03b7', 'City'])),
          },
          contact: {
            telephone1: sanitizeText(pick(row, ['\u03a4\u03b7\u03bb.1', 'Telephone 1'])),
            telephone2: sanitizeText(pick(row, ['\u03a4\u03b7\u03bb.2', 'Telephone 2'])),
            fax: sanitizeText(pick(row, ['Fax'])),
            email: sanitizeText(pick(row, ['email', 'Email', 'E-mail'])),
          },
          vatInfo: {
            registrationNo: sanitizeText(pick(row, ['\u0391.\u03a6.\u039c.', 'VAT Registration No.'])),
            office: sanitizeText(pick(row, ['\u0394.\u039f.\u03a5.', 'VAT Office'])),
          },
          profession: sanitizeText(pick(row, ['\u0395\u03c0\u03ac\u03b3\u03b3\u03b5\u03bb\u03bc\u03b1', 'Profession'])),
          merch: sanitizeText(pick(row, ['\u03a0\u03c9\u03bb\u03b7\u03c4\u03ae\u03c2', 'Merch', 'Salesman'])),
          brand: 'john',
          importedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        const snap = await docRef.get();
        if (!snap.exists) {
          batch.set(docRef, payload);
        } else {
          const existing = snap.data() || {};
          const updates = {};
          for (const key of Object.keys(payload)) {
            if (payload[key] !== undefined && JSON.stringify(payload[key]) !== JSON.stringify(existing[key])) {
              updates[key] = payload[key];
            }
          }
          if (Object.keys(updates).length > 0) {
            batch.update(docRef, updates);
          } else {
            skipped += 1;
            continue;
          }
        }
        processed += 1;
      } catch (error) {
        console.error('? John customer row error:', error.message);
        skipped += 1;
      }
    }

    await batch.commit();
    printProgress(Math.min(processed + skipped, rows.length), rows.length, 'John customers');
  }

  process.stdout.write('\n');
  console.log(`? John customers import complete: processed=${processed}, skipped=${skipped}`);
}

async function importSuperMarketStores() {
  console.log('\n?? Importing SuperMarket stores...');
  const sheetId = SUPERMARKET_SHEETS.STORES;
  if (!sheetId) {
    console.log('?? SuperMarket stores sheet ID not configured. Update firestore-import-config.json.');
    return;
  }

  const companyNameAnswer = await askQuestion('Enter company name for these stores: ');
  const companyName = sanitizeText(companyNameAnswer);
  if (!companyName) {
    console.log('? Company name is required. Aborting import.');
    return;
  }
  const companySlug = makeIdSegment(companyName) || 'company';

  const workbook = await fetchXlsxWorkbook(sheetId);
  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) throw new Error('No worksheet found for SuperMarket stores.');
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });

  const headerIndex = rawRows.findIndex(
    (row) => Array.isArray(row) && normalizeHeaderToken(row[0]) === normalizeHeaderToken('Α/Α')
  );
  if (headerIndex === -1) {
    console.log('? Could not locate header row in SuperMarket stores sheet.');
    return;
  }

  const headerRow = rawRows[headerIndex];
  const dataRows = rawRows.slice(headerIndex + 1).filter((row) => !rowIsEmpty(row));
  if (!dataRows.length) {
    console.log('?? No rows detected in SuperMarket stores sheet.');
    return;
  }

  const columns = {
    storeNumber: findColumnIndex(headerRow, ['\u0391/\u0391', 'A/A', 'Store Index']),
    storeName: findColumnIndex(headerRow, ['\u039a\u0391\u03a4\u0391\u03a3\u03a4\u0397\u039c\u0391', 'Store Name']),
    openingStatus: findColumnIndex(headerRow, ['2024 \u0395\u0393\u039a\u0391\u0399\u039d\u0399\u0391 -\u0391\u039d\u0391\u039a\u0391\u0399\u039d\u0399\u03a3\u0395\u0399\u03a3', '\u0395\u0393\u039a\u0391\u0399\u039d\u0399\u0391', 'Opening Status']),
    categoryNotes: findColumnIndex(headerRow, ['\u0391\u039b\u039b\u0391\u0393\u0395\u03a3 \u03a4\u03a5\u03a0\u039f\u039b\u039f\u0393\u0399\u03a9\u039d /\u0395\u0399\u0394\u0399\u039a\u0395\u03a3 \u03a0\u0395\u03a1\u0399\u03a0\u03a4\u03a9\u03a3\u0395\u0399\u03a3', 'Typologia Changes', 'Special Cases']),
    storeCode: findColumnIndex(headerRow, ['\u039a\u03a9\u0394.', '\u039a\u03c9\u03b4', 'Store Code']),
    address: findColumnIndex(headerRow, ['\u0394\u0399\u0395\u03a5\u0398\u03a5\u039d\u03a3\u0397', 'Address']),
    postalCode: findColumnIndex(headerRow, ['\u03a4\u039a', '\u03a4.\u039a', 'Postal Code', 'Zip']),
    region: findColumnIndex(headerRow, ['\u039d\u039f\u039c\u039f\u03a3', 'Region']),
    city: findColumnIndex(headerRow, ['\u03a0\u039f\u039b\u0397', 'City']),
    area: findColumnIndex(headerRow, ['\u03a0\u0395\u03a1\u0399\u039f\u03a7\u0397', 'Area']),
    phone: findColumnIndex(headerRow, ['\u03a4\u0397\u039b.', '\u03a4\u0397\u039b', 'Telephone', 'Phone']),
    category: findColumnIndex(headerRow, ['\u0393\u03b5\u03bd\u03b9\u03ba\u03ae \u039a\u03b1\u03c4\u03b7\u03b3\u03bf\u03c1\u03af\u03b1 / \u03c4\u03c5\u03c0\u03bf\u03bb\u03bf\u03b3\u03af\u03b1', 'Category', '\u03a4\u03c5\u03c0\u03bf\u03bb\u03bf\u03b3\u03af\u03b1']),
    hasSummerItems: findColumnIndex(headerRow, ['\u039a\u0391\u039b\u039f\u039a\u0391\u0399\u03a1\u0399\u039d\u0391', 'Summer Items']),
    hasToys: findColumnIndex(headerRow, ['\u03a0\u0391\u0399\u03a7\u039d\u0399\u0394\u0399\u0391', 'Toys']),
  };
  if (columns.storeCode === -1 || columns.storeName === -1 || columns.category === -1) {
    throw new Error('SuperMarket stores sheet is missing required columns (store code, store name, category).');
  }

  const totalRows = dataRows.length;
  let processed = 0;
  let skipped = 0;
  const batchSize = 400;

  for (let offset = 0; offset < totalRows; offset += batchSize) {
    const chunk = dataRows.slice(offset, offset + batchSize);
    const batch = db.batch();
    let writes = 0;

    chunk.forEach((row, indexInChunk) => {
      try {
        const storeCode = sanitizeText(columns.storeCode !== -1 ? row[columns.storeCode] : null);
        const storeName = sanitizeText(columns.storeName !== -1 ? row[columns.storeName] : null);
        const categoryValue = sanitizeText(columns.category !== -1 ? row[columns.category] : null);
        if (!storeCode || !storeName || !categoryValue) {
          skipped += 1;
          return;
        }

        const docId = `john_${companySlug}_${makeIdSegment(storeCode) || `${offset + indexInChunk + 1}`}`
;
        const docRef = db.collection(SUPERMARKET_COLLECTIONS.stores).doc(docId);

        const payload = {
          companyName,
          companySlug,
          storeNumber: columns.storeNumber !== -1 ? sanitizeText(row[columns.storeNumber]) : null,
          storeName,
          openingStatus: columns.openingStatus !== -1 ? sanitizeText(row[columns.openingStatus]) : null,
          typologyNotes: columns.categoryNotes !== -1 ? sanitizeText(row[columns.categoryNotes]) : null,
          storeCode,
          storeCodeNormalized: makeIdSegment(storeCode),
          address: columns.address !== -1 ? sanitizeText(row[columns.address]) : null,
          postalCode: columns.postalCode !== -1 ? sanitizeText(row[columns.postalCode]) : null,
          region: columns.region !== -1 ? sanitizeText(row[columns.region]) : null,
          city: columns.city !== -1 ? sanitizeText(row[columns.city]) : null,
          area: columns.area !== -1 ? sanitizeText(row[columns.area]) : null,
          phone: columns.phone !== -1 ? sanitizeText(row[columns.phone]) : null,
          category: categoryValue,
          hasSummerItems: columns.hasSummerItems !== -1 ? sanitizeText(row[columns.hasSummerItems]) : null,
          hasToys: columns.hasToys !== -1 ? sanitizeText(row[columns.hasToys]) : null,
          storeCategory: columns.hasToys !== -1 ? sanitizeText(row[columns.hasToys]) : null,
          brand: 'john',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        const cleaned = Object.fromEntries(
          Object.entries(payload).filter(([_, value]) => value !== undefined)
        );

        batch.set(docRef, cleaned, { merge: true });
        writes += 1;
        processed += 1;
      } catch (error) {
        console.error('SuperMarket store row error:', error.message);
        skipped += 1;
      }
    });

    if (writes > 0) {
      await batch.commit();
    }
    printProgress(Math.min(processed + skipped, totalRows), totalRows, 'SuperMarket stores');
  }

  process.stdout.write('\n');
  console.log(`? SuperMarket stores import complete: processed=${processed}, skipped=${skipped}`);
}

async function importSuperMarketListings() {
  console.log('\n?? Importing SuperMarket listings...');
  const sheetId = SUPERMARKET_SHEETS.LISTINGS;
  if (!sheetId) {
    console.log('?? SuperMarket listings sheet ID not configured. Update firestore-import-config.json.');
    return;
  }

  const workbook = await fetchXlsxWorkbook(sheetId);
  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) throw new Error('No worksheet found for SuperMarket listings.');
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });
  if (!rawRows.length) {
    console.log('?? No rows detected in SuperMarket listings sheet.');
    return;
  }

  const headerRow = rawRows[0];
  const dataRows = rawRows.slice(1).filter((row) => !rowIsEmpty(row));
  if (!dataRows.length) {
    console.log('?? No product rows detected in SuperMarket listings sheet.');
    return;
  }

  const columns = {
    productCode: findColumnIndex(headerRow, ['\u039a\u03c9\u03b4.', '\u039a\u03c9\u03b4', 'Product Code']),
    productCategory: findColumnIndex(headerRow, ['\u039a\u03b1\u03c4\u03b7\u03b3\u03bf\u03c1\u03af\u03b1', 'Product Category', 'Category']),
    listingLabel: findColumnIndex(headerRow, ['Listing Label', 'Label']),
    photoUrl: findColumnIndex(headerRow, ['\u03a6\u03c9\u03c4\u03bf\u03b3\u03c1\u03b1\u03c6\u03af\u03b1', 'Photo', 'Image']),
    barcode: findColumnIndex(headerRow, ['Barcode']),
    description: findColumnIndex(headerRow, ['\u03a0\u03b5\u03c1\u03b9\u03b3\u03c1\u03b1\u03c6\u03ae', 'Description']),
    packaging: findColumnIndex(headerRow, ['\u03a3\u03c5\u03c3\u03ba.', '\u03a3\u03c5\u03c3\u03ba', 'Packaging']),
    price: findColumnIndex(headerRow, ['\u03a4\u03b9\u03bc\u03ae', 'Price']),
    isNew: findColumnIndex(headerRow, ['\u039d\u03ad\u03bf', '\u039d\u0395\u039f', 'New']),
    categoryA: findColumnIndex(headerRow, ['\u0391', 'Category A']),
    categoryB: findColumnIndex(headerRow, ['\u0392', 'Category B']),
    categoryC: findColumnIndex(headerRow, ['\u0393', 'Category C']),
    storeStock: findColumnIndex(headerRow, ['\u0391\u03c0\u03cc\u03b8\u03b5\u03bc\u03b1', 'Stock']),
    suggestedQty: findColumnIndex(headerRow, ['\u03a0\u03bf\u03c3\u03cc\u03c4\u03b7\u03c4\u03b1', 'Quantity']),
    isAActive: findColumnIndex(headerRow, ['IsAActive']),
    isBActive: findColumnIndex(headerRow, ['IsBActive']),
    isCActive: findColumnIndex(headerRow, ['IsCActive']),
  };

  if (columns.productCode === -1) {
    throw new Error('SuperMarket listings sheet is missing the product code column.');
  }

  const totalRows = dataRows.length;
  let processed = 0;
  let skipped = 0;
  const batchSize = 400;

  for (let offset = 0; offset < totalRows; offset += batchSize) {
    const chunk = dataRows.slice(offset, offset + batchSize);
    const batch = db.batch();
    let writes = 0;

    chunk.forEach((row) => {
      try {
        const productCode = sanitizeText(columns.productCode !== -1 ? row[columns.productCode] : null);
        if (!productCode) {
          skipped += 1;
          return;
        }

        const productCategory =
          columns.productCategory !== -1 ? sanitizeText(row[columns.productCategory]) : null;
        const listingLabel = columns.listingLabel !== -1 ? sanitizeText(row[columns.listingLabel]) : null;
        const description = columns.description !== -1 ? sanitizeText(row[columns.description]) : null;
        const packaging = columns.packaging !== -1 ? sanitizeText(row[columns.packaging]) : null;
        const barcode = columns.barcode !== -1 ? sanitizeText(row[columns.barcode]) : null;
        const price = columns.price !== -1 ? asNumber(row[columns.price]) : null;
        const storeStock = columns.storeStock !== -1 ? asNumber(row[columns.storeStock]) : null;
        const suggestedQty = columns.suggestedQty !== -1 ? asNumber(row[columns.suggestedQty]) : null;
        const photoUrl = columns.photoUrl !== -1 ? sanitizeUrl(row[columns.photoUrl]) : null;

        const isAActive = (columns.categoryA !== -1 && isActiveFlag(row[columns.categoryA]))
          || (columns.isAActive !== -1 && isActiveFlag(row[columns.isAActive]));
        const isBActive = (columns.categoryB !== -1 && isActiveFlag(row[columns.categoryB]))
          || (columns.isBActive !== -1 && isActiveFlag(row[columns.isBActive]));
        const isCActive = (columns.categoryC !== -1 && isActiveFlag(row[columns.categoryC]))
          || (columns.isCActive !== -1 && isActiveFlag(row[columns.isCActive]));

        const categories = [];
        if (isAActive) categories.push('A');
        if (isBActive) categories.push('B');
        if (isCActive) categories.push('C');
        const primaryCategory = productCategory || (categories.length === 1 ? categories[0] : (categories.length > 1 ? 'multi' : 'unassigned'));
        const isActiveValue = categories.length > 0 || Boolean(productCategory);

        const newValue = columns.isNew !== -1 ? row[columns.isNew] : null;
        const newToken = normalizeHeaderToken(newValue);
        const isNew = isActiveFlag(newValue) || newToken === 'neo';

        const docId = `john_${makeIdSegment(productCode)}`;
        const docRef = db.collection(SUPERMARKET_COLLECTIONS.listings).doc(docId);

        const payload = {
          productCode,
          listingLabel: listingLabel || description || productCategory || null,
          description,
          barcode,
          packaging,
          price,
          storeStock,
          defaultStock: storeStock,
          suggestedQty,
          isNew,
          photoUrl,
          isAActive,
          isBActive,
          isCActive,
          activeCategories: categories,
          category: primaryCategory,
          productCategory: productCategory || primaryCategory,
          brand: 'john',
          isActive: isActiveValue,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        const cleaned = Object.fromEntries(
          Object.entries(payload).filter(([_, value]) => value !== undefined)
        );

        batch.set(docRef, cleaned, { merge: true });
        writes += 1;
        processed += 1;
      } catch (error) {
        console.error('SuperMarket listing row error:', error.message);
        skipped += 1;
      }
    });

    if (writes > 0) {
      await batch.commit();
    }
    printProgress(Math.min(processed + skipped, totalRows), totalRows, 'SuperMarket listings');
  }

  process.stdout.write('\n');
  console.log(`? SuperMarket listings import complete: processed=${processed}, skipped=${skipped}`);
}
// ---------------------------------------------------------------------------\n// Deletion primitives
// ---------------------------------------------------------------------------
async function deleteAllInCollection(collectionPath, batchSize = 500) {
  console.log(`\n?? Deleting ALL docs in "${collectionPath}" ...`);
  let totalDeleted = 0;
  while (true) {
    const snap = await db.collection(collectionPath).limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    totalDeleted += snap.size;
    printProgress(totalDeleted, 0, `Deleting ${collectionPath}`);
  }
  process.stdout.write('\n');
  console.log(`? Deleted ${totalDeleted} docs from "${collectionPath}".`);
}

async function listUsersFromOrders(collectionPath) {
  console.log(`\n?? Scanning "${collectionPath}" for users ?`);
  const counts = new Map();
  let scanned = 0;
  const pageSize = 500;
  let lastDoc = null;

  while (true) {
    let query = db.collection(collectionPath).orderBy(admin.firestore.FieldPath.documentId()).limit(pageSize);
    if (lastDoc) query = query.startAfter(lastDoc.id);
    const snap = await query.get();
    if (snap.empty) break;

    snap.docs.forEach((doc) => {
      scanned += 1;
      const data = doc.data() || {};
      const uid = data.userId || '(unknown)';
      counts.set(uid, (counts.get(uid) || 0) + 1);
    });

    lastDoc = snap.docs[snap.docs.length - 1];
    printProgress(scanned, 0, `Scanning ${collectionPath}`);
  }

  process.stdout.write('\n');
  return Array.from(counts.entries())
    .map(([userId, count]) => ({ userId, count }))
    .sort((a, b) => b.count - a.count || String(a.userId).localeCompare(String(b.userId)));
}

async function deleteOrdersByUser(collectionPath, userId, batchSize = 500) {
  console.log(`\n?? Deleting orders for userId="${userId}" in "${collectionPath}" ?`);
  let totalDeleted = 0;
  while (true) {
    const snap = await db.collection(collectionPath).where('userId', '==', userId).limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    totalDeleted += snap.size;
    printProgress(totalDeleted, 0, `Deleting ${collectionPath} orders of ${userId}`);
  }
  process.stdout.write('\n');
  console.log(`? Deleted ${totalDeleted} orders for userId="${userId}" in "${collectionPath}".`);
}

async function confirmAndDeleteAllOrders(brandKey) {
  const brand = BRAND_CONFIG[brandKey];
  const confirmation = await askQuestion(`Type "DELETE ALL ${brand.label.toUpperCase()} ORDERS" to confirm: `);
  if (confirmation.trim() === `DELETE ALL ${brand.label.toUpperCase()} ORDERS`) {
    await deleteAllInCollection(brand.orderCollection);
  } else {
    console.log('? Cancelled.');
  }
}

async function deleteOrdersForUserFlow(brandKey) {
  const brand = BRAND_CONFIG[brandKey];
  const users = await listUsersFromOrders(brand.orderCollection);
  if (!users.length) {
    console.log('?? No orders found.');
    return;
  }
  console.log('\n?? Users with orders:');
  users.forEach((user, idx) => {
    console.log(`${idx + 1}. ${user.userId} (${user.count} orders)`);
  });
  const selected = await askQuestion('\nSelect user # to delete orders (Enter to cancel): ');
  const index = parseInt(selected, 10);
  if (!index || index < 1 || index > users.length) {
    console.log('? Cancelled.');
    return;
  }
  const chosen = users[index - 1];
  const confirmation = await askQuestion(`Type "DELETE ${brand.label.toUpperCase()} ${chosen.userId}" to confirm: `);
  if (confirmation.trim() === `DELETE ${brand.label.toUpperCase()} ${chosen.userId}`) {
    await deleteOrdersByUser(brand.orderCollection, chosen.userId);
  } else {
    console.log('? Cancelled.');
  }
}
// ---------------------------------------------------------------------------
// Salesmen rebuild support
// ---------------------------------------------------------------------------
function sanitizeSalesmanName(value) {
  if (value == null) return '';
  const text = String(value).trim();
  return text ? text.replace(/\s+/g, ' ') : '';
}

function normalizeSalesmanKey(value) {
  const sanitized = sanitizeSalesmanName(value);
  return sanitized ? sanitized.toLocaleUpperCase('el-GR') : '';
}

function getValueByPath(source, path) {
  if (!source || typeof source !== 'object') return undefined;
  if (!path.includes('.')) return source[path];
  return path.split('.').reduce((acc, part) => (acc && typeof acc === 'object' ? acc[part] : undefined), source);
}

function extractSalesmenFromCustomer(customer = {}) {
  const results = [];
  const seen = new Set();
  const addCandidate = (value) => {
    if (Array.isArray(value)) {
      value.forEach(addCandidate);
      return;
    }
    const sanitized = sanitizeSalesmanName(value);
    if (!sanitized) return;
    const key = normalizeSalesmanKey(sanitized);
    if (!key || seen.has(key)) return;
    seen.add(key);
    results.push(sanitized);
  };

  SALES_PERSON_FIELD_PATHS.forEach((path) => {
    const extracted = getValueByPath(customer, path);
    if (extracted !== undefined) addCandidate(extracted);
  });

  return results;
}

async function deleteSalesmenForBrand(brandKey) {
  const snap = await db.collection('salesmen').where('brand', '==', brandKey).get();
  if (snap.empty) return 0;
  let deleted = 0;
  const batchSize = 400;
  let batch = db.batch();
  const commits = [];
  snap.forEach((doc, idx) => {
    batch.delete(doc.ref);
    deleted += 1;
    if ((idx + 1) % batchSize === 0) {
      commits.push(batch.commit());
      batch = db.batch();
    }
  });
  commits.push(batch.commit());
  await Promise.all(commits);
  return deleted;
}

async function upsertSalesmenForBrand(brandKey, collectionName) {
  const snapshot = await db.collection(collectionName).get();
  const unique = new Map();
  snapshot.forEach((doc) => {
    const candidates = extractSalesmenFromCustomer(doc.data());
    candidates.forEach((name) => {
      const key = normalizeSalesmanKey(name);
      if (!key || unique.has(key)) return;
      unique.set(key, {
        id: `${brandKey}_${key}`,
        name,
        normalized: key,
        brand: brandKey,
      });
    });
  });

  if (!unique.size) {
    return { totalCustomers: snapshot.size, inserted: 0 };
  }

  let batch = db.batch();
  const commits = [];
  let writes = 0;
  unique.forEach((item) => {
    const ref = db.collection('salesmen').doc(item.id);
    batch.set(ref, {
      name: item.name,
      brand: item.brand,
      normalized: item.normalized,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    writes += 1;
    if (writes % 400 === 0) {
      commits.push(batch.commit());
      batch = db.batch();
    }
  });
  commits.push(batch.commit());
  await Promise.all(commits);
  return { totalCustomers: snapshot.size, inserted: unique.size };
}

async function rebuildSalesmenCollections(targetBrand) {
  const brands = targetBrand ? [targetBrand] : Object.keys(BRAND_CONFIG);
  for (const brandKey of brands) {
    const collection = BRAND_CONFIG[brandKey].customerCollection;
    console.log(`\n?? Rebuilding salesmen for ${BRAND_CONFIG[brandKey].label} (${collection})`);
    const removed = await deleteSalesmenForBrand(brandKey);
    if (removed) {
      console.log(`  Removed ${removed} existing salesmen entries.`);
    }
    const { totalCustomers, inserted } = await upsertSalesmenForBrand(brandKey, collection);
    console.log(`  Customers scanned: ${totalCustomers}`);
    console.log(`  Unique salesmen saved: ${inserted}`);
  }
  console.log('\n? Salesmen rebuild complete.');
}
// ---------------------------------------------------------------------------
// User Management
// ---------------------------------------------------------------------------
async function updateUsersCollection() {
  console.log('\n?? Updating users collection to align with latest fields...');
  
  // Get all users from the users collection
  const usersSnapshot = await db.collection('users').get();
  
  if (usersSnapshot.empty) {
    console.log('?? No users found in the users collection.');
    return;
  }

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  const batchSize = 100;

  for (let i = 0; i < usersSnapshot.docs.length; i += batchSize) {
    const chunk = usersSnapshot.docs.slice(i, i + batchSize);
    const batch = db.batch();

    for (const doc of chunk) {
      try {
        const userData = doc.data();
        const updates = {};

        // Check if merchIds field exists, if not add it
        if (!userData.merchIds) {
          updates.merchIds = [];
        }

        // Check if brands field exists, if not add it
        if (!userData.brands) {
          updates.brands = [];
        }

        // Check if role field exists, if not add default
        if (!userData.role) {
          updates.role = 'salesman';
        }

        // Check if name field exists, if not construct it from firstName and lastName
        if (!userData.name && (userData.firstName || userData.lastName)) {
          const firstName = userData.firstName || '';
          const lastName = userData.lastName || '';
          updates.name = `${firstName} ${lastName}`.trim();
        }

        // Check if createdAt field exists, if not add it
        if (!userData.createdAt) {
          updates.createdAt = admin.firestore.FieldValue.serverTimestamp();
        }

        // Always update updatedAt
        updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

        if (Object.keys(updates).length > 0) {
          batch.update(doc.ref, updates);
          updated += 1;
        } else {
          skipped += 1;
        }
        processed += 1;
      } catch (error) {
        console.error('? User update error:', error.message);
        skipped += 1;
      }
    }

    await batch.commit();
    printProgress(Math.min(processed, usersSnapshot.docs.length), usersSnapshot.docs.length, 'Updating users');
  }

  process.stdout.write('\n');
  console.log(`? Users collection update complete: processed=${processed}, updated=${updated}, skipped=${skipped}`);
}

async function rebuildSalesmenFromCustomers() {
  console.log('\n?? Rebuilding salesmen collection from customers...');
  
  const brands = Object.keys(BRAND_CONFIG);
  let totalProcessed = 0;
  let totalInserted = 0;

  for (const brandKey of brands) {
    const collection = BRAND_CONFIG[brandKey].customerCollection;
    console.log(`\n?? Processing ${BRAND_CONFIG[brandKey].label} customers (${collection})...`);
    
    const snapshot = await db.collection(collection).get();
    const unique = new Map();
    
    snapshot.forEach((doc) => {
      const customerData = doc.data();
      const candidates = extractSalesmenFromCustomer(customerData);
      
      candidates.forEach((name) => {
        const key = normalizeSalesmanKey(name);
        if (!key || unique.has(key)) return;
        
        // Extract merch value from customer data
        const merchValue = customerData.merch || name;
        
        unique.set(key, {
          id: `${brandKey}_${key}`,
          name,
          normalized: key,
          brand: brandKey,
          merch: merchValue, // Add the actual merch value from customer
        });
      });
    });

    if (!unique.size) {
      console.log(`  No salesmen found in ${BRAND_CONFIG[brandKey].label} customers.`);
      continue;
    }

    // Delete existing salesmen for this brand
    const existingSnapshot = await db.collection('salesmen').where('brand', '==', brandKey).get();
    if (!existingSnapshot.empty) {
      const deleteBatch = db.batch();
      existingSnapshot.docs.forEach((doc) => deleteBatch.delete(doc.ref));
      await deleteBatch.commit();
      console.log(`  Removed ${existingSnapshot.size} existing salesmen entries for ${brandKey}.`);
    }

    // Insert new salesmen
    let batch = db.batch();
    const commits = [];
    let writes = 0;
    
    unique.forEach((item) => {
      const ref = db.collection('salesmen').doc(item.id);
      batch.set(ref, {
        name: item.name,
        brand: item.brand,
        normalized: item.normalized,
        merch: item.merch,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      writes += 1;
      
      if (writes % 400 === 0) {
        commits.push(batch.commit());
        batch = db.batch();
      }
    });
    
    commits.push(batch.commit());
    await Promise.all(commits);
    
    console.log(`  Customers scanned: ${snapshot.size}`);
    console.log(`  Unique salesmen saved: ${unique.size}`);
    
    totalProcessed += snapshot.size;
    totalInserted += unique.size;
  }

  console.log(`\n? Salesmen rebuild complete: ${totalProcessed} customers processed, ${totalInserted} salesmen inserted.`);
}

async function inspectSalesmenCollection() {
  console.log('\n?? Inspecting salesmen collection...');
  
  const salesmenSnapshot = await db.collection('salesmen').get();
  
  if (salesmenSnapshot.empty) {
    console.log('? Salesmen collection is empty!');
    return;
  }
  
  console.log(`?? Total salesmen documents: ${salesmenSnapshot.docs.length}`);
  console.log('\n?? Salesmen details:');
  
  salesmenSnapshot.docs.forEach((doc, index) => {
    const data = doc.data();
    console.log(`\n${index + 1}. Document ID: ${doc.id}`);
    console.log(`   Name: ${data.name || 'MISSING'}`);
    console.log(`   Brand: ${data.brand || 'MISSING'}`);
    console.log(`   Merch: ${data.merch || 'MISSING'}`);
    console.log(`   Normalized: ${data.normalized || 'MISSING'}`);
    console.log(`   UpdatedAt: ${data.updatedAt ? 'Present' : 'MISSING'}`);
  });
  
  // Group by brand
  const byBrand = {};
  salesmenSnapshot.docs.forEach(doc => {
    const brand = doc.data().brand || 'unknown';
    if (!byBrand[brand]) byBrand[brand] = [];
    byBrand[brand].push(doc.data().name || 'unnamed');
  });
  
  console.log('\n?? Salesmen by brand:');
  Object.entries(byBrand).forEach(([brand, names]) => {
    console.log(`   ${brand}: ${names.length} salesmen (${names.join(', ')})`);
  });
}

async function userManagementMenu() {
  while (true) {
    console.log(`
5. User Management
  5.1 Update users collection to align with latest fields
  5.2 Rebuild salesmen collection from customers
  5.3 Inspect salesmen collection
  0. Back`);
    const choice = (await askQuestion('Select option: ')).trim();
    switch (choice) {
      case '1':
      case '5.1':
        await updateUsersCollection();
        break;
      case '2':
      case '5.2':
        await rebuildSalesmenFromCustomers();
        break;
      case '3':
      case '5.3':
        await inspectSalesmenCollection();
        break;
      case '0':
        return;
      default:
        console.log('? Invalid option.');
    }
  }
}

// ---------------------------------------------------------------------------
// Menus
// ---------------------------------------------------------------------------
async function playmobilMenu() {
  while (true) {
    console.log(`
1. Playmobil
  1.1 Import Playmobil products
  1.2 Import Playmobil customers
  1.3 Delete Playmobil products collection
  1.4 Delete Playmobil customers collection
  1.5 Delete Playmobil orders of a USER (choose from list)
  1.6 Delete ALL Playmobil orders
  0. Back`);
    const choice = (await askQuestion('Select option: ')).trim();
    switch (choice) {
      case '1':
      case '1.1':
        await importPlaymobilProducts();
        break;
      case '2':
      case '1.2':
        await importPlaymobilCustomers();
        break;
      case '3':
      case '1.3':
        await deleteAllInCollection(BRAND_CONFIG.playmobil.productCollection);
        break;
      case '4':
      case '1.4':
        await deleteAllInCollection(BRAND_CONFIG.playmobil.customerCollection);
        break;
      case '5':
      case '1.5':
        await deleteOrdersForUserFlow('playmobil');
        break;
      case '6':
      case '1.6':
        await confirmAndDeleteAllOrders('playmobil');
        break;
      case '0':
        return;
      default:
        console.log('? Invalid option.');
    }
  }
}

async function kivosMenu() {
  while (true) {
    console.log(`
2. Kivos
  2.1 Import Kivos products
  2.2 Import Kivos customers
  2.3 Delete Kivos products collection
  2.4 Delete Kivos customers collection
  2.5 Delete Kivos orders of a USER (choose from list)
  2.6 Delete ALL Kivos orders
  0. Back`);
    const choice = (await askQuestion('Select option: ')).trim();
    switch (choice) {
      case '1':
      case '2.1':
        await importKivosProducts();
        break;
      case '2':
      case '2.2':
        await importKivosCustomers();
        break;
      case '3':
      case '2.3':
        await deleteAllInCollection(BRAND_CONFIG.kivos.productCollection);
        break;
      case '4':
      case '2.4':
        await deleteAllInCollection(BRAND_CONFIG.kivos.customerCollection);
        break;
      case '5':
      case '2.5':
        await deleteOrdersForUserFlow('kivos');
        break;
      case '6':
      case '2.6':
        await confirmAndDeleteAllOrders('kivos');
        break;
      case '0':
        return;
      default:
        console.log('? Invalid option.');
    }
  }
}

async function johnMenu() {
  while (true) {
    console.log(`
3. John
  3.1 Import John products
  3.2 Import John customers
  3.3 Delete John products collection
  3.4 Delete John customers collection
  3.5 Delete John orders of a USER (choose from list)
  3.6 Delete ALL John orders
  0. Back`);
    const choice = (await askQuestion('Select option: ')).trim();
    switch (choice) {
      case '1':
      case '3.1':
        await importJohnProducts();
        break;
      case '2':
      case '3.2':
        await importJohnCustomers();
        break;
      case '3':
      case '3.3':
        await deleteAllInCollection(BRAND_CONFIG.john.productCollection);
        break;
      case '4':
      case '3.4':
        await deleteAllInCollection(BRAND_CONFIG.john.customerCollection);
        break;
      case '5':
      case '3.5':
        await deleteOrdersForUserFlow('john');
        break;
      case '6':
      case '3.6':
        await confirmAndDeleteAllOrders('john');
        break;
      case '0':
        return;
      default:
        console.log('? Invalid option.');
    }
  }
}

async function superMarketMenu() {
  while (true) {
    console.log(`
9. SuperMarket Management (John)
  9.1 Import SuperMarket Stores
  9.2 Import SuperMarket Listings
  9.3 Delete SuperMarket Stores collection
  9.4 Delete SuperMarket Listings collection
  9.5 Inspect SuperMarket Stores (WIP)
  9.6 Inspect SuperMarket Listings (WIP)
  0. Back`);
    const choice = (await askQuestion('Select option: ')).trim();
    switch (choice) {
      case '1':
      case '9.1':
        await importSuperMarketStores();
        break;
      case '2':
      case '9.2':
        await importSuperMarketListings();
        break;
      case '3':
      case '9.3':
        await deleteAllInCollection(SUPERMARKET_COLLECTIONS.stores);
        break;
      case '4':
      case '9.4':
        await deleteAllInCollection(SUPERMARKET_COLLECTIONS.listings);
        break;
      case '5':
      case '9.5':
        console.log('? Inspect SuperMarket Stores not implemented yet.');
        break;
      case '6':
      case '9.6':
        console.log('? Inspect SuperMarket Listings not implemented yet.');
        break;
      case '0':
        return;
      default:
        console.log('? Invalid option.');
    }
  }
}

async function mainMenu() {
  while (true) {
    console.log(`
==============================
** Firestore Import/Manage
1. Playmobil
2. Kivos
3. John
4. Rebuild salesmen collection from customers
5. User Management
6. SuperMarket Management (John)
0. Exit
==============================`);
    const choice = (await askQuestion('Choose option: ')).trim();

    switch (choice) {
      case '1':
        await playmobilMenu();
        break;
      case '2':
        await kivosMenu();
        break;
      case '3':
        await johnMenu();
        break;
      case '4': {
        const brandInput = (await askQuestion('Enter brand (playmobil/kivos/john) or leave empty for all: ')).trim().toLowerCase();
        const brand = brandInput ? brandInput : null;
        if (brand && !BRAND_CONFIG[brand]) {
          console.log('? Unknown brand. Available: playmobil, kivos, john.');
          break;
        }
        await rebuildSalesmenCollections(brand || undefined);
        break;
      }
      case '5':
        await userManagementMenu();
        break;
      case '6':
      case '9':
        await superMarketMenu();
        break;
      case '0':
        console.log('?? Exiting?');
        rl.close();
        process.exit(0);
      default:
        console.log('? Invalid choice. Please try again.');
    }
  }
}

mainMenu().catch((error) => {
  console.error('Fatal error:', error);
  rl.close();
  process.exit(1);
});








