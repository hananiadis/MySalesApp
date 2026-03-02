import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import colors from '../theme/colors';

const formatCurrency = (value) =>
  Number(value ?? 0).toLocaleString('el-GR', { style: 'currency', currency: 'EUR' });

const formatPercent = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--';
  }
  const rounded = Math.round(value * 10) / 10;
  const signed = rounded > 0 ? `+${rounded}` : `${rounded}`;
  return `${signed}%`;
};

/**
 * KivosKpiCards
 * Displays KPI metrics for Kivos brand with multi-year data (2026/2025/2024/2023)
 */
const KivosKpiCards = ({ kpis, referenceMoment, onCardPress }) => {
  if (!kpis) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>Δεν υπάρχουν διαθέσιμα δεδομένα KPI</Text>
      </View>
    );
  }

  const { sales } = kpis;
  if (!sales) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>Δεν υπάρχουν δεδομένα πωλήσεων</Text>
      </View>
    );
  }

  const refMoment = referenceMoment || new Date();
  const monthName = refMoment.toLocaleString('el-GR', { month: 'long' });
  const day = refMoment.getDate();

  // YTD Cards
  const renderYtdCard = () => {
    const ytd2026 = sales.year2026?.ytd;
    const ytd2025 = sales.year2025?.ytd;
    const ytd2024 = sales.year2024?.ytd;
    const ytd2023 = sales.year2023?.ytd;
    const ytd2022 = sales.year2022?.ytd;

    if (!ytd2026) return null;

    const diff2026vs2025 = ytd2026.diff?.percent ?? null;
    const accentColor = diff2026vs2025 > 0 ? '#66bb6a' : diff2026vs2025 < 0 ? '#ef5350' : '#90a4ae';
    const arrowIcon = diff2026vs2025 > 0 ? 'arrow-up-outline' : diff2026vs2025 < 0 ? 'arrow-down-outline' : 'remove-outline';

    return (
      <TouchableOpacity
        style={[styles.metricCard, { borderColor: accentColor }]}
        onPress={() => onCardPress?.('sales', 'ytd', 'amount')}
        activeOpacity={0.9}
      >
        <View style={styles.metricCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.metricTitle}>Πωλήσεις YTD (1 Ιαν - {day} {monthName})</Text>
          </View>
          <Ionicons name="trending-up-outline" size={28} color="#4b5563" />
        </View>

        {/* Current Year (2026) - Prominent */}
        <View style={styles.metricPrimaryRow}>
          <Text style={styles.metricPrimaryValue}>{formatCurrency(ytd2026.amount)}</Text>
          <Text style={styles.metricYearLabel}>2026</Text>
        </View>
        
        {ytd2026.customers > 0 && (
          <Text style={styles.customersText}>{ytd2026.customers} πελάτες</Text>
        )}

        <View style={styles.comparisonRow}>
          <View style={[styles.diffBadge, { backgroundColor: accentColor }]}>
            <Ionicons name={arrowIcon} size={16} color="#fff" />
            <Text style={styles.diffText}>{formatPercent(diff2026vs2025)}</Text>
          </View>
          <Text style={styles.comparisonText}>vs 2025: {formatCurrency(ytd2025?.amount || 0)}</Text>
        </View>

        {/* Divider */}
        <View style={styles.metricDivider} />

        {/* Historical Years */}
        <Text style={styles.pastYearsTitle}>Ιστορικό</Text>
        <View style={styles.historicalRow}>
          <View style={styles.historicalItem}>
            <Text style={styles.historicalYear}>2025</Text>
            <Text style={styles.historicalValue}>{formatCurrency(ytd2025?.amount || 0)}</Text>
            {ytd2025?.customers > 0 && (
              <Text style={styles.historicalCustomers}>{ytd2025.customers} πελάτες</Text>
            )}
          </View>
          <View style={styles.historicalItem}>
            <Text style={styles.historicalYear}>2024</Text>
            <Text style={styles.historicalValue}>{formatCurrency(ytd2024?.amount || 0)}</Text>
            {ytd2024?.customers > 0 && (
              <Text style={styles.historicalCustomers}>{ytd2024.customers} πελάτες</Text>
            )}
          </View>
          <View style={styles.historicalItem}>
            <Text style={styles.historicalYear}>2023</Text>
            <Text style={styles.historicalValue}>{formatCurrency(ytd2023?.amount || 0)}</Text>
            {ytd2023?.customers > 0 && (
              <Text style={styles.historicalCustomers}>{ytd2023.customers} πελάτες</Text>
            )}
          </View>
          <View style={styles.historicalItem}>
            <Text style={styles.historicalYear}>2022</Text>
            <Text style={styles.historicalValue}>{formatCurrency(ytd2022?.amount || 0)}</Text>
            {ytd2022?.customers > 0 && (
              <Text style={styles.historicalCustomers}>{ytd2022.customers} πελάτες</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // MTD Cards
  const renderMtdCard = () => {
    const mtd2026 = sales.year2026?.mtd;
    const mtd2025 = sales.year2025?.mtd;
    const mtd2024 = sales.year2024?.mtd;
    const mtd2023 = sales.year2023?.mtd;
    const mtd2022 = sales.year2022?.mtd;

    if (!mtd2026) return null;

    const diff2026vs2025 = mtd2026.diff?.percent ?? null;
    const accentColor = diff2026vs2025 > 0 ? '#66bb6a' : diff2026vs2025 < 0 ? '#ef5350' : '#90a4ae';
    const arrowIcon = diff2026vs2025 > 0 ? 'arrow-up-outline' : diff2026vs2025 < 0 ? 'arrow-down-outline' : 'remove-outline';

    return (
      <TouchableOpacity
        style={[styles.metricCard, { borderColor: accentColor }]}
        onPress={() => onCardPress?.('sales', 'mtd', 'amount')}
        activeOpacity={0.9}
      >
        <View style={styles.metricCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.metricTitle}>{monthName} MTD (1-{day})</Text>
          </View>
          <Ionicons name="calendar-outline" size={28} color="#4b5563" />
        </View>

        {/* Current Year (2026) - Prominent */}
        <View style={styles.metricPrimaryRow}>
          <Text style={styles.metricPrimaryValue}>{formatCurrency(mtd2026.amount)}</Text>
          <Text style={styles.metricYearLabel}>2026</Text>
        </View>
        
        {mtd2026.customers > 0 && (
          <Text style={styles.customersText}>{mtd2026.customers} πελάτες</Text>
        )}

        <View style={styles.comparisonRow}>
          <View style={[styles.diffBadge, { backgroundColor: accentColor }]}>
            <Ionicons name={arrowIcon} size={16} color="#fff" />
            <Text style={styles.diffText}>{formatPercent(diff2026vs2025)}</Text>
          </View>
          <Text style={styles.comparisonText}>vs 2025: {formatCurrency(mtd2025?.amount || 0)}</Text>
        </View>

        {/* Divider */}
        <View style={styles.metricDivider} />

        {/* Historical Years */}
        <Text style={styles.pastYearsTitle}>Ιστορικό</Text>
        <View style={styles.historicalRow}>
          <View style={styles.historicalItem}>
            <Text style={styles.historicalYear}>2025</Text>
            <Text style={styles.historicalValue}>{formatCurrency(mtd2025?.amount || 0)}</Text>
            {mtd2025?.customers > 0 && (
              <Text style={styles.historicalCustomers}>{mtd2025.customers} πελάτες</Text>
            )}
          </View>
          <View style={styles.historicalItem}>
            <Text style={styles.historicalYear}>2024</Text>
            <Text style={styles.historicalValue}>{formatCurrency(mtd2024?.amount || 0)}</Text>
            {mtd2024?.customers > 0 && (
              <Text style={styles.historicalCustomers}>{mtd2024.customers} πελάτες</Text>
            )}
          </View>
          <View style={styles.historicalItem}>
            <Text style={styles.historicalYear}>2023</Text>
            <Text style={styles.historicalValue}>{formatCurrency(mtd2023?.amount || 0)}</Text>
            {mtd2023?.customers > 0 && (
              <Text style={styles.historicalCustomers}>{mtd2023.customers} πελάτες</Text>
            )}
          </View>
          <View style={styles.historicalItem}>
            <Text style={styles.historicalYear}>2022</Text>
            <Text style={styles.historicalValue}>{formatCurrency(mtd2022?.amount || 0)}</Text>
            {mtd2022?.customers > 0 && (
              <Text style={styles.historicalCustomers}>{mtd2022.customers} πελάτες</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Yearly Cards
  const renderYearlyCard = () => {
    const yearly2026 = sales.year2026?.yearly;
    const yearly2025 = sales.year2025?.yearly;
    const yearly2024 = sales.year2024?.yearly;
    const yearly2023 = sales.year2023?.yearly;
    const yearly2022 = sales.year2022?.yearly;

    if (!yearly2026) return null;

    const diff2026vs2025 = yearly2026.diff?.percent ?? null;
    const accentColor = diff2026vs2025 > 0 ? '#66bb6a' : diff2026vs2025 < 0 ? '#ef5350' : '#90a4ae';
    const arrowIcon = diff2026vs2025 > 0 ? 'arrow-up-outline' : diff2026vs2025 < 0 ? 'arrow-down-outline' : 'remove-outline';

    return (
      <TouchableOpacity
        style={[styles.metricCard, { borderColor: accentColor }]}
        onPress={() => onCardPress?.('sales', 'yearly', 'amount')}
        activeOpacity={0.9}
      >
        <View style={styles.metricCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.metricTitle}>Ολόκληρο Έτος</Text>
          </View>
          <Ionicons name="stats-chart-outline" size={28} color="#4b5563" />
        </View>

        {/* Current Year (2026) - Prominent */}
        <View style={styles.metricPrimaryRow}>
          <Text style={styles.metricPrimaryValue}>{formatCurrency(yearly2026.amount)}</Text>
          <Text style={styles.metricYearLabel}>2026</Text>
        </View>
        
        {yearly2026.customers > 0 && (
          <Text style={styles.customersText}>{yearly2026.customers} πελάτες</Text>
        )}

        <View style={styles.comparisonRow}>
          <View style={[styles.diffBadge, { backgroundColor: accentColor }]}>
            <Ionicons name={arrowIcon} size={16} color="#fff" />
            <Text style={styles.diffText}>{formatPercent(diff2026vs2025)}</Text>
          </View>
          <Text style={styles.comparisonText}>vs 2025: {formatCurrency(yearly2025?.amount || 0)}</Text>
        </View>

        {/* Divider */}
        <View style={styles.metricDivider} />

        {/* Historical Years */}
        <Text style={styles.pastYearsTitle}>Ιστορικό</Text>
        <View style={styles.historicalRow}>
          <View style={styles.historicalItem}>
            <Text style={styles.historicalYear}>2025</Text>
            <Text style={styles.historicalValue}>{formatCurrency(yearly2025?.amount || 0)}</Text>
            {yearly2025?.customers > 0 && (
              <Text style={styles.historicalCustomers}>{yearly2025.customers} πελάτες</Text>
            )}
          </View>
          <View style={styles.historicalItem}>
            <Text style={styles.historicalYear}>2024</Text>
            <Text style={styles.historicalValue}>{formatCurrency(yearly2024?.amount || 0)}</Text>
            {yearly2024?.customers > 0 && (
              <Text style={styles.historicalCustomers}>{yearly2024.customers} πελάτες</Text>
            )}
          </View>
          <View style={styles.historicalItem}>
            <Text style={styles.historicalYear}>2023</Text>
            <Text style={styles.historicalValue}>{formatCurrency(yearly2023?.amount || 0)}</Text>
            {yearly2023?.customers > 0 && (
              <Text style={styles.historicalCustomers}>{yearly2023.customers} πελάτες</Text>
            )}
          </View>
          <View style={styles.historicalItem}>
            <Text style={styles.historicalYear}>2022</Text>
            <Text style={styles.historicalValue}>{formatCurrency(yearly2022?.amount || 0)}</Text>
            {yearly2022?.customers > 0 && (
              <Text style={styles.historicalCustomers}>{yearly2022.customers} πελάτες</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {renderMtdCard()}
      {renderYtdCard()}
      {renderYearlyCard()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    marginBottom: 20,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    marginVertical: 20,
  },
  emptyText: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
  },
  metricCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  metricCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  metricTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    flexWrap: 'wrap',
  },
  metricPrimaryRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  metricPrimaryValue: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1f2937',
    marginRight: 10,
  },
  metricYearLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e88e5',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  customersText: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 8,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  diffBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 10,
  },
  diffText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginLeft: 4,
  },
  comparisonText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  historicalRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
    marginTop: 4,
  },
  historicalItem: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    paddingHorizontal: 4,
  },
  historicalYear: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
  },
  historicalValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
  },
  historicalCustomers: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  metricDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },
  pastYearsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default KivosKpiCards;
