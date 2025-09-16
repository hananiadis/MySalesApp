// firestoreManager_full.js
// Node CLI εργαλείο διαχείρισης Firestore (imports + καθαρισμοί/διαγραφές)
const admin = require('firebase-admin');
const axios = require('axios');
const csv = require('csv-parser');
const readline = require('readline');
const path = require('path');

// --- Firebase Init ---
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id || 'mysalesapp-38ccf',
});
const db = admin.firestore();

// --- CLI I/O ---
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function askQuestion(q) { return new Promise((res) => rl.question(q, res)); }

function printProgress(current, total, label = '') {
  if (!total || total <= 0) {
    process.stdout.clearLine?.();
    process.stdout.cursorTo?.(0);
    process.stdout.write(`${label} … processed: ${current}\r`);
    return;
  }
  const percent = Math.min(100, Math.round((current / total) * 100));
  const barLength = 20;
  const filledLength = Math.round((percent / 100) * barLength);
  const bar = '█'.repeat(filledLength) + '-'.repeat(barLength - filledLength);
  process.stdout.clearLine?.();
  process.stdout.cursorTo?.(0);
  process.stdout.write(`📊 ${label} [${bar}] ${percent}% (${current}/${total})`);
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

// -------------------- IMPORTS --------------------
async function importProducts() {
  const csvUrl = 'https://docs.google.com/spreadsheets/d/101kDd35o6MBky5KYx0i8MNA5GxIUiNGgYf_01T_7I4c/export?format=csv&gid=0';
  try {
    console.log('\n📦 Importing products...');
    const response = await axios.get(csvUrl, { responseType: 'stream' });
    let processed = 0, skipped = 0;
    const allRows = [];

    await new Promise((resolve, reject) => {
      response.data.pipe(csv())
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
          const code = (row['Product Code'] || '').trim();
          if (!code) { skipped++; continue; }
          const docRef = db.collection('products').doc(code);
          const cleanData = {
            productCode: code,
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
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          };

          const snap = await docRef.get();
          if (!snap.exists) {
            batch.set(docRef, cleanData);
          } else {
            const existing = snap.data() || {};
            const updates = {};
            for (const k in cleanData) {
              if (cleanData[k] !== undefined &&
                  JSON.stringify(cleanData[k]) !== JSON.stringify(existing[k])) {
                updates[k] = cleanData[k];
              }
            }
            if (Object.keys(updates).length > 0) {
              updates.lastUpdated = admin.firestore.FieldValue.serverTimestamp();
              batch.update(docRef, updates);
            } else {
              skipped++;
              continue;
            }
          }
          processed++;
        } catch (err) {
          console.error('❌ Product row error:', err.message);
          skipped++;
        }
      }

      await batch.commit();
      printProgress(Math.min(processed + skipped, allRows.length), allRows.length, 'Importing products');
    }

    process.stdout.write('\n');
    console.log(`✅ Product import complete: processed=${processed}, skipped=${skipped}`);
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
      response.data.pipe(csv())
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
          const code = row['Customer Code']?.trim();
          if (!code) { skipped++; continue; }
          const vat = row['VAT Registration No.']?.trim();
          const docRef = db.collection('customers').doc(code);
          const data = {
            customerCode: code,
            name: row['Name'] || null,
            name3: row['Name 3'] || null,
            address: {
              street: row['Street'] || null,
              postalCode: row['Postal Code'] || null,
              city: row['City'] || null,
            },
            contact: {
              telephone1: row['Telephone 1'] || null,
              telephone2: row['Telephone 2'] || null,
              fax: row['Fax Number'] || null,
              email: row['E-Mail Address'] || null,
            },
            vatInfo: {
              registrationNo: vat || null,
              office: row['VAT Office'] || null,
            },
            salesInfo: {
              description: row['Description Sales Group'] || null,
              groupKey: row['Group key'] || null,
              groupKeyText: row['Group key 1 Text'] || null,
            },
            region: {
              id: row['Region ID'] || null,
              name: row['Region'] || null,
            },
            transportation: {
              zoneId: row['Transportation Zone ID'] || null,
              zone: row['Transportation Zone'] || null,
            },
            merch: row['Merch'] || null,
            importedAt: admin.firestore.FieldValue.serverTimestamp(),
          };

          const snap = await docRef.get();
          if (!snap.exists) {
            batch.set(docRef, data);
          } else {
            const existing = snap.data() || {};
            const updates = {};
            for (const k in data) {
              if (data[k] !== undefined &&
                  JSON.stringify(data[k]) !== JSON.stringify(existing[k])) {
                updates[k] = data[k];
              }
            }
            if (Object.keys(updates).length > 0) {
              batch.update(docRef, updates);
            } else {
              skipped++;
              continue;
            }
          }
          processed++;
        } catch (err) {
          console.error('❌ Customer row error:', err.message);
          skipped++;
        }
      }

      await batch.commit();
      printProgress(Math.min(processed + skipped, allRows.length), allRows.length, 'Importing customers');
    }

    process.stdout.write('\n');
    console.log(`✅ Customer import complete: processed=${processed}, skipped=${skipped}`);
  } catch (e) {
    console.error('❌ Customer import failed:', e.message);
  }
}

