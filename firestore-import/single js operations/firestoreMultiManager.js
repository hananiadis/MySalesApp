const admin = require('firebase-admin');
const fs = require('fs');
const readline = require('readline');

// Initialize Firebase
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'mysalesapp-38ccf'
});

const db = admin.firestore();
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Global variables
let selectedCollection = null;
let collectionsList = [];

function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function getAllCollections() {
  try {
    console.log('\n⏳ Fetching collections...');
    const collections = await db.listCollections();
    collectionsList = collections.map(col => col.id);
    return collectionsList;
  } catch (error) {
    console.error('❌ Failed to fetch collections:', error);
    return [];
  }
}

async function exportCollection(collectionName) {
  try {
    const exportFileName = `firestore_export_${collectionName}_${getTimestamp()}.json`;
    console.log(`\n📤 Starting export of '${collectionName}' collection...`);
    
    const collectionRef = db.collection(collectionName);
    const snapshot = await collectionRef.get();
    
    if (snapshot.empty) {
      console.log('ℹ️ Collection is empty - no documents to export');
      return null;
    }

    const documents = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const exportData = {
      metadata: {
        collection: collectionName,
        exportedAt: new Date().toISOString(),
        documentCount: documents.length,
        environment: process.env.NODE_ENV || 'development'
      },
      documents: documents
    };

    fs.writeFileSync(exportFileName, JSON.stringify(exportData, null, 2));
    console.log(`✅ Export successful: ${exportFileName}`);
    console.log(`   - Documents exported: ${documents.length}`);
    console.log(`   - File size: ${(fs.statSync(exportFileName).size / 1024).toFixed(2)} KB`);
    
    return exportFileName;
    
  } catch (error) {
    console.error('❌ Export failed:', error);
    throw error;
  }
}

async function emptyCollection(collectionName) {
  try {
    // First create backup
    const backupFile = await exportCollection(collectionName);
    if (backupFile === null) return; // Collection was empty
    
    const collectionRef = db.collection(collectionName);
    const snapshot = await collectionRef.get();
    
    if (snapshot.empty) {
      console.log('ℹ️ Collection is already empty');
      return;
    }

    // Get confirmation
    rl.question(`\n⚠️ WARNING: This will DELETE ALL ${snapshot.size} documents from "${collectionName}".\nType "EMPTY" to confirm: `, async (answer) => {
      if (answer.trim().toUpperCase() !== 'EMPTY') {
        console.log('\n❌ Operation cancelled');
        console.log(`ℹ️ Backup remains at: ${backupFile}`);
        showCollectionMenu();
        return;
      }

      console.log('\n⏳ Starting document removal...');
      
      // Delete in batches
      const batchSize = 500;
      let deletedCount = 0;
      let batch = db.batch();
      let batchCount = 0;

      for (const doc of snapshot.docs) {
        batch.delete(doc.ref);
        batchCount++;
        deletedCount++;

        if (batchCount >= batchSize) {
          await batch.commit();
          console.log(`   ▸ Deleted ${deletedCount} documents...`);
          batch = db.batch();
          batchCount = 0;
        }
      }

      // Commit final batch if needed
      if (batchCount > 0) {
        await batch.commit();
      }

      console.log(`\n✅ Successfully deleted ${deletedCount} documents`);
      console.log(`ℹ️ Collection '${collectionName}' remains (now empty)`);
      console.log(`ℹ️ Backup preserved at: ${backupFile}`);
      
      // Verify
      const postDeleteSnapshot = await collectionRef.limit(1).get();
      console.log(postDeleteSnapshot.empty ? 
        '✓ Verification: Collection is now empty' :
        '⚠️ Warning: Some documents may remain');
      
      showCollectionMenu();
    });
    
  } catch (error) {
    console.error('\n❌ Operation failed:', error);
    showCollectionMenu();
  }
}

function showCollectionMenu() {
  console.log('\n================================');
  console.log(`Firestore Collection Manager`);
  console.log(`Current Collection: ${selectedCollection || 'None selected'}`);
  console.log('================================');
  console.log('1. Export collection to JSON');
  console.log('2. Empty collection (with backup)');
  console.log('3. Choose different collection');
  console.log('4. Exit');
  
  rl.question('\nSelect an option (1-4): ', async (choice) => {
    if (!selectedCollection && choice !== '3') {
      console.log('❌ Please select a collection first');
      return showCollectionMenu();
    }

    switch(choice.trim()) {
      case '1':
        await exportCollection(selectedCollection);
        showCollectionMenu();
        break;
      case '2':
        await emptyCollection(selectedCollection);
        break;
      case '3':
        showCollectionsList();
        break;
      case '4':
        console.log('👋 Exiting...');
        process.exit();
        break;
      default:
        console.log('❌ Invalid choice');
        showCollectionMenu();
    }
  });
}

async function showCollectionsList() {
  const collections = await getAllCollections();
  
  if (collections.length === 0) {
    console.log('❌ No collections found in this Firestore database');
    process.exit();
    return;
  }

  console.log('\nAvailable Collections:');
  collections.forEach((col, index) => {
    console.log(`${index + 1}. ${col}`);
  });

  rl.question('\nSelect a collection (number) or type "back": ', (answer) => {
    if (answer.trim().toLowerCase() === 'back') {
      return showCollectionMenu();
    }

    const choice = parseInt(answer);
    if (isNaN(choice) || choice < 1 || choice > collections.length) {
      console.log('❌ Invalid selection');
      return showCollectionsList();
    }

    selectedCollection = collections[choice - 1];
    console.log(`\n✔️ Selected collection: ${selectedCollection}`);
    showCollectionMenu();
  });
}

// Start the application
console.log('\n🔥 Firestore Multi-Collection Manager');
showCollectionsList();

// Handle cleanup
process.on('exit', () => {
  rl.close();
});