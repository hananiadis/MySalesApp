// Expense Category Groups
export const EXPENSE_GROUPS = {
  TRAVEL: 'ΜΕΤΑΚΙΝΗΣΗ',
  ACCOMMODATION_FOOD: 'ΔΙΑΜΟΝΗ & ΔΙΑΤΡΟΦΗ',
  MISCELLANEOUS: 'ΔΙΑΦΟΡΑ'
};

// Expense Categories - Organized by group
export const EXPENSE_CATEGORIES = {
  // ΜΕΤΑΚΙΝΗΣΗ (Travel)
  FUEL: { id: 'fuel', label: 'Βενζίνη - Αέριο', group: EXPENSE_GROUPS.TRAVEL },
  TICKETS: { id: 'tickets', label: 'Εισιτήρια', group: EXPENSE_GROUPS.TRAVEL },
  TAXI: { id: 'taxi', label: 'Ταξί', group: EXPENSE_GROUPS.TRAVEL },
  CAR_RENTAL: { id: 'car_rental', label: 'Ενοικίαση Αυτοκινήτου', group: EXPENSE_GROUPS.TRAVEL },
  TOLLS: { id: 'tolls', label: 'Διόδια', group: EXPENSE_GROUPS.TRAVEL },
  PARKING: { id: 'parking', label: 'Parking', group: EXPENSE_GROUPS.TRAVEL },

  // ΔΙΑΜΟΝΗ & ΔΙΑΤΡΟΦΗ (Accommodation & Food)
  HOTEL: { id: 'hotel', label: 'Ξενοδοχείο', group: EXPENSE_GROUPS.ACCOMMODATION_FOOD },
  PERSONAL_MEAL: { id: 'personal_meal', label: 'Ατομικό Γεύμα', group: EXPENSE_GROUPS.ACCOMMODATION_FOOD },
  THIRD_PARTY_MEAL: { id: 'third_party_meal', label: 'Γεύμα Τρίτου', group: EXPENSE_GROUPS.ACCOMMODATION_FOOD },

  // ΔΙΑΦΟΡΑ (Miscellaneous)
  POSTAL: { id: 'postal', label: 'Ταχυδρομικά Έξοδα', group: EXPENSE_GROUPS.MISCELLANEOUS },
  TELECOM: { id: 'telecom', label: 'Τηλέφωνα, φαξ, Internet', group: EXPENSE_GROUPS.MISCELLANEOUS },
  CAR_SERVICE: { id: 'car_service', label: 'Service Αυτοκινήτου', group: EXPENSE_GROUPS.MISCELLANEOUS },
  OTHER: { id: 'other', label: 'Διάφορα', group: EXPENSE_GROUPS.MISCELLANEOUS }
};

// Expense Status
export const EXPENSE_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  APPROVED: 'approved'
};

// Payment Methods
export const PAYMENT_METHODS = {
  CASH: 'cash',
  CREDIT_CARD: 'credit_card',
  BANK_TRANSFER: 'bank_transfer'
};

export const PAYMENT_METHOD_LABELS = {
  [PAYMENT_METHODS.CASH]: 'Μετρητά',
  [PAYMENT_METHODS.CREDIT_CARD]: 'Πιστωτική Κάρτα',
  [PAYMENT_METHODS.BANK_TRANSFER]: 'Τραπεζική Μεταφορά'
};

// Invoice vs Receipt
export const INVOICE_TYPES = {
  INVOICE: 'invoice',
  RECEIPT: 'receipt'
};

export const INVOICE_TYPE_LABELS = {
  [INVOICE_TYPES.INVOICE]: 'Τιμολόγιο',
  [INVOICE_TYPES.RECEIPT]: 'Απόδειξη'
};

// Fuel Types
export const FUEL_TYPES = {
  UNLEADED: 'unleaded',      // ΑΜΟΛΥΒΔΗ
  LPG: 'lpg',                // ΑΕΡΙΟ
  DIESEL: 'diesel',          // DIESEL
  ADBLUE: 'adblue',          // AdBlue
  ELECTRIC: 'electric'       // ΡΕΥΜΑ
};

