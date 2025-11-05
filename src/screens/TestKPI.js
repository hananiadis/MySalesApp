// src/screens/TestKPI.js
// -------------------------------------------------------------
// Diagnostic screen for verifying Playmobil KPI calculations.
// -------------------------------------------------------------
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ExcelJS from 'exceljs';
import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import PlaymobilKpiCards from '../components/PlaymobilKpiCards';
import usePlaymobilKpi from '../hooks/usePlaymobilKpi';
import { refreshAllSheetsAndCache } from '../services/playmobilKpi';
import AsyncStorage from '@react-native-async-storage/async-storage';

const METRIC_LABELS = {
  mtd: 'MTD',
  ytd: 'YTD',
  monthly: 'Current Month',
  yearly: 'Year',
};

const DATASET_LABELS = {
  invoiced: 'Invoiced Sales',
  orders: 'Orders',
};

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

const formatCustomerCount = (value) =>
  `${Number(value ?? 0).toLocaleString('el-GR')} πελάτες`;

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

const formatDate = (value) => {
  if (!value) return '--';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('el-GR');
};

const capitalize = (value) => {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const ensureExcelSupport = () => {
  if (typeof global !== 'undefined' && typeof global.Buffer === 'undefined') {
    global.Buffer = Buffer;
  }
};

const toExcelDate = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

async function exportKpiSourceXLSX(records, kpis, referenceDate = new Date()) {
  console.log('[exportKpiSourceXLSX] START');
  console.log('[exportKpiSourceXLSX] Records structure:', {
    hasInvoiced: !!records?.invoiced,
    hasOrders: !!records?.orders,
    invoicedCurrent: records?.invoiced?.current?.length || 0,
    invoicedPrevious: records?.invoiced?.previous?.length || 0,
    ordersCurrent: records?.orders?.current?.length || 0,
    ordersPrevious: records?.orders?.previous?.length || 0,
  });
  
  ensureExcelSupport();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MySalesApp';
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Field', key: 'field', width: 28 },
    { header: 'Value', key: 'value', width: 48 },
  ];

  summarySheet.addRow({
    field: 'Reference Date',
    value: referenceDate.toISOString(),
  });

  summarySheet.addRow({ field: '', value: '' }); // Empty row

  // Add KPI summary data
  if (kpis?.invoiced) {
    summarySheet.addRow({ field: 'INVOICED SALES', value: '' });
    
    if (kpis.invoiced.yearly?.current) {
      summarySheet.addRow({
        field: '  Current Year Total',
        value: `${formatCurrency(kpis.invoiced.yearly.current.amount)} (${kpis.invoiced.yearly.current.customers || 0} customers)`,
      });
    }
    
    if (kpis.invoiced.yearly?.previous) {
      summarySheet.addRow({
        field: '  Previous Year Total',
        value: `${formatCurrency(kpis.invoiced.yearly.previous.amount)} (${kpis.invoiced.yearly.previous.customers || 0} customers)`,
      });
    }
    
    if (kpis.invoiced.mtd?.current) {
      summarySheet.addRow({
        field: '  MTD Current',
        value: `${formatCurrency(kpis.invoiced.mtd.current.amount)} (${kpis.invoiced.mtd.current.customers || 0} customers)`,
      });
    }
    
    if (kpis.invoiced.mtd?.previous) {
      summarySheet.addRow({
        field: '  MTD Previous Year',
        value: `${formatCurrency(kpis.invoiced.mtd.previous.amount)} (${kpis.invoiced.mtd.previous.customers || 0} customers)`,
      });
    }
    
    if (kpis.invoiced.context) {
      summarySheet.addRow({
        field: '  Data as of',
        value: `${kpis.invoiced.context.day}/${kpis.invoiced.context.month + 1}/${kpis.invoiced.context.year}`,
      });
    }
  }

  summarySheet.addRow({ field: '', value: '' }); // Empty row

  if (kpis?.orders) {
    summarySheet.addRow({ field: 'ORDERS', value: '' });
    
    if (kpis.orders.yearly?.current) {
      summarySheet.addRow({
        field: '  Current Year Total',
        value: `${formatCurrency(kpis.orders.yearly.current.amount)} (${kpis.orders.yearly.current.customers || 0} customers)`,
      });
    }
    
    if (kpis.orders.yearly?.previous) {
      summarySheet.addRow({
        field: '  Previous Year Total',
        value: `${formatCurrency(kpis.orders.yearly.previous.amount)} (${kpis.orders.yearly.previous.customers || 0} customers)`,
      });
    }
    
    if (kpis.orders.mtd?.current) {
      summarySheet.addRow({
        field: '  MTD Current',
        value: `${formatCurrency(kpis.orders.mtd.current.amount)} (${kpis.orders.mtd.current.customers || 0} customers)`,
      });
    }
    
    if (kpis.orders.mtd?.previous) {
      summarySheet.addRow({
        field: '  MTD Previous Year',
        value: `${formatCurrency(kpis.orders.mtd.previous.amount)} (${kpis.orders.mtd.previous.customers || 0} customers)`,
      });
    }
    
    if (kpis.orders.context) {
      summarySheet.addRow({
        field: '  Data as of',
        value: `${kpis.orders.context.day}/${kpis.orders.context.month + 1}/${kpis.orders.context.year}`,
      });
    }
  }

  summarySheet.addRow({ field: '', value: '' }); // Empty row

  // Add record counts
  summarySheet.addRow({ field: 'RECORD COUNTS', value: '' });
  summarySheet.addRow({
    field: '  Invoiced 2025',
    value: records?.invoiced?.current?.length || 0,
  });
  summarySheet.addRow({
    field: '  Invoiced 2024',
    value: records?.invoiced?.previous?.length || 0,
  });
  summarySheet.addRow({
    field: '  Orders 2025',
    value: records?.orders?.current?.length || 0,
  });
  summarySheet.addRow({
    field: '  Orders 2024',
    value: records?.orders?.previous?.length || 0,
  });

  const addSheet = (title, entries = []) => {
    const sheet = workbook.addWorksheet(title);
    sheet.columns = [
      { header: '#', key: 'index', width: 6 },
      { header: 'Customer Code', key: 'code', width: 16 },
      { header: 'Customer Name', key: 'name', width: 34 },
      { header: 'Amount', key: 'amount', width: 16, style: { numFmt: '#,##0.00' } },
      { header: 'Document Date', key: 'date', width: 18, style: { numFmt: 'dd/mm/yyyy' } },
    ];

    let totalAmount = 0;
    const uniqueCustomers = new Set();

    entries.forEach((entry, idx) => {
      const excelDate = toExcelDate(entry?.date);
      const customerCode = entry?.customerCode || entry?.code || '';
      const amount = Number(entry?.amount ?? 0);
      
      totalAmount += amount;
      if (customerCode) {
        uniqueCustomers.add(customerCode);
      }
      
      const row = sheet.addRow({
        index: idx + 1,
        code: customerCode,
        name: entry?.customerName || entry?.name || '',
        amount: amount,
        date: excelDate,
      });
      row.getCell('amount').numFmt = '#,##0.00';
      if (excelDate) {
        row.getCell('date').numFmt = 'dd/mm/yyyy';
      } else {
        row.getCell('date').value = '';
      }
    });
    
    // Add summary rows at the bottom
    if (entries.length > 0) {
      sheet.addRow({}); // Empty row
      
      const summaryRow = sheet.addRow({
        index: '',
        code: '',
        name: 'TOTAL',
        amount: totalAmount,
        date: '',
      });
      summaryRow.getCell('amount').numFmt = '#,##0.00';
      summaryRow.getCell('name').font = { bold: true };
      summaryRow.getCell('amount').font = { bold: true };
      
      sheet.addRow({
        index: '',
        code: '',
        name: 'Unique Customers',
        amount: uniqueCustomers.size,
        date: '',
      });
      
      sheet.addRow({
        index: '',
        code: '',
        name: 'Total Records',
        amount: entries.length,
        date: '',
      });
    }
  };

  addSheet('Invoiced 2025', records?.invoiced?.current || []);
  addSheet('Invoiced 2024', records?.invoiced?.previous || []);
  addSheet('Orders 2025', records?.orders?.current || []);
  addSheet('Orders 2024', records?.orders?.previous || []);

  console.log('[exportKpiSourceXLSX] Creating Excel buffer...');
  const buffer = await workbook.xlsx.writeBuffer();
  console.log('[exportKpiSourceXLSX] Buffer created, size:', buffer.length, 'bytes');
  
  const base64Workbook = Buffer.from(buffer).toString('base64');
  const directory = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileUri = `${directory}TestKPI_Source_${timestamp}.xlsx`;

  console.log('[exportKpiSourceXLSX] Writing file to:', fileUri);
  await FileSystem.writeAsStringAsync(fileUri, base64Workbook, {
    encoding: FileSystem.EncodingType.Base64,
  });

  console.log('[exportKpiSourceXLSX] File written successfully');
  
  if (await Sharing.isAvailableAsync()) {
    console.log('[exportKpiSourceXLSX] Sharing file...');
    await Sharing.shareAsync(fileUri);
    console.log('[exportKpiSourceXLSX] File shared successfully');
  } else {
    console.log('[exportKpiSourceXLSX] Sharing not available, showing alert');
    Alert.alert('Export complete', `File saved at ${fileUri}`);
  }

  console.log('[exportKpiSourceXLSX] Export complete');
  return fileUri;
}

