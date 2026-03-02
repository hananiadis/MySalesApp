import { addDoc, collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { withUpdatedTimestamp } from './optimizedFirestoreService';

const asQty = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/**
 * Packs an order and creates a backorder for any unfulfilled quantities.
 *
 * @param {Object} params
 * @param {string} params.orderId
 * @param {{ productCode: string, qty: number }[]} params.packedItems
 * @param {string} params.userId
 * @returns {Promise<{ success: boolean, backorderCreated: boolean, backorderId: string | null }>}
 */
export const packOrderWithBackorder = async ({ orderId, packedItems, userId }) => {
  if (!orderId) throw new Error('orderId is required');
  if (!userId) throw new Error('userId is required');

  const packedByCode = (Array.isArray(packedItems) ? packedItems : []).reduce((acc, item) => {
    if (!item?.productCode) return acc;
    const code = String(item.productCode);
    acc[code] = (acc[code] || 0) + asQty(item.packedQty ?? item.qty);
    return acc;
  }, {});

  let createdBackorderId = null;
  let createdBackorder = false;

  await runTransaction(db, async (transaction) => {
    const orderRef = doc(db, 'orders_kivos', orderId);
    const orderSnap = await transaction.get(orderRef);

    if (!orderSnap.exists()) {
      throw new Error('Order not found');
    }

    const orderData = orderSnap.data() || {};
    // Use "lines" per schema; fallback to items if present
    const items = Array.isArray(orderData.lines)
      ? orderData.lines
      : (Array.isArray(orderData.items) ? orderData.items : []);

    const remaining = items.reduce((acc, item) => {
      const productCode = item?.productCode;
      if (!productCode) return acc;

      const originalQty = asQty(item.quantity ?? item.qty);
      const packedQty = asQty(packedByCode[productCode]);

      if (packedQty > originalQty) {
        throw new Error(`Packed quantity exceeds ordered quantity for ${productCode}`);
      }

      const remainingQty = Math.max(originalQty - packedQty, 0);
      if (remainingQty > 0) {
        acc.push({ productCode, qty: remainingQty });
      }
      return acc;
    }, []);

    // Update original order status/metadata
    transaction.update(orderRef, withUpdatedTimestamp('orders_kivos', {
      status: 'packed',
      packedAt: serverTimestamp(),
      packedBy: userId,
    }));

    if (remaining.length > 0) {
      const backorderRef = doc(collection(db, 'orders_kivos'));
      transaction.set(backorderRef, withUpdatedTimestamp('orders_kivos', {
        status: 'backorder',
        parentOrderId: orderId,
        createdAt: serverTimestamp(),
        createdBy: userId,
        // Write schema uses "lines"
        lines: remaining.map(r => ({ productCode: r.productCode, quantity: r.qty ?? r.quantity ?? r.qty })),
      }));
      createdBackorderId = backorderRef.id;
      createdBackorder = true;
    }
  });

  return {
    success: true,
    backorderCreated: createdBackorder,
    backorderId: createdBackorderId,
  };
};

export default packOrderWithBackorder;
