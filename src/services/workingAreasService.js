import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache keys
const WORKING_AREAS_CACHE_KEY = 'working_areas_cache';

// Firestore collection reference
const workingAreasCollectionRef = () => firestore().collection('WorkingAreas');

/**
 * Get all working areas from Firestore
 */
export const getAllWorkingAreas = async () => {
  try {
    const snapshot = await workingAreasCollectionRef().get();
    const areas = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Cache the areas
    await AsyncStorage.setItem(WORKING_AREAS_CACHE_KEY, JSON.stringify(areas));
    
    return areas;
  } catch (error) {
    console.error('❌ [workingAreasService] Error getting working areas:', error);
    // Try to return cached data
    try {
      const cached = await AsyncStorage.getItem(WORKING_AREAS_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  }
};

/**
 * Get cached working areas (for offline support)
 */
export const getCachedWorkingAreas = async () => {
  try {
    const cached = await AsyncStorage.getItem(WORKING_AREAS_CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch (error) {
    console.error('❌ [workingAreasService] Error getting cached working areas:', error);
    return [];
  }
};

/**
 * Get working areas for a specific salesman on a specific day
 * @param {string} salesmanId - The salesman ID
 * @param {string} dayId - The day ID (monday, tuesday, etc.)
 */
export const getWorkingAreasForSalesmanDay = async (salesmanId, dayId) => {
  try {
    // This will be linked to salesman scheduling data
    // For now, return empty array
    return [];
  } catch (error) {
    console.error('❌ [workingAreasService] Error getting working areas for salesman day:', error);
    return [];
  }
};

/**
 * Filter working areas by search term
 * @param {string} searchTerm - The search term
 * @param {Array} areas - The areas to filter
 */
export const filterWorkingAreas = (searchTerm, areas) => {
  if (!searchTerm || searchTerm.trim() === '') {
    return areas;
  }
  
  const lowerTerm = searchTerm.toLowerCase();
  return areas.filter(area => {
    const areaName = (area.name || '').toLowerCase();
    const areaCity = (area.city || '').toLowerCase();
    const areaRegion = (area.region || '').toLowerCase();
    
    return areaName.includes(lowerTerm) || 
           areaCity.includes(lowerTerm) || 
           areaRegion.includes(lowerTerm);
  });
};

/**
 * Format working area for display
 * @param {Object} area - The working area
 */
export const formatWorkingArea = (area) => {
  if (!area) return '';
  
  const parts = [area.name];
  if (area.city) parts.push(area.city);
  if (area.region) parts.push(area.region);
  
  return parts.join(', ');
};
