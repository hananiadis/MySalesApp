// Firebase Configuration
export const FIREBASE_CONFIG = {
  PROJECT_ID: 'mysalesapp-38ccf',
  REGION: 'europe-west1',
};

// Basic Firebase setup for the app
export const FIREBASE_SETUP = {
  // App will use default Firebase configuration
  // Products are managed offline and loaded from Firestore
};

// Cloud Functions URLs
export const CLOUD_FUNCTIONS = {
  SYNC_PRODUCTS: `https://${FIREBASE_CONFIG.REGION}-${FIREBASE_CONFIG.PROJECT_ID}.cloudfunctions.net/syncProductsFromSheets`,
  GET_STATUS: `https://${FIREBASE_CONFIG.REGION}-${FIREBASE_CONFIG.PROJECT_ID}.cloudfunctions.net/getSyncStatus`,
};

// Helper function to get function URL
export const getFunctionUrl = (functionName) => {
  return `https://${FIREBASE_CONFIG.REGION}-${FIREBASE_CONFIG.PROJECT_ID}.cloudfunctions.net/${functionName}`;
}; 

// SuperMarket Google Sheet endpoints (gviz JSON)
export const SUPERMARKET_LISTINGS_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1GPfMydqVMyDjjmhEIjWLP5kN2Vs21v8YdJgr15ins0c/gviz/tq?tqx=out:json';
export const SUPERMARKET_STORES_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1pr6HRuTRbRUpqYVYKLuiV7qZ2uqR-bm0sObZom6_m1s/gviz/tq?tqx=out:json';
export const SUPERMARKET_INVENTORY_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1A1HlA27aaamZy-smzvbr6DckmH7MGME2NNwMMNOnZVI/gviz/tq?tqx=out:json';