export const FUEL_TYPE_LABELS = {
  [FUEL_TYPES.UNLEADED]: 'ΑΜΟΛΥΒΔΗ',
  [FUEL_TYPES.LPG]: 'ΑΕΡΙΟ (LPG)',
  [FUEL_TYPES.DIESEL]: 'DIESEL',
  [FUEL_TYPES.ADBLUE]: 'AdBlue',
  [FUEL_TYPES.ELECTRIC]: 'ΡΕΥΜΑ'
};

// Service Types for Car Service
export const SERVICE_TYPES = {
  CAR_WASH: 'car_wash',
  CAR_INSPECTION: 'car_inspection',
  OIL_CHANGE: 'oil_change',
  BODYWORK: 'bodywork',
  BRAKE_REPLACEMENT: 'brake_replacement',
  FUEL_PUMP: 'fuel_pump',
  TIRE_CHANGE: 'tire_change',
  ENGINE_REPAIR: 'engine_repair',
  WHEEL_ALIGNMENT: 'wheel_alignment',
  BELTS: 'belts',
  RADIATOR: 'radiator',
  AIR_CONDITIONING: 'air_conditioning',
  HORN: 'horn',
  LABOR_COST: 'labor_cost',
  BATTERY: 'battery',
  SPARK_PLUGS: 'spark_plugs',
  NEW_TIRES: 'new_tires',
  TIRE_PRESSURE: 'tire_pressure',
  SUSPENSION_SYSTEM: 'suspension_system',
  STEERING_SYSTEM: 'steering_system',
  EXHAUST_SYSTEM: 'exhaust_system',
  HEATING_SYSTEM: 'heating_system',
  CLUTCH_SYSTEM: 'clutch_system',
  COOLING_SYSTEM: 'cooling_system',
  BRAKE_PADS: 'brake_pads',
  TECHNICAL_INSPECTION: 'technical_inspection',
  WINDOWS_MIRRORS: 'windows_mirrors',
  WIPERS: 'wipers',
  CLUTCH_FLUID: 'clutch_fluid',
  BRAKE_FLUID: 'brake_fluid',
  TRANSMISSION_FLUID: 'transmission_fluid',
  CABIN_AIR_FILTER: 'cabin_air_filter',
  FUEL_FILTER: 'fuel_filter',
  OIL_FILTER: 'oil_filter',
  AIR_FILTER: 'air_filter',
  LIGHTS: 'lights'
};

