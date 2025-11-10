// /src/screens/CustomerSalesSummary.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import SafeScreen from '../components/SafeScreen';
import KpiDataModal from '../components/KpiDataModal';
import { loadSpreadsheet } from '../services/spreadsheetCache';
import { getKivosSpreadsheetRow } from '../services/kivosSpreadsheet';
import { getKivosCreditBreakdown } from '../services/kivosCreditBreakdown';
import { calculateCustomerMetrics, getCustomerBalance } from '../services/playmobilCustomerMetrics';
import { getCustomersFromLocal } from '../utils/localData';
import { parseLocaleNumber } from '../utils/numberFormat';
import colors from '../theme/colors';

const STATUS = { IDLE: 'idle', LOADING: 'loading', READY: 'ready', ERROR: 'error' };

const sanitize = (value) => {
  if (value == null) return 'N/A';
  const text = String(value).trim();
  return text ? text : 'N/A';
};

const toNumber = (value, fallback = null) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  const parsed = parseLocaleNumber(value, { defaultValue: Number.NaN });
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatCurrency = (value, { fallback = '—' } = {}) => {
  const numeric = typeof value === 'number' ? value : toNumber(value, null);
  return Number.isFinite(numeric)
    ? numeric.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })
    : fallback;
};

export default function CustomerSalesSummary({ route, navigation }) {
  const customerId = route?.params?.customerId;
  const brand = route?.params?.brand || 'playmobil';

  if (brand === 'kivos') {
    return <KivosSalesSummary customerId={customerId} />;
  }

  if (brand === 'john') {
    return (
      <SafeScreen>
        <View style={styles.center}>
          <Text>John Hellas sales summary coming soon</Text>
        </View>
      </SafeScreen>
    );
  }

  return <PlaymobilSalesSummary customerId={customerId} navigation={navigation} />;
}

