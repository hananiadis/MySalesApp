/**
 * Optimized Firestore Service
 * Implements timestamp-based incremental fetching
 * Only fetches documents that changed since last sync
 */

import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  saveToCache, 
  getFromCache, 
  getLastSyncTime, 
  updateLastSyncTime,
  hasInitialSync,
  mergeIncrementalChanges,
  STORES 
} from './cacheService';

// Helper: convert Firestore Timestamp or ISO string to JS Date
const toJsDate = (value) => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
};

/**
 * Fetch orders with timestamp-based incremental sync
 * First load: Fetches all orders
 * Subsequent loads: Returns cache + fetches only documents modified since last sync
 * IMPORTANT: Uses 'firestoreUpdatedAt' timestamp field on order documents
 */
export const fetchOrdersIncremental = async (options = {}) => {
  const { forceRefresh = false } = options;

  try {
    const hasInitial = await hasInitialSync('orders_kivos');
    const lastSync = await getLastSyncTime('orders_kivos');

    // Return cached data immediately if available
    if (!forceRefresh && hasInitial) {
      const cached = await getFromCache(STORES.ORDERS, 'orders_list');
      if (cached) {
        console.log(`📦 Orders loaded from cache (${cached.length} orders)`);
        
        // Trigger incremental update in background (non-blocking)
        fetchIncrementalOrders(lastSync).then(updates => {
          if (updates.length > 0) {
            console.log(`✅ Background: ${updates.length} orders updated`);
          }
        });
        
        return cached;
      }
    }

    // Initial fetch or force refresh
    console.log('🔄 Fetching all orders from Firestore (initial sync)...');
    const ordersRef = collection(db, 'orders_kivos');
    const q = query(ordersRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    const orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // createdAt in samples is ISO string, normalize to Date
      createdAt: toJsDate(doc.data().createdAt),
      updatedAt: toJsDate(doc.data().updatedAt),
      packedAt: toJsDate(doc.data().packedAt),
    }));

    console.log(`✅ Fetched ${orders.length} orders from Firestore`);

    await saveToCache(STORES.ORDERS, orders, 'orders_list');
    await updateLastSyncTime('orders_kivos');

    return orders;
  } catch (error) {
    console.error('Error fetching orders:', error);
    const cached = await getFromCache(STORES.ORDERS, 'orders_list');
    if (cached) {
      console.log('⚠️ Using cached orders due to error');
      return cached;
    }
    return [];
  }
};

/**
 * Fetch only orders modified since last sync (incremental)
 * Only charges reads for documents that actually changed!
 */
const fetchIncrementalOrders = async (lastSync) => {
  if (!lastSync) return [];

  try {
    const ordersRef = collection(db, 'orders_kivos');
    
    // Query only documents with firestoreUpdatedAt > lastSync
    // This only fetches documents that changed!
    const q = query(
      ordersRef,
      where('firestoreUpdatedAt', '>', Timestamp.fromMillis(lastSync)),
      orderBy('firestoreUpdatedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('✓ No order changes since last sync');
      await updateLastSyncTime('orders_kivos');
      return [];
    }

    const updates = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: toJsDate(doc.data().createdAt),
      updatedAt: toJsDate(doc.data().updatedAt),
      packedAt: toJsDate(doc.data().packedAt),
    }));

    // Merge changes into cache
    const cached = await getFromCache(STORES.ORDERS, 'orders_list') || [];
    const orderMap = new Map(cached.map(o => [o.id, o]));
    updates.forEach(order => orderMap.set(order.id, order));
    const merged = Array.from(orderMap.values());
    
    await saveToCache(STORES.ORDERS, merged, 'orders_list');
    await updateLastSyncTime('orders_kivos');

    return updates;
  } catch (error) {
    console.error('Error fetching incremental orders:', error);
    return [];
  }
};

/**
 * Force refresh all data (manual update button)
 * Fetches all collections and updates cache
 */
export const forceRefreshAll = async () => {
  console.log('🔄 Force refreshing all data...');
  
  const results = await Promise.allSettled([
    fetchOrdersIncremental({ forceRefresh: true }),
    fetchProductsCached(true),
    fetchCustomersCached(true),
    fetchStockCached(true),
  ]);

  const success = results.filter(r => r.status === 'fulfilled');
  const failed = results.filter(r => r.status === 'rejected');

  console.log(`✅ Refresh complete: ${success.length} success, ${failed.length} failed`);

  // Ensure last sync timestamps are updated even if individual functions skipped
  try { console.log('[ofs] updating last sync: orders_kivos'); await updateLastSyncTime('orders_kivos'); } catch (e) { console.error('[ofs] update last sync failed (orders_kivos)', e); }
  try { console.log('[ofs] updating last sync: products_kivos'); await updateLastSyncTime('products_kivos'); } catch (e) { console.error('[ofs] update last sync failed (products_kivos)', e); }
  try { console.log('[ofs] updating last sync: customers_kivos'); await updateLastSyncTime('customers_kivos'); } catch (e) { console.error('[ofs] update last sync failed (customers_kivos)', e); }
  try { console.log('[ofs] updating last sync: stock_kivos'); await updateLastSyncTime('stock_kivos'); } catch (e) { console.error('[ofs] update last sync failed (stock_kivos)', e); }
  
  return {
    orders: results[0].status === 'fulfilled' ? results[0].value : [],
    products: results[1].status === 'fulfilled' ? results[1].value : {},
    customers: results[2].status === 'fulfilled' ? results[2].value : {},
    stock: results[3].status === 'fulfilled' ? results[3].value : [],
  };
};

