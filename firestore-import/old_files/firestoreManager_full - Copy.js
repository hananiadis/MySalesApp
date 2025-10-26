
const admin = require('firebase-admin');
const axios = require('axios');
const csv = require('csv-parser');
const readline = require('readline');

// Firebase Init
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'mysalesapp-38ccf',
  ignoreUndefinedProperties: true
});
const db = admin.firestore();

// CLI input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
function printProgress(current, total, label = '') {
  const percent = Math.round((current / total) * 100);
  const barLength = 20;
  const filledLength = Math.round((percent / 100) * barLength);
  const bar = '█'.repeat(filledLength) + '-'.repeat(barLength - filledLength);
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  process.stdout.write(`📊 ${label} [${bar}] ${percent}% (${current}/${total})`);
}

function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

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
    console.log('\n📦 Importing products...');
    const response = await axios.get(csvUrl, { responseType: 'stream' });
    let processed = 0, skipped = 0;
    const allRows = [];

    await new Promise((resolve, reject) => {
      response.data.pipe(csv()).on('data', row => allRows.push(row)).on('end', resolve).on('error', reject);
    });

    const batchSize = 500;
    for (let i = 0; i < allRows.length; i += batchSize) {
      const chunk = allRows.slice(i, i + batchSize);
      const batch = db.batch();

      for (const row of chunk) {
        try {
          let progress = 0;
          if (!row['Product Code'] || row['Product Code'].trim() === '') { printProgress(processed + skipped, allRows.length, 'Importing');
            skipped++; continue; }
          const docId = row['Product Code'].trim();
          const docRef = db.collection('products').doc(docId);
          const cleanData = {
            productCode: docId,
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
			aa2025: row['2025AA'] || null,
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

      await printProgress(allRows.length, allRows.length, 'Completed');
      await batch.commit();
    }

    console.log(`\n✅ Product import complete: ${processed} processed, ${skipped} skipped`);
  } catch (e) {
    console.error('❌ Product import failed:', e.message);
  }
}

async function importCustomers() {
  const csvUrl = 'https://docs.google.com/spreadsheets/d/15iBRyUE0izGRi7qY_VhZgbdH7tojL1hq3F0LI6oIjqQ/export?format=csv&gid=0';
  try {
    console.log('\n👥 Importing customers...');
    const response = await axios.get(csvUrl, { responseType: 'stream' });
    let processed = 0, skipped = 0;
    const allRows = [];

    await new Promise((resolve, reject) => {
      response.data.pipe(csv()).on('data', row => allRows.push(row)).on('end', resolve).on('error', reject);
    });

    const batchSize = 500;
    for (let i = 0; i < allRows.length; i += batchSize) {
      const chunk = allRows.slice(i, i + batchSize);
      const batch = db.batch();

      for (const row of chunk) {
        try {
          let progress = 0;
          const code = row['Customer Code']?.trim();
          if (!code) { printProgress(processed + skipped, allRows.length, 'Importing');
            skipped++; continue; }
          const vat = row['VAT Registration No.']?.trim();
          const docRef = db.collection('customers').doc(code);
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
          } else {
            const existing = docSnapshot.data();
            const updates = {};
            for (const key in data) {
              if (
                data[key] !== undefined &&
                JSON.stringify(data[key]) !== JSON.stringify(existing[key])
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

      await printProgress(allRows.length, allRows.length, 'Completed');
      await batch.commit();
    }

    console.log(`\n✅ Customer import complete: ${processed} processed, ${skipped} skipped`);
  } catch (e) {
    console.error('❌ Customer import failed:', e.message);
  }
}

async function deleteCollection(db, collectionPath, batchSize = 500) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.limit(batchSize);
  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(db, query, resolve) {
  const snapshot = await query.get();
  if (snapshot.size === 0) {
    resolve();
    return;
  }
  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await printProgress(allRows.length, allRows.length, 'Completed');
      await batch.commit();
  process.nextTick(() => deleteQueryBatch(db, query, resolve));
}

async function mainMenu() {
  while (true) {
    console.log(`\n==============================
🧭 Firestore Import Manager
1. Import products
2. Import customers
3. Delete products collection
4. Delete customers collection
5. Exit
==============================`);
    const choice = await askQuestion('Choose option: ');
    switch (choice.trim()) {
      case '1':
        await importProducts();
        break;
      case '2':
        await importCustomers();
        break;
      case '3':
        console.log('\n⚠️ Deleting products collection...');
        await deleteCollection(db, 'products');
        console.log('✅ Products collection deleted.');
        break;
      case '4':
        console.log('\n⚠️ Deleting customers collection...');
        await deleteCollection(db, 'customers');
        console.log('✅ Customers collection deleted.');
        break;
      case '5':
        console.log('👋 Exiting...');
        rl.close();
        process.exit(0);
        break;
      default:
        console.log('❌ Invalid choice. Please try again.');
    }
  }
}

mainMenu();
