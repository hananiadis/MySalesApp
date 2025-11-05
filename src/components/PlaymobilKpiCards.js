import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import colors from '../theme/colors';

const DATASET_TITLES = {
  invoiced: 'Τιμολογήσεις',
  orders: 'Παραγγελίες',
};

const DATASET_ICONS = {
  invoiced: 'trending-up-outline',
  orders: 'cart-outline',
};

const formatCurrency = (value) =>
  Number(value ?? 0).toLocaleString('el-GR', { style: 'currency', currency: 'EUR' });

const formatCustomers = (value) =>
  `${Number(value ?? 0).toLocaleString('el-GR')} πελάτες`;

const formatPercent = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--';
  }
  const rounded = Math.round(value * 10) / 10;
  const signed = rounded > 0 ? `+${rounded}` : `${rounded}`;
  return `${signed}%`;
};

const capitalize = (value) => {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
};

function MetricCard({
  dataset,
  metric,
  totalMetric,
  contextLabel,
  dateRangeLabel,
  previousDateRangeLabel,
  totalLabel,
  onPress,
}) {
  console.log('[MetricCard] render', {
    dataset,
    hasMetric: !!metric,
    contextLabel,
    dateRangeLabel,
    previousDateRangeLabel,
    totalLabel,
  });
  if (!metric) return null;

  const datasetTitle = DATASET_TITLES[dataset] || dataset;
  const iconName = DATASET_ICONS[dataset] || 'analytics-outline';

  const totalPrevious = totalMetric?.previous || { amount: 0, customers: null };
  const diffPercent = metric?.diff?.percent ?? null;
  const diffColor =
    diffPercent > 0 ? '#2e7d32' : diffPercent < 0 ? '#c62828' : '#546e7a';
  const accentColor =
    diffPercent > 0 ? '#66bb6a' : diffPercent < 0 ? '#ef5350' : '#90a4ae';
  const arrowIcon =
    diffPercent > 0 ? 'arrow-up-outline' : diffPercent < 0 ? 'arrow-down-outline' : 'remove-outline';

  const handlePress = () => onPress?.(dataset, metric);

  const titleParts = [datasetTitle];
  if (contextLabel) {
    titleParts.push(contextLabel);
  }
  if (dateRangeLabel) {
    titleParts.push(`(${dateRangeLabel})`);
  }
  const titleText = titleParts.join(' ');

  return (
    <TouchableOpacity
      key={`${dataset}-${contextLabel}-${dateRangeLabel}`}
      style={[styles.metricCard, { borderColor: accentColor }]}
      onPress={onPress ? handlePress : undefined}
      activeOpacity={onPress ? 0.9 : 1}
      disabled={!onPress}
    >
      <View style={styles.metricCardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.metricTitle}>{titleText}</Text>
        </View>
        <Ionicons name={iconName} size={28} color="#4b5563" />
      </View>

      <View style={styles.metricPrimaryRow}>
        <Text style={styles.metricPrimaryValue}>
          {formatCurrency(metric.current.amount)}
        </Text>
        <View style={styles.metricCustomerBadge}>
          <Text style={styles.metricCustomerText}>
            {formatCustomers(metric.current.customers)}
          </Text>
        </View>
      </View>

      <View style={styles.metricRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.metricLabel}>{previousDateRangeLabel}</Text>
        </View>
        <View style={styles.metricValueGroup}>
          <Text style={styles.metricValue}>
            {formatCurrency(metric.previous.amount)}
          </Text>
          <Text style={styles.metricCustomerMeta}>
            {formatCustomers(metric.previous.customers)}
          </Text>
        </View>
      </View>

      <View style={styles.metricRow}>
        <Text style={styles.metricLabel}>{totalLabel}</Text>
        <View style={styles.metricValueGroup}>
          <Text style={styles.metricValue}>
            {formatCurrency(totalPrevious.amount)}
          </Text>
          {typeof totalPrevious.customers === 'number' ? (
            <Text style={styles.metricCustomerMeta}>
              {formatCustomers(totalPrevious.customers)}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.metricDiffRow}>
        <Text style={styles.metricLabel}>Μεταβολή %</Text>
        <View style={styles.metricDiffValue}>
          <Ionicons name={arrowIcon} size={16} color={diffColor} />
          <Text style={[styles.metricDiffPercent, { color: diffColor }]}>
            {formatPercent(diffPercent)}
          </Text>
        </View>
      </View>

      <Text style={styles.metricHint}>
        {onPress ? 'Πατήστε για ανάλυση' : 'Ενημερώνεται από τα τελευταία δεδομένα'}
      </Text>
      <View style={[styles.metricAccent, { backgroundColor: accentColor }]} />
    </TouchableOpacity>
  );
}

const toDateFromContext = (context, fallback) => {
  if (context && typeof context === 'object') {
    const { year, month, day } = context;
    if (
      typeof year === 'number' &&
      typeof month === 'number' &&
      typeof day === 'number'
    ) {
      const candidate = new Date(year, month, day);
      if (!Number.isNaN(candidate.getTime())) {
        return candidate;
      }
    }
  }
  return fallback;
};

const buildLabelsFromDate = (date) => {
  const safeDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const monthLabel = capitalize(
    safeDate.toLocaleString('el-GR', { month: 'long' })
  );
  const currentYear = safeDate.getFullYear();
  const previousYear = currentYear - 1;
  const currentDayDisplay = safeDate.getDate().toString();
  const monthNumber = (safeDate.getMonth() + 1).toString().padStart(2, '0');
  const monthRangeLabel = `1-${currentDayDisplay}/${monthNumber}`;
  const ytdRangeLabel = `01/01-${currentDayDisplay}/${monthNumber}`;

  console.log('[PlaymobilKpiCards] buildLabelsFromDate', {
    sourceDate: safeDate.toISOString(),
    monthLabel,
    currentYear,
    previousYear,
    monthRangeLabel,
    ytdRangeLabel,
  });

  return {
    monthLabel,
    monthRangeLabel,
    ytdRangeLabel,
    currentYear,
    previousYear,
    monthNumber,
    currentDay: currentDayDisplay,
  };
};

export default function PlaymobilKpiCards({
  status,
  metricSnapshot,
  referenceMoment,
  error,
  onCardPress,
}) {
  console.log('[PlaymobilKpiCards] render', {
    status,
    hasSnapshot: !!metricSnapshot,
    referenceMoment:
      referenceMoment instanceof Date && !Number.isNaN(referenceMoment.getTime())
        ? referenceMoment.toISOString()
        : referenceMoment,
    hasError: !!error,
  });

  const loading = status === 'loading' || status === 'initial';
  const fallbackDate =
    referenceMoment instanceof Date && !Number.isNaN(referenceMoment.getTime())
      ? referenceMoment
      : new Date();

  const composed = useMemo(() => {
    console.log('[PlaymobilKpiCards] useMemo compose', {
      hasSnapshot: !!metricSnapshot,
    });
    if (!metricSnapshot) {
      return null;
    }
    const { invoiced, orders } = metricSnapshot;
    if (!invoiced && !orders) {
      return null;
    }

    const invoicedDate = toDateFromContext(invoiced?.context, fallbackDate);
    const ordersDate = toDateFromContext(orders?.context, fallbackDate);

    const invoicedLabels = buildLabelsFromDate(invoicedDate);
    const ordersLabels = buildLabelsFromDate(ordersDate);

    return {
      invoiced,
      orders,
      invoicedLabels,
      ordersLabels,
    };
  }, [fallbackDate, metricSnapshot]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loaderText}>Φόρτωση KPI...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loader}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!composed) {
    return null;
  }

  const { invoiced, orders, invoicedLabels, ordersLabels } = composed;

  console.log('[PlaymobilKpiCards] composed labels', {
    hasInvoiced: !!invoiced,
    invoicedLabels,
    hasOrders: !!orders,
    ordersLabels,
  });

  return (
    <View style={styles.cardStack}>
      <MetricCard
        dataset="invoiced"
        metric={invoiced?.mtd}
        totalMetric={invoiced?.monthly}
        contextLabel={invoicedLabels?.monthLabel}
        dateRangeLabel={invoicedLabels?.monthRangeLabel}
        previousDateRangeLabel={
          invoicedLabels
            ? `Τιμολογήσεις ${invoicedLabels.monthLabel} ${invoicedLabels.previousYear} (${invoicedLabels.monthRangeLabel})`
            : undefined
        }
        totalLabel={
          invoicedLabels
            ? `Σύνολο ${invoicedLabels.monthLabel} ${invoicedLabels.previousYear}`
            : 'Σύνολο'
        }
        onPress={onCardPress ? (dataset, metric) => onCardPress(dataset, 'mtd', metric) : undefined}
      />
      <MetricCard
        dataset="orders"
        metric={orders?.mtd}
        totalMetric={orders?.monthly}
        contextLabel={ordersLabels?.monthLabel}
        dateRangeLabel={ordersLabels?.monthRangeLabel}
        previousDateRangeLabel={
          ordersLabels
            ? `Παραγγελίες ${ordersLabels.monthLabel} ${ordersLabels.previousYear} (${ordersLabels.monthRangeLabel})`
            : undefined
        }
        totalLabel={
          ordersLabels
            ? `Σύνολο ${ordersLabels.monthLabel} ${ordersLabels.previousYear}`
            : 'Σύνολο'
        }
        onPress={onCardPress ? (dataset, metric) => onCardPress(dataset, 'mtd', metric) : undefined}
      />
      <MetricCard
        dataset="invoiced"
        metric={invoiced?.ytd}
        totalMetric={invoiced?.yearly}
        contextLabel={
          invoicedLabels ? String(invoicedLabels.currentYear) : new Date().getFullYear().toString()
        }
        dateRangeLabel={invoicedLabels?.ytdRangeLabel}
        previousDateRangeLabel={
          invoicedLabels
            ? `Τιμολογήσεις ${invoicedLabels.previousYear} (${invoicedLabels.ytdRangeLabel})`
            : undefined
        }
        totalLabel={
          invoicedLabels ? `Σύνολο ${invoicedLabels.previousYear}` : 'Σύνολο'
        }
        onPress={onCardPress ? (dataset, metric) => onCardPress(dataset, 'ytd', metric) : undefined}
      />
      <MetricCard
        dataset="orders"
        metric={orders?.ytd}
        totalMetric={orders?.yearly}
        contextLabel={
          ordersLabels ? String(ordersLabels.currentYear) : new Date().getFullYear().toString()
        }
        dateRangeLabel={ordersLabels?.ytdRangeLabel}
        previousDateRangeLabel={
          ordersLabels
            ? `Παραγγελίες ${ordersLabels.previousYear} (${ordersLabels.ytdRangeLabel})`
            : undefined
        }
        totalLabel={
          ordersLabels ? `Σύνολο ${ordersLabels.previousYear}` : 'Σύνολο'
        }
        onPress={onCardPress ? (dataset, metric) => onCardPress(dataset, 'ytd', metric) : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 26,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  loaderText: {
    marginTop: 10,
    fontSize: 14,
    color: colors.textSecondary || '#495057',
  },
  errorText: {
    color: '#c62828',
    textAlign: 'center',
    fontSize: 14,
  },
  cardStack: {
    width: '100%',
    marginBottom: 24,
  },
  metricCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    width: '100%',
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: '#d6e2f3',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  metricCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  metricPrimaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  metricPrimaryValue: { fontSize: 24, fontWeight: '700', color: '#0f172a' },
  metricCustomerBadge: {
    backgroundColor: '#e8f1ff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  metricCustomerText: { fontSize: 12, fontWeight: '600', color: '#1d4ed8' },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  metricLabel: { fontSize: 13, fontWeight: '600', color: '#374151', flex: 1, paddingRight: 12 },
  metricValueGroup: { alignItems: 'flex-end' },
  metricValue: { fontSize: 14, fontWeight: '700', color: '#111827' },
  metricCustomerMeta: { fontSize: 11, color: '#6b7280', marginTop: 2, textAlign: 'right' },
  metricDiffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  metricDiffValue: { flexDirection: 'row', alignItems: 'center' },
  metricDiffPercent: { fontSize: 14, fontWeight: '700', marginLeft: 4 },
  metricHint: {
    fontSize: 11,
    color: '#5f6a7a',
    marginTop: 10,
    marginBottom: 8,
    textAlign: 'right',
  },
  metricAccent: { height: 4, borderRadius: 999, marginTop: 4 },
});
