import firestore from '@react-native-firebase/firestore';

// CREATE a new order in Firestore
export async function createOrder(order) {
  if (!order || !order.userId) throw new Error('Order object or userId missing!');
  const docRef = await firestore()
    .collection('orders')
    .add({
      ...order,
      firestoreCreatedAt: firestore.FieldValue.serverTimestamp(),
    });
  return docRef.id;
}

// UPSERT an order by document ID (merge = true)
export async function updateOrder(orderId, data) {
  if (!orderId || !data) throw new Error('orderId or data missing!');
  await firestore()
    .collection('orders')
    .doc(orderId)
    .set(
      {
        ...data,
        firestoreUpdatedAt: firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

// FETCH all orders for a specific user
export async function fetchOrdersForUser(userId) {
  if (!userId) throw new Error('userId is required!');
  const snapshot = await firestore()
    .collection('orders')
    .where('userId', '==', userId)
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// FETCH orders for user by status (e.g. draft, sent)
export async function fetchOrdersByStatus(userId, status) {
  if (!userId || !status) throw new Error('userId and status required!');
  const snapshot = await firestore()
    .collection('orders')
    .where('userId', '==', userId)
    .where('status', '==', status)
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// FETCH orders for user created after a specific date
export async function fetchOrdersAfterDate(userId, date) {
  if (!userId || !date) throw new Error('userId and date required!');
  const snapshot = await firestore()
    .collection('orders')
    .where('userId', '==', userId)
    .where('firestoreCreatedAt', '>=', firestore.Timestamp.fromDate(date))
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
