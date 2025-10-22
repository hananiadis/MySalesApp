
const admin = require('firebase-admin');
const axios = require('axios');
const csv = require('csv-parser');
const readline = require('readline');
const { Readable } = require('stream');

// Firebase Init
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'mysalesapp-38ccf',
  ignoreUndefinedProperties: true
});
const db = admin.firestore();

// CLI
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function normalizeDecimal(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const cleaned = value.replace(/\./g, '').replace(',', '.');
  return isNaN(cleaned) ? null : parseFloat(cleaned);
}
function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return true;
  const v = value.trim().toLowerCase();
  return v === 'true' || v === 'yes' || v === '1';
}

async function importProducts() {
  const csvUrl = 'https://docs.google.com/spreadsheets/d/101kDd35o6MBky5KYx0i8MNA5GxIUiNGgYf_01T_7I4c/export?format=csv&gid=0';
  try {
    console.log(`
📦 Importing products...`);
    const response = await axios.get(csvUrl, { responseType: 'stream' });
    let processed = 0, skipped = 0;
    const allRows = [];

    await new Promise((resolve, reject) => {
      response.data
        .pipe(csv())
        .on('data', (row) => allRows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    const batchSize = 500;
    for (let i = 0; i < allRows.length; i += batchSize) {
      const chunk = allRows.slice(i, i + batchSize);
      const batch = db.batch();

      for (const row of chunk) {
        try {
          if (!row['Product Code'] || row['Product Code'].trim() === '') {
            skipped++;
            continue;
          }
          const docId = row['Product Code'].trim();
          const docRef = db.collection('products').doc(docId);
          const cleanData = {
            barcode: row['Barcode'] || null,
            playingTheme: row['Playing Theme'] || null,
            description: row['Product Description'] || null,
            launchDate: row['Launch Date'] || null,
            package: row['Package'] || null,
            wholesalePrice: normalizeDecimal(row['Wholesales Price']),
            srp: normalizeDecimal(row['SRP']),
            cataloguePage: row['Catalogue Page'] || null,
            suggestedAge: row['Suggested playing Age'] || null,
            gender: row['Gender'] || null,
            frontCover: row['Front Cover'] || null,
            availableStock: row['Available Stock GR'] || null,
            isActive: parseBoolean(row['IsActive']),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
          };

          const docSnapshot = await docRef.get();
          if (!docSnapshot.exists) {
            batch.set(docRef, cleanData);
            processed++;
          } else {
            const existing = docSnapshot.data();
            const updates = {};
            for (const key in cleanData) {
              if (
                cleanData[key] !== undefined &&
                JSON.stringify(cleanData[key]) !== JSON.stringify(existing[key])
              ) {
                updates[key] = cleanData[key];
              }
            }
            if (Object.keys(updates).length > 0) {
              updates.lastUpdated = admin.firestore.FieldValue.serverTimestamp();
              batch.update(docRef, updates);
              processed++;
            } else {
              skipped++;
            }
          }

        } catch (e) {
          console.error(`❌ Error with product row:`, e.message);
          skipped++;
        }
      }

      await batch.commit();
    }

    console.log(`
✅ Product import complete: ${processed} processed, ${skipped} skipped`);

  } catch (e) {
    console.error('❌ Product import failed:', e.message);
  }
}

async function importCustomers() {
  const csvUrl = 'https://docs.google.com/spreadsheets/d/15iBRyUE0izGRi7qY_VhZgbdH7tojL1hq3F0LI6oIjqQ/export?format=csv&gid=0';
  const customersCollection = 'customers';
  try {
    console.log(`
👥 Importing customers...`);
    const response = await axios.get(csvUrl, { responseType: 'stream' });

    const existing = await db.collection(customersCollection).select('customerCode', 'vatInfo.registrationNo').get();
    const existingCodes = new Set();
    const existingVats = new Set();

    existing.forEach(doc => {
      const d = doc.data();
      if (d.customerCode) existingCodes.add(d.customerCode);
      if (d.vatInfo?.registrationNo) existingVats.add(d.vatInfo.registrationNo);
    });

    let processed = 0, skipped = 0;
    const allRows = [];

    await new Promise((resolve, reject) => {
      response.data
        .pipe(csv())
        .on('data', row => allRows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    const batchSize = 500;
    for (let i = 0; i < allRows.length; i += batchSize) {
      const chunk = allRows.slice(i, i + batchSize);
      const batch = db.batch();

      for (const row of chunk) {
        try {
          const code = row['Customer Code']?.trim();
          const vat = row['VAT Registration No.']?.trim();
          if (!code) { skipped++; continue; }

          const docRef = db.collection(customersCollection).doc(code);
          const data = {
            customerCode: code,
            name: row['Name'] || null,
            name3: row['Name 3'] || null,
            address: {
              street: row['Street'] || null,
              postalCode: row['Postal Code'] || null,
              city: row['City'] || null
            },
            contact: {
              telephone1: row['Telephone 1'] || null,
              telephone2: row['Telephone 2'] || null,
              fax: row['Fax Number'] || null,
              email: row['E-Mail Address'] || null
            },
            vatInfo: {
              registrationNo: vat || null,
              office: row['VAT Office'] || null
            },
            salesInfo: {
              description: row['Description Sales Group'] || null,
              groupKey: row['Group key'] || null,
              groupKeyText: row['Group key 1 Text'] || null
            },
            region: {
              id: row['Region ID'] || null,
              name: row['Region'] || null
            },
            transportation: {
              zoneId: row['Transportation Zone ID'] || null,
              zone: row['Transportation Zone'] || null
            },
            merch: row['Merch'] || null,
            importedAt: admin.firestore.FieldValue.serverTimestamp()
          };

          const docSnapshot = await docRef.get();
          if (!docSnapshot.exists) {
            batch.set(docRef, data);
            processed++;
            existingCodes.add(code);
            if (vat) existingVats.add(vat);
          } else {
            const existingData = docSnapshot.data();
            const updates = {};
            for (const key in data) {
              if (
                data[key] !== undefined &&
                JSON.stringify(data[key]) !== JSON.stringify(existingData[key])
              ) {
                updates[key] = data[key];
              }
            }
            if (Object.keys(updates).length > 0) {
              batch.update(docRef, updates);
              processed++;
            } else {
              skipped++;
            }
          }

        } catch (err) {
          console.error('❌ Customer row error:', err.message);
          skipped++;
        }
      }

      await batch.commit();
    }

    console.log(`
✅ Customer import complete: ${processed} processed, ${skipped} skipped`);
  } catch (e) {
    console.error('❌ Customer import failed:', e.message);
  }
}

function showMenu() {
  console.log(`
==============================`);
  console.log(`🧭 Firestore Import Manager`);
  console.log(`1. Import Products`);
  console.log(`2. Import Customers`);
  console.log(`3. Exit`);
  console.log(`==============================`);

  rl.question('Choose option: ', async (answer) => {
    switch(answer.trim()) {
      case '1':
        await importProducts();
        showMenu();
        break;
      case '2':
        await importCustomers();
        showMenu();
        break;
      case '3':
        rl.close();
        process.exit(0);
        break;
      default:
        console.log(`❌ Invalid option`);
        showMenu();
    }
  });
}

showMenu();
