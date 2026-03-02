// src/components/CustomerInventoryBadge.js
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import colors from '../theme/colors';

/**
 * Displays stock availability badge for a product in an inventory
 * 
 * Props:
 * - lines: Array of inventory lines (from useCustomerInventory hook)
 * - productId: Product ID to check stock for
 * - variant: 'badge' | 'inline' | 'full'
 *   - badge: Small colored circle badge (default)
 *   - inline: Text with icon (In Stock: 5)
 *   - full: Full row with details
 * - compact: boolean - if true, show minimal styling
 */
export default function CustomerInventoryBadge({
  lines,
  productId,
  variant = 'badge',
  compact = false,
}) {
  const stockLine = useMemo(() => {
    if (!lines || !productId) return null;
    return lines.find((l) => l.productId === productId);
  }, [lines, productId]);

  if (!stockLine) {
    // No inventory, no badge
    return null;
  }

  const qty = stockLine.qty || 0;
  const isInStock = qty > 0;
  const stockColor = isInStock ? '#4CAF50' : '#F44336';
  const stockBgColor = isInStock ? '#E8F5E9' : '#FFEBEE';

  if (variant === 'badge') {
    return (
      <View style={[styles.badge, compact && styles.badgeCompact]}>
        <Ionicons 
          name={isInStock ? 'checkmark-circle' : 'close-circle'} 
          size={compact ? 16 : 20} 
          color={stockColor} 
        />
        {!compact && <Text style={[styles.badgeText, { color: stockColor }]}>In Stock</Text>}
      </View>
    );
  }

  if (variant === 'inline') {
    return (
      <View style={styles.inline}>
        <Ionicons 
          name={isInStock ? 'checkmark-circle' : 'close-circle'} 
          size={16} 
          color={stockColor} 
        />
        <Text style={[styles.inlineText, { color: stockColor }]}>
          {isInStock ? `In Stock: ${qty}` : 'Out of Stock'}
        </Text>
      </View>
    );
  }

  // variant === 'full'
  return (
    <View style={[styles.full, { backgroundColor: stockBgColor }]}>
      <View style={styles.fullRow}>
        <View style={styles.fullLeft}>
          <Ionicons 
            name={isInStock ? 'checkmark-circle' : 'close-circle'} 
            size={20} 
            color={stockColor} 
          />
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.fullStatus}>{isInStock ? 'In Stock' : 'Out of Stock'}</Text>
            <Text style={styles.fullQty}>
              Qty: <Text style={{ fontWeight: '700' }}>{qty}</Text>
              {stockLine.uom && ` ${stockLine.uom}`}
            </Text>
          </View>
        </View>
        {stockLine.location && (
          <View style={styles.fullRight}>
            <Text style={styles.fullLocation}>{stockLine.location}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#E8F5E9',
  },
  badgeCompact: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inlineText: {
    fontSize: 12,
    fontWeight: '600',
  },
  full: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginVertical: 8,
  },
  fullRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fullLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fullStatus: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  fullQty: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  fullRight: {
    marginLeft: 12,
  },
  fullLocation: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
});
