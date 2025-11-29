// src/config/brandContacts.js
// Configuration for brand employee contacts

export const BRAND_CONTACTS_CONFIG = {
  // CSV URL for importing contacts to Firestore
  csvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSi-P7gMMVUVBTxzZv7zFotre9UY9G3c91-r_jW1vexoxiUoA7aMUMJJRgz7neY566qVtpv92CbVH9A/pub?gid=734595660&single=true&output=csv',
  
  columnNames: {
    department: 'Τμήμα',
    fullName: 'ΟΝΟΜΑΤΕΠΩΝΥΜΟ',
    mobile: 'ΚΙΝΗΤΟ',
    pmh: 'PMH',
    internal: 'Internal',
    fullPhone: 'Πλήρες Τηλ.',
    email: 'Email',
  },
  
  // Firestore collection name
  collectionName: 'brand_contacts',
};

// Department translations
export const DEPARTMENT_LABELS = {
  'LOGISTICS': 'Logistics',
  'SALES': 'Πωλήσεις',
  'SUPPORT': 'Υποστήριξη',
  'ADMIN': 'Διοίκηση',
  'IT': 'Πληροφορική',
  'WAREHOUSE': 'Αποθήκη',
  // Add more as needed based on actual CSV data
};
