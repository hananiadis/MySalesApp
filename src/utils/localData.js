import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { AVAILABLE_BRANDS, normalizeBrandKey } from '../constants/brands';

// Choose ONE and use everywhere: DocumentDirectoryPath for long-term, CachesDirectoryPath for temp
export const IMAGES_DIR = `${RNFS.DocumentDirectoryPath}/product_images/`;

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

const DEFAULT_BRAND = 'playmobil';
const isKnownBrand = (brand) => AVAILABLE_BRANDS.includes(brand);
const resolveBrandKey = (brand) => {
  const normalized = normalizeBrandKey(brand);
  return isKnownBrand(normalized) ? normalized : DEFAULT_BRAND;
};
const dataKey = (base, brand) => `${base}:${resolveBrandKey(brand)}`;
const actionKey = (base, brand) => `${base}_last_action:${resolveBrandKey(brand)}`;

const LEGACY_KEYS = {
  products: 'products',
  productsAction: 'products_last_action',
  customers: 'customers',
  customersAction: 'customers_last_action',
};
const SUPERMARKET_STORE_KEY = 'supermarket_stores';
const SUPERMARKET_LISTING_KEY = 'supermarket_listings';

// --- PRODUCTS ---
export const saveProductsToLocal = async (products, brand) => {
  const resolvedBrand = resolveBrandKey(brand);
  try {
    const key = dataKey('products', resolvedBrand);
    await AsyncStorage.setItem(key, JSON.stringify(products));
    await AsyncStorage.setItem(actionKey('products', resolvedBrand), `updated on ${formatNow()}`);
    if (resolvedBrand === DEFAULT_BRAND) {
      await AsyncStorage.setItem(LEGACY_KEYS.products, JSON.stringify(products));
      await AsyncStorage.setItem(LEGACY_KEYS.productsAction, `updated on ${formatNow()}`);
    }
  } catch (e) {
    console.error('Saving products failed', e);
  }
};

export const clearProductsLocal = async (brand) => {
  const resolvedBrand = resolveBrandKey(brand);
  try {
    await AsyncStorage.removeItem(dataKey('products', resolvedBrand));
    await AsyncStorage.setItem(actionKey('products', resolvedBrand), `deleted on ${formatNow()}`);
    if (resolvedBrand === DEFAULT_BRAND) {
      await AsyncStorage.removeItem(LEGACY_KEYS.products);
      await AsyncStorage.setItem(LEGACY_KEYS.productsAction, `deleted on ${formatNow()}`);
    }
  } catch (e) {
    console.error('Clearing products failed', e);
  }
};

export const getProductsFromLocal = async (brand) => {
  const resolvedBrand = resolveBrandKey(brand);
  try {
    const json = await AsyncStorage.getItem(dataKey('products', resolvedBrand));
    if (json != null) return JSON.parse(json);
    if (resolvedBrand === DEFAULT_BRAND) {
      const legacy = await AsyncStorage.getItem(LEGACY_KEYS.products);
      return legacy != null ? JSON.parse(legacy) : [];
    }
    return [];
  } catch (e) {
    console.error('Reading products failed', e);
    return [];
  }
};

export const getProductsLastAction = async (brand) => {
  const resolvedBrand = resolveBrandKey(brand);
  try {
    const scoped = await AsyncStorage.getItem(actionKey('products', resolvedBrand));
    if (scoped) return scoped;
    if (resolvedBrand === DEFAULT_BRAND) {
      const legacy = await AsyncStorage.getItem(LEGACY_KEYS.productsAction);
      return legacy || 'No actions yet';
    }
    return 'No actions yet';
  } catch {
    return 'No actions yet';
  }
};

// --- CUSTOMERS ---
export const saveCustomersToLocal = async (customers, brand) => {
  const resolvedBrand = resolveBrandKey(brand);
  try {
    await AsyncStorage.setItem(dataKey('customers', resolvedBrand), JSON.stringify(customers));
    await AsyncStorage.setItem(actionKey('customers', resolvedBrand), `updated on ${formatNow()}`);
    if (resolvedBrand === DEFAULT_BRAND) {
      await AsyncStorage.setItem(LEGACY_KEYS.customers, JSON.stringify(customers));
      await AsyncStorage.setItem(LEGACY_KEYS.customersAction, `updated on ${formatNow()}`);
    }
  } catch (e) {
    console.error('Saving customers failed', e);
  }
};

export const clearCustomersLocal = async (brand) => {
  const resolvedBrand = resolveBrandKey(brand);
  try {
    await AsyncStorage.removeItem(dataKey('customers', resolvedBrand));
    await AsyncStorage.setItem(actionKey('customers', resolvedBrand), `deleted on ${formatNow()}`);
    if (resolvedBrand === DEFAULT_BRAND) {
      await AsyncStorage.removeItem(LEGACY_KEYS.customers);
      await AsyncStorage.setItem(LEGACY_KEYS.customersAction, `deleted on ${formatNow()}`);
    }
  } catch (e) {
    console.error('Clearing customers failed', e);
  }
};

