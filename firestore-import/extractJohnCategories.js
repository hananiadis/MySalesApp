// extractJohnCategories.js
// Extract all unique categories from products_john collection

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id || 'mysalesapp-38ccf',
});
const db = admin.firestore();

async function extractCategories() {
  console.log('\n📊 Extracting categories from products_john collection...\n');
  
  try {
    const snapshot = await db.collection('products_john').get();
    console.log(`✅ Found ${snapshot.size} products\n`);

    const categories = {
      sheets: new Set(),
      generalBySheet: {},
      subByGeneral: {},
    };

    snapshot.forEach((doc) => {
      const data = doc.data();
      const sheet = data.sheetCategory || 'Unknown';
      const general = data.generalCategory || 'Unknown';
      const sub = data.subCategory || 'Unknown';

      // Track sheet categories
      categories.sheets.add(sheet);

      // Track general categories per sheet
      if (!categories.generalBySheet[sheet]) {
        categories.generalBySheet[sheet] = new Set();
      }
      categories.generalBySheet[sheet].add(general);

      // Track sub categories per general
      if (!categories.subByGeneral[general]) {
        categories.subByGeneral[general] = new Set();
      }
      categories.subByGeneral[general].add(sub);
    });

    // Print results with deduplication of consecutive duplicate names
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 SHEET CATEGORIES (Top Level)');
    console.log('═══════════════════════════════════════════════════════════');
    const sortedSheets = Array.from(categories.sheets).sort();
    sortedSheets.forEach((sheet, index) => {
      console.log(`${index + 1}. "${sheet}"`);
    });

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📂 GENERAL CATEGORIES (Per Sheet)');
    console.log('═══════════════════════════════════════════════════════════');
    sortedSheets.forEach((sheet) => {
      const generals = Array.from(categories.generalBySheet[sheet]).sort();
      // Skip printing the sheet header if it has the same name as only general category
      const shouldPrintHeader = !(generals.length === 1 && generals[0] === sheet);
      if (shouldPrintHeader) {
        console.log(`\n📄 ${sheet}:`);
      }
      generals.forEach((general, index) => {
        console.log(`   ${index + 1}. "${general}"`);
      });
    });

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📁 SUB CATEGORIES (Per General Category)');
    console.log('═══════════════════════════════════════════════════════════');
    const sortedGenerals = Object.keys(categories.subByGeneral).sort();
    sortedGenerals.forEach((general) => {
      const subs = Array.from(categories.subByGeneral[general]).sort();
      // Skip printing the general header if it has the same name as only sub category
      const shouldPrintHeader = !(subs.length === 1 && subs[0] === general);
      if (shouldPrintHeader) {
        console.log(`\n🔹 ${general}:`);
      }
      subs.forEach((sub, index) => {
        console.log(`   ${index + 1}. "${sub}"`);
      });
    });

    // Generate copy-paste ready configuration
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('📝 COPY-PASTE CONFIGURATION FOR ProductsScreen.js');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('const JOHN_CATEGORY_SORT_ORDER = {');
    console.log('  sheets: [');
    sortedSheets.forEach((sheet) => {
      console.log(`    '${sheet}',`);
    });
    console.log('  ],');
    
    console.log('  generalCategories: {');
    sortedSheets.forEach((sheet) => {
      const generals = Array.from(categories.generalBySheet[sheet]).sort();
      console.log(`    '${sheet}': [`);
      generals.forEach((general) => {
        console.log(`      '${general}',`);
      });
      console.log(`    ],`);
    });
    console.log('  },');
    
    console.log('  subCategories: {');
    sortedGenerals.forEach((general) => {
      const subs = Array.from(categories.subByGeneral[general]).sort();
      console.log(`    '${general}': [`);
      subs.forEach((sub) => {
        console.log(`      '${sub}',`);
      });
      console.log(`    ],`);
    });
    console.log('  },');
    console.log('};');

    console.log('\n✅ Extraction complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

extractCategories();
