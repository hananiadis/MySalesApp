// src/services/playmobilKpi.js
// Playmobil KPI calculation service

import firestore from '@react-native-firebase/firestore';
import { fetchGoogleSheetCSV, validateGoogleSheetsConfig } from './googleSheets';
import { PLAYMOBIL_CONFIG } from '../config/playmobil';

console.log('[playmobilKpi] Module loaded');

// Sheet key mapping for Playmobil data
const PLAYMOBIL_SHEET_KEYS = {
  invoiced2025: { sheetKey: 'sales2025', dataType: 'sales' },
  invoiced2024: { sheetKey: 'sales2024', dataType: 'sales' },
  orders2025: { sheetKey: 'orders2025', dataType: 'orders' },
  orders2024: { sheetKey: 'orders2024', dataType: 'orders' },
};

console.log('[playmobilKpi] Sheet key mapping:', PLAYMOBIL_SHEET_KEYS);

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
    
    // Firestore 'in' queries support max 10 items
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < merchNames.length; i += batchSize) {
      const batch = merchNames.slice(i, i + batchSize);
      batches.push(batch);
      console.log(`[getCustomerCodes] Created batch ${batches.length}:`, JSON.stringify(batch));
    }
    
    console.log(`[getCustomerCodes] Total batches to process: ${batches.length}`);
    
    const allCustomerCodes = [];
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`[getCustomerCodes] Processing batch ${batchIndex + 1}/${batches.length}`);
      
      const snapshot = await firestore()
        .collection(collectionName)
        .where('merch', 'in', batch)
        .get();
      
      console.log(`[getCustomerCodes] Batch ${batchIndex + 1} returned ${snapshot.size} documents`);
      
      snapshot.forEach((doc, docIndex) => {
        const data = doc.data();
        const customerCode = data.customerCode || doc.id;
        
        console.log(`[getCustomerCodes] Batch ${batchIndex + 1}, Doc ${docIndex + 1}:`, {
          docId: doc.id,
          customerCode,
          merch: data.merch,
          name: data.name
        });
        
        if (customerCode && !allCustomerCodes.includes(customerCode)) {
          allCustomerCodes.push(customerCode);
          console.log(`[getCustomerCodes] Added customer code: ${customerCode} (total: ${allCustomerCodes.length})`);
        } else if (allCustomerCodes.includes(customerCode)) {
          console.log(`[getCustomerCodes] Skipped duplicate customer code: ${customerCode}`);
        }
      });
    }
    
    console.log(`[getCustomerCodes] SUCCESS - Found ${allCustomerCodes.length} unique customers`);
    console.log('[getCustomerCodes] Sample customer codes (first 10):', allCustomerCodes.slice(0, 10));
    console.log('[getCustomerCodes] END');
    
    return allCustomerCodes;
  } catch (error) {
    console.error('[getCustomerCodes] ERROR:', error);
    console.error('[getCustomerCodes] Error code:', error.code);
    console.error('[getCustomerCodes] Error message:', error.message);
    console.error('[getCustomerCodes] Error stack:', error.stack);
    throw error;
  }
}

/**
 * Check if sheets cache needs refresh
 */
function isCacheStale(cacheDoc) {
  console.log('[isCacheStale] Checking cache staleness');
  
  if (!cacheDoc) {
    console.log('[isCacheStale] No cache document provided - STALE');
    return true;
  }
  
  if (!cacheDoc.lastFetchedAt) {
    console.log('[isCacheStale] No lastFetchedAt field - STALE');
    return true;
  }
  
  const ttlHours = PLAYMOBIL_CONFIG.cache.durationHours || 24;
  
  const lastFetched = cacheDoc.lastFetchedAt.toDate();
  const now = new Date();
  const hoursDiff = (now - lastFetched) / (1000 * 60 * 60);
  
  console.log('[isCacheStale] Last fetched:', lastFetched.toISOString());
  console.log('[isCacheStale] Current time:', now.toISOString());
  console.log('[isCacheStale] Hours difference:', hoursDiff.toFixed(2));
  console.log('[isCacheStale] TTL hours:', ttlHours);
  
  const isStale = hoursDiff >= ttlHours;
  console.log(`[isCacheStale] Result: ${isStale ? 'STALE' : 'FRESH'}`);
  
  return isStale;
}

