// src/services/playmobilKpi.js
// Playmobil KPI calculation service

import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchGoogleSheetCSV, validateGoogleSheetsConfig } from './googleSheets';
import { PLAYMOBIL_CONFIG } from '../config/playmobil';

console.log('[playmobilKpi] Module loaded');

// In-memory cache for current session (avoids AsyncStorage reads)
let _memoryCache = {
  datasets: null,
  timestamp: null,
  headerDates: null,
  storeMapping: null, // Store -> Salesman mapping
  storeMappingTimestamp: null,
};

// AsyncStorage cache keys
const CACHE_KEYS = {
  SHEETS_DATA: 'playmobil:sheets:data',
  SHEETS_TIMESTAMP: 'playmobil:sheets:timestamp',
  SHEETS_HEADER_DATES: 'playmobil:sheets:headerDates',
  KPI_RESULTS: 'playmobil:kpi:results',
  KPI_TIMESTAMP: 'playmobil:kpi:timestamp',
  STORE_MAPPING: 'playmobil:storeMapping:data',
  STORE_MAPPING_TIMESTAMP: 'playmobil:storeMapping:timestamp',
  // Month-based chunk keys for smart caching
  MONTH_CHUNK_PREFIX: 'playmobil:month:',
  MONTH_INDEX: 'playmobil:month:index',
  CURRENT_MONTH_TIMESTAMP: 'playmobil:month:current:timestamp',
};

// Cache TTL in hours
const CACHE_TTL_HOURS = 12;

// Days buffer at start of month to ensure we have complete previous month data
const MONTH_START_BUFFER_DAYS = 5;

// Sheet key mapping for Playmobil data
const PLAYMOBIL_SHEET_KEYS = {
  invoiced2025: { sheetKey: 'sales2025', dataType: 'sales' },
  invoiced2024: { sheetKey: 'sales2024', dataType: 'sales' },
  orders2025: { sheetKey: 'orders2025', dataType: 'orders' },
  orders2024: { sheetKey: 'orders2024', dataType: 'orders' },
  balance2025: { sheetKey: 'balance2025', dataType: 'balance' },
};

// Additional Playmobil sheets for customer sales summary
const ADDITIONAL_PLAYMOBIL_SHEETS = ['playmobilSales', 'playmobilStock'];

console.log('[playmobilKpi] Sheet key mapping:', PLAYMOBIL_SHEET_KEYS);
console.log('[playmobilKpi] Additional sheets:', ADDITIONAL_PLAYMOBIL_SHEETS);

/**
 * Fetch and parse store mapping sheet
 * Creates a lookup: { customerCode: { stores: { storeName: salesmanName } } }
 * @returns {Promise<Object>} Store mapping data
 */
async function fetchStoreMapping() {
  console.log('[fetchStoreMapping] START');
  
  try {
    // Check memory cache first
    const now = Date.now();
    if (_memoryCache.storeMapping && _memoryCache.storeMappingTimestamp) {
      const age = (now - _memoryCache.storeMappingTimestamp) / (1000 * 60 * 60);
      if (age < CACHE_TTL_HOURS) {
        console.log('[fetchStoreMapping] Using memory cache');
        return _memoryCache.storeMapping;
      }
    }

    // Check AsyncStorage cache
    const cachedTimestamp = await AsyncStorage.getItem(CACHE_KEYS.STORE_MAPPING_TIMESTAMP);
    if (cachedTimestamp) {
      const age = (now - parseInt(cachedTimestamp, 10)) / (1000 * 60 * 60);
      if (age < CACHE_TTL_HOURS) {
        const cached = await AsyncStorage.getItem(CACHE_KEYS.STORE_MAPPING);
        if (cached) {
          const mapping = JSON.parse(cached);
          _memoryCache.storeMapping = mapping;
          _memoryCache.storeMappingTimestamp = parseInt(cachedTimestamp, 10);
          console.log('[fetchStoreMapping] Using AsyncStorage cache');
          return mapping;
        }
      }
    }

    // Fetch fresh data from 2025 sales sheet (current year as authoritative source)
    console.log('[fetchStoreMapping] Fetching fresh data from 2025 sales sheet');
    const records = await fetchGoogleSheetCSV(
      PLAYMOBIL_CONFIG.sheetUrls.sales2025,
      PLAYMOBIL_CONFIG.columnNames.sales
    );

    console.log(`[fetchStoreMapping] Fetched ${records.length} sales records from 2025 to build store mapping`);

    // Build lookup structure: { customerCode: { stores: { store: salesman }, primaryMerch: string } }
    const mapping = {};
    
    records.forEach((record, index) => {
      const customerCode = (record.customerCode || '').trim();
      const store = (record.shipToCity || '').trim();
      const salesRep = (record.salesRep || '').trim();
      const partnerZM = (record.partnerZM || '').trim();

      if (!customerCode || !store) {
        return; // Skip invalid rows
      }

      // Determine salesman name (handle special case)
      let salesmanName;
      if (salesRep === 'ΑΝΑΝΙΑΔΟΥ ΑΝΑΣΤΑΣΙΑ & ΣΙΑ ΟΕ') {
        salesmanName = partnerZM || salesRep;
      } else {
        salesmanName = salesRep || partnerZM || '';
      }

      if (!salesmanName) {
        return; // Skip if no salesman
      }

      // Initialize customer entry if needed
      if (!mapping[customerCode]) {
        mapping[customerCode] = {
          stores: {},
          salesmen: new Set(),
        };
      }

      // Add store -> salesman mapping
      mapping[customerCode].stores[store] = salesmanName;
      mapping[customerCode].salesmen.add(salesmanName);

      if (index < 3) {
        console.log(`[fetchStoreMapping] Sample ${index + 1}:`, {
          customerCode,
          store,
          salesmanName,
        });
      }
    });

    // Convert Sets to arrays for JSON serialization
    Object.keys(mapping).forEach(customerCode => {
      mapping[customerCode].salesmen = Array.from(mapping[customerCode].salesmen);
      mapping[customerCode].isMultiSalesman = mapping[customerCode].salesmen.length > 1;
    });

    console.log(`[fetchStoreMapping] Built mapping for ${Object.keys(mapping).length} customers`);
    console.log(`[fetchStoreMapping] Multi-salesman customers: ${Object.values(mapping).filter(m => m.isMultiSalesman).length}`);

    // Cache the mapping
    _memoryCache.storeMapping = mapping;
    _memoryCache.storeMappingTimestamp = now;
    
    try {
      await AsyncStorage.setItem(CACHE_KEYS.STORE_MAPPING, JSON.stringify(mapping));
      await AsyncStorage.setItem(CACHE_KEYS.STORE_MAPPING_TIMESTAMP, now.toString());
      console.log('[fetchStoreMapping] Cached store mapping');
    } catch (cacheError) {
      console.warn('[fetchStoreMapping] Failed to cache mapping:', cacheError);
    }

    console.log('[fetchStoreMapping] SUCCESS');
    return mapping;

  } catch (error) {
    console.error('[fetchStoreMapping] ERROR:', error);
    // Return empty mapping on error
    return {};
  }
}