function MetricCard({
  dataset,
  period,
  metric,
  totalMetric,
  contextLabel,
  dateRangeLabel,
  previousDateRangeLabel,
  totalLabel,
  onPress,
}) {
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

  const handlePress = () =>
    onPress?.(dataset, period === 'month' ? 'mtd' : 'ytd', metric);

  // Use contextLabel if provided, otherwise build from parts
  const titleText = contextLabel || `${datasetTitle} (${dateRangeLabel || ''})`;

  return (
    <TouchableOpacity
      key={`${dataset}-${period}`}
      style={[styles.metricCard, { borderColor: accentColor }]}
      onPress={handlePress}
      activeOpacity={0.9}
    >
      <View style={styles.metricCardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.metricTitle}>{titleText}</Text>
        </View>
        <Ionicons name={iconName} size={30} color="#4b5563" />
      </View>

      <View style={styles.metricPrimaryRow}>
        <Text style={styles.metricPrimaryValue}>
          {formatCurrency(metric.current.amount)}
        </Text>
        <View style={styles.metricCustomerBadge}>
          <Text style={styles.metricCustomerText}>
            {formatCustomerCount(metric.current.customers)}
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

      <Text style={styles.metricHint}>Πατήστε για ανάλυση</Text>
      <View style={[styles.metricAccent, { backgroundColor: accentColor }]} />
    </TouchableOpacity>
  );
}