export const SERVICE_TYPE_LABELS = {
  [SERVICE_TYPES.CAR_WASH]: 'Πλυντήριο Αυτοκινήτων',
  [SERVICE_TYPES.CAR_INSPECTION]: 'Έλεγχος Αυτοκινήτου',
  [SERVICE_TYPES.OIL_CHANGE]: 'Αλλαγή λαδιού',
  [SERVICE_TYPES.BODYWORK]: 'Αμάξωμα/Πλαίσιο',
  [SERVICE_TYPES.BRAKE_REPLACEMENT]: 'Αντικατάσταση Φρένων',
  [SERVICE_TYPES.FUEL_PUMP]: 'Αντλία καυσίμου',
  [SERVICE_TYPES.TIRE_CHANGE]: 'Εναλλαγή ελαστικών',
  [SERVICE_TYPES.ENGINE_REPAIR]: 'Επισκευή κινητήρα',
  [SERVICE_TYPES.WHEEL_ALIGNMENT]: 'Εθυγράμμιση Τροχών',
  [SERVICE_TYPES.BELTS]: 'Ζώνες',
  [SERVICE_TYPES.RADIATOR]: 'Καλοριφέρ',
  [SERVICE_TYPES.AIR_CONDITIONING]: 'Κλιματισμός',
  [SERVICE_TYPES.HORN]: 'Κόρνα',
  [SERVICE_TYPES.LABOR_COST]: 'Κόστος εργασίας',
  [SERVICE_TYPES.BATTERY]: 'Μπαταρία',
  [SERVICE_TYPES.SPARK_PLUGS]: 'Μπουζί',
  [SERVICE_TYPES.NEW_TIRES]: 'Νέα Ελαστικά',
  [SERVICE_TYPES.TIRE_PRESSURE]: 'Πίεση ελαστικών',
  [SERVICE_TYPES.SUSPENSION_SYSTEM]: 'Σύστημα Ανάρτησης',
  [SERVICE_TYPES.STEERING_SYSTEM]: 'Σύστημα Διεύθυνσης',
  [SERVICE_TYPES.EXHAUST_SYSTEM]: 'Σύστημα Εξάτμισης',
  [SERVICE_TYPES.HEATING_SYSTEM]: 'Σύστημα Θέρμανσης',
  [SERVICE_TYPES.CLUTCH_SYSTEM]: 'Σύστημα Συμπλέκτη',
  [SERVICE_TYPES.COOLING_SYSTEM]: 'Σύστημα Ψύξης',
  [SERVICE_TYPES.BRAKE_PADS]: 'Τακάκια Φρένων',
  [SERVICE_TYPES.TECHNICAL_INSPECTION]: 'Τεχνικός Έλεγχος',
  [SERVICE_TYPES.WINDOWS_MIRRORS]: 'Τζάμια / Καθρέπτες',
  [SERVICE_TYPES.WIPERS]: 'Υαλοκαθαριστήρες',
  [SERVICE_TYPES.CLUTCH_FLUID]: 'Υγρό Συμπλέκτη',
  [SERVICE_TYPES.BRAKE_FLUID]: 'Υγρό Φρένων',
  [SERVICE_TYPES.TRANSMISSION_FLUID]: 'Υγρό κιβωτίου ταχυτήτων',
  [SERVICE_TYPES.CABIN_AIR_FILTER]: 'Φίλτρο Αέρα Καμπίνας',
  [SERVICE_TYPES.FUEL_FILTER]: 'Φίλτρο Καυσίμου',
  [SERVICE_TYPES.OIL_FILTER]: 'Φίλτρο Λαδίου',
  [SERVICE_TYPES.AIR_FILTER]: 'Φίλτρο αέρα',
  [SERVICE_TYPES.LIGHTS]: 'Φώτα'
};

// Dynamic fields configuration per category
export const EXPENSE_FIELDS = {
  fuel: {
    additionalFields: ['fuelType', 'carId', 'mileage', 'vatNumber', 'costPerLiter', 'totalCost', 'liters', 'costPerKm', 'previousRefuelLogged', 'fullTank'],
    description: 'Τύπος καυσίμου, ΦΠΑ σταθμού, κόστος ανά λίτρο'
  },
  adblue: {
    additionalFields: ['carId', 'mileage', 'vatNumber', 'costPerLiter', 'totalCost', 'previousRefuelLogged'],
    description: 'AdBlue για Diesel κινητήρες'
  },
  car_service: {
    additionalFields: ['carId', 'serviceTypes', 'serviceNotes'],
    description: 'Service εξαρτήματα και εργασίας'
  },
  hotel: {
    additionalFields: ['hotelName', 'nights'],
    description: 'Όνομα ξενοδοχείου και νύχτες'
  },
  tickets: {
    additionalFields: ['departure', 'destination', 'tripDate'],
    description: 'Αναχώρηση, προορισμός, ημερομηνία ταξιδιού'
  },
  taxi: {
    additionalFields: ['departure', 'destination'],
    description: 'Αναχώρηση και προορισμός'
  }
};

// Currency
export const EXPENSE_CURRENCY = 'EUR';

// Sorting options for expenses
export const EXPENSE_SORT_OPTIONS = [
  { id: 'date_desc', label: 'Πιο Πρόσφατα' },
  { id: 'date_asc', label: 'Παλιότερα' },
  { id: 'amount_desc', label: 'Υψηλότερο ποσό' },
  { id: 'amount_asc', label: 'Χαμηλότερο ποσό' }
];