function PlaymobilSalesSummary({ customerId, navigation }) {
  const [customer, setCustomer] = useState(null);
  const [rows, setRows] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [balance, setBalance] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null); // debug snapshot for troubleshooting
  const [status, setStatus] = useState(STATUS.LOADING);
  
  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalData, setModalData] = useState({ title: '', data: [], type: '' });

  const now = new Date();
  const currentYear = now.getFullYear();
  const previousYear = currentYear - 1;
  const currentMonthName = now.toLocaleString('el-GR', { month: 'long' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getCustomersFromLocal('playmobil');
        const found = Array.isArray(list) ? list.find((c) => c.id === customerId) : null;
        if (!cancelled) {
          setCustomer(found || null);
        }

        const customerCode = found?.customerCode;
        if (!customerCode) {
          throw new Error('Customer code not found');
        }

        // Load spreadsheet data for budget and open orders
        // FORCE REFRESH to re-parse with new semicolon-aware parser
        console.log('[CustomerSalesSummary] Loading playmobilSales sheet (force refresh)...');
        const sheetRows = await loadSpreadsheet('playmobilSales', { force: true });
        console.log('[CustomerSalesSummary] Sheet loaded, rows:', Array.isArray(sheetRows) ? sheetRows.length : 'null');
        // Capture a tiny debug snapshot of first two rows (headers + first data) to help trace indices
        const snapshot = Array.isArray(sheetRows) ? sheetRows.slice(0, 2) : [];
        
        // Calculate metrics from KPI data
        const calculatedMetrics = await calculateCustomerMetrics(customerCode, now);
        
        // Get balance from balance sheet
        const customerBalance = await getCustomerBalance(customerCode);
        
        if (!cancelled) {
          setRows(Array.isArray(sheetRows) ? sheetRows : []);
          setMetrics(calculatedMetrics);
          setBalance(customerBalance);
          setDebugInfo({ headerPreview: snapshot });
          setStatus(STATUS.READY);
        }
      } catch (error) {
        console.warn('[CustomerSalesSummary] Playmobil fetch failed', {
          customerId,
          message: error?.message || error,
        });
        if (!cancelled) {
          setStatus(STATUS.ERROR);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const content = useMemo(() => {
    if (status === STATUS.LOADING) {
      return <ActivityIndicator size="large" color={colors.primary} />;
    }
    if (status === STATUS.ERROR) {
      return <Text style={styles.error}>Αποτυχία φόρτωσης δεδομένων</Text>;
    }
    if (!metrics) {
      return <Text style={styles.error}>Δεν υπάρχουν δεδομένα πωλήσεων</Text>;
    }

    // --- Dynamic header parsing for playmobilSales sheet ---
    // Headers are at row 5 (index 4) in this specific sheet
    console.log('[CustomerSalesSummary] Total rows loaded:', rows.length);
    console.log('[CustomerSalesSummary] Row 5 (index 4):', rows[4]);
    
    // The header row is at index 4 (row 5 in Excel)
    const headerRow = rows[4];
    console.log('[CustomerSalesSummary] Header row found:', headerRow ? 'YES' : 'NO');
    console.log('[CustomerSalesSummary] Header row content:', headerRow);
    
    const headerMap = {};
    if (headerRow && Array.isArray(headerRow)) {
      headerRow.forEach((cell, idx) => {
        const key = String(cell || '').trim();
        if (key) {
          headerMap[key.toLowerCase()] = idx;
          // Also store original case for debugging
          if (idx <= 25) { // Log first 26 columns
            console.log(`[CustomerSalesSummary] Column ${idx}: "${key}"`);
          }
        }
      });
    }
    console.log('[CustomerSalesSummary] Header map keys:', Object.keys(headerMap).slice(0, 30));

    const customerCode = String(customer?.customerCode || '').trim();
    console.log('[CustomerSalesSummary] Looking for customer code:', customerCode);
    
    // Data rows start after row 5 (index 5 onwards)
    const dataRows = rows.slice(5);
    console.log('[CustomerSalesSummary] Data rows count:', dataRows.length);
    
    // Find the Bill-to column index
    const codeColIndex = headerMap['bill-to'];
    console.log('[CustomerSalesSummary] Bill-to column index:', codeColIndex);
    
    const row = dataRows.find((r) => {
      if (!Array.isArray(r)) return false;
      if (Number.isFinite(codeColIndex)) {
        const cellValue = String(r[codeColIndex] || '').trim();
        return cellValue === customerCode;
      }
      return r.some((cell) => String(cell || '').trim() === customerCode);
    });
    console.log('[CustomerSalesSummary] Matching row found:', row ? 'YES' : 'NO');
    if (row) {
      console.log('[CustomerSalesSummary] Matching row first 25 cells:', row.slice(0, 25));
    }

    // Helper to safely read by header name with fallback index list
    const readByHeader = (names, fallbackIndices = []) => {
      for (const n of names) {
        const idx = headerMap[n.toLowerCase()];
        if (Number.isFinite(idx) && row && row[idx] != null && row[idx] !== '') {
          return row[idx];
        }
      }
      for (const i of fallbackIndices) {
        if (row && Number.isFinite(i) && row[i] != null && row[i] !== '') {
          return row[i];
        }
      }
      return null;
    };

    // Use the exact column names from the sheet:
    // Column N (user index 14, array index 13): "TTL BDG 2025"
    // Column T (user index 20, array index 19): "Open Orders"
    // Column U (user index 21, array index 20): "Open Dlv's"
    // Column V (user index 22, array index 21): "Total Orders 2025"
    // Column W (user index 23, array index 22): "%O/B"
    const rawBudget = readByHeader(['TTL BDG 2025', 'ttl bdg 2025'], [13]);
    const rawOpenOrders = readByHeader(['Open Orders', 'open orders'], [19]);
    const rawOpenDlv = readByHeader(["Open Dlv's", "open dlv's", 'Open Dlvs'], [20]);
    const rawTotalOrders = readByHeader(['Total Orders 2025', 'total orders 2025'], [21]);
    const rawOB = readByHeader(['%O/B', '%o/b'], [22]);

    console.log('[CustomerSalesSummary] Raw values extracted:', {
      rawBudget,
      rawOpenOrders,
      rawOpenDlv,
      rawTotalOrders,
      rawOB
    });

    const vBudgetCurr = toNumber(rawBudget, 0);
    const vOpenOrders = toNumber(rawOpenOrders, 0);
    const vOpenDlv = toNumber(rawOpenDlv, 0);
    const vTotalOrders = toNumber(rawTotalOrders, 0);
    const vOB = sanitize(rawOB);
    
    console.log('[CustomerSalesSummary] Parsed numeric values:', {
      vBudgetCurr,
      vOpenOrders,
      vOpenDlv,
      vTotalOrders,
      vOB
    });

    // Fallback: if orders metrics still zero but KPI metrics have orders dataset, compute openOrdersAmount from metrics
    let effectiveOpenOrders = vOpenOrders;
    if (effectiveOpenOrders === 0 && metrics?.records?.orders2025?.length) {
      const alt = metrics.records.orders2025.reduce((sum, r) => {
        const val = Number(r.amount || r.total || r.value || 0);
        return sum + (Number.isFinite(val) ? val : 0);
      }, 0);
      if (alt > 0) {
        effectiveOpenOrders = alt;
      }
    }

    // Calculate Inv/Bdg percentage
    const invBdgPercent = vBudgetCurr > 0 
      ? (metrics.fullYearInvoiced2025 / vBudgetCurr) * 100 
      : null;

    // Calculate YTD change percentage
    const ytdChangePercent = metrics.ytdChangePercent;

    // Calculate MTD change percentage
    const mtdChangePercent = metrics.mtdChangePercent;

    // Handler to show modal with sales data
    const handleCardPress = (cardType) => {
      if (!metrics?.records) return;
      
      let data = [];
      let title = '';
      
      if (cardType === 'year-comparison') {
        // Card 1: Show 2024 invoiced data vs 2025 budget
        // Display 2024 invoiced records (most recent 25)
        data = metrics.records.invoiced2024;
        title = `Τιμολογήσεις ${previousYear} - Τελευταίες 25`;
      } else if (cardType === 'ytd') {
        // Card 2: Show YTD 2025 invoiced data
        // Filter for YTD (from Jan 1 to current date in 2025)
        const currentMonth = now.getMonth();
        const currentDay = now.getDate();
        
        data = metrics.records.invoiced2025.filter(record => {
          const recordDate = new Date(record.date || record.invoiceDate);
          if (recordDate.getFullYear() !== currentYear) return false;
          
          const recordMonth = recordDate.getMonth();
          const recordDay = recordDate.getDate();
          
          // Include all records up to current date
          return (recordMonth < currentMonth) || 
                 (recordMonth === currentMonth && recordDay <= currentDay);
        });
        
        title = `YTD Τιμολογήσεις ${currentYear} (έως ${currentDay}/${currentMonth + 1})`;
      } else if (cardType === 'mtd') {
        // Card 3: Show MTD (Month-to-Date) 2025 invoiced data
        // Filter for current month only, up to current day
        const currentMonth = now.getMonth();
        const currentDay = now.getDate();
        
        data = metrics.records.invoiced2025.filter(record => {
          const recordDate = new Date(record.date || record.invoiceDate);
          return recordDate.getFullYear() === currentYear &&
                 recordDate.getMonth() === currentMonth && 
                 recordDate.getDate() <= currentDay;
        });
        
        title = `${currentMonthName} ${currentYear} - MTD (1-${currentDay})`;
      } else if (cardType === 'ytd-2024') {
        // Card 2 - Previous year YTD data
        const currentMonth = now.getMonth();
        const currentDay = now.getDate();
        
        data = metrics.records.invoiced2024.filter(record => {
          const recordDate = new Date(record.date || record.invoiceDate);
          if (recordDate.getFullYear() !== previousYear) return false;
          
          const recordMonth = recordDate.getMonth();
          const recordDay = recordDate.getDate();
          
          // Include all records up to same date in previous year
          return (recordMonth < currentMonth) || 
                 (recordMonth === currentMonth && recordDay <= currentDay);
        });
        
        title = `YTD Τιμολογήσεις ${previousYear} (έως ${currentDay}/${currentMonth + 1})`;
      } else if (cardType === 'mtd-2024') {
        // Card 3 - Previous year MTD data
        const currentMonth = now.getMonth();
        const currentDay = now.getDate();
        
        data = metrics.records.invoiced2024.filter(record => {
          const recordDate = new Date(record.date || record.invoiceDate);
          return recordDate.getFullYear() === previousYear &&
                 recordDate.getMonth() === currentMonth && 
                 recordDate.getDate() <= currentDay;
        });
        
        title = `${currentMonthName} ${previousYear} - MTD (1-${currentDay})`;
      } else if (cardType === 'month-full-2024') {
        // Card 3 - Full month of previous year
        const currentMonth = now.getMonth();
        
        data = metrics.records.invoiced2024.filter(record => {
          const recordDate = new Date(record.date || record.invoiceDate);
          return recordDate.getFullYear() === previousYear &&
                 recordDate.getMonth() === currentMonth;
        });
        
        title = `${currentMonthName} ${previousYear} - Ολόκληρος μήνας`;
      }
      
      setModalData({ title, data, type: 'customer-sales' });
      setModalVisible(true);
    };

    return (
      <>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>Πωλήσεις</Text>
        </View>

        {/* Card 1: Year Comparison */}
        <View style={styles.metricCard}>
          <View style={styles.metricRow}>
            <TouchableOpacity 
              style={styles.metricHalf}
              onPress={() => handleCardPress('year-comparison')}
              activeOpacity={0.7}
            >
              <Text style={styles.label}>{`Τιμολογήσεις ${previousYear}`}</Text>
              <Text style={styles.value}>{formatCurrency(metrics.fullYearInvoiced2024)}</Text>
              <Text style={styles.cardHintSmall}>Πατήστε για λεπτομέρειες</Text>
            </TouchableOpacity>
            <View style={styles.metricHalf}>
              <Text style={styles.label}>{`Budget ${currentYear}`}</Text>
              <Text style={styles.value}>{formatCurrency(vBudgetCurr)}</Text>
              {invBdgPercent != null && (
                <Text style={styles.smallMetric}>
                  Inv/Bdg: {invBdgPercent.toFixed(1)}%
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Card 2: Year-to-Date Comparison */}
        <View style={styles.metricCard}>
          <View style={styles.metricRow}>
            <TouchableOpacity 
              style={styles.metricHalf}
              onPress={() => handleCardPress('ytd-2024')}
              activeOpacity={0.7}
            >
              <Text style={styles.label}>{`Τιμολογημένα YTD ${previousYear}`}</Text>
              <Text style={styles.value}>{formatCurrency(metrics.ytdInvoiced2024)}</Text>
              <Text style={styles.cardHintSmall}>Πατήστε για λεπτομέρειες</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.metricHalf, ytdChangePercent != null && {
                borderBottomWidth: 3,
                borderBottomColor: ytdChangePercent >= 0 ? '#4caf50' : '#f44336',
              }]}
              onPress={() => handleCardPress('ytd')}
              activeOpacity={0.7}
            >
              <Text style={styles.label}>{`Τιμολογημένα ${currentYear}`}</Text>
              <Text style={styles.value}>{formatCurrency(metrics.ytdInvoiced2025)}</Text>
              {ytdChangePercent != null && (
                <Text style={[
                  styles.percentText,
                  { color: ytdChangePercent >= 0 ? '#4caf50' : '#f44336' }
                ]}>
                  {ytdChangePercent >= 0 ? '+' : ''}{ytdChangePercent.toFixed(1)}%
                </Text>
              )}
              <Text style={styles.cardHintSmall}>Πατήστε για λεπτομέρειες</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Card 3: Month Comparison */}
        <View style={styles.metricCard}>
          <View style={styles.metricRow}>
            <View style={styles.metricHalf}>
              <Text style={styles.label}>{`Τιμολογημένα ${currentMonthName} ${previousYear}`}</Text>
              <TouchableOpacity onPress={() => handleCardPress('mtd-2024')} activeOpacity={0.7}>
                <Text style={styles.valueSmall}>MTD: {formatCurrency(metrics.mtdInvoiced2024)}</Text>
                <Text style={styles.cardHintSmall}>Πατήστε για λεπτομέρειες</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleCardPress('month-full-2024')} activeOpacity={0.7}>
                <Text style={styles.valueSmall}>Μήνας: {formatCurrency(metrics.fullMonthInvoiced2024)}</Text>
                <Text style={styles.cardHintSmall}>Πατήστε για λεπτομέρειες</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity 
              style={[styles.metricHalf, mtdChangePercent != null && {
                borderBottomWidth: 3,
                borderBottomColor: mtdChangePercent >= 0 ? '#4caf50' : '#f44336',
              }]}
              onPress={() => handleCardPress('mtd')}
              activeOpacity={0.7}
            >
              <Text style={styles.label}>{`Τιμολογημένα ${currentMonthName} ${currentYear}`}</Text>
              <Text style={styles.value}>{formatCurrency(metrics.mtdInvoiced2025)}</Text>
              {mtdChangePercent != null && (
                <Text style={[
                  styles.percentText,
                  { color: mtdChangePercent >= 0 ? '#4caf50' : '#f44336' }
                ]}>
                  {mtdChangePercent >= 0 ? '+' : ''}{mtdChangePercent.toFixed(1)}%
                </Text>
              )}
              <Text style={styles.cardHintSmall}>Πατήστε για λεπτομέρειες</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionHeader}>Ανοικτές παραγγελίες</Text>
        <View style={styles.ordersRow}>
          <View style={styles.orderBox}>
            <Text style={styles.label}>Ανοικτές παραγγελίες</Text>
            <Text style={styles.value}>{formatCurrency(effectiveOpenOrders)}</Text>
            <Text style={[styles.label, styles.orderSpacer]}>Ανοικτές προς παράδοση</Text>
            <Text style={styles.value}>{formatCurrency(vOpenDlv)}</Text>
          </View>

          <View style={styles.orderBox}>
            <Text style={styles.label}>Σύνολο ανοικτών παραγγελιών</Text>
            <Text style={styles.value}>{formatCurrency(vTotalOrders)}</Text>
            <Text style={[styles.label, styles.orderSpacer]}>% O/B</Text>
            <Text style={styles.value}>{vOB}</Text>
          </View>
        </View>

        <Text style={styles.sectionHeader}>Υπόλοιπο</Text>
        <View style={styles.balanceBox}>
          <Text style={styles.value}>{formatCurrency(balance)}</Text>
        </View>
        {__DEV__ && debugInfo ? (
          <View style={styles.debugBox}>
            <Text style={styles.debugTitle}>DEBUG HEADERS</Text>
            {Array.isArray(debugInfo.headerPreview) && debugInfo.headerPreview.map((r, i) => (
              <Text key={i} style={styles.debugLine}>{JSON.stringify(r)}</Text>
            ))}
            <Text style={styles.debugLine}>Detected columns: {Object.keys(headerMap).join(', ')}</Text>
          </View>
        ) : null}
        
        {/* Data Modal */}
        <KpiDataModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          title={modalData.title}
          data={modalData.data}
          type={modalData.type}
        />
      </>
    );
  }, [customer, currentMonthName, currentYear, previousYear, rows, status, metrics, balance, modalVisible, modalData]);

  return (
    <SafeScreen title="Σύνοψη Πωλήσεων" scroll>
      <ScrollView contentContainerStyle={styles.container}>{content}</ScrollView>
    </SafeScreen>
  );
}

