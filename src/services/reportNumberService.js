import firestore from '@react-native-firebase/firestore';

// Report number counter collection
const reportCountersRef = () => firestore().collection('reportCounters');

// Salesman letter mapping (A, B, C, etc.)
const SALESMAN_LETTERS = {
  'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D', 'E': 'E', 'F': 'F', 'G': 'G', 'H': 'H', 'I': 'I', 'J': 'J',
  'K': 'K', 'L': 'L', 'M': 'M', 'N': 'N', 'O': 'O', 'P': 'P', 'Q': 'Q', 'R': 'R', 'S': 'S', 'T': 'T',
  'U': 'U', 'V': 'V', 'W': 'W', 'X': 'X', 'Y': 'Y', 'Z': 'Z'
};

const AVAILABLE_LETTERS = Object.values(SALESMAN_LETTERS);

/**
 * Get or create a report number for a salesman in a given year
 * @param {string} salesmanId - The salesman ID
 * @param {number} year - The year (e.g., 2026)
 * @returns {Promise<string>} Report number (e.g., "A1", "A2", "B1")
 */
export const getReportNumber = async (salesmanId, year = new Date().getFullYear()) => {
  try {
    const counterId = `${salesmanId}_${year}`;
    const counterRef = reportCountersRef().doc(counterId);
    
    let reportData = null;
    
    await firestore().runTransaction(async (transaction) => {
      const doc = await transaction.get(counterRef);
      
      if (!doc.exists) {
        // First report for this salesman this year
        const letterIndex = salesmanId.charCodeAt(0) % AVAILABLE_LETTERS.length;
        const letter = AVAILABLE_LETTERS[letterIndex];
        
        transaction.set(counterRef, {
          salesmanId,
          year,
          count: 1,
          letter,
          createdAt: new Date(),
          lastUpdated: new Date()
        });
        
        reportData = {
          number: `${letter}1`,
          letter,
          count: 1
        };
      } else {
        const data = doc.data();
        const newCount = data.count + 1;
        
        transaction.update(counterRef, {
          count: newCount,
          lastUpdated: new Date()
        });
        
        reportData = {
          number: `${data.letter}${newCount}`,
          letter: data.letter,
          count: newCount
        };
      }
    });
    
    return reportData;
  } catch (error) {
    console.error('❌ [reportNumberService] Error getting report number:', error);
    throw error;
  }
};

/**
 * Get the last report number for a salesman in a given year
 * @param {string} salesmanId - The salesman ID
 * @param {number} year - The year (e.g., 2026)
 */
export const getLastReportNumber = async (salesmanId, year = new Date().getFullYear()) => {
  try {
    const counterId = `${salesmanId}_${year}`;
    const doc = await reportCountersRef().doc(counterId).get();
    
    if (!doc.exists) {
      return null;
    }
    
    const data = doc.data();
    return {
      number: `${data.letter}${data.count}`,
      letter: data.letter,
      count: data.count
    };
  } catch (error) {
    console.error('❌ [reportNumberService] Error getting last report number:', error);
    return null;
  }
};

/**
 * Assign a letter to a salesman
 * @param {string} salesmanId - The salesman ID
 * @param {string} letter - The letter to assign (A-Z)
 */
export const assignSalesmanLetter = async (salesmanId, letter) => {
  try {
    if (!AVAILABLE_LETTERS.includes(letter.toUpperCase())) {
      throw new Error('Invalid letter. Must be A-Z');
    }
    
    const currentYear = new Date().getFullYear();
    const counterId = `${salesmanId}_${currentYear}`;
    
    await reportCountersRef().doc(counterId).set({
      salesmanId,
      year: currentYear,
      letter: letter.toUpperCase(),
      count: 0,
      createdAt: new Date(),
      lastUpdated: new Date()
    }, { merge: true });
    
    console.log('✅ [reportNumberService] Salesman letter assigned:', letter);
  } catch (error) {
    console.error('❌ [reportNumberService] Error assigning salesman letter:', error);
    throw error;
  }
};

/**
 * Get all report counters for a year
 * @param {number} year - The year (e.g., 2026)
 */
export const getYearReportCounters = async (year = new Date().getFullYear()) => {
  try {
    const snapshot = await reportCountersRef()
      .where('year', '==', year)
      .get();
    
    const counters = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return counters;
  } catch (error) {
    console.error('❌ [reportNumberService] Error getting year report counters:', error);
    return [];
  }
};

/**
 * Reset report numbers for a new year
 * @param {string} salesmanId - The salesman ID (or 'all' for all salesmen)
 * @param {number} newYear - The new year
 */
export const resetReportNumbers = async (salesmanId, newYear) => {
  try {
    const batch = firestore().batch();
    
    if (salesmanId === 'all') {
      // Reset for all salesmen
      const snapshot = await reportCountersRef().where('year', '<', newYear).get();
      
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const newCounterId = `${data.salesmanId}_${newYear}`;
        const newRef = reportCountersRef().doc(newCounterId);
        
        batch.set(newRef, {
          salesmanId: data.salesmanId,
          year: newYear,
          letter: data.letter,
          count: 0,
          createdAt: new Date(),
          lastUpdated: new Date()
        });
      });
    } else {
      // Reset for specific salesman
      const newCounterId = `${salesmanId}_${newYear}`;
      const oldCounterId = `${salesmanId}_${newYear - 1}`;
      const oldDoc = await reportCountersRef().doc(oldCounterId).get();
      
      if (oldDoc.exists) {
        const data = oldDoc.data();
        const newRef = reportCountersRef().doc(newCounterId);
        
        batch.set(newRef, {
          salesmanId,
          year: newYear,
          letter: data.letter,
          count: 0,
          createdAt: new Date(),
          lastUpdated: new Date()
        });
      }
    }
    
    await batch.commit();
    console.log('✅ [reportNumberService] Report numbers reset for year:', newYear);
  } catch (error) {
    console.error('❌ [reportNumberService] Error resetting report numbers:', error);
    throw error;
  }
};
