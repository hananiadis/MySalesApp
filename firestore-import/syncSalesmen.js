const admin = require('firebase-admin');

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = admin.firestore();

const CUSTOMER_COLLECTIONS = {
  playmobil: 'customers',
  john: 'customers_john',
  kivos: 'customers_kivos',
};

const SALES_PERSON_FIELD_PATHS = [
  'merch',
  'Merch',
  'salesman',
  'Salesman',
  'salesmanName',
  'salesmanFullName',
  'salesInfo.merch',
  'salesInfo.salesman',
  'salesInfo.salesmanName',
  'salesInfo.salesmanFullName',
  'salesInfo.merchandiser',
  'salesInfo.owner',
  'πωλητής',
  'Πωλητής',
  'ΠΩΛΗΤΗΣ',
  'merchandiser',
  'assignedMerch',
  'assignedSalesman',
];

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
  return path.split('.').reduce((acc, part) => {
    if (acc && typeof acc === 'object') {
      return acc[part];
    }
    return undefined;
  }, source);
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

async function deleteExistingForBrand(brand) {
  const snap = await db.collection('salesmen').where('brand', '==', brand).get();
  if (snap.empty) return 0;

  let deleted = 0;
  const batches = [];
  let batch = db.batch();
  snap.forEach((doc, idx) => {
    batch.delete(doc.ref);
    deleted += 1;
    if ((idx + 1) % 400 === 0) {
      batches.push(batch.commit());
      batch = db.batch();
    }
  });
  batches.push(batch.commit());
  await Promise.all(batches);
  return deleted;
}

async function upsertSalesmenForBrand(brand, collectionName) {
  const snapshot = await db.collection(collectionName).get();
  const unique = new Map();

  snapshot.forEach((doc) => {
    const candidates = extractSalesmenFromCustomer(doc.data());
    candidates.forEach((name) => {
      const key = normalizeSalesmanKey(name);
      if (!key || unique.has(key)) return;
      unique.set(key, {
        id: `${brand}_${key}`,
        name,
        normalized: key,
        brand,
      });
    });
  });

  if (!unique.size) {
    return { totalCustomers: snapshot.size, inserted: 0 };
  }

  const batches = [];
  let batch = db.batch();
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
      batches.push(batch.commit());
      batch = db.batch();
    }
  });

  batches.push(batch.commit());
  await Promise.all(batches);

  return { totalCustomers: snapshot.size, inserted: unique.size };
}

async function main() {
  console.log('Salesmen sync started...');
  for (const [brand, collection] of Object.entries(CUSTOMER_COLLECTIONS)) {
    console.log(`\nProcessing brand: ${brand}`);
    const deleted = await deleteExistingForBrand(brand);
    if (deleted) {
      console.log(`  Removed ${deleted} existing salesmen entries.`);
    }
    const { totalCustomers, inserted } = await upsertSalesmenForBrand(brand, collection);
    console.log(`  Customers scanned: ${totalCustomers}`);
    console.log(`  Unique salesmen saved: ${inserted}`);
  }
  console.log('\nSalesmen sync complete.');
  process.exit(0);
}

main().catch((error) => {
  console.error('salesmen sync failed:', error);
  process.exit(1);
});
