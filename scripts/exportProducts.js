// scripts/exportProducts.js
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccount = require('../serviceAccountKey.json'); // update path as needed

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function exportProducts() {
  const snapshot = await db.collection('products').get();
  const products = [];
  snapshot.forEach(doc => {
    products.push({ id: doc.id, ...doc.data() });
  });

  fs.writeFileSync(path.join(__dirname, 'products.json'), JSON.stringify(products, null, 2), 'utf-8');
  console.log('Exported', products.length, 'products!');
}

exportProducts().catch(console.error);
