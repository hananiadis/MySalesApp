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

// Debug flag to control verbose import logging
// Enable by setting env DEBUG_IMPORT=1 or passing --debug
const DEBUG_IMPORT = process.env.DEBUG_IMPORT === '1' || process.argv.includes('--debug');

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
function sanitizeDocumentId(value) {
  // Sanitize product codes or any value to be used as Firestore document ID
  // Remove invalid characters: / \ . ~ * [ ] ( ) and spaces
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  const invalid = ['#REF!', '#VALUE!', '#ERROR!', 'N/A', 'NULL', 'null', 'undefined'];
  if (invalid.includes(text)) return null;
  // Replace invalid Firestore path characters with underscore
  return text.replace(/[\/\\\.\~\*\[\]\(\)\s]/g, '_');
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
function parsePackageCount(value) {
  // Parse package count (pieces per box/pack) from various formats
  if (typeof value === 'number' && value > 0) return Math.round(value);
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;
  // Extract first number from strings like "12", "12 pcs", "12τεμ", etc.
  const match = str.match(/\d+/);
  if (!match) return null;
  const num = parseInt(match[0], 10);
  return num > 0 ? num : null;
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

const CONTACTS_CONFIG = {
  collectionName: 'brand_contacts',
  csvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSi-P7gMMVUVBTxzZv7zFotre9UY9G3c91-r_jW1vexoxiUoA7aMUMJJRgz7neY566qVtpv92CbVH9A/pub?gid=734595660&single=true&output=csv',
  columns: {
    department: 'Τμήμα',
    fullName: 'ΟΝΟΜΑΤΕΠΩΝΥΜΟ',
    mobile: 'ΚΙΝΗΤΟ',
    pmh: 'PMH',
    internal: 'Internal',
    fullPhone: 'Πλήρες Τηλ.',
    email: 'Email',
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
// BRAND CONTACTS IMPORT
// ---------------------------------------------------------------------------
async function importBrandContacts(brand) {
  console.log(`\n📞 Importing contacts for brand: ${brand}...`);
  
  try {
    // Fetch CSV
    const response = await axios.get(CONTACTS_CONFIG.csvUrl);
    const lines = response.data.split('\n');
    
    // Parse headers
    const headers = lines[0].split(',').map(h => h.trim());
    console.log(`📋 CSV Headers:`, headers);
    
    // Find column indices
    const colIndices = {
      department: headers.indexOf(CONTACTS_CONFIG.columns.department),
      fullName: headers.indexOf(CONTACTS_CONFIG.columns.fullName),
      mobile: headers.indexOf(CONTACTS_CONFIG.columns.mobile),
      pmh: headers.indexOf(CONTACTS_CONFIG.columns.pmh),
      internal: headers.indexOf(CONTACTS_CONFIG.columns.internal),
      fullPhone: headers.indexOf(CONTACTS_CONFIG.columns.fullPhone),
      email: headers.indexOf(CONTACTS_CONFIG.columns.email),
    };
    
    console.log(`📊 Column indices:`, colIndices);
    
    // Parse contacts
    const contacts = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(',').map(v => v.trim());
      
      const department = values[colIndices.department] || '';
      const fullName = values[colIndices.fullName] || '';
      const mobile = values[colIndices.mobile] || '';
      const pmh = values[colIndices.pmh] || '';
      const internal = values[colIndices.internal] || '';
      const fullPhone = values[colIndices.fullPhone] || '';
      const email = values[colIndices.email] || '';
      
      // Skip empty rows
      if (!fullName && !mobile && !email) continue;
      
      contacts.push({
        department,
        fullName,
        mobile,
        pmh,
        internal,
        fullPhone,
        email,
      });
    }
    
    console.log(`✅ Parsed ${contacts.length} contacts from CSV`);
    
    // Clear existing contacts for this brand
    console.log(`🗑️  Clearing existing contacts for brand: ${brand}...`);
    const existingSnapshot = await db.collection(CONTACTS_CONFIG.collectionName)
      .where('brand', '==', brand)
      .get();
    
    const deleteBatch = db.batch();
    existingSnapshot.forEach(doc => {
      deleteBatch.delete(doc.ref);
    });
    await deleteBatch.commit();
    console.log(`✅ Deleted ${existingSnapshot.size} existing contacts`);
    
    // Import new contacts in batches
    const batchSize = 500;
    let imported = 0;
    
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = db.batch();
      const chunk = contacts.slice(i, i + batchSize);
      
      chunk.forEach((contact, index) => {
        const docRef = db.collection(CONTACTS_CONFIG.collectionName).doc();
        batch.set(docRef, {
          ...contact,
          brand: brand,
          active: true,
          sortOrder: i + index,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      
      await batch.commit();
      imported += chunk.length;
      console.log(`📝 Imported ${imported}/${contacts.length} contacts...`);
    }
    
    console.log(`✅ Successfully imported ${imported} contacts for brand: ${brand}`);
  } catch (error) {
    console.error(`❌ Error importing contacts:`, error.message);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// PLAYMOBIL IMPORTS
// ---------------------------------------------------------------------------
function normalizeBestSellerCode(value) {
  if (value == null) return '';
  // Convert to string, trim, remove leading zeros, uppercase
  return String(value).trim().replace(/^0+/, '').toUpperCase();
}

async function fetchPlaymobilBestSellers() {
  console.log(`📊 Fetching best sellers from published CSV...`);
  try {
    const response = await axios.get(
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vSwXf7TeWPg9Jo7Gl_SqvoJt7I0hxlsRWiv2206AKOmUZiiLtW6TFxFr3q2-IWF8AbJU0dIWY_eCm5Z/pub?gid=180068700&single=true&output=csv'
    );
    
    const rows = [];
    await new Promise((resolve, reject) => {
      require('streamifier')
        .createReadStream(response.data)
        .pipe(csv({ headers: false })) // Parse without headers to get raw array data
        .on('data', (r) => rows.push(r))
        .on('end', resolve)
        .on('error', reject);
    });
    
    console.log(`📊 Total rows read from best sellers CSV: ${rows.length}`);
    if (rows.length > 5) {
      console.log('📄 Row 5 (index 4):', rows[4]);
      console.log('📄 Row 6 (index 5):', rows[5]);
      console.log('📄 Row 7 (index 6):', rows[6]);
      console.log('📄 Row 8 (index 7):', rows[7]);
    }
    
    // Extract product codes from B6:B105 (rows with index 5-104)
    const bestSellerCodes = new Set();
    
    // Skip first 5 rows (indices 0-4), then take next 100 rows (indices 5-104)
    const dataRows = rows.slice(5, 105);
    console.log(`📊 Processing ${dataRows.length} best seller rows (B6:B105 range)`);
    
    dataRows.forEach((row, idx) => {
      // When parsing without headers, row is an object with keys '0', '1', '2', etc.
      // Column B is index 1
      const rawCode = row['1']; // Column B (second column)
      
      const code = normalizeBestSellerCode(rawCode);
      
      if (code) {
        bestSellerCodes.add(code);
        if (idx < 10) {
          console.log(`  Row ${idx + 6}: A="${row['0']}" B="${row['1']}" C="${row['2']}" -> code="${code}"`);
        }
      }
    });
    
    console.log(`✅ Found ${bestSellerCodes.size} unique best seller product codes`);
    if (bestSellerCodes.size > 0) {
      console.log(`📋 First 10 codes:`, Array.from(bestSellerCodes).slice(0, 10).join(', '));
    }
    return bestSellerCodes;
  } catch (error) {
    console.error(`❌ Error fetching best sellers:`, error.message);
    return new Set();
  }
}

async function importPlaymobilProducts() {
  console.log('\n📦 Importing Playmobil products...');
  
  // First, fetch the best sellers list from published CSV
  const bestSellerCodes = await fetchPlaymobilBestSellers();
  
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

  console.log(`📊 Total rows read from CSV: ${rows.length}`);
  if (rows.length > 0) {
    console.log('🔑 Available columns:', Object.keys(rows[0]).join(', '));
    console.log('📄 First row sample:', rows[0]);
    console.log('📄 Last row sample:', rows[rows.length - 1]);
  }

  const batchSize = 400;
  let processed = 0;
  let skipped = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = db.batch();
    const chunk = rows.slice(i, i + batchSize);
    chunk.forEach((row, idx) => {
      const code = sanitizeText(row['Product Code'] || row['Code']);
      if (!code) {
        skipped++;
        if (skipped <= 5) {
          console.log(`⚠️ Skipping row ${i + idx + 1} (no product code):`, row);
        }
        return;
      }
      
      // Normalize code for comparison with best sellers list
      const normalizedCode = normalizeBestSellerCode(code);
      const isBestSeller = bestSellerCodes.has(normalizedCode);
      
      if (isBestSeller && processed < 5) {
        console.log(`⭐ Found best seller: ${code} (normalized: ${normalizedCode})`);
      }
      
      const ref = db.collection('products').doc(code);
      const data = {
        productCode: code,
        barcode: sanitizeText(row['Barcode']),
        playingTheme: sanitizeText(row['Playing Theme']),
        description: sanitizeText(row['Product Description']),
        launchDate: sanitizeText(row['Launch Date']),
        packageInfo: sanitizeText(row['Package']),
        wholesalePrice: roundCurrency(normalizeDecimal(row['Wholesales Price'] || row['Wh Price'])),
        srp: roundCurrency(normalizeDecimal(row['SRP'])),
        cataloguePage: sanitizeText(row['Catalogue Page']),
        suggestedAge: sanitizeText(row['Suggested playing Age']),
        gender: sanitizeText(row['Gender']),
        frontCover: sanitizeUrl(row['Front Cover']),
        availableStock: sanitizeText(row['Available Stock GR']),
        isActive: parseBoolean(row['IsActive']),
        year2025AA: sanitizeText(row['2025AA']),
        bestSeller: isBestSeller, // Mark as best seller if in top 100
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
  
  // Count how many best sellers were found
  const bestSellersMarked = rows.filter(row => {
    const code = sanitizeText(row['Product Code'] || row['Code']);
    if (!code) return false;
    const normalizedCode = normalizeBestSellerCode(code);
    return bestSellerCodes.has(normalizedCode);
  }).length;
  
  console.log(`✅ Playmobil products import done. Processed: ${processed}, Skipped: ${skipped}`);
  console.log(`⭐ Best sellers marked: ${bestSellersMarked} out of ${bestSellerCodes.size} in list`);
}
// ---------------------------------------------------------------------------
// KIVOS IMPORTS
// ---------------------------------------------------------------------------
async function importKivosProducts() {
  console.log('\n📦 Importing Kivos products...');
  const wb = await fetchXlsxWorkbook('18qaTqILCUFuEvqcEM47gc-Ytj3GyNS1LI3Xkfx46Z48');
  const sheet = wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: null });
  
  console.log(`📊 Total rows read from Excel: ${rows.length}`);
  if (rows.length > 0) {
    console.log('🔑 Available columns:', Object.keys(rows[0]).join(', '));
    console.log('📄 First row sample:', rows[0]);
    console.log('📄 Last row sample:', rows[rows.length - 1]);
  }
  
  const batchSize = 300;
  let processed = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = db.batch();
    const chunk = rows.slice(i, i + batchSize);
    chunk.forEach((row, idx) => {
      const code = sanitizeText(row['ΚΩΔΙΚΟΣ ΠΡΟΪΟΝΤΟΣ'] || row['Product Code']);
      if (!code) {
        skipped++;
        if (skipped <= 5) {
          console.log(`⚠️ Skipping row ${i + idx + 1} (no product code):`, row);
        }
        return;
      }
      const ref = db.collection('products_kivos').doc(code);
      const data = {
        productCode: code,
        supplierBrand: sanitizeText(row['Brand']),
        category: sanitizeText(row['Κατηγορία είδους']),
        description: sanitizeText(row['ΠΕΡΙΓΡΑΦΗ']),
        descriptionFull: sanitizeText(row['Description']),
        mm: sanitizeText(row['MM']),
        piecesPerBox: parsePackageCount(row['ΤΕΜΑΧΙΑ ΑΝΑ ΚΟΥΤΙ']) || 1,
        piecesPerCarton: parsePackageCount(row['ΤΕΜΑΧΙΑ ΑΝΑ ΚΙΒΩΤΙΟ']) || null,
        wholesalePrice: roundCurrency(normalizeDecimal(row['ΤΙΜΗ ΤΕΜΑΧΙΟΥ ΕΥΡΩ'] || row['ΤΙΜΗ ΤΕΜΑΧΙΟΥ\n  ΕΥΡΩ'])),
        barcodeUnit: sanitizeText(row['BARCODE ΤΕΜΑΧΙΟΥ']),
        barcodeBox: sanitizeText(row['BARCODE ΚΟΥΤΙΟΥ']),
        barcodeCarton: sanitizeText(row['BARCODE ΚΙΒΩΤΙΟΥ']),
        // Stationary channel (channel 1) offers
        discount: normalizeDecimal(row['Discount']),
        discountEndsAt: sanitizeText(row['Discount.End.Date']),
        offerPrice: roundCurrency(normalizeDecimal(row['ΤΙΜΗ ΤΕΜΑΧΙΟΥ ΠΡΟΣΦΟΡΑΣ ΕΥΡΩ'] || row['ΤΙΜΗ ΤΕΜΑΧΙΟΥ\n  ΠΡΟΣΦΟΡΑΣ ΕΥΡΩ'])),
        // Technical channel (channel 2) offers
        technicalDiscount: normalizeDecimal(row['Technical.Discount']),
        technicalDiscountEndsAt: sanitizeText(row['Technical.Discount.End.Date']),
        technicalOfferPrice: roundCurrency(normalizeDecimal(row['Technical.ΤΙΜΗ ΤΕΜΑΧΙΟΥ ΠΡΟΣΦΟΡΑΣ ΕΥΡΩ'] || row['Technical.ΤΙΜΗ ΤΕΜΑΧΙΟΥ\n  ΠΡΟΣΦΟΡΑΣ ΕΥΡΩ'])),
        // Product metadata
        productUrl: sanitizeUrl(row['Product Url']),
        frontCover: sanitizeUrl(row['Product Image Url'] || row['Cloudinary Image Url']),
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
  console.log(`✅ Kivos products import done. Processed: ${processed}, Skipped: ${skipped}`);
}

// ---------------------------------------------------------------------------
// JOHN IMPORTS (final structure-aligned version)
// ---------------------------------------------------------------------------
async function importJohnProducts() {
  console.log('\n📦 Importing John products...');
  console.log('ℹ️  All products will be set to isActive: true by default');

  const wb = await fetchXlsxWorkbook('18IFOPzzFvzXEgGOXNN0X1_mfZcxk2LlT_mRQj3Fqsv8');

  const allRows = [];
  const sheetCounts = {}; // Track items per sheet
  
  wb.SheetNames.forEach((sheetName) => {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
    console.log(`📄 Loaded sheet "${sheetName}" with ${rows.length} rows`);
    sheetCounts[sheetName] = { total: rows.length, processed: 0, skipped: 0 };
    rows.forEach((r) => allRows.push({ ...r, __sheetName: sheetName }));
  });

  console.log(`📊 Total rows read from workbook: ${allRows.length}`);
  if (allRows.length > 0) {
    console.log('🔑 Header keys sample:', Object.keys(allRows[0]).join(', '));
    console.log('📄 First row sample:', allRows[0]);
    console.log('📄 Last row sample:', allRows[allRows.length - 1]);
  }

  const batchSize = 400;
  let processed = 0;
  let skipped = 0;

  for (let i = 0; i < allRows.length; i += batchSize) {
    const batch = db.batch();
    const chunk = allRows.slice(i, i + batchSize);

    chunk.forEach((row, idx) => {
      const sheetName = row.__sheetName || 'Unknown';
      
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
      const code = sanitizeDocumentId(codeRaw);
      if (!code) {
        skipped++;
        if (sheetCounts[sheetName]) sheetCounts[sheetName].skipped++;
        if (skipped <= 5) {
          console.log(`⚠️ [Row ${i + idx + 1}] Skipped - no valid code. Row data:`, row);
        }
        return;
      }

      const ref = db.collection('products_john').doc(code);

      // --- field mappings based on your actual sheet headers ---
      const data = {
        productCode: code,
        barcode: sanitizeText(row['Κωδ.Barcode']),
        brand: 'john',
        isActive: true,  // Default all John products to active
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
      if (sheetCounts[sheetName]) sheetCounts[sheetName].processed++;
    });

    await batch.commit();
    printProgress(processed, allRows.length, 'John');
  }

  console.log(`\n✅ John products import done. Processed ${processed}, skipped ${skipped}`);
  console.log('\n📊 Import breakdown per sheet:');
  Object.entries(sheetCounts).forEach(([sheetName, counts]) => {
    console.log(`  📄 ${sheetName}: ${counts.processed} imported, ${counts.skipped} skipped (${counts.total} total)`);
  });
}
// ---------------------------------------------------------------------------
// CUSTOMER IMPORTS
// ---------------------------------------------------------------------------
async function importPlaymobilCustomers() {
  console.log('\n👥 Importing Playmobil customers (extended)...');
  const response = await axios.get(
    'https://docs.google.com/spreadsheets/d/15iBRyUE0izGRi7qY_VhZgbdH7tojL1hq3F0LI6oIjqQ/export?format=csv&gid=0'
  );

  const rows = [];
  await new Promise((resolve, reject) => {
    const { Readable } = require('stream');
    Readable.from(response.data)
      .pipe(csv({ 
        separator: ',',
        relax_column_count: true,  // Allow inconsistent column counts
        skip_empty_lines: true,
        trim: true
      }))
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

      // Convert merch to array format
      const merchValue = sanitizeText(r['Merch']);
      const merchArray = merchValue ? [merchValue] : [];

      const data = {
        customerCode: code,
        name: sanitizeText(r['Name']),
        name3: sanitizeText(r['Name 3']),
        address: sanitizeText(r['Street']),
        city: sanitizeText(r['City']),
        postalCode: sanitizeText(r['Postal Code']),
        merch: merchArray,  // Array instead of string
        primaryMerch: merchValue,  // Keep original for reference
        brand: 'playmobil',
        importedAt: admin.firestore.FieldValue.serverTimestamp(),

        contact: {
          telephone1: sanitizeText(r['Telephone 1']),
          telephone2: sanitizeText(r['Telephone 2']),
          fax: sanitizeText(r['Fax Number']),
          email: sanitizeText(r['E-Mail Address']),
        },

        vatInfo: {
          registrationNo: sanitizeText(r['VAT Registration No.']),
          office: sanitizeText(r['VAT Office']),
        },

        salesInfo: {
          description: sanitizeText(r['Description Sales Group']),
          groupKey: sanitizeText(r['Group key']),
          groupKeyText: sanitizeText(r['Group key 1 Text']),
          telephone1: sanitizeText(r['Telephone 1']), // optional as in your sample
        },

        region: {
          id: sanitizeText(r['Region ID']),
          name: sanitizeText(r['Region']),
        },

        transportation: {
          zoneId: sanitizeText(r['Transportation Zone ID']),
          zone: sanitizeText(r['Transportation Zone']),
        },
      };

      // remove empty nested objects
      ['contact', 'vatInfo', 'salesInfo', 'region', 'transportation'].forEach((k) => {
        if (!data[k] || Object.values(data[k]).every((v) => !v)) delete data[k];
      });

      batch.set(ref, data, { merge: true });
      processed++;
    });

    await batch.commit();
    printProgress(processed, rows.length, 'Playmobil customers');
  }

  process.stdout.write('\n');
  console.log('✅ Playmobil customers import done.');
}


// ---------------------------------------------------------------------------
async function importKivosCustomers() {
  console.log('\n👥 Importing Kivos customers...');
  const wb = await fetchXlsxWorkbook('1pCVVgFiutK92nZFYSCkQCQbedqaKgvQahnix6bHSRIU');
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
  
  // DEBUG: Log column headers from first row
  if (DEBUG_IMPORT) {
    console.log('\n🔍 DEBUG: Column headers found in sheet:');
    if (rows.length > 0) {
      const headers = Object.keys(rows[0]);
      console.log('Available columns:', headers);
      console.log('');
    }
  }
  
  const batchSize = 300;
  let processed = 0;
  let debugRowCount = 0;
  
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = db.batch();
    const chunk = rows.slice(i, i + batchSize);
    chunk.forEach((r, chunkIndex) => {
      const code = sanitizeText(r['ΚΩΔΙΚΟΣ ΠΕΛΑΤΗ'] || r['Customer Code'] || r['Κωδικός']);
      if (!code) return;
      
      const ref = db.collection('customers_kivos').doc(code);
      
      // Convert merch to array format
      const merchValue = sanitizeText(r['Πωλητής']);
      const merchArray = merchValue ? [merchValue] : [];
      
      // Parse isActive field (Ενεργός: 1 = active, 0 = inactive)
      const isActiveValue = asNumber(r['Ενεργός']);
      const isActive = isActiveValue === 1;
      
      // Parse channel field (ΚΑΝΑΛΙ: 1 = Stationery, 2 = Technical, 0 = inactive/stopped)
      const channelValue = asNumber(r['ΚΑΝΑΛΙ']);
      
      const data = {
        customerCode: code,
        name: sanitizeText(r['Επωνυμία']),
        merch: merchArray,  // Array instead of string
        primaryMerch: merchValue,  // Keep original for reference
        balance: asNumber(r['Υπόλοιπο']),
        isActive: isActive,  // Boolean: true if Ενεργός = 1
        channel: channelValue,  // Number: 0 = inactive, 1 = Stationery, 2 = Technical
        
        // Address (nested map)
        address: {
          street: sanitizeText(r['Διεύθυνση']),
          city: sanitizeText(r['Πόλη']),
          postalCode: sanitizeText(r['Τ.Κ.']),
        },
        
        // Contact (nested map)
        contact: {
          telephone1: sanitizeText(r['Τηλ.1']),
          telephone2: sanitizeText(r['Τηλ.2']),
          fax: sanitizeText(r['Fax']),
          email: sanitizeText(r['email']),
        },
        
        // VAT Info (nested map)
        vatInfo: {
          registrationNo: sanitizeText(r['Α.Φ.Μ.']),
          office: sanitizeText(r['Δ.Ο.Υ.']),
        },
        
        // Profession
        profession: sanitizeText(r['Επάγγελμα']),
        
        // Sales History Fields
        InvSales2022: asNumber(r['Τζίρος ΧΡΗΣΗ 2022']),
        InvSales2023: asNumber(r['Τζίρος ΧΡΗΣΗ 2023']),
        InvSales2024: asNumber(r['Τζίρος ΧΡΗΣΗ 2024']),
        InvSales2025: asNumber(r['Τζίρος ΧΡΗΣΗ 2025']),
        // Note: InvSales2026 is read live from sheet, not imported to Firestore
        
        brand: 'kivos',
        importedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      
      // DEBUG: Log first 10 rows to see what's being imported
      if (DEBUG_IMPORT && debugRowCount < 10) {
        console.log(`\n========================================`);
        console.log(`🔍 DEBUG ROW ${debugRowCount + 1}:`);
        console.log(`========================================`);
        console.log('📥 ALL SOURCE COLUMNS FROM SHEET:');
        Object.keys(r).forEach(key => {
          console.log(`  "${key}": ${JSON.stringify(r[key])}`);
        });
        console.log('\n💾 ALL FIRESTORE FIELDS TO BE SAVED:');
        console.log('  Collection: customers_kivos');
        console.log('  Document ID:', code);
        console.log('  Fields:');
        Object.entries(data).forEach(([key, value]) => {
          if (key === 'importedAt') {
            console.log(`    ${key}: [SERVER_TIMESTAMP]`);
          } else {
            console.log(`    ${key}: ${JSON.stringify(value)}`);
          }
        });
        console.log(`========================================\n`);
        debugRowCount++;
      }
      
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
      
      // Convert merch to array format
      const merchValue = sanitizeText(r['Merch']);
      const merchArray = merchValue ? [merchValue] : [];
      
      const data = {
        customerCode: code,
        name: sanitizeText(r['Επωνυμία']),
        city: sanitizeText(r['Πόλη']),
        merch: merchArray,  // Array instead of string
        primaryMerch: merchValue,  // Keep original for reference
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
// MIGRATION: Convert merch from string to array
// ---------------------------------------------------------------------------
async function migrateCustomerMerchToArray(brandKey = 'playmobil') {
  console.log(`\n🔄 Migrating customer merch field to array format for ${brandKey}...`);
  
  const collectionName = brandKey === 'playmobil' ? 'customers' : `customers_${brandKey}`;
  
  try {
    const snapshot = await db.collection(collectionName).get();
    console.log(`📋 Found ${snapshot.size} customers to process`);
    
    if (snapshot.empty) {
      console.log('⚠️ No customers found.');
      return;
    }
    
    let migrated = 0;
    let skipped = 0;
    let batch = db.batch();
    let batchCount = 0;
    const commits = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      
      // Only migrate if merch is still a string
      if (typeof data.merch === 'string') {
        const merchValue = data.merch;
        
        batch.update(doc.ref, {
          merch: [merchValue],  // Convert to array
          primaryMerch: merchValue  // Preserve original
        });
        
        migrated++;
        batchCount++;
        
        if (batchCount % 400 === 0) {
          commits.push(batch.commit());
          batch = db.batch();
          printProgress(migrated, snapshot.size, 'Migrating');
        }
      } else if (Array.isArray(data.merch)) {
        skipped++;
      } else {
        console.warn(`⚠️ Customer ${doc.id} has invalid merch field:`, data.merch);
        skipped++;
      }
    });
    
    // Commit remaining
    if (batchCount % 400 !== 0) {
      commits.push(batch.commit());
    }
    
    await Promise.all(commits);
    process.stdout.write('\n');
    
    console.log(`✅ Migration complete!`);
    console.log(`   Migrated: ${migrated} customers`);
    console.log(`   Skipped: ${skipped} customers (already arrays or invalid)`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// HELPER: Add salesman to customer merch array
// ---------------------------------------------------------------------------
async function addSalesmanToCustomer(customerCode, salesmanName, brandKey = 'playmobil') {
  console.log(`\n➕ Adding ${salesmanName} to customer ${customerCode}...`);
  
  const collectionName = brandKey === 'playmobil' ? 'customers' : `customers_${brandKey}`;
  const ref = db.collection(collectionName).doc(customerCode);
  
  try {
    const doc = await ref.get();
    if (!doc.exists) {
      console.log(`❌ Customer ${customerCode} not found.`);
      return;
    }
    
    const data = doc.data();
    const currentMerch = data.merch || [];
    
    if (!Array.isArray(currentMerch)) {
      console.log(`⚠️ Customer merch field is not an array. Run migration first!`);
      return;
    }
    
    if (currentMerch.includes(salesmanName)) {
      console.log(`ℹ️ ${salesmanName} is already assigned to this customer.`);
      return;
    }
    
    await ref.update({
      merch: admin.firestore.FieldValue.arrayUnion(salesmanName)
    });
    
    console.log(`✅ Added ${salesmanName} to customer ${customerCode}`);
    console.log(`   Previous: [${currentMerch.join(', ')}]`);
    console.log(`   Updated: [${[...currentMerch, salesmanName].join(', ')}]`);
  } catch (error) {
    console.error('❌ Failed to add salesman:', error);
  }
}

// HELPER: Link user to salesmen (add salesman IDs to user merchIds)
// ---------------------------------------------------------------------------
async function linkUserToSalesmen(userId, salesmanIds, replace = false) {
  console.log(`\n🔗 ${replace ? 'Setting' : 'Adding'} salesmen to user ${userId}...`);
  
  try {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      console.log(`❌ User ${userId} not found.`);
      return;
    }
    
    const userData = userDoc.data();
    const currentMerchIds = Array.isArray(userData.merchIds) ? userData.merchIds : [];
    
    let updates;
    if (replace) {
      // Replace entire merchIds array
      updates = {
        merchIds: salesmanIds,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      console.log(`   Replacing merchIds: [${salesmanIds.join(', ')}]`);
    } else {
      // Add to existing merchIds (using arrayUnion to avoid duplicates)
      const toAdd = salesmanIds.filter(id => !currentMerchIds.includes(id));
      if (toAdd.length === 0) {
        console.log(`ℹ️ All salesmen already linked to user.`);
        return;
      }
      updates = {
        merchIds: admin.firestore.FieldValue.arrayUnion(...toAdd),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      console.log(`   Adding: [${toAdd.join(', ')}]`);
    }
    
    await userRef.update(updates);
    
    const finalMerchIds = replace ? salesmanIds : [...currentMerchIds, ...salesmanIds.filter(id => !currentMerchIds.includes(id))];
    console.log(`✅ User merchIds updated`);
    console.log(`   Previous: [${currentMerchIds.join(', ')}]`);
    console.log(`   Updated: [${finalMerchIds.join(', ')}]`);
    
    // Also update brands if needed
    const linkedBrands = new Set();
    for (const id of finalMerchIds) {
      const parts = id.split('_');
      if (parts.length > 1) {
        linkedBrands.add(parts[0]); // Extract brand from salesman ID (e.g., "playmobil_JOHN" -> "playmobil")
      }
    }
    
    if (linkedBrands.size > 0) {
      const currentBrands = Array.isArray(userData.brands) ? userData.brands : [];
      const brandsToAdd = Array.from(linkedBrands).filter(b => !currentBrands.includes(b));
      
      if (brandsToAdd.length > 0) {
        await userRef.update({
          brands: admin.firestore.FieldValue.arrayUnion(...brandsToAdd),
        });
        console.log(`   Also added brands: [${brandsToAdd.join(', ')}]`);
      }
    }
  } catch (error) {
    console.error('❌ Failed to link user to salesmen:', error);
  }
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
  5.4 Migrate customer merch to array
  5.5 Add salesman to customer
  5.6 Link user to salesmen (merchIds)
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
      case '4':
      case '5.4':
        {
          const brand = (await askQuestion('Enter brand (playmobil/kivos/john) [playmobil]: ')).trim().toLowerCase() || 'playmobil';
          if (!BRAND_CONFIG[brand]) {
            console.log('❎ Invalid brand');
            break;
          }
          await migrateCustomerMerchToArray(brand);
        }
        break;
      case '5':
      case '5.5':
        {
          const brand = (await askQuestion('Enter brand (playmobil/kivos/john) [playmobil]: ')).trim().toLowerCase() || 'playmobil';
          if (!BRAND_CONFIG[brand]) {
            console.log('❎ Invalid brand');
            break;
          }
          const customerCode = (await askQuestion('Enter customer code: ')).trim();
          const salesmanName = (await askQuestion('Enter salesman name: ')).trim();
          if (!customerCode || !salesmanName) {
            console.log('❎ Both customer code and salesman name are required');
            break;
          }
          await addSalesmanToCustomer(customerCode, salesmanName, brand);
        }
        break;
      case '6':
      case '5.6':
        {
          const userId = (await askQuestion('Enter user ID (uid from users collection): ')).trim();
          const salesmanIdsInput = (await askQuestion('Enter salesman IDs (comma-separated, e.g., playmobil_JOHN,kivos_MARY): ')).trim();
          const replaceStr = (await askQuestion('Replace existing merchIds? (y/n) [n]: ')).trim().toLowerCase();
          
          if (!userId || !salesmanIdsInput) {
            console.log('❎ User ID and salesman IDs are required');
            break;
          }
          
          const salesmanIds = salesmanIdsInput.split(',').map(id => id.trim()).filter(Boolean);
          const replace = replaceStr === 'y' || replaceStr === 'yes';
          
          await linkUserToSalesmen(userId, salesmanIds, replace);
        }
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
  1.3 Import Playmobil contacts
  1.4 Delete Playmobil products collection
  1.5 Delete Playmobil customers collection
  1.6 Delete Playmobil orders of a USER
  1.7 Delete ALL Playmobil orders
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
        await importBrandContacts('playmobil');
        break;
      case '4':
      case '1.4':
        await deleteAllInCollection(BRAND_CONFIG.playmobil.productCollection);
        break;
      case '5':
      case '1.5':
        await deleteAllInCollection(BRAND_CONFIG.playmobil.customerCollection);
        break;
      case '6':
      case '1.6':
        await deleteOrdersForUserFlow('playmobil');
        break;
      case '7':
      case '1.7':
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
  2.3 Import Kivos contacts
  2.4 Delete Kivos products collection
  2.5 Delete Kivos customers collection
  2.6 Delete Kivos orders of a USER
  2.7 Delete ALL Kivos orders
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
        await importBrandContacts('kivos');
        break;
      case '4':
      case '2.4':
        await deleteAllInCollection(BRAND_CONFIG.kivos.productCollection);
        break;
      case '5':
      case '2.5':
        await deleteAllInCollection(BRAND_CONFIG.kivos.customerCollection);
        break;
      case '6':
      case '2.6':
        await deleteOrdersForUserFlow('kivos');
        break;
      case '7':
      case '2.7':
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
  3.3 Import John contacts
  3.4 Delete John products collection
  3.5 Delete John customers collection
  3.6 Delete John orders of a USER
  3.7 Delete ALL John orders
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
        await importBrandContacts('john');
        break;
      case '4':
      case '3.4':
        await deleteAllInCollection(BRAND_CONFIG.john.productCollection);
        break;
      case '5':
      case '3.5':
        await deleteAllInCollection(BRAND_CONFIG.john.customerCollection);
        break;
      case '6':
      case '3.6':
        await deleteOrdersForUserFlow('john');
        break;
      case '7':
      case '3.7':
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
// FIRESTORE SCHEMA EXPORTER
// ---------------------------------------------------------------------------
async function exploreCollection(path, db, schema, visited) {
  if (visited.has(path)) return;
  visited.add(path);

  console.log(`🔍 Exploring ${path} ...`);
  const snapshot = await db.collection(path).limit(20).get();
  schema[path] = schema[path] || {};

  for (const doc of snapshot.docs) {
    const data = doc.data();
    for (const [key, value] of Object.entries(data)) {
      const type = Array.isArray(value)
        ? 'array'
        : value === null
        ? 'null'
        : typeof value;
      if (!schema[path][key]) schema[path][key] = type;
    }

    // Recursively explore subcollections
    const subs = await doc.ref.listCollections();
    for (const sub of subs) {
      await exploreCollection(`${path}/${doc.id}/${sub.id}`, db, schema, visited);
    }
  }
}

async function exportFirestoreSchema() {
  console.log('\n📄 Exporting Firestore schema (sample-based)...');
  const schema = {};
  const visited = new Set();

  // Add any top-level collections you want to include
  const topCollections = [
    'users',
    'products',
    'products_kivos',
    'products_john',
    'customers',
    'customers_kivos',
    'customers_john',
    'orders_playmobil',
    'orders_kivos',
    'orders_john',
    'supermarket_listings',
    'supermarket_stores',
    'supermarket_meta',
    'salesmen',
    'brand_settings',
    'sync_log',
    'analytics_kpi',
  ];

  for (const col of topCollections) {
    try {
      await exploreCollection(col, db, schema, visited);
    } catch (e) {
      console.warn(`⚠️ Failed to scan ${col}:`, e.message);
    }
  }

  const outPath = path.join(__dirname, 'firestore_schema.json');
  fs.writeFileSync(outPath, JSON.stringify(schema, null, 2));
  console.log(`\n✅ Schema exported to ${outPath}`);
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
7. Export Firestore Schema
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
	  case '7':
		await exportFirestoreSchema();
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