/**
 * Fetch fresh data from Google Sheets and cache in Firestore
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

    // Cache metadata only (not the full data - Firestore has 1MB doc limit)
    console.log(`[fetchAndCacheSheet] Caching metadata to Firestore...`);
    const cacheStartTime = Date.now();
    
    await firestore()
      .collection('sheetsCache')
      .doc(cacheKey)
      .set({
        sheetKey,
        cacheKey,
        dataType,
        rowCount: rows.length,
        lastFetchedAt: firestore.FieldValue.serverTimestamp(),
        fetchDuration,
        sheetHeaderDate: rows?._headerDate ? rows._headerDate : null,
      }, { merge: true });
    
    const cacheDuration = Date.now() - cacheStartTime;
    console.log(`[fetchAndCacheSheet] Cached metadata to Firestore in ${cacheDuration}ms`);
    console.log(`[fetchAndCacheSheet] Document path: sheetsCache/${cacheKey}`);
    console.log(`[fetchAndCacheSheet] NOTE: Data is kept in memory, only metadata cached`);
    
    if (rows.length > 0) {
      console.log('[fetchAndCacheSheet] Sample rows (first 3):', rows.slice(0, 3).map(r => ({
        customerCode: r.customerCode,
        customerName: r.customerName,
        amount: r.amount,
        date: r.date?.toISOString?.() || r.date
      })));
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
 * Load sheet data with automatic refresh if stale
 * NOTE: Cache only stores metadata (lastFetchedAt, rowCount).
 * Actual data is always fetched fresh from Google Sheets.
 */
async function loadSheetWithRefresh(datasetKey) {
  console.log(`[loadSheetWithRefresh] START - dataset key: ${datasetKey}`);
  
  try {
    const config = PLAYMOBIL_SHEET_KEYS[datasetKey];
    if (!config) {
      throw new Error(`Unknown dataset key: ${datasetKey}`);
    }
    
    const { sheetKey, dataType } = config;
    console.log(`[loadSheetWithRefresh] Sheet key: ${sheetKey}, Data type: ${dataType}`);
    
    const cacheKey = datasetKey;
    console.log(`[loadSheetWithRefresh] Checking cache: sheetsCache/${cacheKey}`);
    
    const docSnap = await firestore()
      .collection('sheetsCache')
      .doc(cacheKey)
      .get();
    
    if (!docSnap.exists) {
      console.log(`[loadSheetWithRefresh] Cache miss - document does not exist`);
      console.log('[loadSheetWithRefresh] Fetching fresh data...');
      
      const freshRows = await fetchAndCacheSheet(cacheKey, sheetKey, dataType);
      
      console.log(`[loadSheetWithRefresh] END - Returned ${freshRows.length} fresh rows`);
      return freshRows;
    }
    
    const data = docSnap.data();
    console.log(`[loadSheetWithRefresh] Cache hit - document exists`);
    console.log(`[loadSheetWithRefresh] Cache metadata:`, {
      sheetKey: data.sheetKey,
      cacheKey: data.cacheKey,
      rowCount: data.rowCount,
      lastFetchedAt: data.lastFetchedAt?.toDate?.()?.toISOString?.() || 'N/A',
      fetchDuration: data.fetchDuration
    });
    
    const stale = isCacheStale(data);
    
    if (stale) {
      console.log(`[loadSheetWithRefresh] Cache is stale - refreshing...`);
      
      const freshRows = await fetchAndCacheSheet(cacheKey, sheetKey, dataType);
      
      console.log(`[loadSheetWithRefresh] END - Returned ${freshRows.length} refreshed rows`);
      return freshRows;
    }
    
    // Cache is fresh, but we still need to fetch the data (cache only has metadata)
    console.log(`[loadSheetWithRefresh] Cache is fresh (within TTL)`);
    console.log(`[loadSheetWithRefresh] Fetching data from Google Sheets (cache has metadata only)...`);
    
    const rows = await fetchGoogleSheetCSV(sheetKey, dataType);
    
    console.log(`[loadSheetWithRefresh] END - Returned ${rows.length} rows`);
    return rows;
    
  } catch (error) {
    console.error(`[loadSheetWithRefresh] ERROR loading ${datasetKey}:`, error);
    console.error('[loadSheetWithRefresh] Error code:', error.code);
    console.error('[loadSheetWithRefresh] Error message:', error.message);
    console.log('[loadSheetWithRefresh] Returning empty array due to error');
    console.log('[loadSheetWithRefresh] END');
    return [];
  }
}

/**
 * Load all Google Sheets KPI data from Firestore cache
 */
