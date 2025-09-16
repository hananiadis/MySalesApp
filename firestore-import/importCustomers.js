const admin = require('firebase-admin');
const axios = require('axios');
const csv = require('csv-parser');
const { Readable } = require('stream');

// Initialize Firebase
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'mysalesapp-38ccf'
});

const db = admin.firestore();
const customersCollection = 'customers';
const spreadsheetUrl = 'https://docs.google.com/spreadsheets/d/15iBRyUE0izGRi7qY_VhZgbdH7tojL1hq3F0LI6oIjqQ/export?format=csv&gid=0';

/**
 * Normalizes customer data for Firestore
 */
function normalizeCustomerData(row) {
  return {
    customerCode: row['Customer Code'],
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
      registrationNo: row['VAT Registration No.'] || null,  // Fixed column name
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
}

async function importCustomers() {
  try {
    console.log('⏳ Downloading customer data from Google Sheets...');
    const response = await axios.get(spreadsheetUrl, { responseType: 'stream' });
    
    let processedCount = 0;
    let skippedCount = 0;
    let batchCount = 0;
    const batchSize = 500;
    let batch = db.batch();

    // Get existing customer codes and VAT numbers for duplicate check
    const existingCustomers = await db.collection(customersCollection)
      .select('customerCode', 'vatInfo.registrationNo')
      .get();
    
    const existingCustomerCodes = new Set();
    const existingVatNumbers = new Set();
    
    existingCustomers.forEach(doc => {
      const data = doc.data();
      if (data.customerCode) existingCustomerCodes.add(data.customerCode);
      if (data.vatInfo?.registrationNo) existingVatNumbers.add(data.vatInfo.registrationNo);
    });

    console.log('Processing customer data...');
    
    await new Promise((resolve, reject) => {
      response.data
        .pipe(csv())
        .on('data', async (row) => {
          try {
            // Skip rows without Customer Code
            if (!row['Customer Code'] || row['Customer Code'].trim() === '') {
              skippedCount++;
              return;
            }

            const customerCode = row['Customer Code'].trim();
            const vatNumber = row['VAT Registration No.'] ? row['VAT Registration No.'].trim() : null;

            // Skip duplicates
            if (existingCustomerCodes.has(customerCode)) {
              console.log(`↩️ Skipping duplicate Customer Code: ${customerCode}`);
              skippedCount++;
              return;
            }

            if (vatNumber && existingVatNumbers.has(vatNumber)) {
              console.log(`↩️ Skipping duplicate VAT Number: ${vatNumber}`);
              skippedCount++;
              return;
            }

            const customerRef = db.collection(customersCollection).doc(customerCode);
            const customerData = normalizeCustomerData(row);
            
            
const docSnapshot = await customerRef.get();

if (!docSnapshot.exists) {
  batch.set(customerRef, customerData);
  batchCount++;
  processedCount++;
  existingCustomerCodes.add(customerCode);
  if (vatNumber) existingVatNumbers.add(vatNumber);
} else {
  const existingData = docSnapshot.data();
  const updates = {};

  for (const key in customerData) {
    if (
      customerData[key] !== undefined &&
      JSON.stringify(customerData[key]) !== JSON.stringify(existingData[key])
    ) {
      updates[key] = customerData[key];
    }
  }

  if (Object.keys(updates).length > 0) {
    batch.update(customerRef, updates);
    batchCount++;
    processedCount++;
    console.log(`📝 Updated: ${customerCode} ▸ ${Object.keys(updates).join(', ')}`);
  } else {
    skippedCount++;
    console.log(`⏭️ No change: ${customerCode}`);
  }
}
// Commit in batches and create new batch
            if (batchCount >= batchSize) {
              await batch.commit();
              console.log(`  ▸ Processed ${processedCount} customers...`);
              batch = db.batch(); // Create new batch
              batchCount = 0;
            }
          } catch (error) {
            console.error(`Error processing row:`, error);
            skippedCount++;
          }
        })
        .on('end', async () => {
          // Commit any remaining documents in the final batch
          if (batchCount > 0) {
            await batch.commit();
          }
          resolve();
        })
        .on('error', reject);
    });

    console.log('\n✅ Import completed!');
    console.log(`   - New customers added: ${processedCount}`);
    console.log(`   - Rows skipped: ${skippedCount}`);
    
    // Verification
    const newCount = await db.collection(customersCollection).count().get();
    console.log(`   - Total customers now: ${newCount.data().count}`);

  } catch (error) {
    console.error('❌ Import failed:', error);
  } finally {
    process.exit();
  }
}

// Run the import
importCustomers();