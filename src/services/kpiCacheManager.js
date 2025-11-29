// src/services/kpiCacheManager.js
// KPI calculation results cache manager
// Stores computed metrics for different salesman filter combinations

import AsyncStorage from '@react-native-async-storage/async-storage';

console.log('[kpiCacheManager] Module loaded');

// Cache keys
const CACHE_KEYS = {
  // Stores the calculation results for different filter combinations
  RESULTS_PREFIX: 'kpi:results:',
  // Index of all cached filter combinations
  INDEX: 'kpi:results:index',
  // Data version/timestamp - invalidate all caches when data refreshes
  DATA_VERSION: 'kpi:data:version',
};

// Cache configuration
const CACHE_CONFIG = {
  // Maximum number of filter combinations to cache
  MAX_CACHED_COMBINATIONS: 20,
  // Cache TTL in hours
  TTL_HOURS: 24,
};

/**
 * Generate a cache key for a specific filter combination
 * @param {string} brand - Brand identifier (playmobil, kivos, etc)
 * @param {Array<string>} salesmenNames - Sorted array of salesman names
 * @returns {string} Cache key
 */
function generateFilterKey(brand, salesmenNames) {
  if (!Array.isArray(salesmenNames) || salesmenNames.length === 0) {
    return `${brand}:ALL`;
  }
  
  // Sort names to ensure consistent key regardless of selection order
  const sorted = [...salesmenNames].sort();
  return `${brand}:${sorted.join('|')}`;
}

/**
 * Get the current data version timestamp
 * @returns {Promise<number>} Data version timestamp
 */
async function getDataVersion() {
  try {
    const version = await AsyncStorage.getItem(CACHE_KEYS.DATA_VERSION);
    return version ? parseInt(version, 10) : 0;
  } catch (error) {
    console.error('[kpiCacheManager] Error getting data version:', error);
    return 0;
  }
}

/**
 * Set a new data version (called when data is refreshed)
 * This invalidates all existing caches
 * @returns {Promise<void>}
 */
export async function invalidateAllCaches() {
  console.log('[kpiCacheManager] Invalidating all caches due to data refresh');
  
  try {
    const newVersion = Date.now();
    await AsyncStorage.setItem(CACHE_KEYS.DATA_VERSION, newVersion.toString());
    
    // Clear the index
    await AsyncStorage.removeItem(CACHE_KEYS.INDEX);
    
    console.log('[kpiCacheManager] All caches invalidated, new version:', newVersion);
  } catch (error) {
    console.error('[kpiCacheManager] Error invalidating caches:', error);
  }
}

/**
 * Get cached calculation results for a specific filter combination
 * @param {string} brand - Brand identifier
 * @param {Array<string>} salesmenNames - Array of salesman names
 * @returns {Promise<Object|null>} Cached results or null if not found/expired
 */
export async function getCachedResults(brand, salesmenNames) {
  const filterKey = generateFilterKey(brand, salesmenNames);
  const cacheKey = `${CACHE_KEYS.RESULTS_PREFIX}${filterKey}`;
  
  console.log('[kpiCacheManager] Getting cached results for:', filterKey);
  
  try {
    const currentDataVersion = await getDataVersion();
    const cachedJson = await AsyncStorage.getItem(cacheKey);
    
    if (!cachedJson) {
      console.log('[kpiCacheManager] No cached results found');
      return null;
    }
    
    const cached = JSON.parse(cachedJson);
    
    // Check if data version matches (data hasn't been refreshed)
    if (cached.dataVersion !== currentDataVersion) {
      console.log('[kpiCacheManager] Cache invalid - data version mismatch');
      await AsyncStorage.removeItem(cacheKey);
      return null;
    }
    
    // Check if cache has expired
    const age = Date.now() - cached.timestamp;
    const ageHours = age / (1000 * 60 * 60);
    
    if (ageHours > CACHE_CONFIG.TTL_HOURS) {
      console.log(`[kpiCacheManager] Cache expired (${ageHours.toFixed(2)} hours old)`);
      await AsyncStorage.removeItem(cacheKey);
      return null;
    }
    
    console.log(`[kpiCacheManager] Cache hit! Age: ${ageHours.toFixed(2)} hours`);
    return cached.results;
    
  } catch (error) {
    console.error('[kpiCacheManager] Error getting cached results:', error);
    return null;
  }
}

/**
 * Store calculation results for a specific filter combination
 * @param {string} brand - Brand identifier
 * @param {Array<string>} salesmenNames - Array of salesman names
 * @param {Object} results - KPI calculation results
 * @returns {Promise<void>}
 */
