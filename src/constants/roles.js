// -------------------------------------------------------------
// roles.js
// -------------------------------------------------------------
export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  DEVELOPER: 'developer',
  SALES_MANAGER: 'sales_manager',
  SALESMAN: 'salesman',
  WAREHOUSE_MANAGER: 'warehouse_manager',
  CUSTOMER: 'customer',
};

// Friendly role labels (Greek)
export const ROLE_LABELS_EL = {
  [ROLES.OWNER]: 'Ιδιοκτήτης',
  [ROLES.ADMIN]: 'Διαχειριστής',
  [ROLES.DEVELOPER]: 'Προγραμματιστής',
  [ROLES.SALES_MANAGER]: 'Διευθ. Πωλήσεων',
  [ROLES.SALESMAN]: 'Πωλητής',
  [ROLES.WAREHOUSE_MANAGER]: 'Υπευθ. Αποθήκης',
  [ROLES.CUSTOMER]: 'Πελάτης',
};

// Friendly role labels (English)
export const ROLE_LABELS_EN = {
  [ROLES.OWNER]: 'Owner',
  [ROLES.ADMIN]: 'Admin',
  [ROLES.DEVELOPER]: 'Developer',
  [ROLES.SALES_MANAGER]: 'Sales Manager',
  [ROLES.SALESMAN]: 'Salesman',
  [ROLES.WAREHOUSE_MANAGER]: 'Warehouse Manager',
  [ROLES.CUSTOMER]: 'Customer',
};

// Default label resolver (Greek by default)
export const getRoleLabel = (role, locale = 'el') => {
  const loc = String(locale || 'el').toLowerCase();
  const map = loc.startsWith('en') ? ROLE_LABELS_EN : ROLE_LABELS_EL;
  return map[role] || role || '';
};

// Common role ordering (from highest privilege to lowest)
export const ROLE_ORDER = [
  ROLES.OWNER,
  ROLES.ADMIN,
  ROLES.DEVELOPER,
  ROLES.SALES_MANAGER,
  ROLES.SALESMAN,
  ROLES.WAREHOUSE_MANAGER,
  ROLES.CUSTOMER,
];