/**
 * OLD: Fetch orders with pagination
 * Keeping for backward compatibility
 */
export const fetchOrdersPaginated = async (pageSize = 50, lastDoc = null) => {
  try {
    const ordersRef = collection(db, 'orders_kivos');
    let q = query(
      ordersRef,
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );

    if (lastDoc) {
      q = query(
        ordersRef,
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(pageSize)
      );
    }

    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
    }));

    const lastVisible = snapshot.docs[snapshot.docs.length - 1];
    const hasMore = snapshot.docs.length === pageSize;

    return { orders, lastVisible, hasMore };
  } catch (error) {
    console.error('Error fetching paginated orders:', error);
    return { orders: [], lastVisible: null, hasMore: false };
  }
};

/**
 * Fetch products with timestamp-based incremental sync
 * Products rarely change, so this is very efficient
 * IMPORTANT: Requires 'lastUpdated' timestamp field on product documents
 */
export const fetchProductsCached = async (forceRefresh = false) => {
  try {
    const hasInitial = await hasInitialSync('products_kivos');
    const lastSync = await getLastSyncTime('products_kivos');

    if (!forceRefresh && hasInitial) {
      const cached = await getFromCache(STORES.PRODUCTS, 'products_map');
      if (cached) {
        console.log(`📦 Products loaded from cache (${Object.keys(cached).length} products)`);
        
        // Check for updates in background
        fetchIncrementalProducts(lastSync).then(updates => {
          if (updates.length > 0) {
            console.log(`✅ Background: ${updates.length} products updated`);
          }
        });
        
        return cached;
      }
    }

    console.log('🔄 Fetching all products from Firestore (initial sync)...');
    const productsRef = collection(db, 'products_kivos');
    const snapshot = await getDocs(productsRef);

    const productMap = {};
    snapshot.docs.forEach(doc => {
      // Use productCode field if present, otherwise doc.id
      const code = doc.data().productCode || doc.id;
      productMap[code] = { id: doc.id, ...doc.data() };
    });

    console.log(`✅ Fetched ${Object.keys(productMap).length} products from Firestore`);

    await saveToCache(STORES.PRODUCTS, productMap, 'products_map');
    await updateLastSyncTime('products_kivos');

    return productMap;
  } catch (error) {
    console.error('Error fetching products:', error);
    const cached = await getFromCache(STORES.PRODUCTS, 'products_map');
    if (cached) {
      console.log('⚠️ Using cached products due to error');
      return cached;
    }
    return {};
  }
};

const fetchIncrementalProducts = async (lastSync) => {
  if (!lastSync) return [];

  try {
    const productsRef = collection(db, 'products_kivos');
    const q = query(
      productsRef,
      where('lastUpdated', '>', Timestamp.fromMillis(lastSync)),
      orderBy('lastUpdated', 'desc')
    );

    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('✓ No product changes');
      await updateLastSyncTime('products_kivos');
      return [];
    }

    const updates = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Merge into cached map
    const cached = await getFromCache(STORES.PRODUCTS, 'products_map') || {};
    updates.forEach(product => {
      const code = product.productCode || product.id;
      cached[code] = product;
    });
    
    await saveToCache(STORES.PRODUCTS, cached, 'products_map');
    await updateLastSyncTime('products_kivos');

    return updates;
  } catch (error) {
    console.error('Error fetching incremental products:', error);
    return [];
  }
};

/**
 * Fetch customers (rarely changes - very cache-friendly)
 * No incremental sync needed - customers change very rarely
 */
export const fetchCustomersCached = async (forceRefresh = false) => {
  try {
    const hasInitial = await hasInitialSync('customers_kivos');

    if (!forceRefresh && hasInitial) {
      const cached = await getFromCache(STORES.CUSTOMERS, 'customers_map');
      if (cached) {
        console.log(`📦 Customers loaded from cache (${Object.keys(cached).length} customers)`);
        return cached;
      }
    }

    console.log('🔄 Fetching all customers from Firestore...');
    const customersRef = collection(db, 'customers_kivos');
    const snapshot = await getDocs(customersRef);

    const customerMap = {};
    snapshot.docs.forEach(doc => {
      customerMap[doc.id] = { id: doc.id, ...doc.data() };
    });

    console.log(`✅ Fetched ${Object.keys(customerMap).length} customers from Firestore`);

    await saveToCache(STORES.CUSTOMERS, customerMap, 'customers_map');
    await updateLastSyncTime('customers_kivos');

    return customerMap;
  } catch (error) {
    console.error('Error fetching customers:', error);
    const cached = await getFromCache(STORES.CUSTOMERS, 'customers_map');
    if (cached) {
      console.log('⚠️ Using cached customers due to error');
      return cached;
    }
    return {};
  }
};

