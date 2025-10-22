// scripts/exportcustomers.js
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccount = require('../serviceAccountKey.json'); // update path as needed

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function exportcustomers() {
  const snapshot = await db.collection('customers').get();
  const customers = [];
  snapshot.forEach(doc => {
    customers.push({ id: doc.id, ...doc.data() });
  });

  fs.writeFileSync(path.join(__dirname, 'customers.json'), JSON.stringify(customers, null, 2), 'utf-8');
  console.log('Exported', customers.length, 'customers!');
}

exportcustomers().catch(console.error);
