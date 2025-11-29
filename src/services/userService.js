// src/services/userService.js
// Service for managing user data and linked salesmen

import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

/**
 * Get salesmen linked to the current user for a specific brand
 * @param {string} brand - The brand (playmobil, kivos, john)
 * @returns {Promise<Array>} Array of salesman objects with code and name
 */
export async function getUserSalesmen(brand) {
  try {
    const currentUser = auth().currentUser;
    if (!currentUser) {
      throw new Error('No authenticated user');
    }

    // Get user document from Firestore
    const userDoc = await firestore()
      .collection('users')
      .doc(currentUser.uid)
      .get();

    if (!userDoc.exists) {
      console.warn('[UserService] User document not found');
      return [];
    }

    const userData = userDoc.data();
    
    // Get brand-specific salesmen from merchIds array
    // Format: "playmobil_SALESMAN_NAME", "kivos_SALESMAN_NAME", etc.
    const merchIds = userData.merchIds || [];
    
    if (merchIds.length === 0) {
      console.warn('[UserService] No merchIds found for user');
      return [];
    }
    
    // Filter merchIds for the specific brand
    const brandPrefix = `${brand}_`;
    const brandMerchIds = merchIds.filter(id => 
      String(id).toLowerCase().startsWith(brandPrefix.toLowerCase())
    );
    
    if (brandMerchIds.length === 0) {
      console.warn('[UserService] No salesmen linked for brand:', brand);
      return [];
    }
    
    console.log('[UserService] Brand merchIds found:', brandMerchIds);

    // Extract salesman names from merchIds (remove brand prefix)
    const salesmenNames = brandMerchIds.map(id => 
      String(id).substring(brandPrefix.length)
    );
    
    console.log('[UserService] Extracted salesman names:', salesmenNames);

    // Fetch salesman details from the salesmen collection (filtered by brand)
    const salesmenSnapshot = await firestore()
      .collection('salesmen')
      .where('brand', '==', brand)
      .get();
    
    console.log('[UserService] Salesmen collection returned:', salesmenSnapshot.size, 'documents');
    
    // Build a map of all salesmen by name (case-insensitive)
    const allSalesmen = {};
    salesmenSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const salesmanName = data.name || data.fullName || doc.id;
      allSalesmen[salesmanName.toLowerCase()] = {
        code: doc.id,
        name: salesmanName,
        email: data.email,
        phone: data.phone,
      };
    });
    
    // Match user's salesmen names to salesmen collection (case-insensitive)
    const salesmen = salesmenNames
      .map(name => allSalesmen[name.toLowerCase()])
      .filter(Boolean);

    console.log('[UserService] Matched salesmen for brand:', brand, salesmen.length);
    
    if (salesmen.length === 0) {
      console.warn('[UserService] Could not match any salesmen names from merchIds to salesmen collection');
      console.warn('[UserService] Available salesmen in collection:', Object.keys(allSalesmen));
      console.warn('[UserService] User salesman names:', salesmenNames);
    }
    
    return salesmen;
  } catch (error) {
    console.error('[UserService] Error loading user salesmen:', error);
    throw error;
  }
}

/**
 * Check if user has access to a specific brand
 * @param {string} brand - The brand to check
 * @returns {Promise<boolean>}
 */
export async function hasAccessToBrand(brand) {
  try {
    const currentUser = auth().currentUser;
    if (!currentUser) return false;

    const userDoc = await firestore()
      .collection('users')
      .doc(currentUser.uid)
      .get();

    if (!userDoc.exists) return false;

    const userData = userDoc.data();
    const brands = userData.brands || [];
    
    return brands.includes(brand);
  } catch (error) {
    console.error('[UserService] Error checking brand access:', error);
    return false;
  }
}

/**
 * Get all valid customer codes for a brand from Firestore
 * @param {string} brand - The brand (playmobil, kivos, john)
 * @returns {Promise<Set>} Set of valid customer codes
 */
export async function getValidCustomerCodes(brand) {
  try {
    const collectionName = brand === 'playmobil' ? 'customers' : `customers_${brand}`;
    const snapshot = await firestore()
      .collection(collectionName)
      .get();
    
    const customerCodes = new Set();
    snapshot.forEach(doc => {
      const data = doc.data();
      const code = data.customerCode || doc.id;
      customerCodes.add(String(code).trim());
    });
    
    console.log(`[UserService] Loaded ${customerCodes.size} valid customer codes for brand:`, brand);
    return customerCodes;
  } catch (error) {
    console.error('[UserService] Error loading customer codes:', error);
    return new Set();
  }
}

/**
 * Get all brands the user has access to
 * @returns {Promise<Array>} Array of brand strings
 */
export async function getUserBrands() {
  try {
    const currentUser = auth().currentUser;
    if (!currentUser) return [];

    const userDoc = await firestore()
      .collection('users')
      .doc(currentUser.uid)
      .get();

    if (!userDoc.exists) return [];

    const userData = userDoc.data();
    return userData.brands || [];
  } catch (error) {
    console.error('[UserService] Error loading user brands:', error);
    return [];
  }
}
