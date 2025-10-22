import firestore from '@react-native-firebase/firestore';

/**
 * Upload an order to Firestore as a new document.
 * @param {object} order - The order object to upload (must contain at least userId, lines, customerInfo, etc.)
 * @returns {Promise<string>} - The Firestore document ID of the new order.
 */
export async function uploadOrderToFirestore(order) {
  if (!order || !order.userId) throw new Error('Order object or userId missing!');

  try {
    // Use a server timestamp for consistency
    const docRef = await firestore()
      .collection('orders')
      .add({
        ...order,
        firestoreCreatedAt: firestore.FieldValue.serverTimestamp(),
      });
    return docRef.id;
  } catch (err) {
    console.error('Error uploading order to Firestore:', err);
    throw err;
  }
}

export async function getUserOrders(uid) {
  const snapshot = await firestore()
    .collection('orders')
    .where('userId', '==', uid)
    .orderBy('firestoreCreatedAt', 'desc')
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}