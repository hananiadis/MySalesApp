import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import RNFS from 'react-native-fs';

import { DEFAULT_BRAND, normalizeBrandKey } from '../constants/brands';

const formatNow = () =>
  new Date().toLocaleString('el-GR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const LEGACY_KEYS = {
  products: 'products',
  productsAction: 'products_last_action',
  customers: 'customers',
  customersAction: 'customers_last_action',
};

const FILE_POINTER_PREFIX = '@@file:';
const LARGE_PAYLOAD_THRESHOLD = 120_000; // ~120 KB JSON string

const resolveBrandKey = (brand) => normalizeBrandKey(brand ?? DEFAULT_BRAND);
const dataKey = (type, brand) => `${type}:${brand}`;
const actionKey = (type, brand) => `${type}_last_action:${brand}`;

const STORAGE_ROOT = (() => {
  const root = FileSystem.documentDirectory || FileSystem.cacheDirectory;
  if (!root) {
    return null;
  }
  return `${root.replace(/\/?$/, '/') }local-data/`;
})();

const ensureDirAsync = async (dir) => {
  if (!dir) return;
  try {
    const info = await FileSystem.getInfoAsync(dir);
    if (info.exists && info.isDirectory) {
      return;
    }
  } catch (error) {
    // ignore
  }
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch (error) {
    // ignore
  }
};

const filePathFor = (type, brand) => {
  if (!STORAGE_ROOT) {
    return null;
  }
  return `${STORAGE_ROOT}${type}/${brand}.json`;
};

const writeJsonFile = async (type, brand, json) => {
  const path = filePathFor(type, brand);
  if (!path) return null;
  const dir = path.slice(0, path.lastIndexOf('/') + 1);
  await ensureDirAsync(dir);
  await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
  return path;
};

const readJsonFile = async (type, brand, overridePath) => {
  const path = overridePath || filePathFor(type, brand);
  if (!path) return null;
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    return await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.UTF8 });
  } catch (error) {
    return null;
  }
};

const removeJsonFile = async (type, brand, overridePath) => {
  const path = overridePath || filePathFor(type, brand);
  if (!path) return;
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      await FileSystem.deleteAsync(path, { idempotent: true });
    }
  } catch (error) {
    // ignore
  }
};

const clearItemOnly = async (key) => {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    // ignore
  }
};

const pruneExisting = async (key, type, brand) => {
  try {
    const current = await AsyncStorage.getItem(key);
    if (current && current.startsWith(FILE_POINTER_PREFIX)) {
      const pointer = current.slice(FILE_POINTER_PREFIX.length);
      await removeJsonFile(type, brand, pointer);
    }
  } catch (error) {
    // ignore
  }
  await clearItemOnly(key);
};

const storePointerReference = async (key, pointerPath) => {
  if (!pointerPath) return;
  try {
    await clearItemOnly(key);
    await AsyncStorage.setItem(key, `${FILE_POINTER_PREFIX}${pointerPath}`);
  } catch (error) {
    // ignore
  }
};

const storePayload = async (key, type, brand, payload) => {
  const safePayload = Array.isArray(payload) ? payload : [];
  const json = JSON.stringify(safePayload);

  const writeAsFile = async () => {
    if (!STORAGE_ROOT) return null;
    await pruneExisting(key, type, brand);
    const filePath = await writeJsonFile(type, brand, json);
    if (!filePath) return null;
    await AsyncStorage.setItem(key, `${FILE_POINTER_PREFIX}${filePath}`);
    return { strategy: 'file', pointer: filePath };
  };

  if (json.length > LARGE_PAYLOAD_THRESHOLD && STORAGE_ROOT) {
    try {
      const fileResult = await writeAsFile();
      if (fileResult) {
        return fileResult;
      }
    } catch (error) {
      // fall back to inline storage attempt
    }
  }

  await pruneExisting(key, type, brand);

  try {
    await AsyncStorage.setItem(key, json);
    await removeJsonFile(type, brand);
    return { strategy: 'inline' };
  } catch (error) {
    try {
      const fallback = await writeAsFile();
      if (fallback) {
        return fallback;
      }
    } catch (err) {
      // ignore and rethrow original error
    }
    throw error;
  }
};

const readPayload = async (key, type, brand) => {
  const raw = await AsyncStorage.getItem(key);
  let json = null;

  if (raw && raw.startsWith(FILE_POINTER_PREFIX)) {
    json = await readJsonFile(type, brand, raw.slice(FILE_POINTER_PREFIX.length));
  } else if (raw) {
    json = raw;
  } else {
    json = await readJsonFile(type, brand);
  }

  if (!json) return null;

  try {
    return JSON.parse(json);
  } catch (error) {
    return null;
  }
};