export async function getAllSheetsData() {
  console.log('[getAllSheetsData] START');
  
  try {
    const datasets = {
      invoiced2025: [],
      invoiced2024: [],
      orders2025: [],
      orders2024: [],
    };
    const headerDates = {};
    
    console.log('[getAllSheetsData] Dataset keys to load:', Object.keys(datasets));
    
    for (const datasetKey of Object.keys(datasets)) {
      console.log(`[getAllSheetsData] Loading dataset: ${datasetKey}`);
      const rows = await loadSheetWithRefresh(datasetKey);
      datasets[datasetKey] = rows;
      if (rows && rows._headerDate) {
        headerDates[datasetKey] = rows._headerDate;
      }
      console.log(`[getAllSheetsData] Loaded ${rows.length} rows for ${datasetKey}`);
    }
    
    console.log('[getAllSheetsData] Final dataset sizes:', {
      invoiced2025: datasets.invoiced2025.length,
      invoiced2024: datasets.invoiced2024.length,
      orders2025: datasets.orders2025.length,
      orders2024: datasets.orders2024.length,
    });
    
    console.log('[getAllSheetsData] Header dates:', headerDates);
    console.log('[getAllSheetsData] SUCCESS');
    console.log('[getAllSheetsData] END');
    
    // Attach meta without breaking callers
    try {
      Object.defineProperty(datasets, '_headerDates', { value: headerDates, enumerable: false });
    } catch (e) {}
    return datasets;
  } catch (error) {
    console.error('[getAllSheetsData] ERROR:', error);
    console.error('[getAllSheetsData] Error code:', error.code);
    console.error('[getAllSheetsData] Error message:', error.message);
    console.error('[getAllSheetsData] Error stack:', error.stack);
    throw error;
  }
}

/**
 * Force re-download of all sheets and update Firestore metadata cache.
 * Returns the fresh in-memory datasets, with header dates attached like getAllSheetsData.
 */
export async function refreshAllSheetsAndCache() {
  console.log('[refreshAllSheetsAndCache] START');
  const datasets = {
    invoiced2025: [],
    invoiced2024: [],
    orders2025: [],
    orders2024: [],
  };
  const headerDates = {};

  try {
    for (const [datasetKey, cfg] of Object.entries(PLAYMOBIL_SHEET_KEYS)) {
      const { sheetKey, dataType } = cfg;
      console.log(`[refreshAllSheetsAndCache] Refreshing ${datasetKey} -> ${sheetKey} (${dataType})`);
      const rows = await fetchAndCacheSheet(datasetKey, sheetKey, dataType);
      datasets[datasetKey] = rows;
      if (rows && rows._headerDate) headerDates[datasetKey] = rows._headerDate;
      console.log(`[refreshAllSheetsAndCache] ${datasetKey} rows: ${rows.length}`);
    }

    try {
      Object.defineProperty(datasets, '_headerDates', { value: headerDates, enumerable: false });
    } catch (e) {}

    console.log('[refreshAllSheetsAndCache] SUCCESS');
    console.log('[refreshAllSheetsAndCache] END');
    return datasets;
  } catch (error) {
    console.error('[refreshAllSheetsAndCache] ERROR:', error);
    throw error;
  }
}

/**
 * Calculate all KPI metrics for given customer codes
 */
export function calculateAllKPIs(sheetsData, customerCodes, options = {}) {
  console.log('[calculateAllKPIs] START');
  console.log('[calculateAllKPIs] Customer codes count:', customerCodes.length);
  console.log('[calculateAllKPIs] Sample customer codes (first 10):', customerCodes.slice(0, 10));
  console.log('[calculateAllKPIs] Options:', options);
  
  const { referenceDate = new Date() } = options;
  
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();
  const refDay = referenceDate.getDate();
  const previousYear = refYear - 1;
  
  console.log('[calculateAllKPIs] Reference date:', referenceDate.toISOString());
  console.log('[calculateAllKPIs] Reference breakdown:', { refYear, refMonth, refDay, previousYear });
  
  // Helper to filter records by customer codes
  const filterByCustomers = (records) => {
    const filtered = records.filter(r => {
      const recordCode = r.customerCode || r.code;
      return customerCodes.includes(recordCode);
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
    
    const currentFiltered = filterByCustomers(currentYearData);
    const previousFiltered = filterByCustomers(previousYearData);
    
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
      yearly: {
        current: ytdCurrentTotals,
        previous: yearlyPreviousTotals,
        diff: calcDiff(ytdCurrentTotals, yearlyPreviousTotals),
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
export function getCustomerSalesSummary(sheetsData, customerCodes) {
  console.log('[getCustomerSalesSummary] START');
  console.log('[getCustomerSalesSummary] Customer codes count:', customerCodes.length);
  
  const customerMap = new Map();
  
  // Aggregate invoiced sales
  sheetsData.invoiced2025.forEach(record => {
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
