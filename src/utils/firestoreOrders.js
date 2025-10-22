import firestore from '@react-native-firebase/firestore';

const normalizeBrand = (brand) => (brand ? String(brand).trim().toLowerCase() : '');

export const getCollectionName = (brand, orderType = null) => {
  const normalizedBrand = normalizeBrand(brand);

  if (orderType === 'supermarket') {
    if (!normalizedBrand) {
      throw new Error('SuperMarket orders require a brand');
    }
    return `orders_${normalizedBrand}_supermarket`;
  }

  if (normalizedBrand === 'kivos') return 'orders_kivos';
  if (normalizedBrand === 'john') return 'orders_john';
  if (!normalizedBrand || normalizedBrand === 'playmobil') return 'orders';
  return `orders_${normalizedBrand}`;
};

// CREATE a new order in Firestore
export async function createOrder(order) {
  if (!order || !order.userId) throw new Error('Order object or userId missing!');
  const collectionName = getCollectionName(order.brand, order.orderType);
  const docRef = await firestore()
    .collection(collectionName)
    .add({
      ...order,
      firestoreCreatedAt: firestore.FieldValue.serverTimestamp(),
    });
  return docRef.id;
}

// UPSERT an order by document ID (merge = true)
export async function updateOrder(orderId, data) {
  if (!orderId || !data) throw new Error('orderId or data missing!');
  const collectionName = getCollectionName(data.brand, data.orderType);
  await firestore()
    .collection(collectionName)
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
export async function fetchOrdersForUser(userId, brand = null, orderType = null) {
  if (!userId) throw new Error('userId is required!');
  const collectionName = getCollectionName(brand, orderType);
  const snapshot = await firestore()
    .collection(collectionName)
    .where('userId', '==', userId)
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// FETCH orders for user by status (e.g. draft, sent)
export async function fetchOrdersByStatus(userId, status, brand = null, orderType = null) {
  if (!userId || !status) throw new Error('userId and status required!');
  const collectionName = getCollectionName(brand, orderType);
  const snapshot = await firestore()
    .collection(collectionName)
    .where('userId', '==', userId)
    .where('status', '==', status)
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// FETCH orders for user created after a specific date
export async function fetchOrdersAfterDate(userId, date, brand = null, orderType = null) {
  if (!userId || !date) throw new Error('userId and date required!');
  const collectionName = getCollectionName(brand, orderType);
  const snapshot = await firestore()
    .collection(collectionName)
    .where('userId', '==', userId)
    .where('firestoreCreatedAt', '>=', firestore.Timestamp.fromDate(date))
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
