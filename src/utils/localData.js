import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';

export const IMAGES_DIR = `${RNFS.DocumentDirectoryPath}/product_images`;

// Format date for user-friendly logs
const formatNow = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    pad(now.getDate()) + '/' +
    pad(now.getMonth() + 1) + '/' +
    now.getFullYear() + ' ' +
    pad(now.getHours()) + ':' +
    pad(now.getMinutes())
  );
};

// --- PRODUCTS ---
export const saveProductsToLocal = async (products) => {
  try {
    await AsyncStorage.setItem('products', JSON.stringify(products));
    await AsyncStorage.setItem('products_last_action', `updated on ${formatNow()}`);
  } catch (e) {
    console.error('Saving products failed', e);
  }
};

export const clearProductsLocal = async () => {
  try {
    await AsyncStorage.removeItem('products');
    await AsyncStorage.setItem('products_last_action', `deleted on ${formatNow()}`);
  } catch (e) {
    console.error('Clearing products failed', e);
  }
};

export const getProductsFromLocal = async () => {
  try {
    const json = await AsyncStorage.getItem('products');
    return json != null ? JSON.parse(json) : [];
  } catch (e) {
    console.error('Reading products failed', e);
    return [];
  }
};

export const getProductsLastAction = async () => {
  try {
    const val = await AsyncStorage.getItem('products_last_action');
    return val || 'No actions yet';
  } catch {
    return 'No actions yet';
  }
};

// --- CUSTOMERS ---
export const saveCustomersToLocal = async (customers) => {
  try {
    await AsyncStorage.setItem('customers', JSON.stringify(customers));
    await AsyncStorage.setItem('customers_last_action', `updated on ${formatNow()}`);
  } catch (e) {
    console.error('Saving customers failed', e);
  }
};

export const clearCustomersLocal = async () => {
  try {
    await AsyncStorage.removeItem('customers');
    await AsyncStorage.setItem('customers_last_action', `deleted on ${formatNow()}`);
  } catch (e) {
    console.error('Clearing customers failed', e);
  }
};

export const getCustomersFromLocal = async () => {
  try {
    const json = await AsyncStorage.getItem('customers');
    return json != null ? JSON.parse(json) : [];
  } catch (e) {
    console.error('Reading customers failed', e);
    return [];
  }
};

export const getCustomersLastAction = async () => {
  try {
    const val = await AsyncStorage.getItem('customers_last_action');
    return val || 'No actions yet';
  } catch {
    return 'No actions yet';
  }
};

// --- IMAGE CACHING (with RNFS) ---
export async function setImagesLastAction(val) {
  await AsyncStorage.setItem('images_last_action', val);
}

export async function getImagesLastAction() {
  try {
    const val = await AsyncStorage.getItem('images_last_action');
    return val || 'No actions yet';
  } catch {
    return 'No actions yet';
  }
}

const ensureDirExists = async () => {
  try {
    const exists = await RNFS.exists(IMAGES_DIR);
    if (!exists) {
      await RNFS.mkdir(IMAGES_DIR);
    }
  } catch (e) {
    // Optional: log error
  }
};

// Save/download product images locally (from array of products)
export async function cacheProductImages(products) {
  await ensureDirExists();
  let count = 0;
  for (const prod of products) {
    if (prod.frontCover && prod.productCode) {
      const imgUri = prod.frontCover;
      const fileName = `${prod.productCode}.jpg`;
      const filePath = `${IMAGES_DIR}/${fileName}`;
      try {
        if (await RNFS.exists(filePath)) await RNFS.unlink(filePath);
        const downloadResult = await RNFS.downloadFile({ fromUrl: imgUri, toFile: filePath }).promise;
        if (downloadResult.statusCode === 200) count++;
      } catch (e) {
        // Could not download, ignore/log if needed
      }
    }
  }
  await setImagesLastAction(`updated on ${formatNow()}`);
  return count;
}

// Delete all cached product images
export async function clearProductImagesCache() {
  try {
    const exists = await RNFS.exists(IMAGES_DIR);
    if (exists) await RNFS.unlink(IMAGES_DIR);
  } catch (e) {
    // ignore
  }
  await setImagesLastAction(`deleted on ${formatNow()}`);
}

// Helper to get a local image file path (use for <Image source={{uri: ...}}/>)
export function getLocalProductImage(productCode) {
  return `file://${IMAGES_DIR}/${productCode}.jpg`;
}
