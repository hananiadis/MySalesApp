import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache keys
const CARS_CACHE_KEY = 'cars_list_cache';

// Firestore collection reference
const carsCollectionRef = () => firestore().collection('cars');

/**
 * Initialize default cars if collection is empty
 */
export const initializeDefaultCars = async () => {
  try {
    const snapshot = await carsCollectionRef().get();
    
    if (snapshot.empty) {
      const defaultCars = [
        {
          color: 'Άσπρο',
          make: 'KIA',
          model: 'Ceed',
          licensePlate: 'NIP 8893',
          createdAt: new Date(),
          active: true
        },
        {
          color: 'Ασπρο',
          make: 'Toyota',
          model: 'Yaris',
          licensePlate: 'NIY 2531',
          createdAt: new Date(),
          active: true
        },
        {
          color: 'Άσπρο',
          make: 'Peugeot',
          model: '208',
          licensePlate: 'XZM 3308',
          createdAt: new Date(),
          active: true
        },
        {
          color: 'Μαύρο',
          make: 'VW',
          model: 'Tiguan',
          licensePlate: 'NIB 6398',
          createdAt: new Date(),
          active: true
        },
        {
          color: 'Φορτηγάκι',
          make: 'VW',
          model: 'Caddy',
          licensePlate: 'NHT 7168',
          createdAt: new Date(),
          active: true
        }
      ];

      const batch = firestore().batch();
      defaultCars.forEach((car) => {
        const docRef = carsCollectionRef().doc();
        batch.set(docRef, car);
      });
      
      await batch.commit();
      console.log('✅ [carsService] Default cars initialized');
    }
  } catch (error) {
    console.error('❌ [carsService] Error initializing default cars:', error);
  }
};

/**
 * Get all cars from Firestore
 */
export const getAllCars = async () => {
  try {
    const snapshot = await carsCollectionRef().where('active', '==', true).get();
    const cars = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Cache the cars
    await AsyncStorage.setItem(CARS_CACHE_KEY, JSON.stringify(cars));
    
    return cars;
  } catch (error) {
    console.error('❌ [carsService] Error getting cars:', error);
    // Try to return cached data
    try {
      const cached = await AsyncStorage.getItem(CARS_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  }
};

/**
 * Get cached cars (for offline support)
 */
export const getCachedCars = async () => {
  try {
    const cached = await AsyncStorage.getItem(CARS_CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch (error) {
    console.error('❌ [carsService] Error getting cached cars:', error);
    return [];
  }
};

/**
 * Add a new car
 */
export const addCar = async (carData) => {
  try {
    const newCar = {
      color: carData.color,
      make: carData.make,
      model: carData.model,
      licensePlate: carData.licensePlate,
      createdAt: new Date(),
      active: true
    };

    const docRef = await carsCollectionRef().add(newCar);
    console.log('✅ [carsService] Car added:', docRef.id);
    
    // Refresh cache
    await getAllCars();
    
    return { id: docRef.id, ...newCar };
  } catch (error) {
    console.error('❌ [carsService] Error adding car:', error);
    throw error;
  }
};

/**
 * Update a car
 */
export const updateCar = async (carId, carData) => {
  try {
    await carsCollectionRef().doc(carId).update(carData);
    console.log('✅ [carsService] Car updated:', carId);
    
    // Refresh cache
    await getAllCars();
  } catch (error) {
    console.error('❌ [carsService] Error updating car:', error);
    throw error;
  }
};

/**
 * Delete a car (soft delete - mark as inactive)
 */
export const deleteCar = async (carId) => {
  try {
    await carsCollectionRef().doc(carId).update({ active: false });
    console.log('✅ [carsService] Car deleted:', carId);
    
    // Refresh cache
    await getAllCars();
  } catch (error) {
    console.error('❌ [carsService] Error deleting car:', error);
    throw error;
  }
};

/**
 * Get car by license plate
 */
export const getCarByLicensePlate = async (licensePlate) => {
  try {
    const snapshot = await carsCollectionRef()
      .where('licensePlate', '==', licensePlate)
      .where('active', '==', true)
      .get();
    
    if (snapshot.empty) return null;
    
    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data()
    };
  } catch (error) {
    console.error('❌ [carsService] Error getting car by license plate:', error);
    return null;
  }
};

/**
 * Get fuel history for a car (for cost/km calculation)
 */
export const getCarFuelHistory = async (carId, limit = 5) => {
  try {
    // This will be populated by expense records with category = 'fuel' and the carId
    // For now, return empty array
    return [];
  } catch (error) {
    console.error('❌ [carsService] Error getting car fuel history:', error);
    return [];
  }
};
