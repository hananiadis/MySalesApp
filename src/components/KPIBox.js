// src/components/KPIBox.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import colors from '../theme/colors';

/**
 * Display-only KPI card used on the Home dashboard.
 * Stays presentation-only so we avoid touching any business logic.
 */
const KPIBox = ({ label, value }) => {
  return (
    <View style={styles.container} accessible accessibilityRole="summary">
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
});

export default KPIBox;