/**
 * Determine which salesman handled a transaction
 * Two-tier logic for historical data preservation:
 * 
 * TIER 1: Single-salesman customers (merch array has 1 salesman)
 * - Use that salesman for ALL years of data
 * - This preserves complete historical context for each salesman
 * 
 * TIER 2: Multi-salesman customers (merch array has 2+ salesmen)
 * - Examine store-level data from latest available year (2025)
 * - Assign ALL years of sales/orders to the salesman responsible for each store
 * - This reflects current responsibility while maintaining store-level accuracy
 * 
 * @param {Object} record - Transaction record with salesRep, partnerZM, shipToCity/shipToLocation
 * @param {Object} storeMapping - Store mapping data (from latest year, e.g., 2025)
 * @param {Object} customerData - Customer data from Firestore (contains merch array and primaryMerch)
 * @returns {string} The salesman who handled the transaction
 */
function determineHandlingSalesman(record, storeMapping = {}, customerData = null) {
  const salesRep = (record.salesRep || '').trim();
  const partnerZM = (record.partnerZM || '').trim();
  const customerCode = (record.customerCode || '').trim();
  const store = (record.shipToCity || record.shipToLocation || '').trim();

  // Get customer's merch array from Firestore to determine if single or multi-salesman
  const customerMerch = customerData?.merch;
  const merchArray = Array.isArray(customerMerch) ? customerMerch : [customerMerch].filter(Boolean);
  const isSingleSalesmanCustomer = merchArray.length === 1;
  const isMultiSalesmanCustomer = merchArray.length > 1;

  // TIER 1: SINGLE-SALESMAN CUSTOMERS
  // If customer has only ONE salesman in Firestore, use that salesman for ALL years
  // This preserves historical data correctly - the single salesman gets credit for all past activity
  if (isSingleSalesmanCustomer) {
    const singleSalesman = merchArray[0];
    
    // Use the Firestore salesman consistently across all years
    // Even if record has different salesRep/partnerZM, trust Firestore as source of truth
    if (singleSalesman) {
      return singleSalesman;
    }
    
    // Fallback: If merch array exists but empty, try record data or primaryMerch
    if (salesRep || partnerZM) {
      return salesRep === 'ΑΝΑΝΙΑΔΟΥ ΑΝΑΣΤΑΣΙΑ & ΣΙΑ ΟΕ' ? (partnerZM || salesRep) : (salesRep || partnerZM);
    }
    
    return customerData?.primaryMerch || '';
  }

  // TIER 2: MULTI-SALESMAN CUSTOMERS
  // If customer has MULTIPLE salesmen, use store-level analysis from latest year (2025)
  // Each store's sales/orders for ALL years go to the salesman currently responsible for that store
  if (isMultiSalesmanCustomer) {
    const customerMapping = storeMapping[customerCode];
    
    // Try to use store mapping from latest year
    if (customerMapping && customerMapping.isMultiSalesman && store) {
      const storeSalesman = customerMapping.stores[store];
      
      if (storeSalesman) {
        // Use the current store assignment for all years of this store's data
        return storeSalesman;
      }
    }

    // Fallback for multi-salesman: Try record data if store mapping unavailable
    if (salesRep || partnerZM) {
      return salesRep === 'ΑΝΑΝΙΑΔΟΥ ΑΝΑΣΤΑΣΙΑ & ΣΙΑ ΟΕ' ? (partnerZM || salesRep) : (salesRep || partnerZM);
    }

    // Last resort: primaryMerch
    return customerData?.primaryMerch || '';
  }

  // FALLBACK: Customer has no merch data in Firestore
  // Use record data or primaryMerch as last resort
  if (salesRep || partnerZM) {
    return salesRep === 'ΑΝΑΝΙΑΔΟΥ ΑΝΑΣΤΑΣΙΑ & ΣΙΑ ΟΕ' ? (partnerZM || salesRep) : (salesRep || partnerZM);
  }

  return customerData?.primaryMerch || '';
}

/**
 * Get customer codes for given salesman IDs and brand
 */
export async function getCustomerCodes(salesmanIds, brand = 'playmobil') {
  console.log('[getCustomerCodes] START');
  console.log('[getCustomerCodes] Input salesmanIds:', JSON.stringify(salesmanIds));
  console.log('[getCustomerCodes] Input brand:', brand);
  
  try {
    const collectionName = brand === 'playmobil' 
      ? 'customers' 
      : `customers_${brand}`;
    
    console.log(`[getCustomerCodes] Using collection: ${collectionName}`);
    
    // Extract merch names from salesmanIds
    const merchNames = salesmanIds.map(id => {
      const parts = id.split('_');
      const merchName = parts.length > 1 ? parts.slice(1).join('_') : id;
      console.log(`[getCustomerCodes] Extracted merch name from "${id}" -> "${merchName}"`);
      return merchName;
    });
    
    console.log('[getCustomerCodes] All merch names:', JSON.stringify(merchNames));
    
    // Firestore 'array-contains-any' supports max 10 items (same as 'in' operator)
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < merchNames.length; i += batchSize) {
      const batch = merchNames.slice(i, i + batchSize);
      batches.push(batch);
      console.log(`[getCustomerCodes] Created batch ${batches.length}:`, JSON.stringify(batch));
    }
    
    console.log(`[getCustomerCodes] Total batches to process: ${batches.length}`);
    
    const allCustomerCodes = [];
    const customerMerchMap = {}; // Track which customers have single vs multiple salesmen
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`[getCustomerCodes] Processing batch ${batchIndex + 1}/${batches.length}`);
      
      // Use array-contains-any to support array-based merch field
      const snapshot = await firestore()
        .collection(collectionName)
        .where('merch', 'array-contains-any', batch)
        .get();
      
      console.log(`[getCustomerCodes] Batch ${batchIndex + 1} returned ${snapshot.size} documents`);
      
      snapshot.forEach((doc, docIndex) => {
        const data = doc.data();
        const customerCode = data.customerCode || doc.id;
        const merchArray = Array.isArray(data.merch) ? data.merch : [data.merch].filter(Boolean);
        
        console.log(`[getCustomerCodes] Batch ${batchIndex + 1}, Doc ${docIndex + 1}:`, {
          docId: doc.id,
          customerCode,
          merch: data.merch,
          merchCount: merchArray.length,
          name: data.name
        });
        
        // Include all customers - filtering by handledBy happens in calculateAllKPIs
        // This allows multi-salesman customers to show up with correct store attribution
        if (customerCode && !allCustomerCodes.includes(customerCode)) {
          allCustomerCodes.push(customerCode);
          customerMerchMap[customerCode] = {
            salesmen: merchArray,
            isMultiSalesman: merchArray.length > 1
          };
          console.log(`[getCustomerCodes] Added customer code: ${customerCode} (multi-salesman: ${merchArray.length > 1}, total: ${allCustomerCodes.length})`);
        } else if (allCustomerCodes.includes(customerCode)) {
          console.log(`[getCustomerCodes] Skipped duplicate customer code: ${customerCode}`);
        }
      });
    }
    
    console.log(`[getCustomerCodes] SUCCESS - Found ${allCustomerCodes.length} unique customers`);
    console.log('[getCustomerCodes] Sample customer codes (first 10):', allCustomerCodes.slice(0, 10));
    console.log('[getCustomerCodes] Customers with multiple salesmen:', 
      Object.entries(customerMerchMap).filter(([, v]) => v.isMultiSalesman).length);
    console.log('[getCustomerCodes] END');
    
    return { customerCodes: allCustomerCodes, customerMerchMap };
  } catch (error) {
    console.error('[getCustomerCodes] ERROR:', error);
    console.error('[getCustomerCodes] Error code:', error.code);
    console.error('[getCustomerCodes] Error message:', error.message);
    console.error('[getCustomerCodes] Error stack:', error.stack);
    throw error;
  }
}