/**
 * Fetch stock with timestamp-based incremental sync
 * IMPORTANT: Requires 'lastUpdated' timestamp field on stock documents
 */
export const fetchStockCached = async (forceRefresh = false) => {
  try {
    const hasInitial = await hasInitialSync('stock_kivos');
      console.log('🔄 Fetching all orders from Firestore (initial sync)...');

    if (!forceRefresh && hasInitial) {
      const cached = await getFromCache(STORES.STOCK, 'stock_data');
      if (cached) {
        console.log(`📦 Stock loaded from cache (${cached.length} items)`);
        
        // Check for updates in background
        fetchIncrementalStock(lastSync).then(updates => {
          if (updates.length > 0) {
            console.log(`✅ Background: ${updates.length} stock items updated`);
          }
        });
        
        return cached;
      }
    }
      await updateLastSyncTime('orders_kivos');
    console.log('🔄 Fetching all stock from Firestore (initial sync)...');
    const stockRef = collection(db, 'stock_kivos');
    const snapshot = await getDocs(stockRef);

    const stock = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log(`✅ Fetched ${stock.length} stock items from Firestore`);

    await saveToCache(STORES.STOCK, stock, 'stock_data');
    await updateLastSyncTime('stock_kivos');

    return stock;
  } catch (error) {
    console.error('Error fetching stock:', error);
    const cached = await getFromCache(STORES.STOCK, 'stock_data');
    if (cached) {
      console.log('⚠️ Using cached stock due to error');
      return cached;
    }
    return [];
  }
};

const fetchIncrementalStock = async (lastSync) => {
  if (!lastSync) return [];

  try {
    const stockRef = collection(db, 'stock_kivos');
    const q = query(
      stockRef,
      where('lastUpdated', '>', Timestamp.fromMillis(lastSync)),
      orderBy('lastUpdated', 'desc')
    );

    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      await updateLastSyncTime('customers_kivos');
      await updateLastSyncTime('stock_kivos');
      return [];
    }

    const updates = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Merge into cached array using productCode as the stable key
    const cached = await getFromCache(STORES.STOCK, 'stock_data') || [];
    const stockMap = new Map(cached.map(s => [s.productCode || s.id, s]));
    updates.forEach(stock => stockMap.set(stock.productCode || stock.id, stock));
    const merged = Array.from(stockMap.values());
    
    await saveToCache(STORES.STOCK, merged, 'stock_data');
    await updateLastSyncTime('stock_kivos');

    return updates;
  } catch (error) {
    console.error('Error fetching incremental stock:', error);
    return [];
  }
};

/**
 * Helper: Ensure document has lastUpdated/firestoreUpdatedAt timestamp
 * Use this when writing to Firestore to enable incremental sync
 */
export const withLastUpdated = (data) => ({
  ...data,
  lastUpdated: Timestamp.now(),
});

/**
 * Helper: Stamp the appropriate "updated" timestamp field based on collection
 * - orders_kivos: firestoreUpdatedAt
 * - products_kivos: lastUpdated
 * - stock_kivos: lastUpdated
 * - supplier_orders_kivos: lastModified
 */
export const withUpdatedTimestamp = (collectionName, data) => {
  const now = Timestamp.now();
  switch (collectionName) {
    case 'orders_kivos':
      return { ...data, firestoreUpdatedAt: now };
    case 'products_kivos':
    case 'stock_kivos':
      return { ...data, lastUpdated: now };
    case 'supplier_orders_kivos':
      return { ...data, lastModified: now };
    default:
      return { ...data, lastUpdated: now };
  }
};

/**
 * OLD: Fetch orders by status only (legacy)
 */
export const fetchOrdersByStatus = async (status, limitCount = 100) => {
  try {
    const ordersRef = collection(db, 'orders_kivos');
    const q = query(
      ordersRef,
      where('status', '==', status),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
    }));

    return orders;
  } catch (error) {
    console.error(`Error fetching orders by status (${status}):`, error);
    return [];
  }
};

/**
 * OLD: Fetch orders within date range (legacy)
 */
export const fetchOrdersByDateRange = async (startDate, endDate, limitCount = 500) => {
  try {
    const ordersRef = collection(db, 'orders_kivos');
    const q = query(
      ordersRef,
      where('createdAt', '>=', Timestamp.fromDate(startDate)),
      where('createdAt', '<=', Timestamp.fromDate(endDate)),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
    }));

    return orders;
  } catch (error) {
    console.error('Error fetching orders by date range:', error);
    return [];
  }
};