// -------------------- ORDER MANAGEMENT --------------------

// Διαγραφή ΟΛΗΣ της συλλογής σε batches
async function deleteAllInCollection(collectionPath, batchSize = 500) {
  console.log(`\n⚠️ Deleting ALL docs in "${collectionPath}" ...`);
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

// Επιστροφή μοναδικών χρηστών (userId) από τη συλλογή orders (με counts)
async function listUsersFromOrders() {
  console.log('\n🔎 Scanning "orders" for users …');
  const counts = new Map(); // userId -> count
  let scanned = 0;

  // paginate by documentId (ασφαλές για μεγάλα σύνολα)
  const pageSize = 500;
  let lastDoc = null;

  while (true) {
    let q = db.collection('orders').orderBy(admin.firestore.FieldPath.documentId()).limit(pageSize);
    if (lastDoc) q = q.startAfter(lastDoc.id);
    const snap = await q.get();
    if (snap.empty) break;

    snap.docs.forEach((doc) => {
      scanned++;
      const data = doc.data() || {};
      const uid = data.userId || '(unknown)';
      counts.set(uid, (counts.get(uid) || 0) + 1);
    });

    lastDoc = snap.docs[snap.docs.length - 1];
    printProgress(scanned, 0, 'Scanning orders');
  }

  process.stdout.write('\n');
  const list = Array.from(counts.entries()).map(([userId, count]) => ({ userId, count }));
  list.sort((a, b) => b.count - a.count || String(a.userId).localeCompare(String(b.userId)));
  return list;
}

// Διαγραφή orders συγκεκριμένου χρήστη (userId)
async function deleteOrdersByUser(userId, batchSize = 500) {
  console.log(`\n⚠️ Deleting orders for userId="${userId}" …`);
  let totalDeleted = 0;
  while (true) {
    const snap = await db.collection('orders').where('userId', '==', userId).limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    totalDeleted += snap.size;
    printProgress(totalDeleted, 0, `Deleting orders of ${userId}`);
  }
  process.stdout.write('\n');
  console.log(`✅ Deleted ${totalDeleted} orders for userId="${userId}".`);
}

// -------------------- MAIN MENU --------------------
async function mainMenu() {
  while (true) {
    console.log(`
==============================
🧭 Firestore Import/Manage
1. Import products
2. Import customers
3. Delete products collection
4. Delete customers collection
5. Delete ALL orders
6. Delete orders of a USER (choose from list)
7. Exit
==============================`);
    const choice = (await askQuestion('Choose option: ')).trim();

    switch (choice) {
      case '1':
        await importProducts();
        break;
      case '2':
        await importCustomers();
        break;
      case '3':
        await deleteAllInCollection('products');
        break;
      case '4':
        await deleteAllInCollection('customers');
        break;
      case '5': {
        const confirm = (await askQuestion('Type "DELETE ALL ORDERS" to confirm: ')).trim();
        if (confirm === 'DELETE ALL ORDERS') {
          await deleteAllInCollection('orders');
        } else {
          console.log('❌ Cancelled.');
        }
        break;
      }
      case '6': {
        const users = await listUsersFromOrders();
        if (users.length === 0) {
          console.log('ℹ️ No orders found.');
          break;
        }
        console.log('\n👤 Users with orders:');
        users.forEach((u, idx) => {
          console.log(`${idx + 1}. ${u.userId}  (${u.count} orders)`);
        });
        const pickStr = await askQuestion('\nSelect user # to delete his orders (or press Enter to cancel): ');
        const pick = parseInt(pickStr, 10);
        if (!pick || pick < 1 || pick > users.length) {
          console.log('❌ Cancelled.');
          break;
        }
        const chosen = users[pick - 1];
        const confirm = (await askQuestion(`Type "DELETE ${chosen.userId}" to confirm: `)).trim();
        if (confirm === `DELETE ${chosen.userId}`) {
          await deleteOrdersByUser(chosen.userId);
        } else {
          console.log('❌ Cancelled.');
        }
        break;
      }
      case '7':
        console.log('👋 Exiting…');
        rl.close();
        process.exit(0);
      default:
        console.log('❌ Invalid choice. Please try again.');
    }
  }
}

mainMenu().catch((e) => {
  console.error('Fatal error:', e);
  rl.close();
  process.exit(1);
});