export const getCustomersFromLocal = async (brand) => {
  const resolvedBrand = resolveBrandKey(brand);
  try {
    const json = await AsyncStorage.getItem(dataKey('customers', resolvedBrand));
    if (json != null) return JSON.parse(json);
    if (resolvedBrand === DEFAULT_BRAND) {
      const legacy = await AsyncStorage.getItem(LEGACY_KEYS.customers);
      return legacy != null ? JSON.parse(legacy) : [];
    }
    return [];
  } catch (e) {
    console.error('Reading customers failed', e);
    return [];
  }
};

export const getCustomersLastAction = async (brand) => {
  const resolvedBrand = resolveBrandKey(brand);
  try {
    const scoped = await AsyncStorage.getItem(actionKey('customers', resolvedBrand));
    if (scoped) return scoped;
    if (resolvedBrand === DEFAULT_BRAND) {
      const legacy = await AsyncStorage.getItem(LEGACY_KEYS.customersAction);
      return legacy || 'No actions yet';
    }
    return 'No actions yet';
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

// Ensure directory exists (can be imported from imageHelpers.js to avoid duplication)
const ensureDirExists = async () => {
  try {
    const exists = await RNFS.exists(IMAGES_DIR);
    if (!exists) await RNFS.mkdir(IMAGES_DIR);
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
      const filePath = IMAGES_DIR + fileName;
      try {
        // Always overwrite for freshness
        if (await RNFS.exists(filePath)) await RNFS.unlink(filePath);
        const downloadResult = await RNFS.downloadFile({ fromUrl: imgUri, toFile: filePath }).promise;
        if (downloadResult.statusCode === 200) count++;
      } catch (e) {
        // Could not download, ignore/log if you want
        // console.warn(`Image failed for ${prod.productCode}:`, e);
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
  return `file://${IMAGES_DIR}${productCode}.jpg`;
}

// --- SUPERMARKET STORES ---
export const saveSuperMarketStoresToLocal = async (stores, brand) => {
  const resolvedBrand = resolveBrandKey(brand);
  const key = dataKey(`${SUPERMARKET_STORE_KEY}`, resolvedBrand);
  const lastActionKey = actionKey(`${SUPERMARKET_STORE_KEY}`, resolvedBrand);
  try {
    await AsyncStorage.setItem(key, JSON.stringify(stores));
    await AsyncStorage.setItem(lastActionKey, `updated on ${formatNow()}`);
  } catch (e) {
    console.error('Saving supermarket stores failed', e);
  }
};

export const clearSuperMarketStoresLocal = async (brand) => {
  const resolvedBrand = resolveBrandKey(brand);
  const key = dataKey(`${SUPERMARKET_STORE_KEY}`, resolvedBrand);
  const lastActionKey = actionKey(`${SUPERMARKET_STORE_KEY}`, resolvedBrand);
  try {
    await AsyncStorage.removeItem(key);
    await AsyncStorage.setItem(lastActionKey, `deleted on ${formatNow()}`);
  } catch (e) {
    console.error('Clearing supermarket stores failed', e);
  }
};

export const getSuperMarketStoresLastAction = async (brand) => {
  const resolvedBrand = resolveBrandKey(brand);
  try {
    const scoped = await AsyncStorage.getItem(actionKey(`${SUPERMARKET_STORE_KEY}`, resolvedBrand));
    return scoped || 'No actions yet';
  } catch {
    return 'No actions yet';
  }
};

// --- SUPERMARKET LISTINGS ---
export const saveSuperMarketListingsToLocal = async (listings, brand) => {
  const resolvedBrand = resolveBrandKey(brand);
  const key = dataKey(`${SUPERMARKET_LISTING_KEY}`, resolvedBrand);
  const lastActionKey = actionKey(`${SUPERMARKET_LISTING_KEY}`, resolvedBrand);
  try {
    await AsyncStorage.setItem(key, JSON.stringify(listings));
    await AsyncStorage.setItem(lastActionKey, `updated on ${formatNow()}`);
  } catch (e) {
    console.error('Saving supermarket listings failed', e);
  }
};

export const clearSuperMarketListingsLocal = async (brand) => {
  const resolvedBrand = resolveBrandKey(brand);
  const key = dataKey(`${SUPERMARKET_LISTING_KEY}`, resolvedBrand);
  const lastActionKey = actionKey(`${SUPERMARKET_LISTING_KEY}`, resolvedBrand);
  try {
    await AsyncStorage.removeItem(key);
    await AsyncStorage.setItem(lastActionKey, `deleted on ${formatNow()}`);
  } catch (e) {
    console.error('Clearing supermarket listings failed', e);
  }
};

export const getSuperMarketListingsLastAction = async (brand) => {
  const resolvedBrand = resolveBrandKey(brand);
  try {
    const scoped = await AsyncStorage.getItem(actionKey(`${SUPERMARKET_LISTING_KEY}`, resolvedBrand));
    return scoped || 'No actions yet';
  } catch {
    return 'No actions yet';
  }
};
