import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { validateBarcode, formatBarcodeForFont, getRecommendedFont } from '../utils/barcodeValidation';

/**
 * BarcodeText Component
 * Displays a scannable, human-readable barcode using LibreBarcode fonts.
 *
 * Automatically chooses:
 *  - LibreBarcode128Text-Regular for numeric (EAN/UPC/Code128)
 *  - LibreBarcode39Text-Regular for alphanumeric barcodes
 *
 * @param {string} barcode - The barcode value to display
 * @param {number} fontSize - Font size of barcode bars (default: 50)
 * @param {boolean} showValue - Show readable text below (default: true)
 * @param {object} style - Additional container styles
 */
const BarcodeText = ({ barcode, fontSize = 50, showValue = true, style }) => {
  const validatedBarcode = validateBarcode(barcode);
  if (!validatedBarcode) return null;

  const formattedBarcode = formatBarcodeForFont(validatedBarcode);
  const fontFamily = getRecommendedFont(validatedBarcode);

  return (
    <View style={[styles.container, style]}>
      {/* Scannable barcode text */}
      <Text style={[styles.barcodeText, { fontSize, fontFamily }]}>
        {` ${formattedBarcode} `}
      </Text>

      {/* Optional human-readable value */}
      {showValue && (
        <Text style={styles.valueText}>{validatedBarcode}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginVertical: 8,
  },
  barcodeText: {
    color: '#000',
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  valueText: {
    marginTop: 6,
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});

export default BarcodeText;
