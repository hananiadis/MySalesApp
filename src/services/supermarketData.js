import firestore from '@react-native-firebase/firestore';

import { normalizeBrandKey, isSuperMarketBrand, PRODUCT_COLLECTIONS } from '../constants/brands';
import { canonicalCode, toNumberSafe } from '../utils/codeNormalization';

const resolveDocBrand = (data) => {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const candidates = [
    data.brand,
    data.brandKey,
    data.brand_key,
    data.brandSlug,
    data.brandName,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return normalizeBrandKey(candidate);
    }
  }

  return null;
};

const mapSnapshotToBrand = (snapshot, brandKey, { transform } = {}) => {
  const results = [];

  snapshot.forEach((doc) => {
    const data = doc.data?.() || doc.data || {};
    const docBrand = resolveDocBrand(data);

    const matchesBrand = docBrand ? docBrand === brandKey : isSuperMarketBrand(brandKey);
    if (!matchesBrand) {
      return;
    }

    const payload = {
      id: doc.id ?? data.id ?? null,
      ...data,
      brand: docBrand || brandKey,
    };

    if (!payload.id) {
      payload.id = doc.id || `${brandKey}_${results.length}`;
    }

    const transformed = transform ? transform(payload) : payload;
    if (transformed) {
      results.push(transformed);
    }
  });

  return results;
};

const fetchCollectionForBrand = async (collectionName, brand, options = {}) => {
  const normalizedBrand = normalizeBrandKey(brand);
  if (!isSuperMarketBrand(normalizedBrand)) {
    throw new Error(`Brand "${brand}" is not enabled for supermarket flow.`);
  }

  const collectionRef = firestore().collection(collectionName);

  try {
    const scopedSnapshot = await collectionRef.where('brand', '==', normalizedBrand).get();
    const scopedResults = mapSnapshotToBrand(scopedSnapshot, normalizedBrand, options);
    if (scopedResults.length) {
      return scopedResults;
    }
  } catch (error) {
    console.log(`fetchCollectionForBrand scoped query failed for ${collectionName}`, error);
  }

  try {
    const fallbackSnapshot = await collectionRef.get();
    return mapSnapshotToBrand(fallbackSnapshot, normalizedBrand, options);
  } catch (fallbackError) {
    console.log(`fetchCollectionForBrand fallback query failed for ${collectionName}`, fallbackError);
    throw fallbackError;
  }
};

export const fetchSuperMarketStores = async (brand) => {
  return fetchCollectionForBrand('supermarket_stores', brand, {
    transform: (payload) => ({ ...payload }),
  });
};

export const fetchSuperMarketListings = async (brand, { onlyActive = false } = {}) => {
  return fetchCollectionForBrand('supermarket_listings', brand, {
    transform: (payload) => {
      const activeFlags = [
        payload.isActive,
        payload.active,
        payload.is_active,
        payload.status === 'active',
      ];
      const isActive = activeFlags.find((flag) => typeof flag === 'boolean') ?? true;

      if (onlyActive && !isActive) {
        return null;
      }

      const productCategory =
        (typeof payload.productCategory === 'string' && payload.productCategory.trim()) ? payload.productCategory.trim() :
        (typeof payload.listingLabel === 'string' && payload.listingLabel.trim()) ? payload.listingLabel.trim() :
        (typeof payload.category === 'string' && payload.category.trim()) ? payload.category.trim() :
        null;

      const rawCode = String(
        payload.productCode ?? payload.masterCode ?? payload.code ?? ''
      ).trim();
      const displayProductCode = rawCode ? rawCode.toUpperCase() : '';
      const normalizedProductCode = canonicalCode(rawCode || displayProductCode);
      const price = toNumberSafe(payload.price, payload.wholesalePrice ?? 0);

      return {
        ...payload,
        productCode: normalizedProductCode,
        displayProductCode: displayProductCode || normalizedProductCode,
        price,
        isActive,
        productCategory,
      };
    },
  });
};

export const fetchBrandProductsByCodes = async (brand, codes = []) => {
  const collectionName = PRODUCT_COLLECTIONS[brand];
  if (!collectionName || !Array.isArray(codes) || !codes.length) {
    return new Map();
  }

  const uniqueCodes = Array.from(
    new Set(
      codes
        .map((code) => (code == null ? '' : String(code).trim()))
        .filter((code) => code.length > 0)
    )
  );

  if (!uniqueCodes.length) {
    return new Map();
  }

  const results = new Map();
  const docIdSet = new Set();
  uniqueCodes.forEach((code) => {
    docIdSet.add(code);
    docIdSet.add(code.toUpperCase());
  });

  const docIds = Array.from(docIdSet).filter(Boolean);
  const chunkSize = 20;

  for (let i = 0; i < docIds.length; i += chunkSize) {
    const chunk = docIds.slice(i, i + chunkSize);
    const tasks = chunk.map((docId) =>
      firestore()
        .collection(collectionName)
        .doc(docId)
        .get()
        .catch(() => null)
    );

    const snapshots = await Promise.all(tasks);
    snapshots.forEach((snapshot) => {
      if (!snapshot || !snapshot.exists) {
        return;
      }
      const data = snapshot.data() || {};
      const productCode = data.productCode || data.code || snapshot.id;
      const entry = {
        id: snapshot.id,
        ...data,
        productCode,
      };

      const canonicalKey = canonicalCode(productCode);
      const rawKey = String(productCode || '').trim().toUpperCase();

      if (rawKey) {
        results.set(rawKey, entry);
      }
      if (canonicalKey) {
        results.set(canonicalKey, entry);
      }
    });
  }

  return results;
};
