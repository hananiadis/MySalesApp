/**
 * Enhanced Barcode Utilities
 * Supports EAN-8, EAN-13, UPC-A, Code 39, and Code 128
 * Provides validation, formatting, and type detection
 */

/**
 * Cleans barcode string (removes spaces, dashes, underscores, etc.)
 * @param {string} barcode
 * @returns {string|null}
 */
export const validateBarcode = (barcode) => {
  if (!barcode) return null;

  const cleaned = String(barcode)
    .trim()
    .replace(/[\s\-_]/g, '') // remove spaces, dashes, underscores
    .replace(/[^A-Za-z0-9]/g, ''); // remove special characters not in barcode sets

  return cleaned.length > 0 ? cleaned : null;
};

/**
 * Detects the likely barcode type
 * @param {string} barcode - Cleaned barcode
 * @returns {string} - 'EAN-13', 'EAN-8', 'UPC-A', 'CODE39', or 'CODE128'
 */
export const detectBarcodeType = (barcode) => {
  if (!barcode) return 'UNKNOWN';
  const cleaned = validateBarcode(barcode);
  if (!cleaned) return 'UNKNOWN';

  const isNumeric = /^[0-9]+$/.test(cleaned);

  if (isNumeric) {
    if (cleaned.length === 8) return 'EAN-8';
    if (cleaned.length === 12) return 'UPC-A';
    if (cleaned.length === 13) return 'EAN-13';
    return 'CODE128'; // fallback for numeric barcodes of other lengths
  }

  // Alphanumeric → Code 39
  return 'CODE39';
};

/**
 * Calculates the EAN/UPC check digit and compares it.
 * @param {string} code - numeric code (8, 12, or 13 digits)
 * @returns {boolean}
 */
export const validateEANCheckDigit = (code) => {
  if (!/^[0-9]+$/.test(code)) return false;
  const len = code.length;
  if (![8, 12, 13].includes(len)) return false;

  const digits = code.split('').map((d) => parseInt(d, 10));
  const checkDigit = digits.pop(); // last digit

  let sum = 0;
  // weight pattern differs for EAN-8 vs EAN-13
  if (len === 8) {
    for (let i = 0; i < 7; i++) {
      sum += digits[i] * (i % 2 === 0 ? 3 : 1);
    }
  } else {
    for (let i = 0; i < len - 1; i++) {
      sum += digits[i] * (i % 2 === (len === 12 ? 0 : 1) ? 3 : 1);
    }
  }

  const calcCheck = (10 - (sum % 10)) % 10;
  return calcCheck === checkDigit;
};

/**
 * Formats barcode string for LibreBarcode fonts
 * Automatically adds start/stop for Code 128 and asterisks for Code 39
 * @param {string} barcode
 * @returns {string}
 */
export const formatBarcodeForFont = (barcode) => {
  const validated = validateBarcode(barcode);
  if (!validated) return '';

  const type = detectBarcodeType(validated);

  if (type === 'CODE39') {
    // Code 39 uses * as start/stop
    return `*${validated.toUpperCase()}*`;
  }

  // Code 128 (LibreBarcode128Text)
  return `Ì${validated}Î`;
};

/**
 * Returns the best LibreBarcode font to use
 * @param {string} barcode
 * @returns {'LibreBarcode128Text-Regular'|'LibreBarcode39Text-Regular'}
 */
export const getRecommendedFont = (barcode) => {
  const type = detectBarcodeType(barcode);
  return type === 'CODE39'
    ? 'LibreBarcode39Text-Regular'
    : 'LibreBarcode128Text-Regular';
};

/**
 * Checks if a barcode is valid and scannable
 * @param {string} barcode
 * @returns {boolean}
 */
export const isValidBarcode = (barcode) => {
  const validated = validateBarcode(barcode);
  if (!validated) return false;

  const type = detectBarcodeType(validated);
  if (['EAN-8', 'EAN-13', 'UPC-A'].includes(type)) {
    return validateEANCheckDigit(validated);
  }
  return true;
};
