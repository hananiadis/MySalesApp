import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
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
  // New: explicit year labels and two-years-ago totals
  previousYearNumber,
  twoYearsAgoYearNumber,
  twoYearsTotalsLabel,
  twoYearsTotalMetric,
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

  const current = metric?.current || { amount: 0, customers: null };
  const previous = metric?.previous || { amount: 0, customers: null };
  const twoYearsAgo = metric?.twoYearsAgo || { amount: 0, customers: null };
  const totalPrevious = totalMetric?.previous || { amount: 0, customers: null };
  const totalTwoYearsAgo = twoYearsTotalMetric || { amount: 0, customers: null };
  
  // Diff between current and previous year
  const diffPercent = metric?.diff?.percent ?? null;
  const diffColor =
    diffPercent > 0 ? '#2e7d32' : diffPercent < 0 ? '#c62828' : '#546e7a';
  const accentColor =
    diffPercent > 0 ? '#66bb6a' : diffPercent < 0 ? '#ef5350' : '#90a4ae';
  const arrowIcon =
    diffPercent > 0 ? 'arrow-up-outline' : diffPercent < 0 ? 'arrow-down-outline' : 'remove-outline';
  const diffTwoYearsPercent = metric?.diffTwoYears?.percent ?? null;
  const diffTwoYearsColor =
    diffTwoYearsPercent > 0 ? '#2e7d32' : diffTwoYearsPercent < 0 ? '#c62828' : '#546e7a';
  const arrowTwoYearsIcon =
    diffTwoYearsPercent > 0 ? 'arrow-up-outline' : diffTwoYearsPercent < 0 ? 'arrow-down-outline' : 'remove-outline';

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

      {/* Current Year Data - MAIN DISPLAY */}
      <View style={styles.metricPrimaryRow}>
        <Text style={styles.metricPrimaryValue}>
          {formatCurrency(current.amount)}
        </Text>
        <View style={styles.metricCustomerBadge}>
          <Text style={styles.metricCustomerText}>
            {formatCustomers(current.customers)}
          </Text>
        </View>
      </View>

      {/* Diff vs Previous Year */}
      <View style={styles.metricDiffRow}>
        <Text style={styles.metricLabel}>Μεταβολή vs Προηγ.</Text>
        <View style={styles.metricDiffValue}>
          <Ionicons name={arrowIcon} size={16} color={diffColor} />
          <Text style={[styles.metricDiffPercent, { color: diffColor }]}>
            {formatPercent(diffPercent)}
          </Text>
        </View>
      </View>

      {/* Separator / Divider */}
      <View style={styles.metricDivider} />

      {/* Past Years Section */}
      <Text style={styles.pastYearsTitle}>Ιστορικό</Text>

      {/* Previous Year */}
      <View style={styles.metricRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.metricLabel}>
            {previousYearNumber ? `Προηγ. Έτος (${previousYearNumber})` : 'Προηγ. Έτος'}
          </Text>
        </View>
        <View style={styles.metricValueGroup}>
          <Text style={styles.metricValue}>
            {formatCurrency(previous.amount)}
          </Text>
          <Text style={styles.metricCustomerMeta}>
            {formatCustomers(previous.customers)}
          </Text>
        </View>
      </View>

      {/* Two Years Ago */}
      <View style={styles.metricRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.metricLabel}>
            {twoYearsAgoYearNumber ? `2 Έτη πριν (${twoYearsAgoYearNumber})` : '2 Έτη πριν'}
          </Text>
        </View>
        <View style={styles.metricValueGroup}>
          <Text style={styles.metricValue}>
            {formatCurrency(twoYearsAgo.amount)}
          </Text>
          <Text style={styles.metricCustomerMeta}>
            {formatCustomers(twoYearsAgo.customers)}
          </Text>
        </View>
      </View>

      {totalMetric && (
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
      )}

      {/* Two Years Ago Totals */}
      {twoYearsTotalsLabel && (
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>{twoYearsTotalsLabel}</Text>
          <View style={styles.metricValueGroup}>
            <Text style={styles.metricValue}>
              {formatCurrency(totalTwoYearsAgo.amount)}
            </Text>
            {typeof totalTwoYearsAgo.customers === 'number' ? (
              <Text style={styles.metricCustomerMeta}>
                {formatCustomers(totalTwoYearsAgo.customers)}
              </Text>
            ) : null}
          </View>
        </View>
      )}

      {/* Diff vs Two Years Ago */}
      <View style={styles.metricDiffRow}>
        <Text style={styles.metricLabel}>Μεταβολή vs 2 Έτη</Text>
        <View style={styles.metricDiffValue}>
          <Ionicons name={arrowTwoYearsIcon} size={16} color={diffTwoYearsColor} />
          <Text style={[styles.metricDiffPercent, { color: diffTwoYearsColor }]}>
            {formatPercent(diffTwoYearsPercent)}
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
  // Greek month names in genitive case (for "Σύνολο Ιανουαρίου")
  const monthsGenitive = [
    'Ιανουαρίου', 'Φεβρουαρίου', 'Μαρτίου', 'Απριλίου', 'Μαΐου', 'Ιουνίου',
    'Ιουλίου', 'Αυγούστου', 'Σεπτεμβρίου', 'Οκτωβρίου', 'Νοεμβρίου', 'Δεκεμβρίου'
  ];
  const monthLabelGenitive = monthsGenitive[safeDate.getMonth()];

  const currentYear = safeDate.getFullYear();
  const previousYear = currentYear - 1;
  const twoYearsAgo = currentYear - 2;
  const currentDayDisplay = safeDate.getDate().toString();
  const monthNumber = (safeDate.getMonth() + 1).toString().padStart(2, '0');
  const monthRangeLabel = `1-${currentDayDisplay}/${monthNumber}`;
  const ytdRangeLabel = `01/01-${currentDayDisplay}/${monthNumber}`;

  console.log('[PlaymobilKpiCards] buildLabelsFromDate', {
    sourceDate: safeDate.toISOString(),
    monthLabel,
    monthLabelGenitive,
    currentYear,
    previousYear,
    twoYearsAgo,
    monthRangeLabel,
    ytdRangeLabel,
  });

  return {
    monthLabel,
    monthLabelGenitive,
    monthRangeLabel,
    ytdRangeLabel,
    currentYear,
    previousYear,
    twoYearsAgo,
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
  selectedDate = new Date(),
  onDateChange,
}) {
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [dateInput, setDateInput] = useState('');
  
  console.log('[PlaymobilKpiCards] render with selectedDate:', {
    date: selectedDate.toISOString(),
    local: selectedDate.toString(),
    year: selectedDate.getFullYear(),
    month: selectedDate.getMonth(),
    day: selectedDate.getDate(),
  });
  
  const handleDatePress = () => {
    const formattedDate = selectedDate.toLocaleDateString('el-GR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
    setDateInput(formattedDate);
    setDatePickerVisible(true);
  };
  
  const handleDateSubmit = () => {
    console.log('[PlaymobilKpiCards] Date picker submitted:', dateInput);
    if (dateInput) {
      // Parse DD/MM/YYYY format
      const parts = dateInput.trim().split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
        const year = parseInt(parts[2], 10);
        console.log('[PlaymobilKpiCards] Parsed date:', { day, month, year });
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
          console.log('[PlaymobilKpiCards] Valid date created:', date.toISOString());
          console.log('[PlaymobilKpiCards] Calling onDateChange');
          onDateChange?.(date);
          setDatePickerVisible(false);
        } else {
          console.log('[PlaymobilKpiCards] Invalid date');
          Alert.alert('Invalid Date', 'Please enter a valid date');
        }
      } else {
        console.log('[PlaymobilKpiCards] Wrong date format');
        Alert.alert('Invalid Format', 'Please use DD/MM/YYYY format');
      }
    }
  };

  console.log('[PlaymobilKpiCards] render', {
    status,
    hasSnapshot: !!metricSnapshot,
    selectedDate: selectedDate.toISOString(),
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

  const dateDisplay = selectedDate.toLocaleDateString('el-GR', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <View style={styles.cardStack}>
      {/* Date Picker */}
      {onDateChange && (
        <View style={styles.datePickerContainer}>
          <TouchableOpacity
            style={styles.datePickerButton}
            onPress={handleDatePress}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            <Text style={styles.datePickerButtonText}>{dateDisplay}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Monthly MTD Cards */}
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
        previousYearNumber={invoicedLabels?.previousYear}
        twoYearsAgoYearNumber={invoicedLabels?.twoYearsAgo}
        twoYearsTotalsLabel={
          invoicedLabels
            ? `Σύνολο ${invoicedLabels.monthLabelGenitive} ${invoicedLabels.twoYearsAgo}`
            : undefined
        }
        twoYearsTotalMetric={invoiced?.monthly?.twoYearsAgo}
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
        previousYearNumber={ordersLabels?.previousYear}
        twoYearsAgoYearNumber={ordersLabels?.twoYearsAgo}
        twoYearsTotalsLabel={
          ordersLabels
            ? `Σύνολο ${ordersLabels.monthLabelGenitive} ${ordersLabels.twoYearsAgo}`
            : undefined
        }
        twoYearsTotalMetric={orders?.monthly?.twoYearsAgo}
        onPress={onCardPress ? (dataset, metric) => onCardPress(dataset, 'mtd', metric) : undefined}
      />
      
      {/* YTD Cards (Year-To-Date Comparison) */}
      <MetricCard
        dataset="invoiced"
        metric={invoiced?.ytd}
        totalMetric={invoiced?.yearly}
        contextLabel="YTD"
        dateRangeLabel={invoicedLabels?.ytdRangeLabel}
        previousDateRangeLabel={
          invoicedLabels
            ? `Τιμολογήσεις YTD ${invoicedLabels.previousYear} (${invoicedLabels.ytdRangeLabel})`
            : undefined
        }
        totalLabel={
          invoicedLabels
            ? `Σύνολο ${invoicedLabels.previousYear} (Πλήρες Έτος)`
            : 'Σύνολο'
        }
        previousYearNumber={invoicedLabels?.previousYear}
        twoYearsAgoYearNumber={invoicedLabels?.twoYearsAgo}
        twoYearsTotalsLabel={
          invoicedLabels
            ? `Σύνολο ${invoicedLabels.twoYearsAgo} (Πλήρες Έτος)`
            : undefined
        }
        twoYearsTotalMetric={invoiced?.yearly?.twoYearsAgo}
        onPress={onCardPress ? (dataset, metric) => onCardPress(dataset, 'ytd', metric) : undefined}
      />
      <MetricCard
        dataset="orders"
        metric={orders?.ytd}
        totalMetric={orders?.yearly}
        contextLabel="YTD"
        dateRangeLabel={ordersLabels?.ytdRangeLabel}
        previousDateRangeLabel={
          ordersLabels
            ? `Παραγγελίες YTD ${ordersLabels.previousYear} (${ordersLabels.ytdRangeLabel})`
            : undefined
        }
        totalLabel={
          ordersLabels
            ? `Σύνολο ${ordersLabels.previousYear} (Πλήρες Έτος)`
            : 'Σύνολο'
        }
        previousYearNumber={ordersLabels?.previousYear}
        twoYearsAgoYearNumber={ordersLabels?.twoYearsAgo}
        twoYearsTotalsLabel={
          ordersLabels
            ? `Σύνολο ${ordersLabels.twoYearsAgo} (Πλήρες Έτος)`
            : undefined
        }
        twoYearsTotalMetric={orders?.yearly?.twoYearsAgo}
        onPress={onCardPress ? (dataset, metric) => onCardPress(dataset, 'ytd', metric) : undefined}
      />
      
      {/* Date Picker Modal */}
      <Modal
        visible={datePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDatePickerVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setDatePickerVisible(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Select Date</Text>
            <Text style={styles.modalHint}>Enter date (DD/MM/YYYY)</Text>
            <TextInput
              style={styles.dateInput}
              value={dateInput}
              onChangeText={setDateInput}
              placeholder="DD/MM/YYYY"
              keyboardType="numbers-and-punctuation"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setDatePickerVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleDateSubmit}
              >
                <Text style={styles.submitButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
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
  // Divider between current and past years
  metricDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },
  pastYearsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Date Picker Styles
  datePickerContainer: {
    marginBottom: 16,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: colors.primary || '#1d4ed8',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    gap: 8,
  },
  datePickerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary || '#1d4ed8',
  },
  // Date Picker Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalHint: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  dateInput: {
    borderWidth: 2,
    borderColor: colors.primary || '#1d4ed8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    backgroundColor: colors.white,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  submitButton: {
    backgroundColor: colors.primary || '#1d4ed8',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
});