// Weekdays for weekly tracking
export const WEEKDAYS = [
  { id: 'monday', label: 'Δευτέρα', short: 'Δευ' },
  { id: 'tuesday', label: 'Τρίτη', short: 'Τρι' },
  { id: 'wednesday', label: 'Τετάρτη', short: 'Τετ' },
  { id: 'thursday', label: 'Πέμπτη', short: 'Πεμ' },
  { id: 'friday', label: 'Παρασκευή', short: 'Παρ' },
  { id: 'saturday', label: 'Σάββατο', short: 'Σαβ' },
  { id: 'sunday', label: 'Κυριακή', short: 'Κυρ' }
];

/**
 * Get category label by category ID
 * @param {string} categoryId - The category ID
 * @returns {string} The category label in Greek
 */
export const getCategoryLabel = (categoryId) => {
  const category = Object.values(EXPENSE_CATEGORIES).find(cat => cat.id === categoryId);
  return category ? category.label : 'Άγνωστη κατηγορία';
};

/**
 * Get category group by category ID
 * @param {string} categoryId - The category ID
 * @returns {string} The group name (ΜΕΤΑΚΙΝΗΣΗ, ΔΙΑΜΟΝΗ & ΔΙΑΤΡΟΦΗ, ΔΙΑΦΟΡΑ)
 */
export const getCategoryGroup = (categoryId) => {
  const category = Object.values(EXPENSE_CATEGORIES).find(cat => cat.id === categoryId);
  return category ? category.group : null;
};

/**
 * Get all categories in a specific group
 * @param {string} groupId - The group ID (ΜΕΤΑΚΙΝΗΣΗ, ΔΙΑΜΟΝΗ & ΔΙΑΤΡΟΦΗ, ΔΙΑΦΟΡΑ)
 * @returns {Array} Array of categories in the group
 */
export const getCategoriesByGroup = (groupId) => {
  return Object.values(EXPENSE_CATEGORIES).filter(cat => cat.group === groupId);
};

/**
 * Get all category groups
 * @returns {Array} Array of all group names
 */
export const getAllCategoryGroups = () => {
  return Object.values(EXPENSE_GROUPS);
};

/**
 * Get all expense categories as an array
 * @returns {Array} Array of all categories
 */
export const getAllCategories = () => {
  return Object.values(EXPENSE_CATEGORIES);
};

/**
 * Get weekday label by weekday ID
 * @param {string} weekdayId - The weekday ID (monday, tuesday, etc.)
 * @returns {string} The full weekday name in Greek
 */
export const getWeekdayLabel = (weekdayId) => {
  const day = WEEKDAYS.find(d => d.id === weekdayId);
  return day ? day.label : '';
};

/**
 * Get short weekday label by weekday ID
 * @param {string} weekdayId - The weekday ID (monday, tuesday, etc.)
 * @returns {string} The short weekday name in Greek (3 letters)
 */
export const getWeekdayShortLabel = (weekdayId) => {
  const day = WEEKDAYS.find(d => d.id === weekdayId);
  return day ? day.short : '';
};

/**
 * Get ISO week number for a given date
 * @param {Date} date - The date
 * @returns {number} The ISO week number (1-53)
 */
export const getWeekNumber = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

/**
 * Get the year for a given date (used with week number for ISO 8601)
 * @param {Date} date - The date
 * @returns {number} The year
 */
export const getISOWeekYear = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  return d.getUTCFullYear();
};

/**
 * Get week ID in format "YYYY-WXX" (e.g., "2026-W03")
 * @param {Date} date - The date
 * @returns {string} The week ID
 */
export const getWeekId = (date) => {
  const year = getISOWeekYear(date);
  const week = getWeekNumber(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
};

/**
 * Get week start and end dates for a given date
 * Returns Monday as week start, Sunday as week end (ISO 8601)
 * @param {Date} date - The date
 * @returns {Object} Object with start and end Date objects
 */
export const getWeekStartEnd = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  // Adjust to Monday (1) as week start
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
};

/**
 * Get the Monday of a week from a week ID
 * @param {string} weekId - The week ID (format: "2026-W03")
 * @returns {Date} The Monday of that week
 */
