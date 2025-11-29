import firestore from '@react-native-firebase/firestore';
import { normalizeCustomerCode } from '../utils/customerCodes';

const DEFAULT_BRAND = 'playmobil';

const CUSTOMER_COLLECTION_BY_BRAND = {
  playmobil: 'customers',
  john: 'customers_john',
  kivos: 'customers_kivos',
};

function resolveFirestoreInstance(fs) {
  if (fs && typeof fs.collection === 'function') {
    return fs;
  }
  const fallback = firestore();
  if (!fallback || typeof fallback.collection !== 'function') {
    throw new Error('[customerService] No Firestore instance available');
  }
  return fallback;
}

function resolveCustomerCollection(brand) {
  const normalized = (brand || '').toLowerCase();
  if (!normalized) {
    return CUSTOMER_COLLECTION_BY_BRAND[DEFAULT_BRAND];
  }
  return CUSTOMER_COLLECTION_BY_BRAND[normalized] || `customers_${normalized}`;
}

function normaliseString(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export async function getLinkedSalesmenForUser(user, brand = DEFAULT_BRAND) {
  console.log('[customerService] getLinkedSalesmenForUser:', user?.uid, brand);
  if (!user?.uid) return [];

  const db = firestore();
  const userDoc = await db.collection('users').doc(user.uid).get();
  if (!userDoc.exists) return [];

  const data = userDoc.data() || {};
  const merchArray = Array.isArray(data.merchIds) ? data.merchIds.filter(Boolean) : [];
  if (merchArray.length === 0) return [];

  const normalizedBrand = normaliseString(brand);
  const immediateMatches = merchArray.filter(
    (id) => typeof id === 'string' && normaliseString(id).includes(normalizedBrand)
  );

  if (normalizedBrand && immediateMatches.length > 0) {
    return immediateMatches;
  }

  // Fallback: validate brand by inspecting salesman documents
  const validated = [];
  await Promise.all(
    merchArray.map(async (merchId) => {
      if (typeof merchId !== 'string' || merchId.trim().length === 0) return;
      try {
        const snap = await db.collection('salesmen').doc(merchId).get();
        if (!snap.exists) return;
        const snapBrand = normaliseString(snap.data()?.brand);
        if (!normalizedBrand || snapBrand === normalizedBrand) {
          validated.push(merchId);
        }
      } catch (error) {
        console.warn('[customerService] Failed to verify salesman brand', merchId, error);
      }
    })
  );

  return validated.length ? validated : merchArray;
}

async function loadSalesmanMetadata(db, salesmanIds, brand) {
  const idSet = new Set();
  const nameSet = new Set();
  const normalizedBrand = normaliseString(brand);

  await Promise.all(
    salesmanIds.map(async (salesmanId) => {
      if (!salesmanId) return;
      idSet.add(normaliseString(salesmanId));
      nameSet.add(normaliseString(salesmanId));
      try {
        const snap = await db.collection('salesmen').doc(salesmanId).get();
        if (!snap.exists) return;
        const data = snap.data() || {};
        const snapBrand = normaliseString(data.brand);
        if (normalizedBrand && snapBrand && snapBrand !== normalizedBrand) return;

        const friendly = normaliseString(data.merch || data.name || data.fullName || data.salesman);
        if (friendly) {
          nameSet.add(friendly);
        }
      } catch (error) {
        console.warn('[customerService] Failed to load salesman metadata', salesmanId, error);
      }
    })
  );

  return { idSet, nameSet };
}

export async function fetchCustomersForSalesmen(fs, brand, salesmen) {
  const db = resolveFirestoreInstance(fs);
  const collectionName = resolveCustomerCollection(brand);
  console.log('[customerService] fetchCustomersForSalesmen:', { brand, collectionName, salesmen });

  const salesmanIds = (Array.isArray(salesmen) ? salesmen : [])
    .map((id) => (typeof id === 'string' ? id.trim() : ''))
    .filter(Boolean);

  if (salesmanIds.length === 0) {
    return { customerCodesSet: new Set(), customersMap: new Map() };
  }

  const { idSet, nameSet } = await loadSalesmanMetadata(db, salesmanIds, brand);

  let snapshot;
  try {
    snapshot = await db.collection(collectionName).get();
  } catch (error) {
    console.warn('[customerService] Failed to load customers:', error);
    throw error;
  }

  console.log('[customerService] Loaded', snapshot.size, 'customers from', collectionName);

  const customerCodesSet = new Set();
  const customersMap = new Map();

  snapshot.forEach((doc) => {
    const data = doc.data() || {};
    const codeRaw = data.customerCode ?? data.code ?? data.customer_id ?? data.id;
    const code = typeof codeRaw === 'string' || typeof codeRaw === 'number' ? String(codeRaw).trim() : '';
    const normalizedCode = normalizeCustomerCode(code);
    if (!normalizedCode) return;

    // Handle merch as both array and string
    const merchValues = Array.isArray(data.merch) 
      ? data.merch.map(m => normaliseString(m)).filter(Boolean)
      : [normaliseString(data.merch)].filter(Boolean);

    const merchantCandidates = [
      ...merchValues,
      data.salesman,
      data.salesmanName,
      data.salesman_name,
      data.merchName,
      data.salesmanFullName,
    ]
      .map(normaliseString)
      .filter(Boolean);

    const salesmanIdCandidates = [
      data.salesmanId,
      data.salesman_id,
      data.merchId,
      data.merch_id,
      data.salesmanCode,
    ]
      .map(normaliseString)
      .filter(Boolean);

    const matchedById = salesmanIdCandidates.some((value) => idSet.has(value));
    const matchedByName = merchantCandidates.some((value) => nameSet.has(value));

    if (matchedById || matchedByName) {
      customerCodesSet.add(normalizedCode);
      customersMap.set(normalizedCode, { id: doc.id, rawCode: code, ...data });
    }
  });

  return { customerCodesSet, customersMap };
}

export async function getCustomerCodes(fs, salesmen, brand = DEFAULT_BRAND) {
  if (!Array.isArray(salesmen) || salesmen.length === 0) {
    return [];
  }
  const { customerCodesSet } = await fetchCustomersForSalesmen(fs, brand, salesmen);
  return Array.from(customerCodesSet);
}