const clearPayload = async (key, type, brand) => {
  await pruneExisting(key, type, brand);
};

const setActionState = async (type, brand, state) => {
  await AsyncStorage.setItem(actionKey(type, brand), `${state} on ${formatNow()}`);
};

const legacySetAction = async (key) => {
  await AsyncStorage.setItem(key, `updated on ${formatNow()}`);
};

const readActionState = async (type, brand, legacyKey) => {
  try {
    const scoped = await AsyncStorage.getItem(actionKey(type, brand));
    if (scoped) return scoped;
    if (brand === DEFAULT_BRAND && legacyKey) {
      const legacy = await AsyncStorage.getItem(legacyKey);
      if (legacy) return legacy;
    }
  } catch (error) {
    // ignore
  }
  return 'No actions yet';
};

export async function saveProductsToLocal(products, brand) {
  const resolvedBrand = resolveBrandKey(brand);
  const key = dataKey('products', resolvedBrand);
  const result = await storePayload(key, 'products', resolvedBrand, products);
  await setActionState('products', resolvedBrand, 'updated');

  if (resolvedBrand === DEFAULT_BRAND) {
    if (result?.strategy === 'file' && result.pointer) {
      await storePointerReference(LEGACY_KEYS.products, result.pointer);
    } else {
      await storePayload(LEGACY_KEYS.products, 'legacy_products', resolvedBrand, products);
    }
    await legacySetAction(LEGACY_KEYS.productsAction);
  }
}

export async function getProductsFromLocal(brand) {
  const resolvedBrand = resolveBrandKey(brand);
  const payload = await readPayload(dataKey('products', resolvedBrand), 'products', resolvedBrand);
  if (payload) return payload;

  if (resolvedBrand === DEFAULT_BRAND) {
    const legacy = await readPayload(LEGACY_KEYS.products, 'legacy_products', resolvedBrand);
    return legacy || [];
  }
  return [];
}

export async function clearProductsLocal(brand) {
  const resolvedBrand = resolveBrandKey(brand);
  const key = dataKey('products', resolvedBrand);
  await clearPayload(key, 'products', resolvedBrand);
  await setActionState('products', resolvedBrand, 'deleted');

  if (resolvedBrand === DEFAULT_BRAND) {
    await clearPayload(LEGACY_KEYS.products, 'legacy_products', resolvedBrand);
    await AsyncStorage.setItem(LEGACY_KEYS.productsAction, `deleted on ${formatNow()}`);
  }
}

export async function getProductsLastAction(brand) {
  const resolvedBrand = resolveBrandKey(brand);
  return readActionState('products', resolvedBrand, LEGACY_KEYS.productsAction);
}

export async function saveCustomersToLocal(customers, brand) {
  const resolvedBrand = resolveBrandKey(brand);
  const key = dataKey('customers', resolvedBrand);
  const result = await storePayload(key, 'customers', resolvedBrand, customers);
  await setActionState('customers', resolvedBrand, 'updated');

  if (resolvedBrand === DEFAULT_BRAND) {
    if (result?.strategy === 'file' && result.pointer) {
      await storePointerReference(LEGACY_KEYS.customers, result.pointer);
    } else {
      await storePayload(LEGACY_KEYS.customers, 'legacy_customers', resolvedBrand, customers);
    }
    await legacySetAction(LEGACY_KEYS.customersAction);
  }
}

export async function getCustomersFromLocal(brand) {
  const resolvedBrand = resolveBrandKey(brand);
  const payload = await readPayload(dataKey('customers', resolvedBrand), 'customers', resolvedBrand);
  if (payload) return payload;

  if (resolvedBrand === DEFAULT_BRAND) {
    const legacy = await readPayload(LEGACY_KEYS.customers, 'legacy_customers', resolvedBrand);
    return legacy || [];
  }
  return [];
}

export async function clearCustomersLocal(brand) {
  const resolvedBrand = resolveBrandKey(brand);
  const key = dataKey('customers', resolvedBrand);
  await clearPayload(key, 'customers', resolvedBrand);
  await setActionState('customers', resolvedBrand, 'deleted');

  if (resolvedBrand === DEFAULT_BRAND) {
    await clearPayload(LEGACY_KEYS.customers, 'legacy_customers', resolvedBrand);
    await AsyncStorage.setItem(LEGACY_KEYS.customersAction, `deleted on ${formatNow()}`);
  }
}

export async function getCustomersLastAction(brand) {
  const resolvedBrand = resolveBrandKey(brand);
  return readActionState('customers', resolvedBrand, LEGACY_KEYS.customersAction);
}

