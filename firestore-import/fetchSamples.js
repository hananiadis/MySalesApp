/**
 * Firestore Samples Fetcher (Node.js, Admin SDK)
 *
 * Usage:
 * 1) Install dependencies: npm install firebase-admin
 * 2) Place your service account JSON at: ./serviceAccountKey.json
 * 3) Run: node scripts/fetchSamples.js
 * 4) Output: ./firestore_samples.json
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// Collections to iterate (from your provided list)
const collectionNames = [
  'brands_contacts',
  'customers',
  'customers_john',
  'customers_kivos',
  'orders',
  'orders_john',
  'orders_john_supermarket',
  'orders_kivos',
  'products',
  'products_john',
  'products_kivos',
  'salesmen',
  'sheetsCache',
  'stock_kivos',
  'stock_kivos_history',
  'supermarket_listings',
  'supermarket_meta',
  'supermarket_stores',
  'supplier_order_kivos',
  'users',
];

// Config
const SAMPLE_COUNT = Number(process.env.SAMPLE_COUNT || '3'); // default take 3 docs per collection
const OUTPUT_FILE = path.resolve(__dirname, '..', 'firestore_samples.json');
const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, '..', 'serviceAccountKey.json');

function loadServiceAccount() {
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error(`Service account file not found at: ${SERVICE_ACCOUNT_PATH}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8');
  const json = JSON.parse(raw);
  return json;
}

async function main() {
  const sa = loadServiceAccount();

  admin.initializeApp({
    credential: admin.credential.cert(sa),
  });

  const db = admin.firestore();
  const samples = {};

  console.log(`Fetching up to ${SAMPLE_COUNT} sample docs per collection...`);

  for (const name of collectionNames) {
    try {
      console.log(`== ${name} ==`);
      const snap = await db.collection(name).limit(SAMPLE_COUNT).get();
      if (snap.empty) {
        console.log('  (empty)');
        samples[name] = [];
        continue;
      }
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      samples[name] = docs;
      console.log(`  got ${docs.length} docs`);
    } catch (err) {
      console.error(`  error: ${err.message}`);
      samples[name] = { error: err.message };
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(samples, null, 2), 'utf8');
  console.log(`\nSaved to: ${OUTPUT_FILE}`);
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
