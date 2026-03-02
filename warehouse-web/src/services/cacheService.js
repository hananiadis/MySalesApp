/**
 * Local Cache Service using IndexedDB
 * Reduces Firestore reads by caching data locally with timestamps
 */

const DB_NAME = 'WarehouseCache';
const DB_VERSION = 1;
const STORES = {
  ORDERS: 'orders',
  PRODUCTS: 'products',
  CUSTOMERS: 'customers',
  STOCK: 'stock',
  METADATA: 'metadata',
};

// Map object store name -> Firestore collection name (for last sync metadata keys)
const STORE_TO_COLLECTION = {
  [STORES.ORDERS]: 'orders_kivos',
  [STORES.PRODUCTS]: 'products_kivos',
  [STORES.CUSTOMERS]: 'customers_kivos',
  [STORES.STOCK]: 'stock_kivos',
};

// Cache is now persistent and only updates manually or incrementally
// No automatic expiration - data persists until manually refreshed
export const CACHE_DURATION = {
  INFINITE: Infinity, // Never expire - only update via manual refresh or incremental fetch
};

let db = null;

/**
 * Initialize IndexedDB
 */
const initDB = () => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      try {
        const database = event.target.result;
        // Create data stores
        Object.values(STORES).forEach((storeName) => {
          try {
            if (!database.objectStoreNames.contains(storeName)) {
              if (storeName === STORES.METADATA) {
                database.createObjectStore(STORES.METADATA, { keyPath: 'key' });
              } else {
                const store = database.createObjectStore(storeName, { keyPath: 'id' });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('lastModified', 'lastModified', { unique: false });
              }
            }
          } catch (e) {
            console.warn('IndexedDB store creation warn:', storeName, e?.message || e);
          }
        });
      } catch (e) {
        console.error('IndexedDB upgrade error:', e?.message || e);
      }
    };
  });
};

/**
 * Save data to cache
 */
export const saveToCache = async (storeName, data, id = null) => {
  try {
    const database = await initDB();
    const transaction = database.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);

    const cacheEntry = {
      id: id || 'collection_data',
      data,
      timestamp: Date.now(),
    };

    await store.put(cacheEntry);
    return true;
  } catch (error) {
    console.error('Cache save error:', error);
    return false;
  }
};

/**
 * Get data from cache (never expires - persistent storage)
 */
export const getFromCache = async (storeName, id = 'collection_data') => {
  try {
    const database = await initDB();
    const transaction = database.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result;
        
        if (!result) {
          resolve(null);
          return;
        }

        // Return cached data regardless of age - persistence model
        resolve(result.data);
      };

      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Cache read error:', error);
    return null;
  }
};

/**
 * Get last sync timestamp for incremental fetching
 */
export const getLastSyncTime = async (collectionName) => {
  try {
    const database = await initDB();
    const transaction = database.transaction([STORES.METADATA], 'readonly');
    const store = transaction.objectStore(STORES.METADATA);

    return new Promise((resolve) => {
      const request = store.get(`last_sync_${collectionName}`);
      request.onsuccess = () => {
        const ts = request.result?.timestamp || null;
        // Fallback: if previous DB version wrote using id keyPath
        if (ts !== null) return resolve(ts);
        const legacyReq = store.get(collectionName);
        legacyReq.onsuccess = () => resolve(legacyReq.result?.timestamp || null);
        legacyReq.onerror = () => resolve(null);
      };
      request.onerror = () => resolve(null);
    });
  } catch (error) {
    console.error('Get last sync error:', error);
    return null;
  }
};

/**
 * Update last sync timestamp
 */
export const updateLastSyncTime = async (collectionName, timestamp = Date.now()) => {
  try {
    const database = await initDB();
    const transaction = database.transaction([STORES.METADATA], 'readwrite');
    const store = transaction.objectStore(STORES.METADATA);
    console.log(`[cacheService] Writing last sync for ${collectionName}: ${new Date(timestamp).toISOString()}`);
    try {
      await store.put({ key: `last_sync_${collectionName}`, timestamp });
    } catch (e) {
      console.warn('Write metadata with key failed, trying legacy id...', e?.message || e);
    }
    // Also write legacy format for compatibility (id keyPath)
    try {
      await store.put({ id: collectionName, timestamp });
    } catch (_) {}
    console.log(`[cacheService] Wrote last sync for ${collectionName}`);
    return true;
  } catch (error) {
    console.error('Update last sync error:', error);
    return false;
  }
};

/**
 * Debug: List all metadata keys and values
 */
export const listAllMetadata = async () => {
  try {
    const database = await initDB();
    const transaction = database.transaction([STORES.METADATA], 'readonly');
    const store = transaction.objectStore(STORES.METADATA);
    return new Promise((resolve, reject) => {
      const result = [];
      const req = store.openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          result.push(cursor.value);
          cursor.continue();
        } else {
          resolve(result);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.error('List metadata error:', error);
    return [];
  }
};

/**
 * Check if collection has been initially synced
 */
export const hasInitialSync = async (collectionName) => {
  const lastSync = await getLastSyncTime(collectionName);
  return lastSync !== null;
};

/**
 * Merge incremental changes into cached data
 * Efficiently updates cached data with new/modified documents
 */
export const mergeIncrementalChanges = async (storeName, changes, idField = 'id') => {
  try {
    const cachedData = await getFromCache(storeName) || [];
    
    // Convert array to map for efficient updates
    const dataMap = new Map(cachedData.map(item => [item[idField], item]));
    
    // Apply changes (add new or update existing)
    changes.forEach(change => {
      dataMap.set(change[idField], change);
    });
    
    // Convert back to array
    const updatedData = Array.from(dataMap.values());
    
    await saveToCache(storeName, updatedData);
    return updatedData;
  } catch (error) {
    console.error('Merge incremental changes error:', error);
    return null;
  }
};

/**
 * Clear specific cache store and its sync metadata
 */
export const clearCache = async (storeName) => {
  try {
    const database = await initDB();
    const transaction = database.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    await store.clear();
    
    // Also clear metadata for this store
    const metaTransaction = database.transaction([STORES.METADATA], 'readwrite');
    const metaStore = metaTransaction.objectStore(STORES.METADATA);
    const collectionName = STORE_TO_COLLECTION[storeName] || storeName;
    await metaStore.delete(`last_sync_${collectionName}`);
    
    return true;
  } catch (error) {
    console.error('Clear cache error:', error);
    return false;
  }
};

/**
 * Clear all caches
 */
export const clearAllCaches = async () => {
  try {
    const database = await initDB();
    const storeNames = Object.values(STORES);
    
    for (const storeName of storeNames) {
      const transaction = database.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      await store.clear();
    }
    // Clear all last_sync_* metadata keys
    const metaTx = database.transaction([STORES.METADATA], 'readwrite');
    const metaStore = metaTx.objectStore(STORES.METADATA);
    await new Promise((resolve, reject) => {
      const req = metaStore.openCursor();
      const deletions = [];
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const key = cursor.key;
          if (typeof key === 'string' && key.startsWith('last_sync_')) {
            deletions.push(metaStore.delete(key));
          }
          cursor.continue();
        } else {
          Promise.allSettled(deletions).then(() => resolve());
        }
      };
      req.onerror = () => reject(req.error);
    });

    return true;
  } catch (error) {
    console.error('Clear all caches error:', error);
    return false;
  }
};

export { STORES };