export async function saveSuperMarketStoresToLocal(stores, brand) {
  const resolvedBrand = resolveBrandKey(brand);
  await storePayload(dataKey('supermarket_stores', resolvedBrand), 'supermarket_stores', resolvedBrand, stores);
  await setActionState('supermarket_stores', resolvedBrand, 'updated');
}

export async function getSuperMarketStoresFromLocal(brand) {
  const resolvedBrand = resolveBrandKey(brand);
  const payload = await readPayload(dataKey('supermarket_stores', resolvedBrand), 'supermarket_stores', resolvedBrand);
  return payload || [];
}

export async function clearSuperMarketStoresLocal(brand) {
  const resolvedBrand = resolveBrandKey(brand);
  await clearPayload(dataKey('supermarket_stores', resolvedBrand), 'supermarket_stores', resolvedBrand);
  await setActionState('supermarket_stores', resolvedBrand, 'deleted');
}

export async function getSuperMarketStoresLastAction(brand) {
  const resolvedBrand = resolveBrandKey(brand);
  return readActionState('supermarket_stores', resolvedBrand);
}

export async function saveSuperMarketListingsToLocal(listings, brand) {
  const resolvedBrand = resolveBrandKey(brand);
  await storePayload(dataKey('supermarket_listings', resolvedBrand), 'supermarket_listings', resolvedBrand, listings);
  await setActionState('supermarket_listings', resolvedBrand, 'updated');
}

export async function getSuperMarketListingsFromLocal(brand) {
  const resolvedBrand = resolveBrandKey(brand);
  const payload = await readPayload(dataKey('supermarket_listings', resolvedBrand), 'supermarket_listings', resolvedBrand);
  return payload || [];
}

export async function clearSuperMarketListingsLocal(brand) {
  const resolvedBrand = resolveBrandKey(brand);
  await clearPayload(dataKey('supermarket_listings', resolvedBrand), 'supermarket_listings', resolvedBrand);
  await setActionState('supermarket_listings', resolvedBrand, 'deleted');
}

export async function getSuperMarketListingsLastAction(brand) {
  const resolvedBrand = resolveBrandKey(brand);
  return readActionState('supermarket_listings', resolvedBrand);
}

export async function saveSuperMarketListingImagesLastAction(brand) {
  const resolvedBrand = resolveBrandKey(brand);
  await setActionState('supermarket_listing_images', resolvedBrand, 'updated');
}

export async function getSuperMarketListingImagesLastAction(brand) {
  const resolvedBrand = resolveBrandKey(brand);
  return readActionState('supermarket_listing_images', resolvedBrand);
}

export async function saveImagesLastAction() {
  await AsyncStorage.setItem('images_last_action', `updated on ${formatNow()}`);
}

export async function getImagesLastAction() {
  try {
    const val = await AsyncStorage.getItem('images_last_action');
    return val || 'No actions yet';
  } catch (error) {
    return 'No actions yet';
  }
}

export const IMAGES_DIR = `${RNFS.DocumentDirectoryPath}/product_images/`;

const ensureImagesDir = async () => {
  try {
    const exists = await RNFS.exists(IMAGES_DIR);
    if (!exists) {
      await RNFS.mkdir(IMAGES_DIR);
    }
  } catch (error) {
    // ignore
  }
};

export async function cacheProductImages(products) {
  await ensureImagesDir();
  let count = 0;
  for (const prod of products || []) {
    if (prod?.frontCover && prod?.productCode) {
      const fileName = `${prod.productCode}.jpg`;
      const filePath = `${IMAGES_DIR}${fileName}`;
      try {
        if (await RNFS.exists(filePath)) {
          await RNFS.unlink(filePath);
        }
        const result = await RNFS.downloadFile({ fromUrl: prod.frontCover, toFile: filePath }).promise;
        if (result.statusCode === 200) {
          count += 1;
        }
      } catch (error) {
        // ignore download failures
      }
    }
  }
  await AsyncStorage.setItem('images_last_action', `updated on ${formatNow()}`);
  return count;
}

export async function clearProductImagesCache() {
  try {
    const exists = await RNFS.exists(IMAGES_DIR);
    if (exists) {
      await RNFS.unlink(IMAGES_DIR);
    }
  } catch (error) {
    // ignore
  }
  await AsyncStorage.setItem('images_last_action', `deleted on ${formatNow()}`);
}

export function getLocalProductImage(productCode) {
  return `file://${IMAGES_DIR}${productCode}.jpg`;
}

export async function clearAllLocalData() {
  await AsyncStorage.clear();
  if (STORAGE_ROOT) {
    try {
      await FileSystem.deleteAsync(STORAGE_ROOT, { idempotent: true });
    } catch (error) {
      // ignore
    }
  }
}

export async function dumpLocalKeys() {
  const keys = await AsyncStorage.getAllKeys();
  console.log('local data keys:', keys);
}
