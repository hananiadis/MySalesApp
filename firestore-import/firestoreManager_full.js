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

// --- Utilities ---
function sanitizeText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  const invalid = ['#REF!', '#VALUE!', '#ERROR!', 'N/A', 'NULL', 'null', 'undefined'];
  if (invalid.includes(text)) return null;
  return text;
}
function sanitizeUrl(value) {
  const text = sanitizeText(value);
  if (!text) return null;
  if (/^=IMAGE\((['"])(.+?)\1/i.test(text)) {
    return text.match(/^=IMAGE\((['"])(.+?)\1/i)[2];
  }
  return /^https?:\/\//i.test(text) ? text : null;
}
function normalizeDecimal(value) {
  // Accept numbers directly
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (value === null || value === undefined) return null;

  // Convert to string and trim
  const raw = String(value).trim();
  if (!raw) return null;

  // Common garbage -> null
  const bad = /^(?:-|—|N\/A|null|undefined|#REF!|#VALUE!|#ERROR!)$/i;
  if (bad.test(raw)) return null;

  // Remove currency symbols & spaces
  const stripped = raw.replace(/[€$£\s]/g, '');

  // If both comma and dot appear, assume:
  // - the rightmost one is the decimal separator
  // - all others are thousands separators
  const lastComma = stripped.lastIndexOf(',');
  const lastDot = stripped.lastIndexOf('.');
  const decIdx = Math.max(lastComma, lastDot);

  const toNum = (intPart, fracPart = '') => {
    const i = (intPart || '').replace(/[^0-9-]/g, '');  // keep minus if present
    const f = (fracPart || '').replace(/[^0-9]/g, '');
    const composed = f ? `${i}.${f}` : i;
    const n = Number(composed);
    return Number.isFinite(n) ? n : null;
  };

  if (decIdx === -1) {
    // No explicit decimal separator → remove all non-digits and minus
    const onlyDigits = stripped.replace(/[^0-9-]/g, '');
    if (!onlyDigits || onlyDigits === '-' || onlyDigits === '--') return null;
    return toNum(onlyDigits);
  }

  // Split around the rightmost separator
  const intPart = stripped.slice(0, decIdx);
  const fracPart = stripped.slice(decIdx + 1);

  return toNum(intPart, fracPart);
}
function roundCurrency(value) {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}
function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined) return false;
  const s = String(value).trim().toLowerCase();
  return ['true', '1', 'yes', 'x', 'ok', 'ναι'].includes(s);
}
// Keep this convenience wrapper for all numeric reads coming from sheets.
function asNumber(value) {
  return normalizeDecimal(value);
}
function makeIdSegment(v) {
  return String(v || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
}
function rowIsEmpty(row) {
  return !Array.isArray(row) || !row.some((c) => !!(c && String(c).trim()));
}
function findColumnIndex(header, names) {
  const norm = (v) => String(v || '').trim().toLowerCase().replace(/[^a-z0-9α-ω]/g, '');
  const normalized = header.map(norm);
  for (const n of names) {
    const idx = normalized.indexOf(norm(n));
    if (idx !== -1) return idx;
  }
  return -1;
}
function printProgress(current, total, label = '') {
  const percent = total ? Math.min(100, Math.round((current / total) * 100)) : 0;
  process.stdout.clearLine?.();
  process.stdout.cursorTo?.(0);
  process.stdout.write(`${label} ${percent}% (${current}/${total})`);
}

// --- Constants ---
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

const SUPERMARKET_SHEETS = {
  LISTINGS: '1GPfMydqVMyDjjmhEIjWLP5kN2Vs21v8YdJgr15ins0c',
  STORES: '1pr6HRuTRbRUpqYVYKLuiV7qZ2uqR-bm0sObZom6_m1s',
};

const SUPERMARKET_COLLECTIONS = {
  listings: 'supermarket_listings',
  stores: 'supermarket_stores',
};

async function fetchXlsxWorkbook(sheetId) {
  const response = await axios.get(
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`,
    { responseType: 'arraybuffer' }
  );
  if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
  return XLSX.read(response.data, { type: 'buffer' });
}

// ---------------------------------------------------------------------------
// PLAYMOBIL IMPORTS
// ---------------------------------------------------------------------------
async function importPlaymobilProducts() {
  console.log('\n📦 Importing Playmobil products...');
  const response = await axios.get(
    'https://docs.google.com/spreadsheets/d/101kDd35o6MBky5KYx0i8MNA5GxIUiNGgYf_01T_7I4c/export?format=csv&gid=0'
  );
  const rows = [];
  await new Promise((resolve, reject) => {
    require('streamifier')
      .createReadStream(response.data)
      .pipe(csv())
      .on('data', (r) => rows.push(r))
      .on('end', resolve)
      .on('error', reject);
  });

  const batchSize = 400;
  let processed = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = db.batch();
    const chunk = rows.slice(i, i + batchSize);
    chunk.forEach((row) => {
      const code = sanitizeText(row['Product Code'] || row['Code']);
      if (!code) return;
      const ref = db.collection('products').doc(code);
      const data = {
        productCode: code,
        description: sanitizeText(row['Product Description']),
        wholesalePrice: roundCurrency(normalizeDecimal(row['Wh Price'])),
        srp: roundCurrency(normalizeDecimal(row['SRP'])),
        frontCover: sanitizeUrl(row['Front Cover']),
        launchDate: sanitizeText(row['Launch Month']),
        brand: 'playmobil',
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      };
      batch.set(ref, data, { merge: true });
      processed++;
    });
    await batch.commit();
    printProgress(processed, rows.length, 'Playmobil');
  }
  process.stdout.write('\n');
  console.log('✅ Playmobil products import done.');
}
// ---------------------------------------------------------------------------
// KIVOS IMPORTS
// ---------------------------------------------------------------------------
async function importKivosProducts() {
  console.log('\n📦 Importing Kivos products...');
  const wb = await fetchXlsxWorkbook('18qaTqILCUFuEvqcEM47gc-Ytj3GyNS1LI3Xkfx46Z48');
  const sheet = wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: null });
  const batchSize = 300;
  let processed = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = db.batch();
    const chunk = rows.slice(i, i + batchSize);
    chunk.forEach((row) => {
      const code = sanitizeText(row['ΚΩΔΙΚΟΣ ΠΡΟΪΟΝΤΟΣ'] || row['Product Code']);
      if (!code) return;
      const ref = db.collection('products_kivos').doc(code);
      const data = {
        productCode: code,
        description: sanitizeText(row['ΠΕΡΙΓΡΑΦΗ']),
        packaging: sanitizeText(row['ΣΥΣΚΕΥΑΣΙΑ']),
        wholesalePrice: roundCurrency(normalizeDecimal(row['ΤΙΜΗ ΤΕΜΑΧΙΟΥ ΕΥΡΩ'])),
        brand: 'kivos',
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      };
      batch.set(ref, data, { merge: true });
      processed++;
    });
    await batch.commit();
    printProgress(processed, rows.length, 'Kivos');
  }
  process.stdout.write('\n');
  console.log('✅ Kivos products import done.');
}

// ---------------------------------------------------------------------------
// JOHN IMPORTS (final structure-aligned version)
// ---------------------------------------------------------------------------
async function importJohnProducts() {
  console.log('\n📦 Importing John products...');

  const wb = await fetchXlsxWorkbook('18IFOPzzFvzXEgGOXNN0X1_mfZcxk2LlT_mRQj3Fqsv8');

  const allRows = [];
  wb.SheetNames.forEach((sheetName) => {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
    console.log(`📄 Loaded sheet "${sheetName}" with ${rows.length} rows`);
    rows.forEach((r) => allRows.push({ ...r, __sheetName: sheetName }));
  });

  console.log(`📊 Total rows read from workbook: ${allRows.length}`);
  if (allRows[0]) console.log('🔑 Header keys sample:', Object.keys(allRows[0]));

  const batchSize = 400;
  let processed = 0;
  let skipped = 0;

  for (let i = 0; i < allRows.length; i += batchSize) {
    const batch = db.batch();
    const chunk = allRows.slice(i, i + batchSize);

    chunk.forEach((row, idx) => {
      // --- tolerant product code field names ---
      const codeRaw =
        row['ΚΩΔ.'] ||
        row['Κωδ.'] ||
        row['ΚΩΔΙΚΟΣ'] ||
        row['ΚΩΔΙΚΟΣ ΠΡΟΪΟΝΤΟΣ'] ||
        row['ΚΩΔ'] ||
        row['Κωδικός'] ||
        row['Product Code'] ||
        row['Code'];
      const code = sanitizeText(codeRaw);
      if (!code) {
        skipped++;
        console.log(`⚠️ [Row ${i + idx + 1}] Skipped - no valid code`);
        return;
      }

      const ref = db.collection('products_john').doc(code);

      // --- field mappings based on your actual sheet headers ---
      const data = {
        productCode: code,
        barcode: sanitizeText(row['Κωδ.Barcode']),
        brand: 'john',
        generalCategory: sanitizeText(row['ΓΕΝΙΚΗ ΚΑΤΗΓΟΡΙΑ']),
        subCategory: sanitizeText(row['ΥΠΟΚΑΤΗΓΟΡΙΑ']),
        description: sanitizeText(row['Ελληνική Περιγραφή']),
        packaging: sanitizeText(row['Συσκευασία']),
        priceList: roundCurrency(normalizeDecimal(row['Τιμή τιμοκαταλόγου'])),
        wholesalePrice: roundCurrency(normalizeDecimal(row['Χονδρική Τιμή'])),
        srp: roundCurrency(
          normalizeDecimal(
            row['Προτεινόμενη Λιανική Τιμή'] ||
              row['Λιανική Τιμή'] ||
              row['SRP']
          )
        ),
        frontCover: sanitizeText(row['Cloudinary Url']),
        sheetCategory: sanitizeText(row.__sheetName),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      };

      // only add non-empty values
      Object.keys(data).forEach((k) => {
        if (data[k] === '' || data[k] === 'N/A' || data[k] == null) delete data[k];
      });

      batch.set(ref, data, { merge: true });
      processed++;
    });

    await batch.commit();
    printProgress(processed, allRows.length, 'John');
  }

  console.log(`\n✅ John products import done. Processed ${processed}, skipped ${skipped}`);
}
// ---------------------------------------------------------------------------
// CUSTOMER IMPORTS
// ---------------------------------------------------------------------------
async function importPlaymobilCustomers() {
  console.log('\n👥 Importing Playmobil customers...');
  const response = await axios.get(
    'https://docs.google.com/spreadsheets/d/15iBRyUE0izGRi7qY_VhZgbdH7tojL1hq3F0LI6oIjqQ/export?format=csv&gid=0'
  );
  const rows = [];
  await new Promise((resolve, reject) => {
    require('streamifier')
      .createReadStream(response.data)
      .pipe(csv())
      .on('data', (r) => rows.push(r))
      .on('end', resolve)
      .on('error', reject);
  });

  const batchSize = 400;
  let processed = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = db.batch();
    const chunk = rows.slice(i, i + batchSize);
    chunk.forEach((r) => {
      const code = sanitizeText(r['Customer Code']);
      if (!code) return;
      const ref = db.collection('customers').doc(code);
      const data = {
        customerCode: code,
        name: sanitizeText(r['Name']),
        address: sanitizeText(r['Street']),
        city: sanitizeText(r['City']),
        postalCode: sanitizeText(r['Postal Code']),
        telephone1: sanitizeText(r['Telephone 1']),
        vat: sanitizeText(r['VAT Registration No.']),
        brand: 'playmobil',
        importedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      batch.set(ref, data, { merge: true });
      processed++;
    });
    await batch.commit();
    printProgress(processed, rows.length, 'Playmobil Customers');
  }
  process.stdout.write('\n');
  console.log('✅ Playmobil customers import done.');
}

// ---------------------------------------------------------------------------
async function importKivosCustomers() {
  console.log('\n👥 Importing Kivos customers...');
  const wb = await fetchXlsxWorkbook('1pCVVgFiutK92nZFYSCkQCQbedqaKgvQahnix6bHSRIU');
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
  const batchSize = 300;
  let processed = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = db.batch();
    const chunk = rows.slice(i, i + batchSize);
    chunk.forEach((r) => {
      const code = sanitizeText(r['ΚΩΔΙΚΟΣ ΠΕΛΑΤΗ'] || r['Customer Code']);
      if (!code) return;
      const ref = db.collection('customers_kivos').doc(code);
      const data = {
        customerCode: code,
        name: sanitizeText(r['Επωνυμία']),
        city: sanitizeText(r['Πόλη']),
        vat: sanitizeText(r['Α.Φ.Μ.']),
        merch: sanitizeText(r['Πωλητής']),
        balance: asNumber(r['Υπόλοιπο']),
        brand: 'kivos',
        importedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      batch.set(ref, data, { merge: true });
      processed++;
    });
    await batch.commit();
    printProgress(processed, rows.length, 'Kivos Customers');
  }
  process.stdout.write('\n');
  console.log('✅ Kivos customers import done.');
}

// ---------------------------------------------------------------------------
async function importJohnCustomers() {
  console.log('\n👥 Importing John customers...');
  const wb = await fetchXlsxWorkbook('16E6ErNMb_kTyCYQIzpjaODo3aye0VQq9u_MbyNsd38o');
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
  const batchSize = 400;
  let processed = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = db.batch();
    const chunk = rows.slice(i, i + batchSize);
    chunk.forEach((r) => {
      const code = sanitizeText(r['ΚΩΔ.'] || r['Customer Code']);
      if (!code) return;
      const ref = db.collection('customers_john').doc(code);
      const data = {
        customerCode: code,
        name: sanitizeText(r['Επωνυμία']),
        city: sanitizeText(r['Πόλη']),
        merch: sanitizeText(r['Merch']),
        vat: sanitizeText(r['Α.Φ.Μ.']),
        brand: 'john',
        importedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      batch.set(ref, data, { merge: true });
      processed++;
    });
    await batch.commit();
    printProgress(processed, rows.length, 'John Customers');
  }
  process.stdout.write('\n');
  console.log('✅ John customers import done.');
}

// ---------------------------------------------------------------------------
// 🏬 SUPERMARKET STORES IMPORT (with summary logging)
// ---------------------------------------------------------------------------
async function importSuperMarketStores() {
  console.log('\n🏬 Importing SuperMarket stores (with summaries)...');
  const wb = await fetchXlsxWorkbook(SUPERMARKET_SHEETS.STORES);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const header = rows[0];
  const data = rows.slice(1).filter((r) => !rowIsEmpty(r));

  const idxCode = findColumnIndex(header, ['ΚΩΔ.', 'Store Code']);
  const idxName = findColumnIndex(header, ['Store Name', 'Κατάστημα']);
  const idxCategory = findColumnIndex(header, ['Category', 'Κατηγορία']);
  const idxToys = findColumnIndex(header, ['Toys', 'ΠΑΙΧΝΙΔΙΑ', 'Has Toys', 'hasToys']);
  const idxSummer = findColumnIndex(header, [
    'Summer Items',
    'ΚΑΛΟΚΑΙΡΙΝΑ',
    'Has Summer Items',
    'hasSummerItems',
  ]);

  if (idxCode === -1) {
    console.error('❌ Missing "Store Code" column in spreadsheet header.');
    return;
  }

  const batchSize = 300;
  let processed = 0,
    skipped = 0;

  // Summaries
  const summerStats = {};
  const toyStats = {};
  const allBrands = new Set();

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = db.batch();
    const chunk = data.slice(i, i + batchSize);

    chunk.forEach((row) => {
      try {
        const storeCode = sanitizeText(row[idxCode]);
        if (!storeCode) return;

        const storeName = sanitizeText(row[idxName]);
        const category = sanitizeText(row[idxCategory]);
        const hasToys = sanitizeText(row[idxToys]);
        const hasSummerItems = sanitizeText(row[idxSummer]);
        const brand = 'john'; // Fixed, may extend later if needed

        // Count for summaries
        if (hasSummerItems) {
          const key = hasSummerItems.toUpperCase();
          summerStats[key] = (summerStats[key] || 0) + 1;
        }
        if (hasToys) {
          const key = hasToys.toUpperCase();
          toyStats[key] = (toyStats[key] || 0) + 1;
        }
        allBrands.add(brand);

        const ref = db
          .collection(SUPERMARKET_COLLECTIONS.stores)
          .doc(`${brand}_${makeIdSegment(storeCode)}`);

        const doc = {
          storeCode,
          storeName,
          storeCategory: category,
          hasToys,
          hasSummerItems,
          brand,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        const clean = Object.fromEntries(Object.entries(doc).filter(([_, v]) => v !== undefined));

        batch.set(ref, clean, { merge: true });
        processed++;
      } catch (e) {
        skipped++;
        console.error('❌ Store row error:', e.message);
      }
    });

    await batch.commit();
    printProgress(processed + skipped, data.length, 'SuperMarket Stores');
  }

  process.stdout.write('\n');
  console.log(`✅ Imported ${processed} SuperMarket stores (${skipped} skipped)`);

  // ✅ Summary Report
  console.log('\n📊 Store Category Summary');
  console.log('------------------------------------');
  console.log('🏷️  Summer Types:');
  if (Object.keys(summerStats).length === 0) {
    console.log('  (none found)');
  } else {
    Object.entries(summerStats).forEach(([type, count]) =>
      console.log(`  ${type}: ${count}`)
    );
  }

  console.log('\n🧸 Toys Categories:');
  if (Object.keys(toyStats).length === 0) {
    console.log('  (none found)');
  } else {
    Object.entries(toyStats).forEach(([type, count]) =>
      console.log(`  ${type}: ${count}`)
    );
  }

  console.log('\n🏢 Brands detected:', Array.from(allBrands).join(', ') || '(none)');
  console.log('------------------------------------\n');
}
// ---------------------------------------------------------------------------
// ✨ UPDATED SUPERMARKET LISTINGS IMPORT (with new summer categories)
// ---------------------------------------------------------------------------
async function importSuperMarketListings() {
  console.log('\n🏪 Importing SuperMarket listings (extended with summer categories)...');
  const sheetId = SUPERMARKET_SHEETS.LISTINGS;
  const wb = await fetchXlsxWorkbook(sheetId);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const header = rows[0];
  const data = rows.slice(1).filter((r) => !rowIsEmpty(r));

  const col = {
    superMarket: findColumnIndex(header, ['SuperMarket']),
    productCode: findColumnIndex(header, ['Κωδ.', 'Κωδικος', 'Product Code']),
    productCategory: findColumnIndex(header, ['Κατηγορία', 'Category']),
    photoUrl: findColumnIndex(header, ['Φωτογραφία', 'Photo']),
    barcode: findColumnIndex(header, ['Barcode']),
    description: findColumnIndex(header, ['Περιγραφή', 'Description']),
    packaging: findColumnIndex(header, ['Συσκ.', 'Packaging']),
    price: findColumnIndex(header, ['Τιμή', 'Price']),
    isNew: findColumnIndex(header, ['Νέο', 'New']),
    isAActive: findColumnIndex(header, ['IsAActive']),
    isBActive: findColumnIndex(header, ['IsBActive']),
    isCActive: findColumnIndex(header, ['IsCActive']),
    // ✅ new summer category fields
    isSummerActiveGrand: findColumnIndex(header, ['isSummerActiveGrand']),
    isSummerActiveMegala: findColumnIndex(header, ['isSummerActiveMegala']),
    isSummerActiveMegalaPlus: findColumnIndex(header, ['isSummerActiveMegalaPlus']),
    isSummerActiveMesaia: findColumnIndex(header, ['isSummerActiveMesaia']),
    isSummerActiveMikra: findColumnIndex(header, ['isSummerActiveMikra']),
    brand: findColumnIndex(header, ['Brand']),
    categoryHierarchyTree: findColumnIndex(header, ['categoryHierarchyTree', 'Category Hierarchy']),
  };

  const categoryOrder = [];
  const batchSize = 400;
  let processed = 0, skipped = 0;

  const summerCounters = {
    grand: 0,
    megala: 0,
    megalaPlus: 0,
    mesaia: 0,
    mikra: 0,
  };

  for (let i = 0; i < data.length; i += batchSize) {
    const chunk = data.slice(i, i + batchSize);
    const batch = db.batch();

    chunk.forEach((r) => {
      try {
        const code = sanitizeText(col.productCode !== -1 ? r[col.productCode] : null);
        if (!code) return;
        const productCategory = sanitizeText(col.productCategory !== -1 ? r[col.productCategory] : null);
        if (productCategory && !categoryOrder.includes(productCategory))
          categoryOrder.push(productCategory);

        const ref = db.collection(SUPERMARKET_COLLECTIONS.listings)
          .doc(`john_${makeIdSegment(code)}`);

        const payload = {
          superMarket: sanitizeText(r[col.superMarket]),
          productCode: code,
          productCategory,
          photoUrl: sanitizeUrl(r[col.photoUrl]),
          barcode: sanitizeText(r[col.barcode]),
          description: sanitizeText(r[col.description]),
          packaging: sanitizeText(r[col.packaging]),
          price: asNumber(r[col.price]),
          isNew: parseBoolean(r[col.isNew]),

          // ✅ regular categories
          isAActive: parseBoolean(r[col.isAActive]),
          isBActive: parseBoolean(r[col.isBActive]),
          isCActive: parseBoolean(r[col.isCActive]),

          // ✅ new summer categories
          isSummerActiveGrand: parseBoolean(r[col.isSummerActiveGrand]),
          isSummerActiveMegala: parseBoolean(r[col.isSummerActiveMegala]),
          isSummerActiveMegalaPlus: parseBoolean(r[col.isSummerActiveMegalaPlus]),
          isSummerActiveMesaia: parseBoolean(r[col.isSummerActiveMesaia]),
          isSummerActiveMikra: parseBoolean(r[col.isSummerActiveMikra]),

          brand: sanitizeText(r[col.brand]) || 'john',
          categoryHierarchyTree:
            col.categoryHierarchyTree !== -1
              ? String(r[col.categoryHierarchyTree] || '')
                  .split('>')
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [],

          importedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        // track counts for debug
        if (payload.isSummerActiveGrand) summerCounters.grand++;
        if (payload.isSummerActiveMegala) summerCounters.megala++;
        if (payload.isSummerActiveMegalaPlus) summerCounters.megalaPlus++;
        if (payload.isSummerActiveMesaia) summerCounters.mesaia++;
        if (payload.isSummerActiveMikra) summerCounters.mikra++;

        const clean = Object.fromEntries(
          Object.entries(payload).filter(([_, v]) => v !== undefined)
        );

        batch.set(ref, clean, { merge: true });
        processed++;
      } catch (e) {
        skipped++;
        console.error('Row error:', e.message);
      }
    });

    await batch.commit();
    printProgress(processed + skipped, data.length, 'SuperMarket listings');
  }

  await db.collection('supermarket_meta').doc('category_order').set({
    order: categoryOrder,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  process.stdout.write('\n');
  console.log(`✅ SuperMarket listings imported: ${processed} processed, ${skipped} skipped`);

  // ✅ summary report for summer flags
  console.log('\n📊 Summer category summary:');
  Object.entries(summerCounters).forEach(([key, count]) => {
    console.log(`  ${key}: ${count}`);
  });
}
// ---------------------------------------------------------------------------
// DELETION UTILITIES
// ---------------------------------------------------------------------------
async function deleteAllInCollection(collectionPath, batchSize = 500) {
  console.log(`\n🗑️  Deleting ALL docs in "${collectionPath}" ...`);
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
  console.log(`✅ Deleted ${totalDeleted} docs from "${collectionPath}".`);
}

// ---------------------------------------------------------------------------
// DELETE ORDERS BY USER
// ---------------------------------------------------------------------------
async function listUsersFromOrders(collectionPath) {
  console.log(`\n📋 Scanning "${collectionPath}" for users ...`);
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
      scanned++;
      const d = doc.data() || {};
      const uid = d.userId || '(unknown)';
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

// ---------------------------------------------------------------------------
async function deleteOrdersByUser(collectionPath, userId, batchSize = 500) {
  console.log(`\n🗑️  Deleting orders for userId="${userId}" in "${collectionPath}" ...`);
  let totalDeleted = 0;

  while (true) {
    const snap = await db.collection(collectionPath).where('userId', '==', userId).limit(batchSize).get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    totalDeleted += snap.size;
    printProgress(totalDeleted, 0, `Deleting ${collectionPath} (${userId})`);
  }

  process.stdout.write('\n');
  console.log(`✅ Deleted ${totalDeleted} orders for userId="${userId}"`);
}

// ---------------------------------------------------------------------------
async function confirmAndDeleteAllOrders(brandKey) {
  const brand = BRAND_CONFIG[brandKey];
  const confirmation = await askQuestion(`Type "DELETE ALL ${brand.label.toUpperCase()} ORDERS" to confirm: `);
  if (confirmation.trim() === `DELETE ALL ${brand.label.toUpperCase()} ORDERS`) {
    await deleteAllInCollection(brand.orderCollection);
  } else {
    console.log('❎ Cancelled.');
  }
}

// ---------------------------------------------------------------------------
async function deleteOrdersForUserFlow(brandKey) {
  const brand = BRAND_CONFIG[brandKey];
  const users = await listUsersFromOrders(brand.orderCollection);
  if (!users.length) {
    console.log('ℹ️  No orders found.');
    return;
  }

  console.log('\n📋 Users with orders:');
  users.forEach((u, idx) => console.log(`${idx + 1}. ${u.userId} (${u.count} orders)`));

  const selected = await askQuestion('\nSelect user # to delete orders (Enter to cancel): ');
  const index = parseInt(selected, 10);
  if (!index || index < 1 || index > users.length) {
    console.log('❎ Cancelled.');
    return;
  }

  const chosen = users[index - 1];
  const confirmation = await askQuestion(
    `Type "DELETE ${brand.label.toUpperCase()} ${chosen.userId}" to confirm: `
  );

  if (confirmation.trim() === `DELETE ${brand.label.toUpperCase()} ${chosen.userId}`) {
    await deleteOrdersByUser(brand.orderCollection, chosen.userId);
  } else {
    console.log('❎ Cancelled.');
  }
}
// ---------------------------------------------------------------------------
// SALESMEN REBUILD SUPPORT
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

  const addCandidate = (val) => {
    if (Array.isArray(val)) return val.forEach(addCandidate);
    const sanitized = sanitizeSalesmanName(val);
    if (!sanitized) return;
    const key = normalizeSalesmanKey(sanitized);
    if (!key || seen.has(key)) return;
    seen.add(key);
    results.push(sanitized);
  };

  const SALES_PERSON_FIELD_PATHS = [
    'merch', 'Merch', 'salesman', 'Salesman', 'salesmanName', 'SalesmanFullName',
    'salesInfo.merch', 'salesInfo.salesman', 'salesInfo.salesmanName', 'salesInfo.salesmanFullName',
    'salesInfo.merchandiser', 'salesInfo.owner', 'merchandiser', 'assignedMerch', 'assignedSalesman'
  ];

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
    deleted++;
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
      unique.set(key, { id: `${brandKey}_${key}`, name, normalized: key, brand: brandKey });
    });
  });

  if (!unique.size) return { totalCustomers: snapshot.size, inserted: 0 };

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
    writes++;
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
    console.log(`\n🔁 Rebuilding salesmen for ${BRAND_CONFIG[brandKey].label} (${collection})`);
    const removed = await deleteSalesmenForBrand(brandKey);
    if (removed) console.log(`  Removed ${removed} existing salesmen entries.`);
    const { totalCustomers, inserted } = await upsertSalesmenForBrand(brandKey, collection);
    console.log(`  Customers scanned: ${totalCustomers}`);
    console.log(`  Unique salesmen saved: ${inserted}`);
  }
  console.log('\n✅ Salesmen rebuild complete.');
}

// ---------------------------------------------------------------------------
// USER MANAGEMENT
// ---------------------------------------------------------------------------
async function updateUsersCollection() {
  console.log('\n👥 Updating users collection to align with latest fields...');
  const usersSnapshot = await db.collection('users').get();

  if (usersSnapshot.empty) {
    console.log('ℹ️ No users found.');
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
      const userData = doc.data();
      const updates = {};

      if (!userData.merchIds) updates.merchIds = [];
      if (!userData.brands) updates.brands = [];
      if (!userData.role) updates.role = 'salesman';

      if (!userData.name && (userData.firstName || userData.lastName)) {
        updates.name = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
      }

      if (!userData.createdAt) updates.createdAt = admin.firestore.FieldValue.serverTimestamp();
      updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

      if (Object.keys(updates).length > 0) {
        batch.update(doc.ref, updates);
        updated++;
      } else skipped++;

      processed++;
    }

    await batch.commit();
    printProgress(processed, usersSnapshot.docs.length, 'Updating users');
  }

  process.stdout.write('\n');
  console.log(`✅ Users updated: processed=${processed}, updated=${updated}, skipped=${skipped}`);
}

async function rebuildSalesmenFromCustomers() {
  console.log('\n🔁 Rebuilding salesmen collection from all brand customers...');
  const brands = Object.keys(BRAND_CONFIG);
  let totalProcessed = 0;
  let totalInserted = 0;

  for (const brandKey of brands) {
    const collection = BRAND_CONFIG[brandKey].customerCollection;
    console.log(`\n🔍 Processing ${BRAND_CONFIG[brandKey].label} customers (${collection})...`);
    const snapshot = await db.collection(collection).get();
    const unique = new Map();

    snapshot.forEach((doc) => {
      const customer = doc.data();
      const candidates = extractSalesmenFromCustomer(customer);
      candidates.forEach((name) => {
        const key = normalizeSalesmanKey(name);
        if (!key || unique.has(key)) return;
        const merchValue = customer.merch || name;
        unique.set(key, { id: `${brandKey}_${key}`, name, normalized: key, brand: brandKey, merch: merchValue });
      });
    });

    if (!unique.size) {
      console.log(`  No salesmen found for ${brandKey}.`);
      continue;
    }

    const existingSnapshot = await db.collection('salesmen').where('brand', '==', brandKey).get();
    if (!existingSnapshot.empty) {
      const deleteBatch = db.batch();
      existingSnapshot.docs.forEach((doc) => deleteBatch.delete(doc.ref));
      await deleteBatch.commit();
      console.log(`  Removed ${existingSnapshot.size} old entries.`);
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
        merch: item.merch,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      writes++;
      if (writes % 400 === 0) {
        commits.push(batch.commit());
        batch = db.batch();
      }
    });

    commits.push(batch.commit());
    await Promise.all(commits);

    console.log(`  Saved ${unique.size} unique salesmen.`);
    totalProcessed += snapshot.size;
    totalInserted += unique.size;
  }

  console.log(`\n✅ Completed: ${totalProcessed} customers processed, ${totalInserted} salesmen inserted.`);
}

async function inspectSalesmenCollection() {
  console.log('\n🔎 Inspecting salesmen collection...');
  const snap = await db.collection('salesmen').get();
  if (snap.empty) {
    console.log('⚠️ Salesmen collection is empty.');
    return;
  }

  console.log(`📋 Total salesmen: ${snap.size}`);
  const byBrand = {};
  snap.forEach((doc) => {
    const d = doc.data();
    const b = d.brand || 'unknown';
    if (!byBrand[b]) byBrand[b] = [];
    byBrand[b].push(d.name || '(no name)');
  });

  console.log('\nSummary by brand:');
  Object.entries(byBrand).forEach(([b, names]) => {
    console.log(`  ${b}: ${names.length} salesmen`);
  });
}
// ---------------------------------------------------------------------------
// USER MANAGEMENT MENU
// ---------------------------------------------------------------------------
async function userManagementMenu() {
  while (true) {
    console.log(`
5. User Management
  5.1 Update users collection
  5.2 Rebuild salesmen from customers
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
        console.log('❎ Invalid option.');
    }
  }
}

// ---------------------------------------------------------------------------
// BRAND MENUS
// ---------------------------------------------------------------------------
async function playmobilMenu() {
  while (true) {
    console.log(`
1. Playmobil
  1.1 Import Playmobil products
  1.2 Import Playmobil customers
  1.3 Delete Playmobil products collection
  1.4 Delete Playmobil customers collection
  1.5 Delete Playmobil orders of a USER
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
        console.log('❎ Invalid option.');
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
  2.5 Delete Kivos orders of a USER
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
        console.log('❎ Invalid option.');
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
  3.5 Delete John orders of a USER
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
        console.log('❎ Invalid option.');
    }
  }
}

// ---------------------------------------------------------------------------
// SUPERMARKET MANAGEMENT MENU
// ---------------------------------------------------------------------------
async function superMarketMenu() {
  while (true) {
    console.log(`
6. SuperMarket Management (John)
  6.1 Import SuperMarket Stores
  6.2 Import SuperMarket Listings
  6.3 Delete SuperMarket Stores collection
  6.4 Delete SuperMarket Listings collection
  0. Back`);
    const choice = (await askQuestion('Select option: ')).trim();
    switch (choice) {
      case '1':
      case '6.1':
        await importSuperMarketStores();
        break;
      case '2':
      case '6.2':
        await importSuperMarketListings();
        break;
      case '3':
      case '6.3':
        await deleteAllInCollection(SUPERMARKET_COLLECTIONS.stores);
        break;
      case '4':
      case '6.4':
        await deleteAllInCollection(SUPERMARKET_COLLECTIONS.listings);
        break;
      case '0':
        return;
      default:
        console.log('❎ Invalid option.');
    }
  }
}

// ---------------------------------------------------------------------------
// MAIN MENU ENTRYPOINT
// ---------------------------------------------------------------------------
async function mainMenu() {
  while (true) {
    console.log(`
==============================
🔥 Firestore Import / Manager
==============================
1. Playmobil
2. Kivos
3. John
4. Rebuild Salesmen Collection
5. User Management
6. SuperMarket Management
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
        const brandInput = (await askQuestion('Enter brand (playmobil/kivos/john) or leave empty for all: '))
          .trim()
          .toLowerCase();
        const brand = brandInput || null;
        if (brand && !BRAND_CONFIG[brand]) {
          console.log('❎ Unknown brand. Available: playmobil, kivos, john.');
          break;
        }
        await rebuildSalesmenCollections(brand || undefined);
        break;
      }
      case '5':
        await userManagementMenu();
        break;
      case '6':
        await superMarketMenu();
        break;
      case '0':
        console.log('👋 Exiting Firestore Manager...');
        rl.close();
        process.exit(0);
      default:
        console.log('❎ Invalid choice, try again.');
    }
  }
}

// ---------------------------------------------------------------------------
// EXECUTION ENTRY
// ---------------------------------------------------------------------------
mainMenu().catch((err) => {
  console.error('💥 Fatal error:', err);
  rl.close();
  process.exit(1);
});
