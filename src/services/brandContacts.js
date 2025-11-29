// src/services/brandContacts.js
// Service for fetching and managing brand employee contacts

import firestore from '@react-native-firebase/firestore';
import { BRAND_CONTACTS_CONFIG } from '../config/brandContacts';

/**
 * Fetch brand contacts from Firestore for specific brand
 * @param {string} brand - Brand key (playmobil, kivos, john)
 * @returns {Promise<Array>} Array of contact objects
 */
export async function fetchBrandContacts(brand) {
  console.log('[fetchBrandContacts] START for brand:', brand);
  
  try {
    const snapshot = await firestore()
      .collection(BRAND_CONTACTS_CONFIG.collectionName)
      .where('brand', '==', brand)
      .where('active', '==', true)
      .orderBy('sortOrder', 'asc')
      .orderBy('fullName', 'asc')
      .get();

    const contacts = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      contacts.push({
        id: doc.id,
        ...data,
        // Map pmh field to internal for 4-digit company phone numbers
        internal: data.internal || data.pmh || null,
      });
    });

    console.log('[fetchBrandContacts] Found', contacts.length, 'contacts for brand:', brand);
    return contacts;
  } catch (error) {
    console.error('[fetchBrandContacts] ERROR:', error);
    throw error;
  }
}

/**
 * Import contacts from CSV to Firestore (Admin function)
 * @param {string} brand - Brand key to assign to imported contacts
 * @param {boolean} clearExisting - Whether to clear existing contacts for this brand
 * @returns {Promise<Object>} Import result
 */
export async function importContactsFromCSV(brand, clearExisting = false) {
  console.log('[importContactsFromCSV] START for brand:', brand, 'clearExisting:', clearExisting);
  
  try {
    // Fetch CSV data
    console.log('[importContactsFromCSV] Fetching CSV...');
    const response = await fetch(BRAND_CONTACTS_CONFIG.csvUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`);
    }

    const csvText = await response.text();
    console.log('[importContactsFromCSV] CSV fetched, parsing...');

    // Parse CSV
    const contacts = parseContactsCSV(csvText);
    console.log('[importContactsFromCSV] Parsed', contacts.length, 'contacts');

    // Clear existing contacts for this brand if requested
    if (clearExisting) {
      console.log('[importContactsFromCSV] Clearing existing contacts for brand:', brand);
      const existingSnapshot = await firestore()
        .collection(BRAND_CONTACTS_CONFIG.collectionName)
        .where('brand', '==', brand)
        .get();
      
      const batch = firestore().batch();
      existingSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log('[importContactsFromCSV] Deleted', existingSnapshot.size, 'existing contacts');
    }

    // Import new contacts in batches
    const batchSize = 500;
    let imported = 0;
    
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = firestore().batch();
      const chunk = contacts.slice(i, i + batchSize);
      
      chunk.forEach((contact, index) => {
        const docRef = firestore()
          .collection(BRAND_CONTACTS_CONFIG.collectionName)
          .doc();
        
        batch.set(docRef, {
          ...contact,
          brand: brand,
          active: true,
          sortOrder: i + index,
          createdAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
      });
      
      await batch.commit();
      imported += chunk.length;
      console.log('[importContactsFromCSV] Imported', imported, '/', contacts.length);
    }

    const result = {
      success: true,
      brand,
      imported,
      cleared: clearExisting ? existingSnapshot?.size || 0 : 0,
    };
    
    console.log('[importContactsFromCSV] Import complete:', result);
    return result;
  } catch (error) {
    console.error('[importContactsFromCSV] ERROR:', error);
    throw error;
  }
}

/**
 * Parse CSV text into contact objects
 * @param {string} csvText - Raw CSV text
 * @returns {Array} Array of contact objects
 */
function parseContactsCSV(csvText) {
  const contacts = [];
  const lines = csvText.split('\n');
  
  // Skip header row
  const headers = lines[0].split(',').map(h => h.trim());
  console.log('[parseContactsCSV] Headers:', headers);
  
  // Find column indices
  const colIndices = {
    department: headers.indexOf(BRAND_CONTACTS_CONFIG.columnNames.department),
    fullName: headers.indexOf(BRAND_CONTACTS_CONFIG.columnNames.fullName),
    mobile: headers.indexOf(BRAND_CONTACTS_CONFIG.columnNames.mobile),
    pmh: headers.indexOf(BRAND_CONTACTS_CONFIG.columnNames.pmh),
    internal: headers.indexOf(BRAND_CONTACTS_CONFIG.columnNames.internal),
    fullPhone: headers.indexOf(BRAND_CONTACTS_CONFIG.columnNames.fullPhone),
    email: headers.indexOf(BRAND_CONTACTS_CONFIG.columnNames.email),
  };
  
  console.log('[parseContactsCSV] Column indices:', colIndices);

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split(',').map(v => v.trim());
    
    const department = values[colIndices.department] || '';
    const fullName = values[colIndices.fullName] || '';
    const mobile = values[colIndices.mobile] || '';
    const pmh = values[colIndices.pmh] || '';
    const internal = values[colIndices.internal] || '';
    const fullPhone = values[colIndices.fullPhone] || '';
    const email = values[colIndices.email] || '';

    // Skip empty rows
    if (!fullName && !mobile && !email) {
      continue;
    }

    contacts.push({
      department,
      fullName,
      mobile,
      pmh,
      internal,
      fullPhone,
      email,
    });
  }

  console.log('[parseContactsCSV] Parsing complete:', contacts.length, 'contacts');
  return contacts;
}

/**
 * Group contacts by department with custom sort order
 * @param {Array} contacts - Array of contact objects
 * @returns {Object} Contacts grouped by department in specified order
 */
export function groupContactsByDepartment(contacts) {
  // Custom department order
  const departmentOrder = [
    'Country Manager',
    'Οικονομική Διεύθυνση',
    'Λογιστήριο',
    'Διεύθυνση Πωλήσεων',
    'Πωλήσεις',
    'Διεύθυνση Lechuza',
    'Πωλήσεις Lechuza',
    'Διεύθυνση Marketing',
    'Marketing',
    'Διεύθυνση Operations & Supply',
    'Operations & Supply',
    'Αποθήκη',
    'Οδηγός',
    'Deco',
    'Fun Park',
  ];

  const grouped = {};
  
  // Group contacts by department
  contacts.forEach(contact => {
    const dept = contact.department || 'Άλλο';
    if (!grouped[dept]) {
      grouped[dept] = [];
    }
    grouped[dept].push(contact);
  });

  // Sort the grouped object by department order
  const sortedGrouped = {};
  
  // First add departments in the specified order
  departmentOrder.forEach(dept => {
    if (grouped[dept]) {
      sortedGrouped[dept] = grouped[dept];
    }
  });
  
  // Then add any remaining departments not in the order list
  Object.keys(grouped).forEach(dept => {
    if (!departmentOrder.includes(dept)) {
      sortedGrouped[dept] = grouped[dept];
    }
  });

  return sortedGrouped;
}
