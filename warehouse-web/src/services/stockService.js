import {
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * Adjust stock for a product
 * @param {Object} params
 * @param {string} params.productCode - Product code
 * @param {number} params.delta - Quantity change (positive or negative)
 * @param {string} params.reason - Optional reason for adjustment
 * @param {string} params.notes - Optional notes
 * @param {string} params.updatedBy - User ID making the adjustment
 */
export const adjustStock = async ({ productCode, delta, reason, notes, updatedBy }) => {
  if (!productCode) throw new Error('Product code is required');
  if (typeof delta !== 'number' || delta === 0) throw new Error('Invalid delta value');

  try {
    await runTransaction(db, async (transaction) => {
      // Reference to stock document
      const stockRef = doc(db, 'stock_kivos', productCode);
      const stockSnap = await transaction.get(stockRef);

      let oldQty = 0;
      if (stockSnap.exists()) {
        oldQty = stockSnap.data().qtyOnHand || 0;
      }

      const newQty = oldQty + delta;

      if (newQty < 0) {
        throw new Error('Adjustment would result in negative stock');
      }

      // Update or create stock document
      transaction.set(
        stockRef,
        {
          productCode,
          qtyOnHand: newQty,
          lastUpdated: serverTimestamp(),
          updatedBy,
        },
        { merge: true },
      );

      // Create history record
      const historyRef = doc(collection(db, 'stock_kivos_history'));
      transaction.set(historyRef, {
        productCode,
        delta,
        oldQty,
        newQty,
        reason: reason || null,
        notes: notes || null,
        timestamp: serverTimestamp(),
        updatedBy,
      });
    });

    return { success: true };
  } catch (error) {
    console.error('Error adjusting stock:', error);
    throw error;
  }
};

/**
 * Get stock adjustment history for a product
 * @param {string} productCode
 */
export const getStockHistory = async (productCode) => {
  // This would query stock_kivos_history collection
  // Implementation depends on your query needs
  // For now, just a placeholder
  return [];
};

/**
 * Update minimum stock level for a product
 * @param {Object} params
 * @param {string} params.productCode - Product code
 * @param {number} params.lowStockLimit - New minimum stock level
 * @param {string} params.updatedBy - User ID making the update
 */
export const updateMinStock = async ({ productCode, lowStockLimit, updatedBy }) => {
  if (!productCode) throw new Error('Product code is required');
  if (typeof lowStockLimit !== 'number' || lowStockLimit < 0) {
    throw new Error('Invalid minimum stock value');
  }

  try {
    // Update product document
    const productRef = doc(db, 'products_kivos', productCode);
    await setDoc(
      productRef,
      {
        lowStockLimit,
        lastUpdated: serverTimestamp(),
      },
      { merge: true },
    );

    return { success: true };
  } catch (error) {
    console.error('Error updating minimum stock:', error);
    throw error;
  }
};
