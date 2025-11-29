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
import Ionicons from 'react-native-vector-icons/Ionicons';
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
    return <KivosSalesSummary customerId={customerId} navigation={navigation} />;
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
  const currentMonth = now.getMonth(); // 0-11
  const currentDayOfMonth = now.getDate(); // 1-31
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
      console.log('[CustomerSalesSummary] Matching row length:', row.length);
      console.log('[CustomerSalesSummary] Matching row first 25 cells:', row.slice(0, 25));
      
      // Log key order-related columns
      console.log('[CustomerSalesSummary] Order-related column values:', {
        col19_openOrders: row[19],
        col20_openDlv: row[20],
        col21_totalOrders: row[21],
        col22_percentOB: row[22],
        col13_budget: row[13]
      });
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

    console.log('[CustomerSalesSummary] Raw values extracted from sheet:', {
      rawBudget,
      rawOpenOrders,
      rawOpenDlv,
      rawTotalOrders,
      rawOB,
      types: {
        rawBudget: typeof rawBudget,
        rawOpenOrders: typeof rawOpenOrders,
        rawOpenDlv: typeof rawOpenDlv,
        rawTotalOrders: typeof rawTotalOrders,
        rawOB: typeof rawOB
      }
    });

    const vBudgetCurr = toNumber(rawBudget, 0);
    const vOpenOrders = toNumber(rawOpenOrders, 0);
    const vOpenDlv = toNumber(rawOpenDlv, 0);
    const vTotalOrders = toNumber(rawTotalOrders, 0);
    const vOB = sanitize(rawOB);
    
    console.log('[CustomerSalesSummary] After parsing with toNumber/sanitize:', {
      vBudgetCurr,
      vOpenOrders,
      vOpenDlv,
      vTotalOrders,
      vOB,
      types: {
        vBudgetCurr: typeof vBudgetCurr,
        vOpenOrders: typeof vOpenOrders,
        vOpenDlv: typeof vOpenDlv,
        vTotalOrders: typeof vTotalOrders,
        vOB: typeof vOB
      }
    });

    // Use sheet values directly - sheet is source of truth for orders
    const effectiveOpenOrders = vOpenOrders;
    
    console.log('[CustomerSalesSummary] Final order values from sheet:', {
      effectiveOpenOrders,
      vOpenDlv,
      vTotalOrders,
      vOB,
      hasOrderRecords: !!metrics?.records?.orders2025?.length,
      orderRecordsCount: metrics?.records?.orders2025?.length || 0
    });

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

        {/* Calculate revenue split first to check if multiple salesmen */}
        {(() => {
          const salesmenSplit = {};
          let hasMultipleSalesmen = false;
          
          // Process 2025 data
          if (metrics?.records?.invoiced2025) {
            metrics.records.invoiced2025.forEach(record => {
              const salesman = record.handledBy || 'Άγνωστος';
              const amount = parseFloat(record.amount || record.total || record.value || 0);
              
              if (!salesmenSplit[salesman]) {
                salesmenSplit[salesman] = { 
                  amount: 0,           // YTD 2025
                  count: 0,            // Transaction count 2025
                  ytd2024: 0,          // YTD 2024
                  fullYear2024: 0,     // Full year 2024
                  mtd2025: 0,          // MTD current month 2025
                  mtd2024: 0,          // MTD current month 2024
                  fullMonth2024: 0,    // Full previous month 2024
                };
              }
              salesmenSplit[salesman].amount += amount;
              salesmenSplit[salesman].count += 1;
              
              // Calculate MTD 2025
              const recordDate = new Date(record.date || record.invoiceDate);
              if (recordDate.getFullYear() === currentYear && 
                  recordDate.getMonth() === currentMonth &&
                  recordDate.getDate() <= currentDayOfMonth) {
                salesmenSplit[salesman].mtd2025 += amount;
              }
            });
            
            hasMultipleSalesmen = Object.keys(salesmenSplit).length > 1;
          }
          
          // Process 2024 data for historical comparisons
          // Note: handledBy in 2024 records is already set to the CURRENT (2025) salesman
          // This ensures historical comparison uses current ownership
          if (metrics?.records?.invoiced2024) {
            console.log('[CustomerSalesSummary] Processing 2024 data with current salesman attribution');
            metrics.records.invoiced2024.forEach(record => {
              const salesman = record.handledBy || 'Άγνωστος';
              const amount = parseFloat(record.amount || record.total || record.value || 0);
              const recordDate = new Date(record.date || record.invoiceDate);
              
              console.log('[CustomerSalesSummary] 2024 record:', { salesman, amount, date: recordDate });
              
              if (!salesmenSplit[salesman]) {
                salesmenSplit[salesman] = { 
                  amount: 0, count: 0, ytd2024: 0, fullYear2024: 0, 
                  mtd2025: 0, mtd2024: 0, fullMonth2024: 0,
                };
              }
              
              // Full year 2024
              salesmenSplit[salesman].fullYear2024 += amount;
              
              // YTD 2024 (same date range as current year)
              if (recordDate.getMonth() < currentMonth || 
                  (recordDate.getMonth() === currentMonth && recordDate.getDate() <= currentDayOfMonth)) {
                salesmenSplit[salesman].ytd2024 += amount;
              }
              
              // MTD 2024 (same month, up to same day)
              if (recordDate.getMonth() === currentMonth && 
                  recordDate.getDate() <= currentDayOfMonth) {
                salesmenSplit[salesman].mtd2024 += amount;
              }
              
              // Full month 2024 (entire month)
              if (recordDate.getMonth() === currentMonth) {
                salesmenSplit[salesman].fullMonth2024 += amount;
              }
            });
          }

          const total = hasMultipleSalesmen ? Object.values(salesmenSplit).reduce((sum, s) => sum + s.amount, 0) : 0;
          const sortedSalesmen = hasMultipleSalesmen ? Object.entries(salesmenSplit).sort(([, a], [, b]) => b.amount - a.amount) : [];

          return (
            <>
              {/* Navigation Buttons */}
              <View style={styles.topNavigationButtons}>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => navigation.goBack()}
                  activeOpacity={0.7}
                >
                  <Ionicons name="arrow-back" size={20} color={colors.primary} />
                  <Text style={styles.backButtonText}>Επιστροφή στον Πελάτη</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.monthlyNavButton}
                  onPress={() => navigation.navigate('CustomerMonthlySales', {
                    customerId: customer?.id,
                    brand: 'playmobil'
                  })}
                  activeOpacity={0.7}
                >
                  <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                  <Text style={styles.monthlyNavButtonText}>Μηνιαία</Text>
                </TouchableOpacity>
              </View>
              
              {/* Customer Header */}
              {customer && (
                <View style={styles.customerHeader}>
                  <View style={styles.customerHeaderRow}>
                    <Ionicons name="business-outline" size={24} color={colors.primary} />
                    <View style={styles.customerInfo}>
                      <Text style={styles.customerName}>{customer.name}</Text>
                      <Text style={styles.customerDetail}>Κωδικός: {customer.customerCode}</Text>
                      {customer.address && (
                        <Text style={styles.customerDetail}>
                          {typeof customer.address === 'string' 
                            ? customer.address 
                            : [customer.address.street, customer.address.city, customer.address.postalCode]
                                .filter(Boolean)
                                .join(', ')
                          }
                        </Text>
                      )}
                      {!customer.address && customer.city && (
                        <Text style={styles.customerDetail}>{customer.city}</Text>
                      )}
                    </View>
                  </View>
                </View>
              )}
              
              {/* Card 1: Year Comparison */}
              <View style={styles.metricCard}>
                {hasMultipleSalesmen && (
                  <View style={styles.salesmenInfo}>
                    <Ionicons name="people-outline" size={16} color="#6b7280" />
                    <Text style={styles.salesmenInfoText}>
                      Πελάτης με {Object.keys(salesmenSplit).length} πωλητές
                    </Text>
                  </View>
                )}
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
                {hasMultipleSalesmen && (
                  <View style={styles.salesmenInfo}>
                    <Ionicons name="people-outline" size={16} color="#6b7280" />
                    <Text style={styles.salesmenInfoText}>
                      Κατανομή ανά πωλητή παρακάτω
                    </Text>
                  </View>
                )}
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

              {/* Revenue Split by Salesman - Show below cards when multiple salesmen */}
              {hasMultipleSalesmen && (
                <>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionHeader}>Κατανομή Πωλήσεων ανά Πωλητή</Text>
                  </View>
                  <View style={styles.splitCard}>
                    {sortedSalesmen.map(([salesman, data], index) => {
                      const percentage = total > 0 ? (data.amount / total) * 100 : 0;
                      
                      // Calculate percentage changes
                      const ytdChange = data.ytd2024 > 0 
                        ? ((data.amount - data.ytd2024) / data.ytd2024) * 100 
                        : null;
                      const mtdChange = data.mtd2024 > 0 
                        ? ((data.mtd2025 - data.mtd2024) / data.mtd2024) * 100 
                        : null;
                      
                      return (
                        <View key={index} style={styles.splitContainer}>
                          {/* Salesman Header */}
                          <View style={styles.splitRow}>
                            <View style={styles.splitLeft}>
                              <View style={styles.salesmanHeader}>
                                <Ionicons name="person-outline" size={16} color="#1e88e5" />
                                <Text style={styles.salesmanName}>{salesman}</Text>
                              </View>
                            </View>
                            <View style={styles.splitRight}>
                              <Text style={styles.salesmanPercent}>{percentage.toFixed(1)}%</Text>
                            </View>
                          </View>
                          
                          {/* YTD Section */}
                          <View style={styles.metricGroup}>
                            <View style={styles.metricLine}>
                              <Text style={styles.metricLabel}>YTD {currentYear}:</Text>
                              <Text style={styles.metricValue}>
                                {formatCurrency(data.amount)}
                                <Text style={styles.metricSubtext}> ({data.count} συναλλαγές)</Text>
                              </Text>
                            </View>
                            {data.ytd2024 > 0 && (
                              <>
                                <View style={styles.metricLine}>
                                  <Text style={styles.metricLabelSecondary}>YTD {previousYear}:</Text>
                                  <View style={styles.metricValueRow}>
                                    <Text style={styles.metricValueSecondary}>
                                      {formatCurrency(data.ytd2024)}
                                    </Text>
                                    {ytdChange !== null && (
                                      <Text style={[
                                        styles.changeText,
                                        { color: ytdChange >= 0 ? '#4caf50' : '#f44336' }
                                      ]}>
                                        {ytdChange >= 0 ? '+' : ''}{ytdChange.toFixed(1)}%
                                      </Text>
                                    )}
                                  </View>
                                </View>
                                <View style={styles.metricLine}>
                                  <Text style={styles.metricLabelSecondary}>Όλο {previousYear}:</Text>
                                  <Text style={styles.metricValueSecondary}>
                                    {formatCurrency(data.fullYear2024)}
                                  </Text>
                                </View>
                              </>
                            )}
                          </View>
                          
                          {/* MTD Section */}
                          <View style={styles.metricGroup}>
                            <View style={styles.metricLine}>
                              <Text style={styles.metricLabel}>MTD {currentMonthName} {currentYear}:</Text>
                              <Text style={styles.metricValue}>
                                {formatCurrency(data.mtd2025)}
                              </Text>
                            </View>
                            {data.mtd2024 > 0 && (
                              <>
                                <View style={styles.metricLine}>
                                  <Text style={styles.metricLabelSecondary}>MTD {currentMonthName} {previousYear}:</Text>
                                  <View style={styles.metricValueRow}>
                                    <Text style={styles.metricValueSecondary}>
                                      {formatCurrency(data.mtd2024)}
                                    </Text>
                                    {mtdChange !== null && (
                                      <Text style={[
                                        styles.changeText,
                                        { color: mtdChange >= 0 ? '#4caf50' : '#f44336' }
                                      ]}>
                                        {mtdChange >= 0 ? '+' : ''}{mtdChange.toFixed(1)}%
                                      </Text>
                                    )}
                                  </View>
                                </View>
                                <View style={styles.metricLine}>
                                  <Text style={styles.metricLabelSecondary}>{currentMonthName} {previousYear} (ολόκλ.):</Text>
                                  <Text style={styles.metricValueSecondary}>
                                    {formatCurrency(data.fullMonth2024)}
                                  </Text>
                                </View>
                              </>
                            )}
                          </View>
                          
                          {index < sortedSalesmen.length - 1 && <View style={styles.splitDivider} />}
                        </View>
                      );
                    })}
                  </View>
                </>
              )}
            </>
          );
        })()}

        <Text style={styles.sectionHeader}>Ανοικτές παραγγελίες</Text>
        <View style={styles.ordersRow}>
          <View style={styles.orderBox}>
            <Text style={styles.label}>Ανοικτές παραγγελίες</Text>
            <Text style={styles.value}>{formatCurrency(effectiveOpenOrders)}</Text>
            <Text style={[styles.label, styles.orderSpacer]}>Ανοικτές προς παράδοση</Text>
            <Text style={styles.value}>{formatCurrency(vOpenDlv)}</Text>
          </View>

          <View style={styles.orderBox}>
            <Text style={styles.label}>Σύνολο Παραγγελιών</Text>
            <Text style={styles.value}>{formatCurrency(vTotalOrders)}</Text>
            <Text style={[styles.label, styles.orderSpacer]}>% O/B</Text>
            <Text style={styles.value}>{vOB}</Text>
          </View>
        </View>
        
        {/* Log what's being displayed */}
        {(() => {
          console.log('[CustomerSalesSummary] RENDERING ORDERS SECTION:', {
            effectiveOpenOrders,
            vOpenDlv,
            vTotalOrders,
            vOB,
            formatted: {
              effectiveOpenOrders: formatCurrency(effectiveOpenOrders),
              vOpenDlv: formatCurrency(vOpenDlv),
              vTotalOrders: formatCurrency(vTotalOrders),
              vOB: vOB
            }
          });
          return null;
        })()}

        <Text style={styles.sectionHeader}>Υπόλοιπο</Text>
        <View style={styles.balanceBox}>
          <Text style={styles.value}>{formatCurrency(balance)}</Text>
        </View>
        
        {/* Monthly Sales Breakdown Button */}
        <TouchableOpacity
          style={styles.monthlyBreakdownButton}
          onPress={() => navigation.navigate('CustomerMonthlySales', {
            customerId: customer?.id,
            brand: 'playmobil'
          })}
          activeOpacity={0.7}
        >
          <Ionicons name="calendar-outline" size={20} color={colors.white} />
          <Text style={styles.monthlyBreakdownButtonText}>
            Μηνιαία Ανάλυση Πωλήσεων
          </Text>
          <Ionicons name="chevron-forward" size={20} color={colors.white} />
        </TouchableOpacity>
        
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

