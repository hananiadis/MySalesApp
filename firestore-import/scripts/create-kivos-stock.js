// scripts/create-kivos-stock.js

const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Only Kivos brand
const BRAND = "kivos";

async function initStock() {
  const productsCol = `products_${BRAND}`;
  const stockCol = `stock_${BRAND}`;

  console.log(`\n--- Initializing stock for KIVOS ---\n`);

  const productsSnapshot = await db.collection(productsCol).get();

  if (productsSnapshot.empty) {
    console.log(`No products found in ${productsCol}`);
    return;
  }

  const batch = db.batch();

  productsSnapshot.forEach((doc) => {
    const product = doc.data();
    const productCode = product.productCode;

    if (!productCode) return;

    const stockRef = db.collection(stockCol).doc(productCode);

    batch.set(
      stockRef,
      {
        qtyOnHand: 0,
        lastUpdated: new Date(),
        updatedBy: "system_init",
        productCode,
      },
      { merge: true }
    );
  });

  await batch.commit();

  console.log(`KIVOS stock initialized successfully → stock_kivos`);
}

initStock()
  .then(() => {
    console.log("\nALL DONE 🎉");
    process.exit();
  })
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
