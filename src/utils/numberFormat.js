// src/utils/numberFormat.js
/**
 * Parses numeric values that may include locale-specific thousand/decimal separators.
 * - Accepts numbers, numeric strings with commas/dots/spaces.
 * - Preserves decimal separator based on the last occurrence of comma/dot.
 * - Removes extraneous characters (currency symbols, etc.).
 */
export function parseLocaleNumber(value, { defaultValue = 0 } = {}) {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : defaultValue;
  }

  let text = String(value).trim();
  if (!text) return defaultValue;

  text = text.replace(/\s+/g, '');

  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      // Comma is the decimal separator, dot is thousands separator.
      text = text.replace(/\./g, '').replace(/,/g, '.');
    } else {
      // Dot is the decimal separator, comma is thousands separator.
      text = text.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    // Only comma present: decide whether it's decimal or thousands separator.
    const parts = text.split(',');
    const lastPart = parts[parts.length - 1] || '';
    const looksLikeThousands =
      parts.length > 1 &&
      parts.slice(0, -1).every((segment) => segment.length <= 3) &&
      lastPart.length === 3;
    text = looksLikeThousands ? text.replace(/,/g, '') : text.replace(/,/g, '.');
  } else if (lastDot !== -1) {
    // Only dot present; distinguish decimal vs thousands separator.
    const thousandPattern = /^\d{1,3}(\.\d{3})+$/;
    if (thousandPattern.test(text)) {
      text = text.replace(/\./g, '');
    } else {
      const dotParts = text.split('.');
      if (dotParts.length > 2) {
        const decimal = dotParts.pop();
        text = dotParts.join('') + '.' + decimal;
      }
    }
  }

  // Keep digits, optional leading minus and a single dot.
  const isNegative = text.startsWith('-');
  const normalized = text.replace(/[^0-9.]/g, '');
  if (!normalized) return defaultValue;

  const parsed = Number((isNegative ? '-' : '') + normalized);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}