function KivosSalesSummary({ customerId, navigation }) {
  const [state, setState] = useState({
    status: STATUS.LOADING,
    customer: null,
    sheetRow: null,
    creditBreakdown: null,
    salesData: null, // Multi-year sales data
    error: null,
  });
  
  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalData, setModalData] = useState({ 
    title: '', 
    data: [], 
    previousData: [],
    year2023Data: [],
    year2022Data: [],
    type: '' 
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const lookup = String(customerId || '').trim();
      console.log('[KivosSalesSummary] Starting load for customerId:', customerId, 'lookup:', lookup);
      
      if (!lookup) {
        console.warn('[KivosSalesSummary] No customer ID provided');
        if (!cancelled) {
          setState({ 
            status: STATUS.ERROR, 
            customer: null, 
            sheetRow: null, 
            creditBreakdown: null, 
            salesData: null,
            error: 'Δεν βρέθηκε κωδικός πελάτη.' 
          });
        }
        return;
      }

      try {
        if (!cancelled) {
          setState((prev) => ({ ...prev, status: STATUS.LOADING, error: null }));
        }

        console.log('[KivosSalesSummary] Loading local customers...');
        const local = (await getCustomersFromLocal('kivos')) || [];
        console.log('[KivosSalesSummary] Local customers loaded:', local.length);
        
        const localMatch =
          local.find((c) => String(c.id || '').trim() === lookup) ||
          local.find((c) => String(c.customerCode || '').trim() === lookup);

        let resolvedCustomer = localMatch || null;
        console.log('[KivosSalesSummary] Local match found:', !!localMatch, localMatch?.customerCode);

        if (!resolvedCustomer) {
          console.log('[KivosSalesSummary] No local match, checking Firestore...');
          const docSnap = await firestore().collection('customers_kivos').doc(lookup).get();
          if (docSnap.exists) {
            resolvedCustomer = { id: docSnap.id, ...docSnap.data() };
            console.log('[KivosSalesSummary] Found in Firestore:', resolvedCustomer.customerCode);
          } else {
            console.warn('[KivosSalesSummary] Customer not found in Firestore');
          }
        }

        const sheetCode = String(resolvedCustomer?.customerCode || lookup).trim();
        console.log('[KivosSalesSummary] Using sheet code:', sheetCode);
        
        console.log('[KivosSalesSummary] Loading sheet row...');
        const sheetRow = sheetCode ? await getKivosSpreadsheetRow(sheetCode) : null;
        console.log('[KivosSalesSummary] Sheet row loaded:', !!sheetRow);
        if (sheetRow) {
          console.log('[KivosSalesSummary] Sheet row data:', {
            customerCode: sheetRow.customerCode,
            customerName: sheetRow.customerName,
            hasData: !!sheetRow
          });
        }
        
        // Get credit breakdown for balance
        console.log('[KivosSalesSummary] Loading credit breakdown...');
        const creditBreakdown = sheetCode ? await getKivosCreditBreakdown(sheetCode) : null;
        console.log('[KivosSalesSummary] Credit breakdown loaded:', !!creditBreakdown);
        if (creditBreakdown) {
          console.log('[KivosSalesSummary] Credit breakdown data:', {
            balance: creditBreakdown.balance,
            total: creditBreakdown.total,
            hasBreakdown: !!creditBreakdown.breakdown
          });
        }
        
        // Load detailed sales data for all years
        let salesData = null;
        if (sheetCode) {
          try {
            console.log('[KivosSalesSummary] Loading sales data for customer code:', sheetCode);
            const { calculateKPIs } = await import('../services/kivosKpi');
            salesData = await calculateKPIs([sheetCode], new Date());
            console.log('[KivosSalesSummary] Sales data loaded:', {
              customerCode: sheetCode,
              hasRecords: !!salesData.records,
              hasSales: !!salesData.sales,
              years: Object.keys(salesData.records || {}),
              recordCounts: {
                year2025: salesData.records?.year2025?.length || 0,
                year2024: salesData.records?.year2024?.length || 0,
                year2023: salesData.records?.year2023?.length || 0,
                year2022: salesData.records?.year2022?.length || 0,
              },
              salesAmounts: {
                year2025: salesData.sales?.year2025?.yearly?.amount || 0,
                year2024: salesData.sales?.year2024?.yearly?.amount || 0,
                year2023: salesData.sales?.year2023?.yearly?.amount || 0,
                year2022: salesData.sales?.year2022?.yearly?.amount || 0,
              }
            });
            
            // Log detailed sales structure
            if (salesData.sales) {
              Object.keys(salesData.sales).forEach(yearKey => {
                const yearSales = salesData.sales[yearKey];
                console.log(`[KivosSalesSummary] ${yearKey} sales structure:`, {
                  hasYtd: !!yearSales.ytd,
                  hasMtd: !!yearSales.mtd,
                  hasYearly: !!yearSales.yearly,
                  ytdAmount: yearSales.ytd?.amount,
                  mtdAmount: yearSales.mtd?.amount,
                  yearlyAmount: yearSales.yearly?.amount
                });
              });
            }
            
            // Log sample records
            if (salesData.records) {
              Object.keys(salesData.records).forEach(yearKey => {
                const records = salesData.records[yearKey];
                if (records && records.length > 0) {
                  console.log(`[KivosSalesSummary] ${yearKey} sample records (first 3):`, 
                    records.slice(0, 3).map(r => ({
                      date: r.date,
                      amount: r.amount,
                      customerCode: r.customerCode
                    }))
                  );
                }
              });
            }
          } catch (err) {
            console.warn('[KivosSalesSummary] Failed to load sales data:', err.message);
            console.error('[KivosSalesSummary] Error details:', err);
            console.error('[KivosSalesSummary] Stack trace:', err.stack);
          }
        } else {
          console.warn('[KivosSalesSummary] No sheet code available, skipping sales data load');
        }

        console.log('[KivosSalesSummary] Setting final state with resolved data');
        if (!cancelled) {
          setState({
            status: STATUS.READY,
            customer: resolvedCustomer,
            sheetRow,
            creditBreakdown,
            salesData,
            error: null,
          });
        }
      } catch (error) {
        console.error('[KivosSalesSummary] Load failed with error:', error);
        console.error('[KivosSalesSummary] Error message:', error.message);
        console.error('[KivosSalesSummary] Error stack:', error.stack);
        if (!cancelled) {
          setState({
            status: STATUS.ERROR,
            customer: null,
            sheetRow: null,
            creditBreakdown: null,
            salesData: null,
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

  const { status, customer, sheetRow, creditBreakdown, salesData, error } = state;
  
  const handleYearCardPress = (year) => {
    if (!salesData || !salesData.records) return;
    
    const yearKey = `year${year}`;
    const records = salesData.records[yearKey] || [];
    const previousYear = year - 1;
    const previousYearKey = `year${previousYear}`;
    const previousRecords = salesData.records[previousYearKey] || [];
    
    const year2023Records = salesData.records.year2023 || [];
    const year2022Records = salesData.records.year2022 || [];
    
    setModalData({
      title: `Πωλήσεις ${year}`,
      data: records,
      previousData: previousRecords,
      year2023Data: year2023Records,
      year2022Data: year2022Records,
      type: 'sales',
    });
    setModalVisible(true);
  };

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

  // Build sales array with detailed metrics for each year
  const sales = [];
  
  console.log('[KivosSalesSummary] Building sales array from salesData:', {
    hasSalesData: !!salesData,
    hasSales: !!salesData?.sales,
    salesKeys: salesData?.sales ? Object.keys(salesData.sales) : []
  });
  
  if (salesData?.sales) {
    const years = [2025, 2024, 2023, 2022];
    
    years.forEach(year => {
      const yearKey = `year${year}`;
      const yearData = salesData.sales[yearKey];
      
      console.log(`[KivosSalesSummary] Processing ${yearKey}:`, {
        hasYearData: !!yearData,
        ytdAmount: yearData?.ytd?.amount,
        mtdAmount: yearData?.mtd?.amount,
        yearlyAmount: yearData?.yearly?.amount,
        recordCount: salesData.records?.[yearKey]?.length || 0
      });
      
      if (yearData) {
        const salesEntry = {
          year,
          ytd: yearData.ytd?.amount,
          mtd: yearData.mtd?.amount,
          yearly: yearData.yearly?.amount,
          ytdDiff: yearData.ytd?.diff?.percent,
          mtdDiff: yearData.mtd?.diff?.percent,
          yearlyDiff: yearData.yearly?.diff?.percent,
          recordCount: salesData.records?.[yearKey]?.length || 0,
        };
        sales.push(salesEntry);
        console.log(`[KivosSalesSummary] Added ${year} to sales array:`, salesEntry);
      } else {
        console.log(`[KivosSalesSummary] No data for ${yearKey}, skipping`);
      }
    });
  } else {
    console.warn('[KivosSalesSummary] No salesData.sales available');
  }

  const sortedSales = sales
    .filter((item) => Number.isFinite(item.yearly) || Number.isFinite(item.ytd))
    .sort((a, b) => b.year - a.year);

  console.log('[KivosSalesSummary] Final sorted sales:', {
    totalSales: sales.length,
    filteredSales: sortedSales.length,
    years: sortedSales.map(s => s.year),
    amounts: sortedSales.map(s => ({ year: s.year, yearly: s.yearly }))
  });

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
        {/* Navigation Buttons */}
        <View style={styles.topNavigationButtons}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={colors.primary} />
            <Text style={styles.backButtonText}>Επιστροφή στον Πελάτη</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.monthlyNavButton}
            onPress={() => navigation.navigate('CustomerMonthlySales', {
              customerId,
              brand: 'kivos'
            })}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            <Text style={styles.monthlyNavButtonText}>Μηνιαία</Text>
          </TouchableOpacity>
        </View>
        
        <Text style={styles.sectionHeader}>Ιστορικό Πωλήσεων</Text>
        {!hasSalesData ? (
          <Text style={styles.error}>
            Δεν υπάρχουν διαθέσιμα ποσά πωλήσεων για τον συγκεκριμένο πελάτη.
          </Text>
        ) : (
          <View style={styles.kivosColumn}>
            {sortedSales.map((item, index) => {
              const reference = sortedSales[index + 1];
              const yearlyValue = item.yearly || 0;
              const referenceValue = reference?.yearly || 0;
              
              const delta = Number.isFinite(yearlyValue) && Number.isFinite(referenceValue) && referenceValue !== 0
                  ? ((yearlyValue - referenceValue) / referenceValue) * 100
                  : null;
              
              const trendColor = delta == null ? colors.textPrimary : delta >= 0 ? '#4caf50' : '#f44336';
              
              const isCurrentYear = item.year === new Date().getFullYear();
              const hasRecords = item.recordCount > 0;
              
              return (
                <TouchableOpacity 
                  key={item.year}
                  activeOpacity={hasRecords ? 0.7 : 1}
                  disabled={!hasRecords}
                  onPress={() => hasRecords && handleYearCardPress(item.year)}
                  style={[
                    styles.kivosYearCard,
                    delta != null && {
                      borderLeftWidth: 4,
                      borderLeftColor: trendColor,
                    }
                  ]}
                >
                  <View style={styles.kivosYearHeader}>
                    <Text style={styles.kivosYearTitle}>{item.year}</Text>
                    {delta != null && (
                      <Text style={[styles.kivosDelta, { color: trendColor }]}>
                        {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
                      </Text>
                    )}
                  </View>
                  
                  <View style={styles.kivosMetricsRow}>
                    {isCurrentYear && Number.isFinite(item.ytd) && (
                      <View style={styles.kivosMetricBox}>
                        <Text style={styles.kivosMetricLabel}>YTD</Text>
                        <Text style={styles.kivosMetricValue}>{formatCurrency(item.ytd)}</Text>
                        {item.ytdDiff != null && (
                          <Text style={[styles.kivosMetricDiff, { 
                            color: item.ytdDiff >= 0 ? '#4caf50' : '#f44336' 
                          }]}>
                            {item.ytdDiff >= 0 ? '+' : ''}{item.ytdDiff.toFixed(1)}%
                          </Text>
                        )}
                      </View>
                    )}
                    
                    {isCurrentYear && Number.isFinite(item.mtd) && (
                      <View style={styles.kivosMetricBox}>
                        <Text style={styles.kivosMetricLabel}>MTD</Text>
                        <Text style={styles.kivosMetricValue}>{formatCurrency(item.mtd)}</Text>
                        {item.mtdDiff != null && (
                          <Text style={[styles.kivosMetricDiff, { 
                            color: item.mtdDiff >= 0 ? '#4caf50' : '#f44336' 
                          }]}>
                            {item.mtdDiff >= 0 ? '+' : ''}{item.mtdDiff.toFixed(1)}%
                          </Text>
                        )}
                      </View>
                    )}
                    
                    {Number.isFinite(item.yearly) && (
                      <View style={styles.kivosMetricBox}>
                        <Text style={styles.kivosMetricLabel}>
                          {isCurrentYear ? 'Σύνολο' : `Σύνολο ${item.year}`}
                        </Text>
                        <Text style={styles.kivosMetricValue}>{formatCurrency(item.yearly)}</Text>
                        {item.yearlyDiff != null && (
                          <Text style={[styles.kivosMetricDiff, { 
                            color: item.yearlyDiff >= 0 ? '#4caf50' : '#f44336' 
                          }]}>
                            {item.yearlyDiff >= 0 ? '+' : ''}{item.yearlyDiff.toFixed(1)}%
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                  
                  {hasRecords && (
                    <Text style={styles.kivosCardHint}>
                      Πατήστε για λεπτομέρειες • {item.recordCount} παραστατικά
                    </Text>
                  )}
                </TouchableOpacity>
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
      
      {/* KPI Data Modal */}
      <KpiDataModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={modalData.title}
        data={modalData.data}
        previousData={modalData.previousData}
        year2023Data={modalData.year2023Data}
        year2022Data={modalData.year2022Data}
        type={modalData.type}
      />
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
  kivosYearCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  kivosYearHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  kivosYearTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  kivosMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  kivosMetricBox: {
    flex: 1,
    minWidth: 100,
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
  },
  kivosMetricLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  kivosMetricValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  kivosMetricDiff: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  kivosCardHint: {
    fontSize: 11,
    color: '#7c8791',
    marginTop: 12,
    textAlign: 'center',
    fontStyle: 'italic',
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
  splitCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  splitContainer: {
    marginBottom: 8,
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  splitDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 16,
  },
  splitLeft: {
    flex: 1,
  },
  splitRight: {
    alignItems: 'flex-end',
  },
  salesmanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  salesmanName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e88e5',
  },
  salesmanCount: {
    fontSize: 12,
    color: '#6b7280',
  },
  salesmanAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 2,
  },
  salesmanPercent: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '700',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  metricGroup: {
    marginTop: 12,
    paddingLeft: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#e5e7eb',
  },
  metricLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  metricLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'right',
  },
  metricSubtext: {
    fontSize: 11,
    fontWeight: '400',
    color: '#9ca3af',
  },
  metricLabelSecondary: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
    flex: 1,
  },
  metricValueSecondary: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textAlign: 'right',
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#f3f4f6',
  },
  salesmenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  salesmenInfoText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  topNavigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.primary,
    flex: 1,
    gap: 6,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  monthlyNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: 6,
  },
  monthlyNavButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  customerHeader: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  customerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  customerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  customerDetail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  monthlyBreakdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    gap: 8,
  },
  monthlyBreakdownButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
});
