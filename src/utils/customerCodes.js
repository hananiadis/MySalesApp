// src/utils/customerCodes.js
// -------------------------------------------------------------
// Shared helpers for normalising customer codes across sheets
// -------------------------------------------------------------

export function normalizeCustomerCode(value) {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  if (!text) return '';
  return text.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

export function codesMatch(a, b) {
  return normalizeCustomerCode(a) === normalizeCustomerCode(b);
}