function KivosSalesSummary({ customerId }) {
  const [state, setState] = useState({
    status: STATUS.LOADING,
    customer: null,
    sheetRow: null,
    creditBreakdown: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const lookup = String(customerId || '').trim();
      if (!lookup) {
        if (!cancelled) {
          setState({ status: STATUS.ERROR, customer: null, sheetRow: null, creditBreakdown: null, error: 'Δεν βρέθηκε κωδικός πελάτη.' });
        }
        return;
      }

      try {
        if (!cancelled) {
          setState((prev) => ({ ...prev, status: STATUS.LOADING, error: null }));
        }

        const local = (await getCustomersFromLocal('kivos')) || [];
        const localMatch =
          local.find((c) => String(c.id || '').trim() === lookup) ||
          local.find((c) => String(c.customerCode || '').trim() === lookup);

        let resolvedCustomer = localMatch || null;

        if (!resolvedCustomer) {
          const docSnap = await firestore().collection('customers_kivos').doc(lookup).get();
          if (docSnap.exists) {
            resolvedCustomer = { id: docSnap.id, ...docSnap.data() };
          }
        }

        const sheetCode = String(resolvedCustomer?.customerCode || lookup).trim();
        const sheetRow = sheetCode ? await getKivosSpreadsheetRow(sheetCode) : null;
        
        // Get credit breakdown for balance
        const creditBreakdown = sheetCode ? await getKivosCreditBreakdown(sheetCode) : null;

        if (!cancelled) {
          setState({
            status: STATUS.READY,
            customer: resolvedCustomer,
            sheetRow,
            creditBreakdown,
            error: null,
          });
        }
      } catch (error) {
        console.warn('[KivosSalesSummary] failed to load', error);
        if (!cancelled) {
          setState({
            status: STATUS.ERROR,
            customer: null,
            sheetRow: null,
            creditBreakdown: null,
            error: 'Δεν ήταν δυνατή η φόρτωση των δεδομένων.',
          });
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const { status, customer, sheetRow, creditBreakdown, error } = state;

  if (status === STATUS.LOADING) {
    return (
      <SafeScreen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingLabel}>Φόρτωση δεδομένων…</Text>
        </View>
      </SafeScreen>
    );
  }

  if (status === STATUS.ERROR) {
    return (
      <SafeScreen>
        <View style={styles.center}>
          <Text style={styles.error}>{error || 'Σφάλμα κατά τη φόρτωση'}</Text>
        </View>
      </SafeScreen>
    );
  }

  const sales = [
    { year: 2022, value: toNumber(customer?.InvSales2022) },
    { year: 2023, value: toNumber(customer?.InvSales2023) },
    { year: 2024, value: toNumber(customer?.InvSales2024) },
    { year: 2025, value: toNumber(sheetRow?.sales2025) },
  ];

  const sortedSales = sales
    .filter((item) => Number.isFinite(item.value))
    .sort((a, b) => b.year - a.year);

  const hasSalesData = sortedSales.length > 0;
  
  // Get balance from credit breakdown
  const balance = creditBreakdown?.balance != null 
    ? creditBreakdown.balance 
    : creditBreakdown?.total != null 
    ? creditBreakdown.total 
    : null;

  return (
    <SafeScreen title="Σύνοψη Πωλήσεων" scroll>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.sectionHeader}>Ιστορικό</Text>
        {!hasSalesData ? (
          <Text style={styles.error}>
            Δεν υπάρχουν διαθέσιμα ποσά πωλήσεων για τον συγκεκριμένο πελάτη.
          </Text>
        ) : (
          <View style={styles.kivosColumn}>
            {sortedSales.map((item, index) => {
              const reference = sortedSales[index + 1]?.value ?? null;
              const delta =
                Number.isFinite(item.value) && Number.isFinite(reference) && reference !== 0
                  ? ((item.value - reference) / reference) * 100
                  : null;
              const trendColor = delta == null ? colors.textPrimary : delta >= 0 ? '#4caf50' : '#f44336';
              
              return (
                <View 
                  key={item.year} 
                  style={[
                    styles.kivosBoxHorizontal,
                    delta != null && {
                      borderBottomWidth: 3,
                      borderBottomColor: trendColor,
                    }
                  ]}
                >
                  <View style={styles.kivosBoxContent}>
                    <Text style={styles.kivosLabel}>{`Τζίρος ${item.year}`}</Text>
                    <Text style={styles.kivosValue}>{formatCurrency(item.value)}</Text>
                  </View>
                  {delta != null && (
                    <Text style={[styles.kivosDelta, { color: trendColor }]}>
                      {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {sheetRow == null ? (
          <Text style={styles.notice}>
            Δεν βρέθηκαν δεδομένα στο αρχείο Kivos Customers για τον πελάτη.
          </Text>
        ) : null}

        {balance != null && Number.isFinite(balance) ? (
          <>
            <Text style={styles.sectionHeader}>Υπόλοιπο</Text>
            <View style={styles.balanceBox}>
              <Text style={styles.value}>{formatCurrency(balance)}</Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  error: { textAlign: 'center', color: '#c62828', marginTop: 12 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 12,
    marginBottom: 6,
  },
  metricCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginVertical: 6,
    padding: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricHalf: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    marginHorizontal: 4,
    padding: 10,
    borderRadius: 8,
  },
  label: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
  value: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  valueSmall: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginTop: 2 },
  smallMetric: { 
    fontSize: 12, 
    color: colors.primary, 
    marginTop: 4,
    fontWeight: '600'
  },
  percentText: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  cardHint: {
    fontSize: 11,
    color: '#5f6a7a',
    marginTop: 8,
    textAlign: 'right',
    fontStyle: 'italic',
  },
  cardHintSmall: {
    fontSize: 10,
    color: '#5f6a7a',
    marginTop: 4,
    fontStyle: 'italic',
  },
  ordersRow: { flexDirection: 'row', marginTop: 6 },
  orderBox: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    margin: 4,
    padding: 10,
    borderRadius: 10,
  },
  orderSpacer: { marginTop: 8 },
  balanceBox: { 
    backgroundColor: '#E3F2FD', 
    margin: 4, 
    padding: 12, 
    borderRadius: 10,
    alignItems: 'center'
  },
  kivosColumn: {
    flexDirection: 'column',
  },
  kivosBoxHorizontal: {
    width: '100%',
    backgroundColor: '#E3F2FD',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kivosBoxContent: {
    flex: 1,
  },
  kivosLabel: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: colors.textSecondary,
    marginBottom: 4,
  },
  kivosValue: { 
    fontSize: 17, 
    fontWeight: '700', 
    color: colors.textPrimary,
  },
  kivosDelta: { 
    fontSize: 16, 
    fontWeight: '700',
    marginLeft: 12,
  },
  notice: {
    marginTop: 12,
    color: '#546e7a',
    fontSize: 13,
    textAlign: 'center',
  },
  loadingLabel: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 14,
  },
  debugBox: {
    backgroundColor: '#0b395433',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  debugTitle: { 
    fontWeight: '700', 
    fontSize: 12, 
    color: '#0b3954', 
    marginBottom: 6 
  },
  debugLine: { 
    fontSize: 10, 
    color: '#0b3954' 
  },
});
