// src/utils/codeNormalization.js

/**
 * Canonicalize product codes
 * Example: 03934 → 3934, 03835PM → 3835PM
 */
export function canonicalCode(raw) {
  if (!raw) return "";
  const s = String(raw).trim().toUpperCase();

  // Remove leading zeros
  let normalized = s.replace(/^0+/, "");

  // Remove known suffixes like MT, WD, PK, etc.
  normalized = normalized.replace(/(MT|WD|BL|PK|SET)$/i, "");

  // Remove non-alphanumeric characters
  normalized = normalized.replace(/[^A-Z0-9]/g, "");

  return normalized;
}

/**
 * Safe numeric parser to avoid NaN issues
 */
export function toNumberSafe(value, fallback = 0) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const normalized = String(value)
    .trim()
    .replace(/\s+/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '') // remove thousands separators
    .replace(',', '.');

  const n = Number(normalized);
  return Number.isFinite(n) ? n : fallback;
}
// Normalizes a product code for key comparison (strip 0s, letters, spacing)
export const normalizeCodeForKey = (code = "") => {
  try {
    return String(code).trim().toUpperCase().replace(/^0+/, "");
  } catch {
    return code;
  }
};

// Normalizes for fuzzy matching (ignore suffixes like MT, WD, spaces)
export const normalizeCodeForMatch = (code = "") => {
  try {
    return String(code)
      .trim()
      .toUpperCase()
      .replace(/^0+/, "")
      .replace(/(MT|WD|SP|WS)$/i, "");
  } catch {
    return code;
  }
};

/**
 * Finds a product in a product list or inventory object
 * using either productCode or masterCode, normalized.
 *
 * Works with:
 *   - Array of product objects
 *   - Object keyed by productCode
 *
 * Example:
 *   getProductByCode('03934', productList)
 */
export function getProductByCode(code, data) {
  if (!code || !data) return null;
  const target = canonicalCode(code);

  // Case 1: Array of products
  if (Array.isArray(data)) {
    for (const item of data) {
      if (!item) continue;
      const productCode = canonicalCode(item.productCode);
      const masterCode = canonicalCode(item.masterCode);
      if (target === productCode || target === masterCode) return item;
    }
    return null;
  }

  // Case 2: Object keyed by code
  if (typeof data === 'object') {
    for (const key in data) {
      const entry = data[key];
      if (!entry) continue;
      const productCode = canonicalCode(entry.productCode || key);
      const masterCode = canonicalCode(entry.masterCode);
      if (target === productCode || target === masterCode) return entry;
    }
  }

  return null;
}

/**
 * Gets numeric stock quantity safely from an inventory object
 * Returns 0 if not found or invalid number.
 *
 * Example:
 *   const stock = getStockByCode('03835PM', inventory);
 */
export function getStockByCode(code, inventory) {
  const entry = getProductByCode(code, inventory);
  return entry ? toNumberSafe(entry.stockQty || entry.qty || entry.stock, 0) : 0;
}