/**
 * Check if cache is stale (older than TTL)
 */
async function isCacheStale(timestampKey, ttlHours = CACHE_TTL_HOURS) {
  try {
    const timestampStr = await AsyncStorage.getItem(timestampKey);
    if (!timestampStr) {
      console.log(`[isCacheStale] No timestamp found for ${timestampKey} - STALE`);
      return true;
    }

    const timestamp = new Date(timestampStr);
    const now = new Date();
    const hoursDiff = (now - timestamp) / (1000 * 60 * 60);

    console.log(`[isCacheStale] ${timestampKey}:`, {
      timestamp: timestamp.toISOString(),
      now: now.toISOString(),
      hoursDiff: hoursDiff.toFixed(2),
      ttlHours,
      isStale: hoursDiff >= ttlHours,
    });

    return hoursDiff >= ttlHours;
  } catch (error) {
    console.warn('[isCacheStale] Error checking cache:', error);
    return true;
  }
}

/**
 * Fetch fresh data from Google Sheets and cache in AsyncStorage
 */
async function fetchAndCacheSheet(cacheKey, sheetKey, dataType) {
  console.log(`[fetchAndCacheSheet] START`);
  console.log(`[fetchAndCacheSheet] Cache key: ${cacheKey}`);
  console.log(`[fetchAndCacheSheet] Sheet key: ${sheetKey}`);
  console.log(`[fetchAndCacheSheet] Data type: ${dataType}`);
  
  try {
    console.log('[fetchAndCacheSheet] Validating Google Sheets configuration...');
    if (!validateGoogleSheetsConfig()) {
      throw new Error('Google Sheets is not configured properly');
    }

    console.log(`[fetchAndCacheSheet] Fetching sheet data from Google Sheets...`);
    const startTime = Date.now();
    
    const rows = await fetchGoogleSheetCSV(sheetKey, dataType);
    
    const fetchDuration = Date.now() - startTime;
    console.log(`[fetchAndCacheSheet] Fetch completed in ${fetchDuration}ms`);
    console.log(`[fetchAndCacheSheet] Fetched ${rows.length} rows`);

    if (rows.length === 0) {
      console.warn(`[fetchAndCacheSheet] No data returned for ${sheetKey}`);
    }

    console.log('[fetchAndCacheSheet] SUCCESS');
    console.log('[fetchAndCacheSheet] END');
    
    return rows;
  } catch (error) {
    console.error(`[fetchAndCacheSheet] ERROR for ${sheetKey}:`, error);
    console.error('[fetchAndCacheSheet] Error name:', error.name);
    console.error('[fetchAndCacheSheet] Error message:', error.message);
    console.error('[fetchAndCacheSheet] Error stack:', error.stack);
    
    throw error;
  }
}

/**
 * Clear all cached chunk data
 */
async function clearChunkedCache() {
  console.log('[clearChunkedCache] START');
  try {
    // Get month index
    const indexStr = await AsyncStorage.getItem(CACHE_KEYS.MONTH_INDEX);
    if (indexStr) {
      const index = JSON.parse(indexStr);
      console.log('[clearChunkedCache] Removing month chunks:', index);
      
      // Remove all month chunk keys
      const keysToRemove = Object.values(index).flat();
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        console.log(`[clearChunkedCache] Removed ${keysToRemove.length} month chunk keys`);
      }
    }
    
    // Remove index and metadata
    await AsyncStorage.multiRemove([
      CACHE_KEYS.MONTH_INDEX,
      CACHE_KEYS.SHEETS_DATA,
      CACHE_KEYS.SHEETS_TIMESTAMP,
      CACHE_KEYS.SHEETS_HEADER_DATES,
      CACHE_KEYS.CURRENT_MONTH_TIMESTAMP,
    ]);
    
    console.log('[clearChunkedCache] SUCCESS');
  } catch (error) {
    console.warn('[clearChunkedCache] Error:', error);
  }
}

/**
 * Parse date from record (handles multiple date field formats)
 */
function parseRecordDate(record) {
  const dateStr = record.date || record.Date || record.documentDate || record['Posting Date'];
  if (!dateStr) return null;
  
  // Try to parse the date string
  const str = String(dateStr).trim();
  
  // Handle DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const parts = str.split(/[\/\-\.]/);
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-based
    const year = parseInt(parts[2], 10);
    
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return new Date(year, month, day);
    }
  }
  
  // Fallback to Date constructor
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Get month key for a date (YYYY-MM format)
 */
