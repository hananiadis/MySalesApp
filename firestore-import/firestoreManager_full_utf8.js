// firestoreManager_full.js
// Unified CLI for Firestore imports and maintenance per brand
const admin = require('firebase-admin');
const axios = require('axios');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const readline = require('readline');

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

function printProgress(current, total, label = '') {
  if (!total || total <= 0) {
    process.stdout.clearLine?.();
    process.stdout.cursorTo?.(0);
    process.stdout.write(`${label} � processed: ${current}\r`);
    return;
  }
  const percent = Math.min(100, Math.round((current / total) * 100));
  const barLength = 20;
  const filledLength = Math.round((percent / 100) * barLength);
  const bar = '�'.repeat(filledLength) + '-'.repeat(barLength - filledLength);
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
  return null;
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
  const rows = await fetchCsvRows(`https://docs.google.com/spreadsheets/d/${GOOGLE_SHEETS.PLAYMOBIL_PRODUCTS}/export?format=csv&gid=0`);
  console.log('\n?? Importing Playmobil products...');
  let processed = 0;
  let skipped = 0;
  const batchSize = 500;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const batch = db.batch();

    for (const row of chunk) {
      try {
        const codeAliases = [
          '\u039a\u03a9\u0394\u0399\u039a\u039f\u03a3\u0020\u03a0\u03a1\u039f\u03aa\u039f\u039d\u03a4\u039f\u03a3',
          '\u039a\u03a9\u0394\u0399\u039a\u039f\u03a3',
          'Product Code',
          'ProductCode',
          'Code',
          '??????? ?????????',
          '???????',
          '???????',
        ];
        const code = sanitizeText(pick(row, codeAliases));
        if (!code) { skipped += 1; continue; }

        const description = sanitizeText(pick(row, ['\u03a0\u0395\u03a1\u0399\u0393\u03a1\u0391\u03a6\u0397', 'Description', '?????????']));
        const brandLabel = sanitizeText(row['Brand']);
        const category = sanitizeText(
          pick(row, ['\u039a\u03b1\u03c4\u03b7\u03b3\u03bf\u03c1\u03af\u03b1\u0020\u03b5\u03af\u03b4\u03bf\u03c5\u03c2', '????????? ??????'])
        );
        const mm = sanitizeText(row['MM']);

        const piecesPerBoxRaw = pick(row, [
          '\u03a4\u0395\u039c\u0391\u03a7\u0399\u0391\u0020\u0391\u039d\u0391\u0020\u039a\u039f\u03a5\u03a4\u0399',
          '\u03a4\u0395\u039c\u0391\u03a7\u0399\u0391\u0020\u0391\u039d\u0391\u0020\u039a\u039f\u03a5\u03a4\u0399\u002f\u03a4\u0395\u039c\u002e',
          'Pieces per box',
          'Pieces Per Box',
          '??????? ??? ?????',
          '??????? ??? ?????/???.',
        ]);
        const piecesPerCartonRaw = pick(row, [
          '\u03a4\u0395\u039c\u0391\u03a7\u0399\u0391\u0020\u0391\u039d\u0391\u0020\u039a\u0399\u0392\u03a9\u03a4\u0399\u039f',
          'Pieces per carton',
          'Pieces Per Carton',
          '??????? ??? ???????',
        ]);
        const piecesPerBox = sanitizeText(piecesPerBoxRaw);
        const piecesPerCarton = sanitizeText(piecesPerCartonRaw);
        let packaging = sanitizeText(pick(row, ['\u03a3\u03a5\u03a3\u039a\u0395\u03a5\u0391\u03a3\u0399\u0391', '??????????']));
        if (!packaging) {
          const parts = [sanitizeText(piecesPerBoxRaw), sanitizeText(piecesPerCartonRaw)].filter(Boolean);
          if (parts.length) packaging = parts.join('/');
        }
        const piecesPerPack = sanitizeText(
          pick(row, ['Pieces per pack', 'Pieces Per Pack', '\u03a4\u0395\u039c\u0391\u03a7\u0399\u0391\u0020\u0391\u039d\u0391\u0020\u03a3\u03a5\u03a3\u039a\u0395\u03a5\u0391\u03a3\u0399\u0391', '??????? ??? ?????/???.'])
        ) || packaging;

        const wholesalePrice = roundCurrency(
          normalizeDecimal(
            pick(row, [
              '\u03a4\u0399\u039c\u0397\u0020\u03a4\u0395\u039c\u0391\u03a7\u0399\u039f\u03a5\n\u0020\u0020\u0395\u03a5\u03a1\u03a9',
              '\u03a4\u0399\u039c\u0397\u0020\u03a4\u0395\u039c\u0391\u03a7\u0399\u039f\u03a5\n\u0020\u0395\u03a5\u03a1\u03a9',
              '\u03a4\u0399\u039c\u0397\u0020\u03a4\u0395\u039c\u0391\u03a7\u0399\u039f\u03a5\u0020\u0395\u03a5\u03a1\u03a9',
              '???? ????????\n ????',
              '???? ????????\n????',
              '???? ???????? ????',
              '???? ???????? ????',
              '???? ????????',
            ])
          )
        );
        const offerPrice = roundCurrency(
          normalizeDecimal(
            pick(row, [
              '\u03a4\u0399\u039c\u0397\u0020\u03a4\u0395\u039c\u0391\u03a7\u0399\u039f\u03a5\n\u0020\u0020\u03a0\u03a1\u039f\u03a3\u03a6\u039f\u03a1\u0391\u03a3\u0020\u0395\u03a5\u03a1\u03a9',
              '\u03a4\u0399\u039c\u0397\u0020\u03a4\u0395\u039c\u0391\u03a7\u0399\u039f\u03a5\n\u0020\u03a0\u03a1\u039f\u03a3\u03a6\u039f\u03a1\u0391\u03a3\u0020\u0395\u03a5\u03a1\u03a9',
              '\u03a4\u0399\u039c\u0397\u0020\u03a4\u0395\u039c\u0391\u03a7\u0399\u039f\u03a5\u0020\u03a0\u03a1\u039f\u03a3\u03a6\u039f\u03a1\u0391\u03a3\u0020\u0395\u03a5\u03a1\u03a9',
              '???? ????????\n ????????? ????',
              '???? ????????\n????????? ????',
              '???? ???????? ????????? ????',
              '???? ???????? ????????? ????',
            ])
          )
        );

        const barcodeUnit = sanitizeText(
          pick(row, ['\u0042\u0041\u0052\u0043\u004f\u0044\u0045\u0020\u03a4\u0395\u039c\u0391\u03a7\u0399\u039f\u03a5', 'BARCODE ????????', 'Barcode'])
        );
        const barcodeBox = sanitizeText(
          pick(row, ['\u0042\u0041\u0052\u0043\u004f\u0044\u0045\u0020\u039a\u039f\u03a5\u03a4\u0399\u039f\u03a5', 'BARCODE ???????'])
        );
        const barcodeCarton = sanitizeText(
          pick(row, ['\u0042\u0041\u0052\u0043\u004f\u0044\u0045\u0020\u039a\u0399\u0392\u03a9\u03a4\u0399\u039f\u03a5', 'BARCODE ????????'])
        );
        const discount = normalizeDecimal(row['Discount']);
        const discountEndsAt = sanitizeText(row['Discount.End.Date']);
        const descriptionFull = sanitizeText(pick(row, ['Description']));
        const productUrl = sanitizeUrl(pick(row, ['Product Url']));
        const frontCoverCloudinary = sanitizeUrl(pick(row, ['Cloudinary Image Url', 'Cloudinary Url']));
        const frontCoverLegacy = sanitizeUrl(pick(row, ['Product Image Url', 'Image Url']));
        const frontCover = frontCoverCloudinary || frontCoverLegacy;

        const docRef = db.collection(BRAND_CONFIG.playmobil.productCollection).doc(code);
        const payload = {
          productCode: code,
          description,
          descriptionFull,
          supplierBrand: brandLabel,
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
          discount,
          discountEndsAt,
          productUrl,
          frontCover,
          brand: 'playmobil',
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (offerPrice !== null) {
          payload.offerPrice = offerPrice;
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
}

async function importKivosProducts() {
  console.log('\n>> Importing Kivos products...');
  const workbook = await fetchXlsxWorkbook(GOOGLE_SHEETS.KIVOS_PRODUCTS);
  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) throw new Error('No worksheet found inside the Kivos products file.');
  const rows = sheetRowsFromWorkbook(workbook, sheetName);

  if (!Array.isArray(rows) || rows.length === 0) {
    console.log('>> No rows detected in Kivos products workbook.');
    return;
  }

  let processed = 0;
  let skipped = 0;
  const batchSize = 300;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const batch = db.batch();

    for (const row of chunk) {
      try {
        const codeAliases = [
          '\u039a\u03a9\u0394\u0399\u039a\u039f\u03a3\u0020\u03a0\u03a1\u039f\u03aa\u039f\u039d\u03a4\u039f\u03a3',
          '\u039a\u03a9\u0394\u0399\u039a\u039f\u03a3',
          'Product Code',
          'ProductCode',
          'Code',
          '??????? ?????????',
          '???????',
          '???????',
        ];
        const code = sanitizeText(pick(row, codeAliases));
        if (!code) { skipped += 1; continue; }

        const description = sanitizeText(pick(row, ['\u03a0\u0395\u03a1\u0399\u0393\u03a1\u0391\u03a6\u0397', 'Description', '?????????']));
        const brandLabel = sanitizeText(row['Brand']);
        const category = sanitizeText(
          pick(row, ['\u039a\u03b1\u03c4\u03b7\u03b3\u03bf\u03c1\u03af\u03b1\u0020\u03b5\u03af\u03b4\u03bf\u03c5\u03c2', '????????? ??????'])
        );
        const mm = sanitizeText(row['MM']);

        const piecesPerBoxRaw = pick(row, [
          '\u03a4\u0395\u039c\u0391\u03a7\u0399\u0391\u0020\u0391\u039d\u0391\u0020\u039a\u039f\u03a5\u03a4\u0399',
          '\u03a4\u0395\u039c\u0391\u03a7\u0399\u0391\u0020\u0391\u039d\u0391\u0020\u039a\u039f\u03a5\u03a4\u0399\u002f\u03a4\u0395\u039c\u002e',
          'Pieces per box',
          'Pieces Per Box',
          '??????? ??? ?????',
          '??????? ??? ?????/???.',
        ]);
        const piecesPerCartonRaw = pick(row, [
          '\u03a4\u0395\u039c\u0391\u03a7\u0399\u0391\u0020\u0391\u039d\u0391\u0020\u039a\u0399\u0392\u03a9\u03a4\u0399\u039f',
          'Pieces per carton',
          'Pieces Per Carton',
          '??????? ??? ???????',
        ]);
        const piecesPerBox = sanitizeText(piecesPerBoxRaw);
        const piecesPerCarton = sanitizeText(piecesPerCartonRaw);
        let packaging = sanitizeText(pick(row, ['\u03a3\u03a5\u03a3\u039a\u0395\u03a5\u0391\u03a3\u0399\u0391', '??????????']));
        if (!packaging) {
          const parts = [sanitizeText(piecesPerBoxRaw), sanitizeText(piecesPerCartonRaw)].filter(Boolean);
          if (parts.length) packaging = parts.join('/');
        }
        const piecesPerPack = sanitizeText(
          pick(row, ['Pieces per pack', 'Pieces Per Pack', '\u03a4\u0395\u039c\u0391\u03a7\u0399\u0391\u0020\u0391\u039d\u0391\u0020\u03a3\u03a5\u03a3\u039a\u0395\u03a5\u0391\u03a3\u0399\u0391', '??????? ??? ?????/???.'])
        ) || packaging;

        const wholesalePrice = roundCurrency(
          normalizeDecimal(
            pick(row, [
              '\u03a4\u0399\u039c\u0397\u0020\u03a4\u0395\u039c\u0391\u03a7\u0399\u039f\u03a5\n\u0020\u0020\u0395\u03a5\u03a1\u03a9',
              '\u03a4\u0399\u039c\u0397\u0020\u03a4\u0395\u039c\u0391\u03a7\u0399\u039f\u03a5\n\u0020\u0395\u03a5\u03a1\u03a9',
              '\u03a4\u0399\u039c\u0397\u0020\u03a4\u0395\u039c\u0391\u03a7\u0399\u039f\u03a5\u0020\u0395\u03a5\u03a1\u03a9',
              '???? ????????\n ????',
              '???? ????????\n????',
              '???? ???????? ????',
              '???? ???????? ????',
              '???? ????????',
            ])
          )
        );
        const offerPrice = roundCurrency(
          normalizeDecimal(
            pick(row, [
              '\u03a4\u0399\u039c\u0397\u0020\u03a4\u0395\u039c\u0391\u03a7\u0399\u039f\u03a5\n\u0020\u0020\u03a0\u03a1\u039f\u03a3\u03a6\u039f\u03a1\u0391\u03a3\u0020\u0395\u03a5\u03a1\u03a9',
              '\u03a4\u0399\u039c\u0397\u0020\u03a4\u0395\u039c\u0391\u03a7\u0399\u039f\u03a5\n\u0020\u03a0\u03a1\u039f\u03a3\u03a6\u039f\u03a1\u0391\u03a3\u0020\u0395\u03a5\u03a1\u03a9',
              '\u03a4\u0399\u039c\u0397\u0020\u03a4\u0395\u039c\u0391\u03a7\u0399\u039f\u03a5\u0020\u03a0\u03a1\u039f\u03a3\u03a6\u039f\u03a1\u0391\u03a3\u0020\u0395\u03a5\u03a1\u03a9',
              '???? ????????\n ????????? ????',
              '???? ????????\n????????? ????',
              '???? ???????? ????????? ????',
              '???? ???????? ????????? ????',
            ])
          )
        );

        const barcodeUnit = sanitizeText(
          pick(row, ['\u0042\u0041\u0052\u0043\u004f\u0044\u0045\u0020\u03a4\u0395\u039c\u0391\u03a7\u0399\u039f\u03a5', 'BARCODE ????????', 'Barcode'])
        );
        const barcodeBox = sanitizeText(
          pick(row, ['\u0042\u0041\u0052\u0043\u004f\u0044\u0045\u0020\u039a\u039f\u03a5\u03a4\u0399\u039f\u03a5', 'BARCODE ???????'])
        );
        const barcodeCarton = sanitizeText(
          pick(row, ['\u0042\u0041\u0052\u0043\u004f\u0044\u0045\u0020\u039a\u0399\u0392\u03a9\u03a4\u0399\u039f\u03a5', 'BARCODE ????????'])
        );
        const discount = normalizeDecimal(row['Discount']);
        const discountEndsAt = sanitizeText(row['Discount.End.Date']);
        const descriptionFull = sanitizeText(pick(row, ['Description']));
        const productUrl = sanitizeUrl(pick(row, ['Product Url']));
        const frontCoverCloudinary = sanitizeUrl(pick(row, ['Cloudinary Image Url', 'Cloudinary Url']));
        const frontCoverLegacy = sanitizeUrl(pick(row, ['Product Image Url', 'Image Url']));
        const frontCover = frontCoverCloudinary || frontCoverLegacy;

        const docRef = db.collection(BRAND_CONFIG.kivos.productCollection).doc(code);
        const payload = {
          productCode: code,
          description,
          descriptionFull,
          supplierBrand: brandLabel,
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
          discount,
          discountEndsAt,
          productUrl,
          frontCover,
          brand: 'kivos',
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (offerPrice !== null) {
          payload.offerPrice = offerPrice;
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
}

async function importJohnProducts() {
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
        const code = sanitizeText(pick(row, ['??d.', '?O?.', '??d????', 'Product Code', 'Code']));
        if (!code) { skipped += 1; continue; }

        const generalCategory = sanitizeText(pick(row, ['G????? ????G????']));
        const subCategory = sanitizeText(pick(row, ['???????G????']));
        const barcode = sanitizeText(pick(row, ['??d.Barcode', 'Barcode']));
        const description = sanitizeText(pick(row, ['???????? ?e????af?', '?e????af?', 'Description']));
        const packaging = sanitizeText(pick(row, ['S?s?e?as?a']));

        const priceList = roundCurrency(normalizeDecimal(pick(row, ['??�? t?�??ata?????', '??�? t?�/???', '??�? t?�??ata????? NET', 'Price List'])));
        const wholesalePrice = roundCurrency(normalizeDecimal(pick(row, ['???d???? ??�?', 'Wholesale Price'])));
        const srp = roundCurrency(normalizeDecimal(pick(row, ['???te???�e?? ??a???? ??�?', 'Suggested Retail Price'])));
        const productDimensions = sanitizeText(pick(row, ['??ast?se?? ??????t?? (cm)', '??ast?se?? ??????t??']));
        const packageDimensions = sanitizeText(pick(row, ['??ast?se?? S?s?e?as?a? (cm)', '??ast?se?? S?s?e?as?a?']));
        const frontCover = sanitizeUrl(pick(row, ['Cloudinary Url', 'Cloudinary URL', 'F?t???af?a', 'Photo']));

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
        console.error('? John product row error:', error.message);
        skipped += 1;
      }
    }

    await batch.commit();
    printProgress(Math.min(processed + skipped, rows.length), rows.length, 'John products');
  }

  process.stdout.write('\n');
  console.log(`? John products import complete: processed=${processed}, skipped=${skipped}`);
}
// ---------------------------------------------------------------------------
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

  let processed = 0;
  let skipped = 0;
  const batchSize = 400;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const batch = db.batch();

    for (const row of chunk) {
      try {
        const code = sanitizeText(pick(row, ['??d????', 'Customer Code', 'Code']));
        if (!code) { skipped += 1; continue; }

        const docRef = db.collection(BRAND_CONFIG.kivos.customerCollection).doc(code);
        const payload = {
          customerCode: code,
          name: sanitizeText(pick(row, ['?p???�?a', 'Name'])),
          address: {
            street: sanitizeText(pick(row, ['??e????s?', 'Street'])),
            postalCode: sanitizeText(pick(row, ['?.?.', 'Postal Code'])),
            city: sanitizeText(pick(row, ['????', 'City'])),
          },
          contact: {
            telephone1: sanitizeText(pick(row, ['???.1', 'Telephone 1'])),
            telephone2: sanitizeText(pick(row, ['???.2', 'Telephone 2'])),
            fax: sanitizeText(pick(row, ['Fax'])),
            email: sanitizeText(pick(row, ['email', 'E-Mail Address'])),
          },
          vatInfo: {
            registrationNo: sanitizeText(pick(row, ['?.F.?.', 'VAT Registration No.'])),
            office: sanitizeText(pick(row, ['?.?.?.', 'VAT Office'])),
          },
          profession: sanitizeText(pick(row, ['?p???e?�a', 'Profession'])), // Column J
          merch: sanitizeText(pick(row, ['????t??', 'Merch'])), // Column M
          
          // Sales Data (N-P) - Import to Firestore
          InvSales2022: sanitizeText(pick(row, ['?????? ???S? 2022', 'Sales 2022'])), // Column N
          InvSales2023: sanitizeText(pick(row, ['?????? ???S? 2023', 'Sales 2023'])), // Column O
          InvSales2024: sanitizeText(pick(row, ['?????? ???S? 2024', 'Sales 2024'])), // Column P
          
          // Status Fields (S-T) - Updated column positions
          isActive: sanitizeText(pick(row, ['??e????', 'Active'])), // Column S
          channel: sanitizeText(pick(row, ['??????', 'Channel'])), // Column T
          
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
}

async function importJohnCustomers() {
  console.log('\n?? Importing John customers (columns A-M only)...');
  const workbook = await fetchXlsxWorkbook(GOOGLE_SHEETS.JOHN_CUSTOMERS);
  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) throw new Error('No worksheet found for John customers.');
  // Import all columns but only use A-M in the payload
  const rows = sheetRowsFromWorkbook(workbook, sheetName);
  
  console.log(`?? Found ${rows.length} rows in John customers spreadsheet`);
  if (rows.length === 0) {
    console.log('?? No data found in John customers spreadsheet. Check if the spreadsheet has data.');
    return;
  }

  // Debug: Show first row structure
  if (rows.length > 0) {
    console.log('?? First row structure:', Object.keys(rows[0]));
    console.log('?? First row sample:', JSON.stringify(rows[0], null, 2));
  }

  let processed = 0;
  let skipped = 0;
  const batchSize = 400;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const batch = db.batch();

    for (const row of chunk) {
      try {
        const code = sanitizeText(pick(row, ['??d????', 'Customer Code', 'Code']));
        if (!code) { 
          console.log(`?? Skipping row with no code: ${JSON.stringify(row)}`);
          skipped += 1; 
          continue; 
        }

        const docRef = db.collection(BRAND_CONFIG.john.customerCollection).doc(code);
        console.log(`?? Processing John customer: ${code}`);
        const payload = {
          customerCode: code,
          name: sanitizeText(pick(row, ['?p???�?a', 'Name'])),
          address: {
            street: sanitizeText(pick(row, ['??e????s?', 'Street'])),
            postalCode: sanitizeText(pick(row, ['?.?.', 'Postal Code'])),
            city: sanitizeText(pick(row, ['????', 'City'])),
          },
          contact: {
            telephone1: sanitizeText(pick(row, ['???.1', 'Telephone 1'])),
            telephone2: sanitizeText(pick(row, ['???.2', 'Telephone 2'])),
            fax: sanitizeText(pick(row, ['Fax'])),
            email: sanitizeText(pick(row, ['email', 'E-Mail Address'])),
          },
          vatInfo: {
            registrationNo: sanitizeText(pick(row, ['?.F.?.', 'VAT Registration No.'])),
            office: sanitizeText(pick(row, ['?.?.?.', 'VAT Office'])),
          },
          profession: sanitizeText(pick(row, ['?p???e?�a', 'Profession'])), // Column J - Profession
          merch: sanitizeText(pick(row, ['????t??', 'Merch'])),
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

    try {
      await batch.commit();
      console.log(`? Batch committed successfully for John customers`);
    } catch (error) {
      console.error(`? Batch commit failed for John customers:`, error);
    }
    printProgress(Math.min(processed + skipped, rows.length), rows.length, 'John customers');
  }

  process.stdout.write('\n');
  console.log(`? John customers import complete: processed=${processed}, skipped=${skipped}`);
}
// ---------------------------------------------------------------------------
// Deletion primitives
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
  console.log(`\n?? Scanning "${collectionPath}" for users �`);
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
  console.log(`\n?? Deleting orders for userId="${userId}" in "${collectionPath}" �`);
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
      case '0':
        console.log('?? Exiting�');
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
