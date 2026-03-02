import firestore from '@react-native-firebase/firestore';

const carBrandsCollectionRef = () => firestore().collection('carBrands');

/**
 * Get all car brands from Firestore
 */
export const getCarBrands = async () => {
  try {
    const snapshot = await carBrandsCollectionRef().where('active', '==', true).get();
    const brands = {};
    snapshot.forEach((doc) => {
      brands[doc.data().name.toLowerCase()] = doc.data();
    });
    return brands;
  } catch (error) {
    console.error('❌ Error fetching car brands:', error);
    return {};
  }
};

/**
 * Get specific brand by name
 */
export const getCarBrandByName = async (brandName) => {
  try {
    const snapshot = await carBrandsCollectionRef()
      .where('name', '==', brandName)
      .where('active', '==', true)
      .get();
    
    if (!snapshot.empty) {
      return snapshot.docs[0].data();
    }
    return null;
  } catch (error) {
    console.error('❌ Error fetching car brand:', error);
    return null;
  }
};
