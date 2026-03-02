/**
 * Initialize Firestore Collections for Expense Tracker
 * This script populates:
 * - carBrands collection
 * - fuelTypes collection
 * - serviceTypes collection  
 * - cars collection (if empty)
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Car Brands Data with logos
const carBrands = [
  {
    id: 'kia',
    name: 'KIA',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b6/KIA_logo3.svg',
    active: true
  },
  {
    id: 'toyota',
    name: 'TOYOTA',
    logoUrl: 'https://global.toyota/pages/global_toyota/mobility/toyota-brand/emblem_001.jpg',
    active: true
  },
  {
    id: 'peugeot',
    name: 'PEUGEOT',
    logoUrl: 'https://w7.pngwing.com/pngs/981/989/png-transparent-peugeot-106-car-logo-peugeot-206-peugeot-text-suspension-design-thumbnail.png',
    active: true
  },
  {
    id: 'vw',
    name: 'VW',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Volkswagen_logo_2019.svg',
    active: true
  }
];

// Fuel Types Data
const fuelTypes = [
  { id: 'unleaded', label: 'ΑΜΟΛΥΒΔΗ', order: 1, active: true },
  { id: 'lpg', label: 'ΑΕΡΙΟ (LPG)', order: 2, active: true },
  { id: 'diesel', label: 'DIESEL', order: 3, active: true },
  { id: 'adblue', label: 'AdBlue', order: 4, active: true },
  { id: 'electric', label: 'ΡΕΥΜΑ', order: 5, active: true }
];

// Service Types Data
const serviceTypes = [
  { id: 'car_wash', label: 'Πλυντήριο Αυτοκινήτων', order: 1, active: true },
  { id: 'car_inspection', label: 'Έλεγχος Αυτοκινήτου', order: 2, active: true },
  { id: 'oil_change', label: 'Αλλαγή λαδιού', order: 3, active: true },
  { id: 'bodywork', label: 'Αμάξωμα/Πλαίσιο', order: 4, active: true },
  { id: 'brake_replacement', label: 'Αντικατάσταση Φρένων', order: 5, active: true },
  { id: 'fuel_pump', label: 'Αντλία καυσίμου', order: 6, active: true },
  { id: 'tire_change', label: 'Εναλλαγή ελαστικών', order: 7, active: true },
  { id: 'engine_repair', label: 'Επισκευή κινητήρα', order: 8, active: true },
  { id: 'wheel_alignment', label: 'Εθυγράμμιση Τροχών', order: 9, active: true },
  { id: 'belts', label: 'Ζώνες', order: 10, active: true },
  { id: 'radiator', label: 'Καλοριφέρ', order: 11, active: true },
  { id: 'air_conditioning', label: 'Κλιματισμός', order: 12, active: true },
  { id: 'horn', label: 'Κόρνα', order: 13, active: true },
  { id: 'labor_cost', label: 'Κόστος εργασίας', order: 14, active: true },
  { id: 'battery', label: 'Μπαταρία', order: 15, active: true },
  { id: 'spark_plugs', label: 'Μπουζί', order: 16, active: true },
  { id: 'new_tires', label: 'Νέα Ελαστικά', order: 17, active: true },
  { id: 'tire_pressure', label: 'Πίεση ελαστικών', order: 18, active: true },
  { id: 'suspension_system', label: 'Σύστημα Ανάρτησης', order: 19, active: true },
  { id: 'steering_system', label: 'Σύστημα Διεύθυνσης', order: 20, active: true },
  { id: 'exhaust_system', label: 'Σύστημα Εξάτμισης', order: 21, active: true },
  { id: 'heating_system', label: 'Σύστημα Θέρμανσης', order: 22, active: true },
  { id: 'clutch_system', label: 'Σύστημα Συμπλέκτη', order: 23, active: true },
  { id: 'cooling_system', label: 'Σύστημα Ψύξης', order: 24, active: true },
  { id: 'brake_pads', label: 'Τακάκια Φρένων', order: 25, active: true },
  { id: 'technical_inspection', label: 'Τεχνικός Έλεγχος', order: 26, active: true },
  { id: 'windows_mirrors', label: 'Τζάμια / Καθρέπτες', order: 27, active: true },
  { id: 'wipers', label: 'Υαλοκαθαριστήρες', order: 28, active: true },
  { id: 'clutch_fluid', label: 'Υγρό Συμπλέκτη', order: 29, active: true },
  { id: 'brake_fluid', label: 'Υγρό Φρένων', order: 30, active: true },
  { id: 'transmission_fluid', label: 'Υγρό κιβωτίου ταχυτήτων', order: 31, active: true },
  { id: 'cabin_air_filter', label: 'Φίλτρο Αέρα Καμπίνας', order: 32, active: true },
  { id: 'fuel_filter', label: 'Φίλτρο Καυσίμου', order: 33, active: true },
  { id: 'oil_filter', label: 'Φίλτρο Λαδίου', order: 34, active: true },
  { id: 'air_filter', label: 'Φίλτρο αέρα', order: 35, active: true },
  { id: 'lights', label: 'Φώτα', order: 36, active: true }
];

// Cars Data (default fleet)
const cars = [
  {
    color: 'Άσπρο',
    make: 'KIA',
    model: 'Ceed',
    licensePlate: 'NIP 8893',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    active: true
  },
  {
    color: 'Ασπρο',
    make: 'Toyota',
    model: 'Yaris',
    licensePlate: 'NIY 2531',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    active: true
  },
  {
    color: 'Άσπρο',
    make: 'Peugeot',
    model: '208',
    licensePlate: 'XZM 3308',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    active: true
  },
  {
    color: 'Μαύρο',
    make: 'VW',
    model: 'Tiguan',
    licensePlate: 'NIB 6398',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    active: true
  },
  {
    color: 'Φορτηγάκι',
    make: 'VW',
    model: 'Caddy',
    licensePlate: 'NHT 7168',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    active: true
  }
];

async function initializeFuelTypes() {
  console.log('🚗 Initializing Fuel Types...');
  const batch = db.batch();
  
  for (const fuelType of fuelTypes) {
    const docRef = db.collection('fuelTypes').doc(fuelType.id);
    batch.set(docRef, fuelType);
  }
  
  await batch.commit();
  console.log('✅ Fuel Types initialized:', fuelTypes.length);
}

async function initializeCarBrands() {
  console.log('🏷️  Initializing Car Brands...');
  const batch = db.batch();
  
  for (const brand of carBrands) {
    const docRef = db.collection('carBrands').doc(brand.id);
    batch.set(docRef, brand);
  }
  
  await batch.commit();
  console.log('✅ Car Brands initialized:', carBrands.length);
}

async function initializeServiceTypes() {
  console.log('🔧 Initializing Service Types...');
  const batch = db.batch();
  
  for (const serviceType of serviceTypes) {
    const docRef = db.collection('serviceTypes').doc(serviceType.id);
    batch.set(docRef, serviceType);
  }
  
  await batch.commit();
  console.log('✅ Service Types initialized:', serviceTypes.length);
}

async function initializeCars() {
  console.log('🚙 Checking Cars collection...');
  
  const carsSnapshot = await db.collection('cars').get();
  
  if (carsSnapshot.empty) {
    console.log('📝 Cars collection is empty. Adding default cars...');
    const batch = db.batch();
    
    for (const car of cars) {
      const docRef = db.collection('cars').doc();
      batch.set(docRef, car);
    }
    
    await batch.commit();
    console.log('✅ Cars initialized:', cars.length);
  } else {
    console.log('✅ Cars collection already has', carsSnapshot.size, 'vehicles');
  }
}

async function main() {
  try {
    console.log('🚀 Starting Firestore Expense Data Initialization...\n');
    
    await initializeCarBrands();
    await initializeFuelTypes();
    await initializeServiceTypes();
    await initializeCars();
    
    console.log('\n🎉 All collections initialized successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing Firestore:', error);
    process.exit(1);
  }
}

main();