function getMonthKey(date) {
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Check if we're in the buffer period at start of month
 */
function isInMonthStartBuffer() {
  const now = new Date();
  const dayOfMonth = now.getDate();
  return dayOfMonth <= MONTH_START_BUFFER_DAYS;
}

/**
 * Get the current month and optionally previous month if in buffer period
 */
function getMonthsToRefresh() {
  const now = new Date();
  const currentMonthKey = getMonthKey(now);
  
  const monthsToRefresh = [currentMonthKey];
  
  // If we're in the first few days of the month, also refresh previous month
  if (isInMonthStartBuffer()) {
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthKey = getMonthKey(prevMonth);
    monthsToRefresh.push(prevMonthKey);
    console.log(`[getMonthsToRefresh] In buffer period (day ${now.getDate()}) - will refresh both ${currentMonthKey} and ${prevMonthKey}`);
  } else {
    console.log(`[getMonthsToRefresh] Outside buffer period - will refresh only ${currentMonthKey}`);
  }
  
  return monthsToRefresh;
}

/**
 * Save datasets organized by month
 */
async function saveMonthBasedDatasets(datasets) {
  console.log('[saveMonthBasedDatasets] START');
  
  try {
    const monthIndex = {};
    const monthsToRefresh = getMonthsToRefresh();
    
    for (const [datasetKey, records] of Object.entries(datasets)) {
      if (datasetKey === '_headerDates') continue;
      
      console.log(`[saveMonthBasedDatasets] Processing ${datasetKey}: ${records.length} records`);
      
      // Group records by month
      const recordsByMonth = {};
      let recordsWithoutDate = [];
      
      for (const record of records) {
        const recordDate = parseRecordDate(record);
        
        if (recordDate) {
          const monthKey = getMonthKey(recordDate);
          if (!recordsByMonth[monthKey]) {
            recordsByMonth[monthKey] = [];
          }
          recordsByMonth[monthKey].push(record);
        } else {
          recordsWithoutDate.push(record);
        }
      }
      
      console.log(`[saveMonthBasedDatasets] ${datasetKey} months found:`, Object.keys(recordsByMonth).sort());
      if (recordsWithoutDate.length > 0) {
        console.log(`[saveMonthBasedDatasets] ${datasetKey} records without date: ${recordsWithoutDate.length}`);
      }
      
      // Save each month chunk
      const chunkKeys = [];
      
      for (const [monthKey, monthRecords] of Object.entries(recordsByMonth)) {
        const chunkKey = `${CACHE_KEYS.MONTH_CHUNK_PREFIX}${datasetKey}:${monthKey}`;
        
        // Only save/update current month and buffer month, keep others as permanent cache
        const shouldUpdate = monthsToRefresh.includes(monthKey);
        
        if (shouldUpdate) {
          // Update this month's data
          await AsyncStorage.setItem(chunkKey, JSON.stringify(monthRecords));
          console.log(`[saveMonthBasedDatasets] Saved ${monthKey}: ${monthRecords.length} records (UPDATED)`);
        } else {
          // Check if this month is already cached
          const existing = await AsyncStorage.getItem(chunkKey);
          if (!existing) {
            // Historical month not yet cached - save it permanently
            await AsyncStorage.setItem(chunkKey, JSON.stringify(monthRecords));
            console.log(`[saveMonthBasedDatasets] Saved ${monthKey}: ${monthRecords.length} records (NEW PERMANENT)`);
          } else {
            console.log(`[saveMonthBasedDatasets] Kept ${monthKey}: existing cache (PERMANENT)`);
          }
        }
        
        chunkKeys.push(chunkKey);
      }
      
      // Save records without dates in a special chunk
      if (recordsWithoutDate.length > 0) {
        const noDateKey = `${CACHE_KEYS.MONTH_CHUNK_PREFIX}${datasetKey}:no-date`;
        await AsyncStorage.setItem(noDateKey, JSON.stringify(recordsWithoutDate));
        chunkKeys.push(noDateKey);
        console.log(`[saveMonthBasedDatasets] Saved no-date records: ${recordsWithoutDate.length}`);
      }
      
      monthIndex[datasetKey] = chunkKeys;
    }
    
    // Save month index
    await AsyncStorage.setItem(CACHE_KEYS.MONTH_INDEX, JSON.stringify(monthIndex));
    
    // Save current month timestamp for TTL tracking
    await AsyncStorage.setItem(CACHE_KEYS.CURRENT_MONTH_TIMESTAMP, new Date().toISOString());
    
    console.log('[saveMonthBasedDatasets] Month index saved');
    console.log('[saveMonthBasedDatasets] SUCCESS');
  } catch (error) {
    console.error('[saveMonthBasedDatasets] ERROR:', error);
    throw error;
  }
}

/**
 * Load datasets from month-based chunks
 */
async function loadMonthBasedDatasets() {
  console.log('[loadMonthBasedDatasets] START');
  
  try {
    const indexStr = await AsyncStorage.getItem(CACHE_KEYS.MONTH_INDEX);
    if (!indexStr) {
      console.log('[loadMonthBasedDatasets] No month index found');
      return null;
    }
    
    const monthIndex = JSON.parse(indexStr);
    const datasets = {
      invoiced2025: [],
      invoiced2024: [],
      orders2025: [],
      orders2024: [],
      balance2025: [],
    };
    
    for (const [datasetKey, chunkKeys] of Object.entries(monthIndex)) {
      console.log(`[loadMonthBasedDatasets] Loading ${datasetKey}: ${chunkKeys.length} month chunks`);
      
      for (const chunkKey of chunkKeys) {
        const chunkStr = await AsyncStorage.getItem(chunkKey);
        if (chunkStr) {
          const chunk = JSON.parse(chunkStr);
          datasets[datasetKey].push(...chunk);
        } else {
          console.warn(`[loadMonthBasedDatasets] Missing chunk: ${chunkKey}`);
        }
      }
      
      console.log(`[loadMonthBasedDatasets] ${datasetKey}: ${datasets[datasetKey].length} total records`);
    }
    
    console.log('[loadMonthBasedDatasets] SUCCESS');
    return datasets;
  } catch (error) {
    console.error('[loadMonthBasedDatasets] ERROR:', error);
    return null;
  }
}

/**
 * Check if current month cache needs refresh
 */
async function isCurrentMonthCacheStale() {
  try {
    const timestampStr = await AsyncStorage.getItem(CACHE_KEYS.CURRENT_MONTH_TIMESTAMP);
    if (!timestampStr) {
      console.log('[isCurrentMonthCacheStale] No timestamp found');
      return true;
    }
    
    const timestamp = new Date(timestampStr);
    const now = new Date();
    const hoursDiff = (now - timestamp) / (1000 * 60 * 60);

    console.log(`[isCurrentMonthCacheStale] Current month cache age: ${hoursDiff.toFixed(2)} hours`);

    return hoursDiff >= CACHE_TTL_HOURS;
  } catch (error) {
    console.warn('[isCurrentMonthCacheStale] Error checking cache:', error);
    return true;
  }
}

/**
 * Load all Google Sheets KPI data with caching
 */
export async function getAllSheetsData() {
  console.log('[getAllSheetsData] START');
  
  try {
    // First check in-memory cache (fastest - no AsyncStorage read)
    if (_memoryCache.datasets && _memoryCache.timestamp) {
      const cacheAge = Date.now() - _memoryCache.timestamp;
      const cacheAgeHours = cacheAge / (1000 * 60 * 60);
      
      if (cacheAgeHours < CACHE_TTL_HOURS) {
        console.log(`[getAllSheetsData] Using in-memory cache (age: ${cacheAgeHours.toFixed(2)} hours)`);
        console.log('[getAllSheetsData] Records:', {
          invoiced2025: _memoryCache.datasets.invoiced2025?.length || 0,
          invoiced2024: _memoryCache.datasets.invoiced2024?.length || 0,
          orders2025: _memoryCache.datasets.orders2025?.length || 0,
          orders2024: _memoryCache.datasets.orders2024?.length || 0,
          balance2025: _memoryCache.datasets.balance2025?.length || 0,
        });
        console.log('[getAllSheetsData] END (from memory)');
        return _memoryCache.datasets;
      } else {
        console.log(`[getAllSheetsData] In-memory cache stale (${cacheAgeHours.toFixed(2)} hours old)`);
        _memoryCache = { datasets: null, timestamp: null, headerDates: null };
      }
    }

    // Check if current month cache needs refresh
    const isStale = await isCurrentMonthCacheStale();

    if (!isStale) {
      console.log('[getAllSheetsData] Attempting to load from month-based AsyncStorage cache');
      
      // Try to load from month chunks
      const datasets = await loadMonthBasedDatasets();
      
      if (datasets) {
        console.log('[getAllSheetsData] Cache loaded - re-applying handledBy attribution with current store mapping');
        
        // Re-fetch store mapping and customer data to re-apply attribution
        // This ensures historical data uses current (2025) salesman assignments
        const storeMapping = await fetchStoreMapping();
        console.log(`[getAllSheetsData] Store mapping loaded for ${Object.keys(storeMapping).length} customers`);
        
        const customersSnapshot = await firestore().collection('customers').get();
        const customerDataMap = {};
        customersSnapshot.forEach(doc => {
          const data = doc.data();
          const customerCode = data.customerCode || doc.id;
          customerDataMap[customerCode] = {
            merch: data.merch, // Full merch array for single vs multi-salesman logic
            primaryMerch: data.primaryMerch || (Array.isArray(data.merch) ? data.merch[0] : data.merch) || '',
          };
        });
        console.log(`[getAllSheetsData] Loaded customer data for ${Object.keys(customerDataMap).length} customers`);
        
        // Re-apply handledBy to cached data
        ['invoiced2025', 'invoiced2024', 'orders2025', 'orders2024'].forEach(datasetKey => {
          if (datasets[datasetKey]) {
            datasets[datasetKey].forEach(record => {
              const customerCode = (record.customerCode || '').trim();
              const customerData = customerDataMap[customerCode] || null;
              record.handledBy = determineHandlingSalesman(record, storeMapping, customerData);
            });
            console.log(`[getAllSheetsData] Re-applied handledBy to ${datasets[datasetKey].length} ${datasetKey} records`);
          }
        });
        
        // Restore header dates
        const headerDatesStr = await AsyncStorage.getItem(CACHE_KEYS.SHEETS_HEADER_DATES);
        if (headerDatesStr) {
          const headerDates = JSON.parse(headerDatesStr);
          Object.defineProperty(datasets, '_headerDates', {
            value: headerDates,
            enumerable: false,
          });
        }
        
        // Store in memory cache for faster subsequent access
        _memoryCache = {
          datasets: datasets,
          timestamp: Date.now(),
          headerDates: datasets._headerDates,
          storeMapping: storeMapping,
          storeMappingTimestamp: Date.now(),
        };
        
        console.log('[getAllSheetsData] Cached data loaded from AsyncStorage:', {
          invoiced2025: datasets.invoiced2025?.length || 0,
          invoiced2024: datasets.invoiced2024?.length || 0,
          orders2025: datasets.orders2025?.length || 0,
          orders2024: datasets.orders2024?.length || 0,
          balance2025: datasets.balance2025?.length || 0,
        });
        console.log('[getAllSheetsData] END (from month-based cache with re-applied attribution)');
        return datasets;
      }
    }

    // Cache is stale or missing - fetch fresh data
    console.log('[getAllSheetsData] Cache stale or missing - fetching fresh data');
    return await fetchAndCacheAllSheets();
  } catch (error) {
    console.error('[getAllSheetsData] ERROR:', error);
    
    // If storage error, try to fetch without caching
    if (error.message && error.message.includes('SQLITE_FULL')) {
      console.warn('[getAllSheetsData] Storage full - clearing cache and fetching without cache');
      try {
        await clearChunkedCache();
        return await fetchAndCacheAllSheets();
      } catch (retryError) {
        console.error('[getAllSheetsData] Retry failed:', retryError);
        throw retryError;
      }
    }
    
    throw error;
  }
}

/**
 * Fetch all sheets and cache them
 */
async function fetchAndCacheAllSheets() {
  console.log('[fetchAndCacheAllSheets] START');
  
  const datasets = {
    invoiced2025: [],
    invoiced2024: [],
    orders2025: [],
    orders2024: [],
    balance2025: [],
  };
  const headerDates = {};

  try {
    // Fetch store mapping first
    console.log('[fetchAndCacheAllSheets] Fetching store mapping...');
    const storeMapping = await fetchStoreMapping();
    console.log(`[fetchAndCacheAllSheets] Store mapping loaded for ${Object.keys(storeMapping).length} customers`);

    // Fetch all customer data for salesman attribution
    console.log('[fetchAndCacheAllSheets] Fetching customer data for salesman attribution...');
    const customersSnapshot = await firestore().collection('customers').get();
    const customerDataMap = {};
    customersSnapshot.forEach(doc => {
      const data = doc.data();
      const customerCode = data.customerCode || doc.id;
      customerDataMap[customerCode] = {
        merch: data.merch, // Full merch array for single vs multi-salesman logic
        primaryMerch: data.primaryMerch || (Array.isArray(data.merch) ? data.merch[0] : data.merch) || '',
      };
    });
    console.log(`[fetchAndCacheAllSheets] Loaded customer data for ${Object.keys(customerDataMap).length} customers`);

    for (const [datasetKey, cfg] of Object.entries(PLAYMOBIL_SHEET_KEYS)) {
      const { sheetKey, dataType } = cfg;
      console.log(`[fetchAndCacheAllSheets] Fetching ${datasetKey} -> ${sheetKey} (${dataType})`);
      
      const rows = await fetchAndCacheSheet(datasetKey, sheetKey, dataType);
      
      // Add handledBy field to sales AND orders records
      if (dataType === 'sales' || dataType === 'orders') {
        rows.forEach(record => {
          const customerCode = (record.customerCode || '').trim();
          const customerData = customerDataMap[customerCode] || null;
          record.handledBy = determineHandlingSalesman(record, storeMapping, customerData);
        });
        console.log(`[fetchAndCacheAllSheets] Added handledBy field to ${rows.length} ${dataType} records`);
      }
      
      datasets[datasetKey] = rows;
      
      if (rows && rows._headerDate) {
        headerDates[datasetKey] = rows._headerDate;
      }
      
      console.log(`[fetchAndCacheAllSheets] ${datasetKey} loaded: ${rows.length} rows`);
    }

    // Try to save datasets using month-based storage (only updates current month, keeps historical months)
    console.log('[fetchAndCacheAllSheets] Saving datasets in month-based chunks...');
    try {
      await saveMonthBasedDatasets(datasets);
      
      // Save header dates (small data)
      await AsyncStorage.setItem(CACHE_KEYS.SHEETS_HEADER_DATES, JSON.stringify(headerDates));
      
      console.log('[fetchAndCacheAllSheets] All data cached successfully (month-based)');
    } catch (saveError) {
      console.warn('[fetchAndCacheAllSheets] Failed to cache data:', saveError);
      console.warn('[fetchAndCacheAllSheets] Continuing without cache - data will be fetched on next request');
      // Don't throw - we still have the data in memory
    }

    // Attach header dates as non-enumerable property
    Object.defineProperty(datasets, '_headerDates', {
      value: headerDates,
      enumerable: false,
    });

    // Populate in-memory cache for faster subsequent access
    _memoryCache = {
      datasets: datasets,
      timestamp: Date.now(),
      headerDates: headerDates,
      storeMapping: storeMapping,
      storeMappingTimestamp: Date.now(),
    };
    console.log('[fetchAndCacheAllSheets] In-memory cache populated');

    console.log('[fetchAndCacheAllSheets] SUCCESS');
    console.log('[fetchAndCacheAllSheets] END');
    return datasets;
  } catch (error) {
    console.error('[fetchAndCacheAllSheets] ERROR:', error);
    throw error;
  }
}

/**
 * Force re-download of all sheets and update cache
 */
export async function refreshAllSheetsAndCache() {
  console.log('[refreshAllSheetsAndCache] START');
  
  try {
    // Clear existing cache (including chunks)
    await clearChunkedCache();
    await AsyncStorage.removeItem(CACHE_KEYS.KPI_RESULTS);
    await AsyncStorage.removeItem(CACHE_KEYS.KPI_TIMESTAMP);
    
    // Invalidate all KPI calculation caches since data has been refreshed
    console.log('[refreshAllSheetsAndCache] Invalidating KPI calculation caches...');
    const { invalidateAllCaches } = await import('./kpiCacheManager');
    await invalidateAllCaches();
    
    console.log('[refreshAllSheetsAndCache] Cache cleared (including chunks and KPI results)');

    // Fetch fresh data for all KPI sheets
    const datasets = await fetchAndCacheAllSheets();
    
    // Refresh additional Playmobil sheets (customer sales summary, stock)
    const { loadSpreadsheet } = await import('./spreadsheetCache');
    for (const sheetKey of ADDITIONAL_PLAYMOBIL_SHEETS) {
      console.log(`[refreshAllSheetsAndCache] Refreshing additional sheet: ${sheetKey}`);
      try {
        await loadSpreadsheet(sheetKey, { force: true });
        console.log(`[refreshAllSheetsAndCache] ${sheetKey} refreshed successfully`);
      } catch (sheetError) {
        console.warn(`[refreshAllSheetsAndCache] Failed to refresh ${sheetKey}:`, sheetError.message);
      }
    }

    console.log('[refreshAllSheetsAndCache] SUCCESS');
    console.log('[refreshAllSheetsAndCache] END');
    return datasets;
  } catch (error) {
    console.error('[refreshAllSheetsAndCache] ERROR:', error);
    throw error;
  }
}

/**
 * Clear all Playmobil cache (useful for troubleshooting storage issues)
 * This will clear ALL cached data including historical months
 * @returns {Promise<void>}
 */
export async function clearAllPlaymobilCache() {
  console.log('[clearAllPlaymobilCache] START');
  try {
    // Clear in-memory cache
    _memoryCache = { datasets: null, timestamp: null, headerDates: null };
    console.log('[clearAllPlaymobilCache] In-memory cache cleared');
    
    // Clear AsyncStorage cache
    await clearChunkedCache();
    await AsyncStorage.removeItem(CACHE_KEYS.KPI_RESULTS);
    await AsyncStorage.removeItem(CACHE_KEYS.KPI_TIMESTAMP);
    
    // Clear all KPI calculation caches
    const { clearAllCaches } = await import('./kpiCacheManager');
    await clearAllCaches();
    
    console.log('[clearAllPlaymobilCache] All Playmobil cache cleared (including KPI results and historical months)');
  } catch (error) {
    console.error('[clearAllPlaymobilCache] ERROR:', error);
    throw error;
  }
}

/**
 * Force refresh of ALL data including historical months (not just current month)
 * Use this when you need to rebuild the entire cache from scratch
 * @returns {Promise<Object>} Fresh datasets
 */
export async function forceRefreshAllData() {
  console.log('[forceRefreshAllData] START - This will refresh ALL months including historical data');
  try {
    // Clear all cache to force complete rebuild
    await clearAllPlaymobilCache();
    
    // Fetch fresh data - this will rebuild month-based cache from scratch
    const datasets = await fetchAndCacheAllSheets();
    
    // Also refresh additional sheets
    const { loadSpreadsheet } = await import('./spreadsheetCache');
    for (const sheetKey of ADDITIONAL_PLAYMOBIL_SHEETS) {
      console.log(`[forceRefreshAllData] Refreshing additional sheet: ${sheetKey}`);
      try {
        await loadSpreadsheet(sheetKey, { force: true });
        console.log(`[forceRefreshAllData] ${sheetKey} refreshed successfully`);
      } catch (sheetError) {
        console.warn(`[forceRefreshAllData] Failed to refresh ${sheetKey}:`, sheetError.message);
      }
    }
    
    console.log('[forceRefreshAllData] SUCCESS');
    console.log('[forceRefreshAllData] END');
    return datasets;
  } catch (error) {
    console.error('[forceRefreshAllData] ERROR:', error);
    throw error;
  }
}

/**
 * Calculate all KPI metrics for given customer codes
 */
export async function calculateAllKPIs(sheetsData, customerCodes, options = {}) {
  console.log('[calculateAllKPIs] START');
  console.log('[calculateAllKPIs] Customer codes count:', customerCodes.length);
  console.log('[calculateAllKPIs] Sample customer codes (first 10):', customerCodes.slice(0, 10));
  console.log('[calculateAllKPIs] Options:', options);
  
  const { referenceDate = new Date(), salesmenFilter = null, customerMerchMap = {} } = options;
  
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();
  const refDay = referenceDate.getDate();
  const previousYear = refYear - 1;
  
  console.log('[calculateAllKPIs] Reference date:', referenceDate.toISOString());
  console.log('[calculateAllKPIs] Reference breakdown:', { refYear, refMonth, refDay, previousYear });
  console.log('[calculateAllKPIs] Salesmen filter:', salesmenFilter);
  
  // Fetch current store mapping for re-attributing previous year data
  console.log('[calculateAllKPIs] Fetching current store mapping...');
  const storeMapping = await fetchStoreMapping();
  console.log('[calculateAllKPIs] Store mapping loaded:', {
    customers: Object.keys(storeMapping).length,
    multiSalesmanCustomers: Object.values(storeMapping).filter(c => c.isMultiSalesman).length
  });
  
  // Helper to re-attribute previous year records based on CURRENT store assignments
  // This ensures each salesman sees their currently assigned stores' historical data
  const reattributePreviousYearRecord = (record) => {
    const recordCode = record.customerCode || record.code;
    const storeName = record.shipToCity || record.store || '';
    
    // Get current store mapping for this customer
    const customerStores = storeMapping[recordCode];
    if (!customerStores || !customerStores.stores) {
      // No mapping available, keep original handledBy
      return record;
    }
    
    // Find current salesman for this store
    const currentSalesman = customerStores.stores[storeName];
    if (currentSalesman) {
      // Re-attribute to current salesman
      return { ...record, handledBy: currentSalesman };
    }
    
    // Store not found in mapping, keep original
    return record;
  };
  
  // Helper to filter records by customer codes AND salesman (if filter provided)
  const filterByCustomers = (records, isPreviousYear = false) => {
    // For previous year data, re-attribute based on current store assignments
    const recordsToFilter = isPreviousYear 
      ? records.map(r => reattributePreviousYearRecord(r))
      : records;
    
    const filtered = recordsToFilter.filter(r => {
      const recordCode = r.customerCode || r.code;
      const matchesCustomer = customerCodes.includes(recordCode);
      
      // If no salesman filter, just check customer
      if (!salesmenFilter || !Array.isArray(salesmenFilter) || salesmenFilter.length === 0) {
        return matchesCustomer;
      }
      
      // For sales/orders records with handledBy field (store-based attribution)
      if (r.handledBy !== undefined && r.handledBy !== null && r.handledBy !== '') {
        const matchesSalesman = salesmenFilter.includes(r.handledBy);
        return matchesCustomer && matchesSalesman;
      }
      
      // For balance records without handledBy, just use customer filtering
      return matchesCustomer;
    });
    return filtered;
  };
  
  // Helper to parse date from record
  const parseDate = (dateValue) => {
    if (!dateValue) return null;
    if (dateValue instanceof Date) return dateValue;
    
    // Handle Firestore Timestamp
    if (dateValue.toDate && typeof dateValue.toDate === 'function') {
      return dateValue.toDate();
    }
    
    const parsed = new Date(dateValue);
    return isNaN(parsed.getTime()) ? null : parsed;
  };
  
  // Helper to calculate metrics for a dataset
  const calculateDatasetMetrics = (currentYearData, previousYearData, datasetName) => {
    console.log(`[calculateAllKPIs:${datasetName}] Calculating metrics`);
    console.log(`[calculateAllKPIs:${datasetName}] Input data sizes:`, {
      currentYear: currentYearData.length,
      previousYear: previousYearData.length
    });
    
    const currentFiltered = filterByCustomers(currentYearData, false); // Current year: use handledBy
    const previousFiltered = filterByCustomers(previousYearData, true); // Previous year: use current assignment
    
    console.log(`[calculateAllKPIs:${datasetName}] After customer filter:`, {
      current: currentFiltered.length,
      previous: previousFiltered.length
    });
    
    // MTD: Month-to-date
    console.log(`[calculateAllKPIs:${datasetName}] Calculating MTD...`);
    const mtdCurrent = currentFiltered.filter(r => {
      const date = parseDate(r.date);
      if (!date) return false;
      return date.getMonth() === refMonth && 
             date.getDate() <= refDay &&
             date.getFullYear() === refYear;
    });
    
    const mtdPrevious = previousFiltered.filter(r => {
      const date = parseDate(r.date);
      if (!date) return false;
      return date.getMonth() === refMonth && 
             date.getDate() <= refDay &&
             date.getFullYear() === previousYear;
    });
    
    console.log(`[calculateAllKPIs:${datasetName}] MTD records:`, {
      current: mtdCurrent.length,
      previous: mtdPrevious.length
    });
    
    // YTD: Year-to-date
    console.log(`[calculateAllKPIs:${datasetName}] Calculating YTD...`);
    const ytdCurrent = currentFiltered.filter(r => {
      const date = parseDate(r.date);
      if (!date) return false;
      if (date.getFullYear() !== refYear) return false;
      if (date.getMonth() < refMonth) return true;
      if (date.getMonth() === refMonth && date.getDate() <= refDay) return true;
      return false;
    });
    
    const ytdPrevious = previousFiltered.filter(r => {
      const date = parseDate(r.date);
      if (!date) return false;
      if (date.getFullYear() !== previousYear) return false;
      if (date.getMonth() < refMonth) return true;
      if (date.getMonth() === refMonth && date.getDate() <= refDay) return true;
      return false;
    });
    
    console.log(`[calculateAllKPIs:${datasetName}] YTD records:`, {
      current: ytdCurrent.length,
      previous: ytdPrevious.length
    });
    
    // Monthly: Full month (previous year)
    const monthlyPrevious = previousFiltered.filter(r => {
      const date = parseDate(r.date);
      if (!date) return false;
      return date.getMonth() === refMonth && date.getFullYear() === previousYear;
    });
    
    // Yearly: Full year (previous year)
    const yearlyPrevious = previousFiltered.filter(r => {
      const date = parseDate(r.date);
      if (!date) return false;
      return date.getFullYear() === previousYear;
    });
    
    // Yearly: Full year (current year)
    const yearlyCurrent = currentFiltered.filter(r => {
      const date = parseDate(r.date);
      if (!date) return false;
      return date.getFullYear() === refYear;
    });
    
    // Helper to calculate totals
    const calculateTotals = (records) => {
      const amount = records.reduce((sum, r) => {
        const value = Number(r.amount || r.total || r.value || 0);
        return sum + value;
      }, 0);
      
      const uniqueCustomers = new Set(
        records.map(r => r.customerCode || r.code)
      ).size;
      
      return { amount, customers: uniqueCustomers };
    };
    
    // Sort records by amount descending
    const sortByAmount = (records) => {
      return [...records].sort((a, b) => {
        const aAmount = Number(a.amount || a.total || a.value || 0);
        const bAmount = Number(b.amount || b.total || b.value || 0);
        return bAmount - aAmount;
      });
    };
    
    // Calculate diff
    const calcDiff = (current, previous) => {
      const amountDiff = current.amount - previous.amount;
      const percentDiff = previous.amount !== 0 
        ? (amountDiff / previous.amount) * 100 
        : (current.amount > 0 ? 100 : 0);
      
      return {
        amount: amountDiff,
        percent: percentDiff,
      };
    };
    
    // Build metric objects
    const mtdCurrentTotals = calculateTotals(mtdCurrent);
    const mtdPreviousTotals = calculateTotals(mtdPrevious);
    
    const ytdCurrentTotals = calculateTotals(ytdCurrent);
    const ytdPreviousTotals = calculateTotals(ytdPrevious);
    
    const monthlyPreviousTotals = calculateTotals(monthlyPrevious);
    const yearlyPreviousTotals = calculateTotals(yearlyPrevious);
    const yearlyCurrentTotals = calculateTotals(yearlyCurrent);
    
    // Context for labels: use the provided referenceDate to ensure
    // ranges (1/MM–DD/MM and 01/01–DD/MM) match header-derived date
    const contextFromRef = {
      month: refMonth,
      day: refDay,
      year: refYear,
    };
    console.log(`[calculateAllKPIs:${datasetName}] Context from reference date:`, contextFromRef);

    return {
      mtd: {
        current: mtdCurrentTotals,
        previous: mtdPreviousTotals,
        diff: calcDiff(mtdCurrentTotals, mtdPreviousTotals),
        currentRecords: sortByAmount(mtdCurrent),
        previousRecords: sortByAmount(mtdPrevious),
      },
      ytd: {
        current: ytdCurrentTotals,
        previous: ytdPreviousTotals,
        diff: calcDiff(ytdCurrentTotals, ytdPreviousTotals),
        currentRecords: sortByAmount(ytdCurrent),
        previousRecords: sortByAmount(ytdPrevious),
      },
      monthly: {
        previous: monthlyPreviousTotals,
      },
      ytdComparison: {
        current: ytdCurrentTotals,
        previous: ytdPreviousTotals,
        diff: calcDiff(ytdCurrentTotals, ytdPreviousTotals),
      },
      yearly: {
        current: yearlyCurrentTotals,
        previous: yearlyPreviousTotals,
        diff: calcDiff(yearlyCurrentTotals, yearlyPreviousTotals),
        currentRecords: sortByAmount(yearlyCurrent),
        previousRecords: sortByAmount(yearlyPrevious),
      },
      context: contextFromRef,
      allCurrentRecords: currentFiltered,
      allPreviousRecords: previousFiltered,
    };
  };
  
  console.log('[calculateAllKPIs] Processing invoiced dataset...');
  const invoicedMetrics = calculateDatasetMetrics(
    sheetsData.invoiced2025,
    sheetsData.invoiced2024,
    'invoiced'
  );
  
  console.log('[calculateAllKPIs] Processing orders dataset...');
  const ordersMetrics = calculateDatasetMetrics(
    sheetsData.orders2025,
    sheetsData.orders2024,
    'orders'
  );
  
  const result = {
    invoiced: invoicedMetrics,
    orders: ordersMetrics,
    records: {
      invoiced: {
        current: invoicedMetrics.allCurrentRecords,
        previous: invoicedMetrics.allPreviousRecords,
      },
      orders: {
        current: ordersMetrics.allCurrentRecords,
        previous: ordersMetrics.allPreviousRecords,
      },
    },
  };
  
  console.log('[calculateAllKPIs] SUCCESS');
  console.log('[calculateAllKPIs] END');
  
  return result;
}

/**
 * Get customer sales summary aggregated by customer
 */
export function getCustomerSalesSummary(sheetsData, customerCodes, salesmenFilter = null) {
  console.log('[getCustomerSalesSummary] START');
  console.log('[getCustomerSalesSummary] Customer codes count:', customerCodes.length);
  console.log('[getCustomerSalesSummary] Salesmen filter:', salesmenFilter);
  
  const customerMap = new Map();
  
  // Aggregate invoiced sales (current year - filter by salesman)
  sheetsData.invoiced2025.forEach(record => {
    const recordCode = record.customerCode || record.code;
    if (!customerCodes.includes(recordCode)) return;
    
    // Filter by salesman if provided (only for current year)
    if (salesmenFilter && Array.isArray(salesmenFilter) && salesmenFilter.length > 0) {
      if (record.handledBy && !salesmenFilter.includes(record.handledBy)) {
        return; // Skip this record, wrong salesman
      }
    }
    
    if (!customerMap.has(recordCode)) {
      customerMap.set(recordCode, {
        code: recordCode,
        name: record.customerName || record.name || '',
        invoiced2025: 0,
        orders2025: 0,
      });
    }
    
    const customer = customerMap.get(recordCode);
    customer.invoiced2025 += Number(record.amount || record.total || record.value || 0);
  });
  
  // Aggregate orders
  sheetsData.orders2025.forEach(record => {
    const recordCode = record.customerCode || record.code;
    if (!customerCodes.includes(recordCode)) return;
    
    if (!customerMap.has(recordCode)) {
      customerMap.set(recordCode, {
        code: recordCode,
        name: record.customerName || record.name || '',
        invoiced2025: 0,
        orders2025: 0,
      });
    }
    
    const customer = customerMap.get(recordCode);
    customer.orders2025 += Number(record.amount || record.total || record.value || 0);
  });
  
  // Convert to array and sort
  const summary = Array.from(customerMap.values()).map(c => ({
    ...c,
    total: c.invoiced2025 + c.orders2025,
  }));
  
  summary.sort((a, b) => b.total - a.total);
  
  console.log('[getCustomerSalesSummary] Top 5 customers:', summary.slice(0, 5).map(c => ({
    code: c.code,
    name: c.name,
    total: c.total.toFixed(2)
  })));
  
  console.log('[getCustomerSalesSummary] SUCCESS');
  console.log('[getCustomerSalesSummary] END');
  
  return summary;
}
