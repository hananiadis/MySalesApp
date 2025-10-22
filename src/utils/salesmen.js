import firestore from '@react-native-firebase/firestore';

export const SALESMEN_COLLECTION = 'salesmen';

export const SALES_PERSON_FIELD_PATHS = [
  'merch',
  'salesman',
  'salesmanName',
  'salesmanFullName',
  'salesInfo.merch',
  'salesInfo.salesman',
  'salesInfo.salesmanName',
  'salesInfo.merchandiser',
  'salesInfo.owner',
  '\u03c0\u03c9\u03bb\u03b7\u03c4\u03ae\u03c2',
  '\u03a0\u03c9\u03bb\u03b7\u03c4\u03ae\u03c2',
  '\u03a0\u03a9\u039b\u0397\u03a4\u0397\u03a3',
  'merchandiser',
  'assignedMerch',
  'assignedSalesman',
];

export function sanitizeSalesmanName(value) {
  if (value == null) {
    return '';
  }
  const text = String(value).trim();
  if (!text) {
    return '';
  }
  return text.replace(/\s+/g, ' ');
}

export function normalizeSalesmanKey(value) {
  const sanitized = sanitizeSalesmanName(value);
  return sanitized ? sanitized.toLocaleUpperCase('el-GR') : '';
}

function getValueByPath(source, path) {
  if (!source || typeof source !== 'object') {
    return undefined;
  }
  if (!path.includes('.')) {
    return source[path];
  }
  return path.split('.').reduce((acc, segment) => {
    if (acc && typeof acc === 'object' && segment in acc) {
      return acc[segment];
    }
    return undefined;
  }, source);
}

export function extractSalesmanCandidates(customer = {}) {
  const results = [];
  const seen = new Set();

  const addValue = (value) => {
    if (Array.isArray(value)) {
      value.forEach(addValue);
      return;
    }
    const sanitized = sanitizeSalesmanName(value);
    if (!sanitized) {
      return;
    }
    const key = normalizeSalesmanKey(sanitized);
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    results.push(sanitized);
  };

  SALES_PERSON_FIELD_PATHS.forEach((path) => {
    const value = getValueByPath(customer, path);
    if (value !== undefined) {
      addValue(value);
    }
  });

  return results;
}

export function collectSalesmenFromCustomers(customers = [], brand) {
  const map = new Map();
  const normalizedBrand = typeof brand === 'string' ? brand.trim().toLowerCase() : 'playmobil';

  (customers || []).forEach((customer) => {
    const candidates = extractSalesmanCandidates(customer);
    candidates.forEach((name) => {
      const key = normalizeSalesmanKey(name);
      if (!key || map.has(key)) {
        return;
      }
      map.set(key, {
        name,
        brand: normalizedBrand,
        normalized: key,
      });
    });
  });

  return Array.from(map.values());
}


export function normalizeSalesmenAssignments(rawAssignments = {}) {
  if (!rawAssignments || typeof rawAssignments !== 'object') {
    return {};
  }

  const result = {};

  const addName = (set, value) => {
    const cleaned = sanitizeSalesmanName(value);
    if (!cleaned) {
      return;
    }
    set.add(cleaned);
  };

  Object.entries(rawAssignments).forEach(([brandKey, entry]) => {
    const normalizedBrand = typeof brandKey === 'string' ? brandKey.trim().toLowerCase() : '';
    if (!normalizedBrand) {
      return;
    }

    const found = new Set();

    const process = (value) => {
      if (value == null) {
        return;
      }
      if (Array.isArray(value)) {
        value.forEach(process);
        return;
      }
      const type = typeof value;
      if (type === 'string' || type === 'number' || type === 'boolean') {
        addName(found, value);
        return;
      }
      if (type === 'object') {
        if (Array.isArray(value.names)) {
          value.names.forEach(process);
        }
        if (Array.isArray(value.list)) {
          value.list.forEach(process);
        }
        if (Array.isArray(value.values)) {
          value.values.forEach(process);
        }
        if (Array.isArray(value.items)) {
          value.items.forEach(process);
        }
        if (value.name) {
          addName(found, value.name);
        }
        if (value.label) {
          addName(found, value.label);
        }
        if (value.displayName) {
          addName(found, value.displayName);
        }
        if (typeof value.value === 'string') {
          addName(found, value.value);
        }
      }
    };

    process(entry);

    if (found.size) {
      result[normalizedBrand] = Array.from(found);
    }
  });

  return result;
}

export function createSalesmanDocId(brand, name) {
  const normalizedBrand = typeof brand === 'string' ? brand.trim().toLowerCase() : 'playmobil';
  const key = normalizeSalesmanKey(name);
  return key ? `${normalizedBrand}_${key}` : `${normalizedBrand}_unknown`;
}

export async function upsertSalesmenForBrand(brand, customers) {
  const salesmen = collectSalesmenFromCustomers(customers, brand);
  if (!salesmen.length) {
    return 0;
  }
  const batch = firestore().batch();
  salesmen.forEach((salesman) => {
    if (!salesman.name) {
      return;
    }
    const docId = createSalesmanDocId(brand, salesman.name);
    const ref = firestore().collection(SALESMEN_COLLECTION).doc(docId);
    batch.set(
      ref,
      {
        name: salesman.name,
        brand: salesman.brand,
        normalized: salesman.normalized,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
  await batch.commit();
  return salesmen.length;
}

export function customerMatchesSalesmen(customer = {}, assignments = {}, brandKey = null) {
  if (!customer || !assignments || typeof assignments !== 'object') {
    return false;
  }
  const normalizedBrand = typeof brandKey === 'string' && brandKey.trim()
    ? brandKey.trim().toLowerCase()
    : (typeof customer.brand === 'string' ? customer.brand.trim().toLowerCase() : 'playmobil');
  const allowed = Array.isArray(assignments[normalizedBrand]) ? assignments[normalizedBrand] : [];
  if (!allowed.length) {
    return false;
  }
  const allowedKeys = new Set(allowed.map(normalizeSalesmanKey).filter(Boolean));
  if (!allowedKeys.size) {
    return false;
  }
  const candidates = extractSalesmanCandidates(customer);
  return candidates.some((candidate) => allowedKeys.has(normalizeSalesmanKey(candidate)));
}

export function filterCustomersBySalesmen(customers = [], assignments = {}, brandKey = null) {
  if (!Array.isArray(customers) || !customers.length) {
    return [];
  }
  return customers.filter((customer) => customerMatchesSalesmen(customer, assignments, brandKey));
}