export const getMondayFromWeekId = (weekId) => {
  const [year, week] = weekId.split('-W');
  const yearNum = parseInt(year, 10);
  const weekNum = parseInt(week, 10);
  
  // January 4th is always in week 1
  const jan4 = new Date(yearNum, 0, 4);
  const dayNum = jan4.getDay() || 7;
  jan4.setDate(jan4.getDate() - dayNum + 1);
  
  // Get the Monday of the target week
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() + (weekNum - 1) * 7);
  
  return monday;
};

/**
 * Get all categories grouped and organized for picker display
 * @returns {Array} Array of groups with their categories
 */
export const getCategoriesGrouped = () => {
  const groups = getAllCategoryGroups();
  return groups.map(groupName => ({
    group: groupName,
    categories: getCategoriesByGroup(groupName)
  }));
};

/**
 * Validate expense data
 * @param {Object} expense - The expense object to validate
 * @returns {Object} { valid: boolean, errors: Array }
 */
export const validateExpense = (expense) => {
  const errors = [];

  if (!expense.category || !Object.values(EXPENSE_CATEGORIES).find(cat => cat.id === expense.category)) {
    errors.push('Category is required and must be valid');
  }

  if (!expense.amount || expense.amount <= 0) {
    errors.push('Amount must be greater than 0');
  }

  if (!expense.date) {
    errors.push('Date is required');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validate weekly tracking data
 * @param {Object} tracking - The weekly tracking object to validate
 * @returns {Object} { valid: boolean, errors: Array }
 */
export const validateWeeklyTracking = (tracking) => {
  const errors = [];

  if (!tracking.mileage) {
    errors.push('Mileage data is required');
  } else {
    const { startKm, endKm, privateKm } = tracking.mileage;
    
    if (startKm === undefined || startKm === null || startKm < 0) {
      errors.push('Start mileage must be a valid positive number');
    }
    
    if (endKm === undefined || endKm === null || endKm < 0) {
      errors.push('End mileage must be a valid positive number');
    }
    
    if (startKm !== undefined && endKm !== undefined && endKm < startKm) {
      errors.push('End mileage cannot be less than start mileage');
    }
    
    if (privateKm === undefined || privateKm === null || privateKm < 0) {
      errors.push('Private mileage must be a valid positive number');
    }
    
    if (startKm !== undefined && endKm !== undefined && privateKm !== undefined) {
      const totalKm = endKm - startKm;
      if (privateKm > totalKm) {
        errors.push('Private mileage cannot exceed total mileage');
      }
    }
  }

  if (!tracking.pettyCash) {
    errors.push('Petty cash data is required');
  } else {
    const { given } = tracking.pettyCash;
    if (given === undefined || given === null || given < 0) {
      errors.push('Petty cash given must be a valid positive number');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Calculate business kilometers from tracking data
 * @param {Object} mileage - Object with startKm, endKm, privateKm
 * @returns {number} Business kilometers
 */
export const calculateBusinessKm = (mileage) => {
  const { startKm, endKm, privateKm } = mileage;
  if (startKm === undefined || endKm === undefined || privateKm === undefined) {
    return 0;
  }
  const totalKm = endKm - startKm;
  return Math.max(0, totalKm - privateKm);
};

/**
 * Calculate remaining petty cash
 * @param {number} given - Amount given
 * @param {number} spent - Amount spent from expenses
 * @returns {number} Remaining amount
 */
export const calculateRemainingPettyCash = (given, spent, previousBalance = 0) => {
  return Math.max(0, (previousBalance || 0) + (given || 0) - (spent || 0));
};
/**
 * Format date to DD/MM/YYYY format
 * @param {Date|string} date - The date to format
 * @returns {string} Formatted date in DD/MM/YYYY
 */
export const formatDateDDMMYYYY = (date) => {
  try {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '';
  }
};

/**
 * Parse date string from DD/MM/YYYY to Date object
 * @param {string} dateString - Date in DD/MM/YYYY format
 * @returns {Date} Date object
 */
export const parseDateDDMMYYYY = (dateString) => {
  try {
    const [day, month, year] = dateString.split('/').map(Number);
    return new Date(year, month - 1, day);
  } catch {
    return new Date();
  }
};