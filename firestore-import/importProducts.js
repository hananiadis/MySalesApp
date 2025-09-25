const admin = require('firebase-admin');
const axios = require('axios');
const csv = require('csv-parser');
const { Readable } = require('stream');

// Initialize Firebase
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'mysalesapp-38ccf',
  ignoreUndefinedProperties: true,
});

const db = admin.firestore();

// Public CSV export URL from Google Sheets
const csvUrl = 'https://docs.google.com/spreadsheets/d/101kDd35o6MBky5KYx0i8MNA5GxIUiNGgYf_01T_7I4c/export?format=csv&gid=0';

/**
 * Converts string numbers with either comma or dot decimals to proper floats
 * @param {string} value - The value to normalize
 * @returns {number|null} - Converted number or null if not numeric
 */
function normalizeDecimal(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const cleanedValue = value.replace(/\./g, '').replace(',', '.');
  return isNaN(cleanedValue) ? null : parseFloat(cleanedValue);
}

/**
 * Converts various string representations to boolean
 * @param {string} value - The value to convert
 * @returns {boolean} - Converted boolean value
 */
function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return true; // Default to true

  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === 'yes' || normalized === '1';
}

async function importProducts() {
  try {
    console.log('🚀 Starting CSV import from Google Sheets...');
    const response = await axios.get(csvUrl, { responseType: 'stream' });

    let processedCount = 0;
    let skippedCount = 0;

    response.data
      .pipe(csv())
      .on('data', async (row) => {
        try {
          // Skip rows with empty product code
          if (!row['Product Code'] || row['Product Code'].trim() === '') {
            console.log('⏭️ Skipping row with missing Product Code');
            skippedCount++;
            return;
          }

          const docId = row['Product Code'].trim();
          const docRef = db.collection('products').doc(docId);

          // Prepare clean data
          const cleanData = {
            productCode: docId,
            code: docId,
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
            isActive: parseBoolean(row['IsActive']), // Get from Column N
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          };

          const docSnapshot = await docRef.get();

          if (!docSnapshot.exists) {
            await docRef.set(cleanData);
            processedCount++;
            console.log(`🆕 Added new: ${docId}`);
          } else {
            const existingData = docSnapshot.data();
            const updates = {};

            for (const key in cleanData) {
              if (
                cleanData[key] !== undefined &&
                JSON.stringify(cleanData[key]) !== JSON.stringify(existingData[key])
              ) {
                updates[key] = cleanData[key];
              }
            }

            if (Object.keys(updates).length > 0) {
              updates.lastUpdated = admin.firestore.FieldValue.serverTimestamp();
              await docRef.update(updates);
              processedCount++;
              console.log(`📝 Updated: ${docId} ▸ ${Object.keys(updates).join(', ')}`);
            } else {
              skippedCount++;
              console.log(`⏭️ No change: ${docId}`);
            }
          }
        } catch (error) {
          console.error(`❌ Error processing ${row['Product Code']}:`, error.message);
          skippedCount++;
        }
      })
      .on('end', () => {
        console.log(`\n📊 Import Summary:`);
        console.log(`✔️ Processed: ${processedCount}`);
        console.log(`⏭️ Skipped: ${skippedCount}`);
        console.log('✨ Import completed!');

        // Optional: Output a sample document structure
        if (processedCount > 0) {
          console.log('\n📝 Sample document structure:');
          console.log({
            barcode: '123456789',
            description: 'Sample Product',
            srp: 19.99,
            isActive: true,
            lastUpdated: 'Firestore server timestamp',
          });
        }
      })
      .on('error', (error) => {
        console.error('❌ CSV processing error:', error);
      });
  } catch (error) {
    console.error('💥 Fatal error in import process:', error.message);
    process.exit(1);
  }
}

// Run the import
importProducts();
