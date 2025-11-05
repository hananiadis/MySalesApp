// googleSheetsCache.js
// Service to fetch, cache, and retrieve Google Sheets data

import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const CACHE_COLLECTION = 'sheetsCache';
const CACHE_DURATION_HOURS = 24; // Cache for 24 hours

/**
 * Google Sheets URLs - Replace with your actual sheet export URLs
 * To get CSV export URL: File > Share > Publish to web > Select sheet > CSV
 */
const SHEET_URLS = {
  sales2025: 'https://docs.google.com/spreadsheets/d/1JM1GNHLNim1R59MS62rI6kcrf_gdwMs0fRnxg9cw-sg/gviz/tq?tqx=out:csv&gid=616087206',
  orders2025: 'https://docs.google.com/spreadsheets/d/1JM1GNHLNim1R59MS62rI6kcrf_gdwMs0fRnxg9cw-sg/gviz/tq?tqx=out:csv&gid=724538995',
  balance2025: 'https://docs.google.com/spreadsheets/d/1JM1GNHLNim1R59MS62rI6kcrf_gdwMs0fRnxg9cw-sg/gviz/tq?tqx=out:csv&gid=440325138',
  sales2024: 'https://docs.google.com/spreadsheets/d/1TSvC2gkaoOl-dZhLd_SpvVaZxswRiC-DLlV0y_JADQ0/gviz/tq?tqx=out:csv&gid=466675476',
  orders2024: 'https://docs.google.com/spreadsheets/d/1TSvC2gkaoOl-dZhLd_SpvVaZxswRiC-DLlV0y_JADQ0/gviz/tq?tqx=out:csv&gid=729827210'
};

/**
 * Parse CSV text to array of objects
 */
function parseCSV(csvText) {
  const lines = csvText.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    const values = lines[i].split(',');
    const row = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] ? values[index].trim().replace(/"/g, '') : '';
    });
    
    data.push(row);
  }
  
  return data;
}

/**
 * Fetch data from Google Sheets
 */
async function fetchSheetData(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch sheet: ${response.statusText}`);
    }
    const csvText = await response.text();
    return parseCSV(csvText);
  } catch (error) {
    console.error('Error fetching sheet:', error);
    throw error;
  }
}

/**
 * Check if cache is still valid
 */
function isCacheValid(cacheDoc) {
  if (!cacheDoc.exists()) return false;
  
  const data = cacheDoc.data();
  if (!data.timestamp) return false;
  
  const cacheTime = data.timestamp.toDate();
  const now = new Date();
  const hoursDiff = (now - cacheTime) / (1000 * 60 * 60);
  
  return hoursDiff < CACHE_DURATION_HOURS;
}

/**
 * Get cached data or fetch new data
 */
async function getCachedSheetData(db, sheetKey, sheetUrl) {
  const cacheDocRef = doc(db, CACHE_COLLECTION, sheetKey);
  
  try {
    // Check cache first
    const cacheDoc = await getDoc(cacheDocRef);
    
    if (isCacheValid(cacheDoc)) {
      console.log(`Using cached data for ${sheetKey}`);
      return cacheDoc.data().data;
    }
    
    // Cache miss or expired - fetch new data
    console.log(`Fetching fresh data for ${sheetKey}`);
    const freshData = await fetchSheetData(sheetUrl);
    
    // Store in cache
    await setDoc(cacheDocRef, {
      data: freshData,
      timestamp: serverTimestamp(),
      sheetKey
    });
    
    return freshData;
  } catch (error) {
    console.error(`Error getting cached data for ${sheetKey}:`, error);
    
    // If fetch fails but we have old cache, use it
    const cacheDoc = await getDoc(cacheDocRef);
    if (cacheDoc.exists()) {
      console.warn(`Using stale cache for ${sheetKey} due to fetch error`);
      return cacheDoc.data().data;
    }
    
    throw error;
  }
}

/**
 * Main function to get all sheets data (cached or fresh)
 */
export async function getAllSheetsData(db) {
  try {
    const [sales2025, orders2025, balance2025, sales2024, orders2024] = await Promise.all([
      getCachedSheetData(db, 'sales2025', SHEET_URLS.sales2025),
      getCachedSheetData(db, 'orders2025', SHEET_URLS.orders2025),
      getCachedSheetData(db, 'balance2025', SHEET_URLS.balance2025),
      getCachedSheetData(db, 'sales2024', SHEET_URLS.sales2024),
      getCachedSheetData(db, 'orders2024', SHEET_URLS.orders2024)
    ]);
    
    return {
      sales2025,
      orders2025,
      balance2025,
      sales2024,
      orders2024
    };
  } catch (error) {
    console.error('Error fetching all sheets data:', error);
    throw error;
  }
}

/**
 * Force refresh all cached data
 */
export async function refreshAllCaches(db) {
  const cacheDocRefs = Object.keys(SHEET_URLS).map(key => 
    doc(db, CACHE_COLLECTION, key)
  );
  
  // Delete all cache documents
  await Promise.all(cacheDocRefs.map(ref => 
    setDoc(ref, { timestamp: new Date(0) })
  ));
  
  // Fetch fresh data
  return getAllSheetsData(db);
}

/**
 * Get specific sheet data
 */
export async function getSheetData(db, sheetKey) {
  if (!SHEET_URLS[sheetKey]) {
    throw new Error(`Unknown sheet key: ${sheetKey}`);
  }
  
  return getCachedSheetData(db, sheetKey, SHEET_URLS[sheetKey]);
}