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