import firestore from '@react-native-firebase/firestore';

import { normalizeBrandKey, isSuperMarketBrand } from '../constants/brands';

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

      return {
        ...payload,
        isActive,
        productCategory,
      };
    },
  });
};