export default function TestKPI() {
  console.log('[TestKPI] Component rendering');

  const [activeMetric, setActiveMetric] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [referenceDate] = useState(() => {
    const date = new Date();
    console.log('[TestKPI] Reference date initialized:', date.toISOString());
    return date;
  });

  // USE THE HOOK - This replaces the old useState and useEffect
  console.log('[TestKPI] Calling usePlaymobilKpi hook...');
  const {
    status,
    kpis,
    customers,
    error,
    recordSets,
    isLoading,
    isError,
    metricSnapshot,
    referenceMoment,
  } = usePlaymobilKpi({ referenceDate, enabled: true, reloadToken });

  console.log('[TestKPI] Hook returned:', {
    status,
    hasKpis: !!kpis,
    customersCount: customers?.length || 0,
    hasError: !!error,
    hasRecordSets: !!recordSets,
    isLoading,
    isError
  });

  const systemDateLabel = useMemo(() => {
    const label = new Date().toLocaleDateString('el-GR');
    console.log('[TestKPI:referenceDateLabel] Computed:', label);
    return label;
  }, []);

  const handleExportSource = useCallback(async () => {
    if (!recordSets) {
      Alert.alert('Export unavailable', 'KPI data has not loaded yet.');
      return;
    }
    
    console.log('[TestKPI:handleExportSource] Starting export...');
    
    try {
      const fileUri = await exportKpiSourceXLSX(recordSets, kpis, referenceDate);
      console.log('[TestKPI:handleExportSource] Export successful:', fileUri);
      Alert.alert(
        'Export Successful', 
        'KPI source data exported successfully.',
        [{ text: 'OK' }]
      );
    } catch (exportError) {
      console.error('[TestKPI:handleExportSource] Export failed:', exportError);
      console.error('[TestKPI:handleExportSource] Error stack:', exportError?.stack);
      Alert.alert('Export failed', exportError?.message || 'Unknown error');
    }
  }, [recordSets, kpis, referenceDate]);

  const handleRefreshSheets = useCallback(async () => {
    if (isRefreshing) return;
    try {
      console.log('[TestKPI] handleRefreshSheets: START');
      setIsRefreshing(true);
      const result = await refreshAllSheetsAndCache();
      console.log('[TestKPI] handleRefreshSheets: refreshed datasets', {
        invoiced2025: result?.invoiced2025?.length,
        invoiced2024: result?.invoiced2024?.length,
        orders2025: result?.orders2025?.length,
        orders2024: result?.orders2024?.length,
        headerDates: result?._headerDates,
      });
      // Write last sync timestamp so MainHomeScreen updates immediately
      try {
        const nowISO = new Date().toISOString();
        await AsyncStorage.setItem('sync:last:playmobilSheets', nowISO);
        console.log('[TestKPI] Wrote last sync timestamp to AsyncStorage:', nowISO);
      } catch (err) {
        console.warn('[TestKPI] Failed to write last sync timestamp:', err);
      }
      // Trigger re-fetch in the hook
      setReloadToken((t) => t + 1);
      Alert.alert('Sheets refreshed', 'Τα δεδομένα ανανεώθηκαν από τα Google Sheets.');
    } catch (e) {
      console.error('[TestKPI] handleRefreshSheets ERROR:', e);
      Alert.alert('Refresh failed', e?.message || 'Unknown error');
    } finally {
      setIsRefreshing(false);
      console.log('[TestKPI] handleRefreshSheets: END');
    }
  }, [isRefreshing]);

  const handleMetricPress = (dataset, key, metric) => {
    if (!metric) return;
    setActiveMetric({
      dataset,
      key,
      metric,
    });
  };

  const closeMetricModal = () => setActiveMetric(null);

  const activeRecords = useMemo(() => {
    if (!activeMetric) {
      return { current: [], previous: [] };
    }
    const { metric } = activeMetric;
    return {
      current: Array.isArray(metric.currentRecords) ? metric.currentRecords.slice(0, 25) : [],
      previous: Array.isArray(metric.previousRecords) ? metric.previousRecords.slice(0, 25) : [],
    };
  }, [activeMetric]);

  const renderRecordRow = ({ item }) => (
    <View style={styles.recordRow}>
      <Text style={styles.recordTitle}>
        {item.customerCode || item.code} | {item.customerName || item.name || '—'}
      </Text>
      <Text style={styles.recordMeta}>
        {formatDate(item.date || item.invoiceDate || item.orderDate)} | {formatCurrency(item.amount || item.total || item.value)}
      </Text>
    </View>
  );

  // LOADING STATE
  if (isLoading) {
    console.log('[TestKPI] Rendering loading state');
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1976d2" />
        <Text style={styles.text}>Loading KPI data...</Text>
      </View>
    );
  }

  // ERROR STATE
  if (isError) {
    console.log('[TestKPI] Rendering error state:', error);
    return (
      <View style={styles.center}>
        <Text style={[styles.text, { color: '#c62828' }]}>Error: {error}</Text>
      </View>
    );
  }

  // NO DATA STATE
  if (!kpis) {
    console.log('[TestKPI] Rendering no data state');
    return (
      <View style={styles.center}>
        <Text style={styles.text}>No KPI data available.</Text>
      </View>
    );
  }

  console.log('[TestKPI] Rendering main content');

  const { invoiced, orders, totals: recordTotals } = metricSnapshot;

  // Build labels from the hook-provided referenceMoment (header-derived)
  const monthLabel = capitalize(
    referenceMoment.toLocaleString('el-GR', { month: 'long' })
  );
  const currentYear = referenceMoment.getFullYear();
  const currentYearLabel = String(currentYear);
  const currentDay = referenceMoment.getDate();
  const currentDayDisplay = currentDay.toString();
  const monthNumber = (referenceMoment.getMonth() + 1).toString().padStart(2, '0');
  const monthRangeLabel = `1-${currentDayDisplay}/${monthNumber}`;
  const previousYear = currentYear - 1;
  const ytdRangeLabel = `01/01-${currentDayDisplay}/${monthNumber}`;
  
  // Keep contextDate for informational purposes only
  const contextDate = invoiced?.context
    ? new Date(invoiced.context.year, invoiced.context.month, invoiced.context.day)
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.header}>Playmobil KPI Diagnostic</Text>
      {contextDate && (
        <Text style={styles.subHeader}>
          Latest entry date: {contextDate.toLocaleDateString('el-GR')}
        </Text>
      )}
      <View style={styles.datasetSummary}>
        <Text style={styles.datasetLine}>
          Invoiced rows 2025: {recordTotals.invoicedCurrent.toLocaleString('el-GR')} | 2024: {recordTotals.invoicedPrevious.toLocaleString('el-GR')}
        </Text>
        <Text style={styles.datasetLine}>
          Orders rows 2025: {recordTotals.ordersCurrent.toLocaleString('el-GR')} | 2024: {recordTotals.ordersPrevious.toLocaleString('el-GR')}
        </Text>
      </View>
      <View style={styles.actionsRow}>
        <View />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.systemTag}>System: {systemDateLabel}</Text>
          <TouchableOpacity
            style={[styles.iconButton, isRefreshing && styles.iconButtonDisabled]}
            onPress={handleRefreshSheets}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color="#1e88e5" />
            ) : (
              <Ionicons name="refresh-outline" size={20} color="#1e88e5" />
            )}
          </TouchableOpacity>
        <TouchableOpacity style={styles.exportButton} onPress={handleExportSource}>
          <Text style={styles.exportButtonText}>Export KPI Source</Text>
        </TouchableOpacity>
        </View>
      </View>

      <View style={styles.cardGrid}>
        <MetricCard
          dataset="invoiced"
          period="month"
          metric={invoiced?.mtd}
          totalMetric={invoiced?.monthly}
          contextLabel={`Τιμολογήσεις ${monthLabel} (${monthRangeLabel})`}
          dateRangeLabel={monthRangeLabel}
          previousDateRangeLabel={`Τιμολογήσεις ${monthLabel} ${previousYear} (${monthRangeLabel})`}
          totalLabel={`Σύνολο ${monthLabel} ${previousYear}`}
          onPress={handleMetricPress}
        />
        <MetricCard
          dataset="orders"
          period="month"
          metric={orders?.mtd}
          totalMetric={orders?.monthly}
          contextLabel={`Παραγγελίες ${monthLabel} (${monthRangeLabel})`}
          dateRangeLabel={monthRangeLabel}
          previousDateRangeLabel={`Παραγγελίες ${monthLabel} ${previousYear} (${monthRangeLabel})`}
          totalLabel={`Σύνολο ${monthLabel} ${previousYear}`}
          onPress={handleMetricPress}
        />
        <MetricCard
          dataset="invoiced"
          period="year"
          metric={invoiced?.ytd}
          totalMetric={invoiced?.yearly}
          contextLabel={`Ετήσιες Τιμολογήσεις ${currentYearLabel} (${ytdRangeLabel})`}
          dateRangeLabel={ytdRangeLabel}
          previousDateRangeLabel={`Τιμολογήσεις ${previousYear} (${ytdRangeLabel})`}
          totalLabel={`Σύνολο ${previousYear}`}
          onPress={handleMetricPress}
        />
        <MetricCard
          dataset="orders"
          period="year"
          metric={orders?.ytd}
          totalMetric={orders?.yearly}
          contextLabel={`Ετήσιες Παραγγελίες ${currentYearLabel} (${ytdRangeLabel})`}
          dateRangeLabel={ytdRangeLabel}
          previousDateRangeLabel={`Παραγγελίες ${previousYear} (${ytdRangeLabel})`}
          totalLabel={`Σύνολο ${previousYear}`}
          onPress={handleMetricPress}
        />
      </View>

      {activeMetric ? (
        <Modal
          transparent
          animationType="slide"
          visible
          onRequestClose={closeMetricModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {DATASET_LABELS[activeMetric.dataset] || activeMetric.dataset} ·{' '}
                  {METRIC_LABELS[activeMetric.key] || activeMetric.key}
                </Text>
                <TouchableOpacity onPress={closeMetricModal} style={styles.modalClose}>
                  <Text style={styles.modalCloseText}>Close</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalSummary}>
                <Text style={styles.modalSummaryText}>
                  2025: {formatCurrency(activeMetric.metric.current.amount)} |{' '}
                  {formatCustomers(activeMetric.metric.current.customers)}
                </Text>
                <Text style={styles.modalSummaryText}>
                  2024: {formatCurrency(activeMetric.metric.previous.amount)} |{' '}
                  {formatCustomers(activeMetric.metric.previous.customers)}
                </Text>
                <Text style={styles.modalSummaryText}>
                  Diff: {formatCurrency(activeMetric.metric.diff.amount)} |{' '}
                  {formatPercent(activeMetric.metric.diff.percent)}
                </Text>
              </View>

              <Text style={styles.modalSectionTitle}>Top customers (2025)</Text>
              <FlatList
                data={activeRecords.current}
                keyExtractor={(item, index) => `${item.code}-${index}`}
                renderItem={renderRecordRow}
                ListEmptyComponent={
                  <Text style={styles.modalEmpty}>No matching records for 2025.</Text>
                }
                style={styles.modalList}
              />

              <Text style={[styles.modalSectionTitle, { marginTop: 16 }]}>
                Comparison customers (2024)
              </Text>
              <FlatList
                data={activeRecords.previous}
                keyExtractor={(item, index) => `${item.code}-prev-${index}`}
                renderItem={renderRecordRow}
                ListEmptyComponent={
                  <Text style={styles.modalEmpty}>No matching records for 2024.</Text>
                }
                style={styles.modalList}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  scrollContent: { padding: 16, paddingBottom: 32 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f6fa',
    paddingHorizontal: 24,
  },
  text: { fontSize: 16, color: '#333', marginTop: 12, textAlign: 'center' },
  header: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1976d2',
    marginBottom: 4,
    textAlign: 'center',
  },
  subHeader: { fontSize: 14, color: '#455a64', marginBottom: 20, textAlign: 'center' },
  datasetSummary: {
    backgroundColor: '#e8f1ff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  referenceTag: { fontSize: 13, color: '#546e7a' },
  systemTag: { fontSize: 12, color: '#6b7280', marginRight: 6 },
  exportButton: {
    backgroundColor: '#1e88e5',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  exportButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cfe1fb',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7fbff',
    marginRight: 10,
  },
  iconButtonDisabled: {
    opacity: 0.6,
  },

  datasetLine: { fontSize: 13, color: '#1f3a6d', marginBottom: 4 },
  cardGrid: {
    width: '100%',
    marginBottom: 24,
  },
  metricCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    width: '100%',
    alignSelf: 'stretch',
    flexGrow: 1,
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
  metricLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  metricCaption: {
    fontSize: 11,
    color: '#6b7280',
    textTransform: 'uppercase',
    marginTop: 2,
    letterSpacing: 0.3,
  },
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
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#37474f', marginBottom: 12 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 26,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', flex: 1, marginRight: 12 },
  modalClose: { paddingHorizontal: 10, paddingVertical: 6 },
  modalCloseText: { color: '#1e88e5', fontWeight: '600', fontSize: 14 },
  modalSummary: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  modalSummaryText: { fontSize: 14, color: '#1f2937', marginBottom: 4 },
  modalSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 6,
  },
  modalList: { maxHeight: 160 },
  modalEmpty: { fontSize: 13, color: '#6b7280', textAlign: 'center', paddingVertical: 8 },
  recordRow: {
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#dde3eb',
  },
  recordTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  recordMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
});
