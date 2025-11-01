// /src/components/SalesmanInfoCard.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';

/**
 * SalesmanInfoCard
 * - Preserves original layout and styling
 * - Supports region as text or React element
 * - Allows dot-only connection indicator (no text)
 * - Keeps brand chips and avatar
 */
const SalesmanInfoCard = ({
  name,
  region,
  connectionLabel,
  lastSyncLabel,
  isOnline,
  brands = [],
}) => {
  return (
    <View style={styles.container}>
      {/* Header: avatar + name + region */}
      <View style={styles.headerRow}>
        <View style={styles.avatar}>
          <Ionicons name="person-outline" size={28} color={colors.white} />
        </View>
        <View style={styles.meta}>
          <Text style={styles.name}>{name}</Text>
          {/* ✅ Support string or React element for region */}
          {typeof region === 'string' ? (
            <Text style={styles.region}>{region}</Text>
          ) : (
            <View style={styles.regionElement}>{region}</View>
          )}
        </View>
      </View>

      {/* Status row: dot-only or dot+text + last sync */}
      <View style={styles.statusRow}>
        <View style={styles.statusPill}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isOnline ? '#4CAF50' : '#E53935' },
            ]}
          />
          {/* ✅ If connectionLabel empty, hide text (for dot-only mode) */}
          {connectionLabel ? (
            <Text style={styles.statusText}>{connectionLabel}</Text>
          ) : null}
        </View>
        <Text style={styles.lastSync}>{lastSyncLabel}</Text>
      </View>

      {/* Brand chips */}
      {brands.length ? (
        <View style={styles.brandWrap}>
          {brands.map((brand) => (
            <TouchableOpacity
              key={brand.key}
              style={styles.brandChip}
              onPress={brand.onPress}
              activeOpacity={0.85}
              disabled={!brand.onPress}
            >
              <Text style={styles.brandChipText}>{brand.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  meta: { flex: 1 },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  region: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  regionElement: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F1FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  lastSync: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  brandWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 18,
  },
  brandChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    marginRight: 8,
    marginBottom: 8,
  },
  brandChipText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
});

export default SalesmanInfoCard;