export async function setCachedResults(brand, salesmenNames, results) {
  const filterKey = generateFilterKey(brand, salesmenNames);
  const cacheKey = `${CACHE_KEYS.RESULTS_PREFIX}${filterKey}`;
  
  console.log('[kpiCacheManager] Caching results for:', filterKey);
  
  try {
    const currentDataVersion = await getDataVersion();
    
    // If no data version exists, set it now
    if (currentDataVersion === 0) {
      await AsyncStorage.setItem(CACHE_KEYS.DATA_VERSION, Date.now().toString());
    }
    
    const cacheEntry = {
      filterKey,
      dataVersion: currentDataVersion || Date.now(),
      timestamp: Date.now(),
      results: {
        // Store only the computed metrics, not raw records (too large)
        kpis: results.kpis,
        metricSnapshot: results.metricSnapshot,
        // Store limited customer summary (top 100)
        customers: Array.isArray(results.customers) ? results.customers.slice(0, 100) : [],
      },
    };
    
    await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
    
    // Update the index
    await updateCacheIndex(filterKey);
    
    // Prune old caches if we exceed the limit
    await pruneOldCaches();
    
    console.log('[kpiCacheManager] Results cached successfully');
    
  } catch (error) {
    console.error('[kpiCacheManager] Error caching results:', error);
    // Don't throw - caching is optional
  }
}

/**
 * Update the cache index with a new filter key
 * @param {string} filterKey - Filter combination key
 * @returns {Promise<void>}
 */
async function updateCacheIndex(filterKey) {
  try {
    const indexJson = await AsyncStorage.getItem(CACHE_KEYS.INDEX);
    const index = indexJson ? JSON.parse(indexJson) : [];
    
    // Add or update entry
    const existingIndex = index.findIndex(entry => entry.key === filterKey);
    const entry = { key: filterKey, lastAccess: Date.now() };
    
    if (existingIndex >= 0) {
      index[existingIndex] = entry;
    } else {
      index.push(entry);
    }
    
    await AsyncStorage.setItem(CACHE_KEYS.INDEX, JSON.stringify(index));
    
  } catch (error) {
    console.error('[kpiCacheManager] Error updating cache index:', error);
  }
}

/**
 * Remove old caches if we exceed the maximum number of cached combinations
 * @returns {Promise<void>}
 */
async function pruneOldCaches() {
  try {
    const indexJson = await AsyncStorage.getItem(CACHE_KEYS.INDEX);
    if (!indexJson) return;
    
    const index = JSON.parse(indexJson);
    
    if (index.length <= CACHE_CONFIG.MAX_CACHED_COMBINATIONS) {
      return; // No pruning needed
    }
    
    console.log(`[kpiCacheManager] Pruning old caches (${index.length} > ${CACHE_CONFIG.MAX_CACHED_COMBINATIONS})`);
    
    // Sort by last access time (oldest first)
    index.sort((a, b) => a.lastAccess - b.lastAccess);
    
    // Remove oldest entries
    const toRemove = index.length - CACHE_CONFIG.MAX_CACHED_COMBINATIONS;
    const removed = index.splice(0, toRemove);
    
    // Delete the cache entries
    for (const entry of removed) {
      const cacheKey = `${CACHE_KEYS.RESULTS_PREFIX}${entry.key}`;
      await AsyncStorage.removeItem(cacheKey);
      console.log('[kpiCacheManager] Removed old cache:', entry.key);
    }
    
    // Update the index
    await AsyncStorage.setItem(CACHE_KEYS.INDEX, JSON.stringify(index));
    
    console.log(`[kpiCacheManager] Pruned ${toRemove} old caches`);
    
  } catch (error) {
    console.error('[kpiCacheManager] Error pruning caches:', error);
  }
}

/**
 * Get cache statistics
 * @returns {Promise<Object>} Cache statistics
 */
export async function getCacheStats() {
  try {
    const indexJson = await AsyncStorage.getItem(CACHE_KEYS.INDEX);
    const index = indexJson ? JSON.parse(indexJson) : [];
    const dataVersion = await getDataVersion();
    
    return {
      cachedCombinations: index.length,
      maxCombinations: CACHE_CONFIG.MAX_CACHED_COMBINATIONS,
      dataVersion,
      ttlHours: CACHE_CONFIG.TTL_HOURS,
      entries: index.map(entry => ({
        key: entry.key,
        lastAccess: new Date(entry.lastAccess).toISOString(),
        ageHours: ((Date.now() - entry.lastAccess) / (1000 * 60 * 60)).toFixed(2),
      })),
    };
  } catch (error) {
    console.error('[kpiCacheManager] Error getting cache stats:', error);
    return {
      cachedCombinations: 0,
      maxCombinations: CACHE_CONFIG.MAX_CACHED_COMBINATIONS,
      dataVersion: 0,
      ttlHours: CACHE_CONFIG.TTL_HOURS,
      entries: [],
    };
  }
}

/**
 * Clear all cached results (keeping data version)
 * @returns {Promise<void>}
 */
export async function clearAllCaches() {
  console.log('[kpiCacheManager] Clearing all cached results');
  
  try {
    const indexJson = await AsyncStorage.getItem(CACHE_KEYS.INDEX);
    if (indexJson) {
      const index = JSON.parse(indexJson);
      
      // Remove all cache entries
      for (const entry of index) {
        const cacheKey = `${CACHE_KEYS.RESULTS_PREFIX}${entry.key}`;
        await AsyncStorage.removeItem(cacheKey);
      }
    }
    
    // Clear the index
    await AsyncStorage.removeItem(CACHE_KEYS.INDEX);
    
    console.log('[kpiCacheManager] All caches cleared');
    
  } catch (error) {
    console.error('[kpiCacheManager] Error clearing caches:', error);
  }
}
