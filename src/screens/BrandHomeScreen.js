// src/screens/BrandHomeScreen.js
import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ExcelJS from 'exceljs';
import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import SafeScreen from '../components/SafeScreen';
import colors from '../theme/colors';
import { normalizeBrandKey, BRAND_LABEL } from '../constants/brands';
import PlaymobilKpiCards from '../components/PlaymobilKpiCards';
import KpiDataModal from '../components/KpiDataModal';
import usePlaymobilKpi from '../hooks/usePlaymobilKpi';
import { refreshAllSheetsAndCache } from '../services/playmobilKpi';

const BRAND_ART = {
  playmobil: require('../../assets/playmobil_logo.png'),
  kivos: require('../../assets/kivos_logo.png'),
  john: require('../../assets/john_hellas_logo.png'),
};

const STRINGS = {
  quickActions: '\u0393\u03c1\u03ae\u03b3\u03bf\u03c1\u03b5\u03c2 \u03b5\u03bd\u03ad\u03c1\u03b3\u03b5\u03b9\u03b5\u03c2',
  newOrder: '\u039d\u03ad\u03b1 \u03c0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03af\u03b1',
  orders: '\u0394\u03b9\u03b1\u03c7\u03b5\u03af\u03c1\u03b9\u03c3\u03b7 \u03c0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03b9\u03ce\u03bd',
  supermarket: '\u03a0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03af\u03b1 SuperMarket',
  contacts: '\u0395\u03c0\u03b1\u03c6\u03ad\u03c2', // Επαφές
  analytics: '\u0391\u03bd\u03b1\u03bb\u03c5\u03c4\u03b9\u03ba\u03ac', // Αναλυτικά
  back: '\u0395\u03c0\u03b9\u03c3\u03c4\u03c1\u03bf\u03c6\u03ae \u03c3\u03c4\u03b7\u03bd \u03ba\u03b5\u03bd\u03c4\u03c1\u03b9\u03ba\u03ae',
};

const ICONS = {
  newOrder: 'add-circle-outline',
  orders: 'file-tray-full-outline',
  supermarket: 'cart-outline',
  contacts: 'call-outline',
  analytics: 'stats-chart-outline',
  back: 'arrow-back-circle-outline',
};

const buildActions = ({
  brand,
  navigation,
  supportsSuperMarket,
  hasOrdersTab,
  navigateToStack,
}) => {
  const actions = [
    {
      key: 'new-order',
      label: STRINGS.newOrder,
      icon: ICONS.newOrder,
      onPress: () => navigation.navigate('NewOrder', { brand }),
    },
    {
      key: 'orders',
      label: STRINGS.orders,
      icon: ICONS.orders,
      onPress: () => {
        const routeNames = navigation?.getState?.()?.routeNames || [];
        if (hasOrdersTab && routeNames.includes('OrdersMgmt')) {
          navigation.navigate('OrdersMgmt', { brand });
        } else {
          navigateToStack('OrdersManagement', { brand });
        }
      },
    },
  ];

  if (supportsSuperMarket) {
    actions.splice(1, 0, {
      key: 'supermarket',
      label: STRINGS.supermarket,
      icon: ICONS.supermarket,
      onPress: () => navigateToStack('SuperMarketOrderFlow', { brand }),
    });
  }

  actions.push({
    key: 'analytics',
    label: STRINGS.analytics,
    icon: ICONS.analytics,
    onPress: () => navigation.navigate('SalesAnalytics', { brand }),
  });

  actions.push({
    key: 'contacts',
    label: STRINGS.contacts,
    icon: ICONS.contacts,
    onPress: () => navigation.navigate('BrandContacts', { brand }),
  });

  actions.push({
    key: 'back',
    label: STRINGS.back,
    icon: ICONS.back,
    onPress: () => navigateToStack('MainHome'),
  });

  return actions;
};

// Export helper functions (copied from TestKPI)
const ensureExcelSupport = () => {
  if (typeof global !== 'undefined' && typeof global.Buffer === 'undefined') {
    global.Buffer = Buffer;
  }
};

const formatCurrency = (value) =>
  Number(value ?? 0).toLocaleString('el-GR', { style: 'currency', currency: 'EUR' });

const toExcelDate = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

async function exportKpiSourceXLSX(records, kpis, referenceDate = new Date(), context = {}) {
  ensureExcelSupport();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MySalesApp';
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Field', key: 'field', width: 28 },
    { header: 'Value', key: 'value', width: 48 },
  ];

  summarySheet.addRow({ field: 'Reference Date', value: referenceDate.toISOString() });
  if (Array.isArray(context.activeSalesmenIds)) {
    summarySheet.addRow({ field: 'Salesmen Scope', value: context.activeSalesmenIds.join(', ') || 'ALL' });
  }
  if (Array.isArray(context.availableSalesmen)) {
    summarySheet.addRow({ field: 'Available Salesmen', value: context.availableSalesmen.map(s => s.id).join(', ') });
  }

  summarySheet.addRow({ field: '', value: '' });

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
  }

  if (kpis?.orders) {
    summarySheet.addRow({ field: '', value: '' });
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
  }

  // Add data sheets
  const datasets = [
    { key: 'invoiced2025', name: 'Invoiced 2025', data: records?.invoiced?.current || [] },
    { key: 'invoiced2024', name: 'Invoiced 2024', data: records?.invoiced?.previous || [] },
    { key: 'orders2025', name: 'Orders 2025', data: records?.orders?.current || [] },
    { key: 'orders2024', name: 'Orders 2024', data: records?.orders?.previous || [] },
  ];

  datasets.forEach(({ name, data }) => {
    if (!data.length) return;
    const sheet = workbook.addWorksheet(name);
    sheet.columns = [
      { header: 'Customer Code', key: 'customerCode', width: 16 },
      { header: 'Customer Name', key: 'customerName', width: 32 },
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Amount', key: 'amount', width: 14 },
    ];

    let totalAmount = 0;
    data.forEach((record) => {
      const amount = Number(record.amount || record.total || record.value || 0);
      totalAmount += amount;
      sheet.addRow({
        customerCode: record.customerCode || record.code || '',
        customerName: record.customerName || record.name || '',
        date: toExcelDate(record.date),
        amount,
      });
    });

    sheet.addRow({});
    sheet.addRow({
      customerCode: '',
      customerName: 'TOTAL',
      date: '',
      amount: totalAmount,
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const directory = FileSystem.documentDirectory || '';
  const fileUri = `${directory}PlaymobilKPI_${timestamp}.xlsx`;

  await FileSystem.writeAsStringAsync(fileUri, buffer.toString('base64'), {
    encoding: 'base64',
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Export Playmobil KPI',
    });
  }

  return fileUri;
}

const BrandHomeScreen = ({ navigation, route }) => {
  const brandParam = route?.params?.brand;
  const brand = useMemo(() => normalizeBrandKey(brandParam), [brandParam]);
  const title = BRAND_LABEL[brand] || BRAND_LABEL.playmobil;
  const art = BRAND_ART[brand] || BRAND_ART.playmobil;
  const supportsSuperMarket = Boolean(route?.params?.supportsSuperMarket);
  const routeNames = navigation?.getState?.()?.routeNames || [];
  const hasOrdersTab = routeNames.includes('OrdersMgmt');

  // KPI state for Playmobil brand only
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [referenceDate] = useState(() => new Date());
  // Salesmen filter UI state (Playmobil only)
  // Start as undefined to distinguish "not loaded yet" from "loaded as null (all)"
  const [selectedSalesmenIds, setSelectedSalesmenIds] = useState(undefined);
  const [userLinkedSalesmen, setUserLinkedSalesmen] = useState(null);
  
  // Modal state for KPI data display
  const [modalVisible, setModalVisible] = useState(false);
  const [modalData, setModalData] = useState({ title: '', data: [], type: '' });

  const isPlaymobil = brand === 'playmobil';

  // Load user's linked salesmen first (only for Playmobil)
  useEffect(() => {
    if (!isPlaymobil) return;
    
    (async () => {
      try {
        const { getUserSalesmen } = await import('../services/userService');
        const linkedSalesmen = await getUserSalesmen('playmobil');
        
        console.log('[BrandHomeScreen] User linked salesmen loaded:', linkedSalesmen.length);
        setUserLinkedSalesmen(linkedSalesmen);
      } catch (err) {
        console.error('[BrandHomeScreen] Failed to load user salesmen:', err);
        setUserLinkedSalesmen([]);
      }
    })();
  }, [isPlaymobil]);

  // Persist salesman selection per brand (Playmobil)
  // Default to user's linked salesmen instead of showing ALL company data
  useEffect(() => {
    if (!isPlaymobil || userLinkedSalesmen === null) return;
    
    (async () => {
      try {
        // Check if passed via route params (takes precedence)
        const routeSalesmenIds = route?.params?.selectedSalesmenIds;
        if (Array.isArray(routeSalesmenIds) && routeSalesmenIds.length > 0) {
          console.log('[BrandHomeScreen] Using salesmen from route params:', routeSalesmenIds);
          setSelectedSalesmenIds(routeSalesmenIds);
          return;
        }
        
        // Try to load saved selection
        const saved = await AsyncStorage.getItem('playmobil:selectedSalesmenIds');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length) {
            console.log('[BrandHomeScreen] Using saved salesmen selection:', parsed);
            setSelectedSalesmenIds(parsed);
            return;
          }
        }
        
        // No saved selection - default to user's linked salesmen (not ALL)
        if (userLinkedSalesmen.length > 0) {
          const linkedIds = userLinkedSalesmen.map(s => s.name); // Use names since KPI uses names
          console.log('[BrandHomeScreen] Defaulting to user linked salesmen:', linkedIds);
          setSelectedSalesmenIds(linkedIds);
        } else {
          // User has no linked salesmen - show nothing (will display message)
          console.log('[BrandHomeScreen] User has no linked salesmen');
          setSelectedSalesmenIds([]);
        }
      } catch (e) {
        console.warn('[BrandHomeScreen] Failed to initialize salesman selection', e?.message);
        // On error, default to user's linked salesmen
        const linkedIds = userLinkedSalesmen.map(s => s.name);
        setSelectedSalesmenIds(linkedIds);
      }
    })();
  }, [isPlaymobil, userLinkedSalesmen, route?.params?.selectedSalesmenIds]);

  // Use the KPI hook only for Playmobil - wait for filter to initialize
  const {
    status,
    error,
    metricSnapshot,
    referenceMoment,
    kpis,
    recordSets,
    isLoading: kpisLoading,
    availableSalesmen = [],
    activeSalesmenIds = [],
  } = usePlaymobilKpi({
    referenceDate,
    enabled: isPlaymobil && selectedSalesmenIds !== undefined, // Wait for initialization
    reloadToken,
    selectedSalesmenIds: selectedSalesmenIds === undefined ? null : selectedSalesmenIds,
  }) || {};

  const systemDateLabel = useMemo(() => {
    return new Date().toLocaleDateString('el-GR');
  }, []);

  const handleExportKpi = useCallback(async () => {
    if (!recordSets) {
      Alert.alert('Export unavailable', 'KPI data has not loaded yet.');
      return;
    }

    try {
      // Build context for export and dynamic filename suffix
      const selectedLabels = (availableSalesmen || [])
        .filter(s => !selectedSalesmenIds || selectedSalesmenIds.includes(s.id))
        .map(s => s.label);
      const isAll = !selectedSalesmenIds || !selectedSalesmenIds.length;
      const scopeLabel = isAll ? 'ALL' : (selectedLabels.length <= 3 ? selectedLabels.join('_') : `${selectedLabels.length}_SALES`);

      const fileUri = await exportKpiSourceXLSX(recordSets, kpis, referenceDate, {
        activeSalesmenIds,
        availableSalesmen,
        scopeLabel,
      });
      console.log('[BrandHomeScreen] Export successful:', fileUri);
      Alert.alert('Export Successful', 'KPI data exported successfully.', [{ text: 'OK' }]);
    } catch (exportError) {
      console.error('[BrandHomeScreen] Export failed:', exportError);
      Alert.alert('Export failed', exportError?.message || 'Unknown error');
    }
  }, [recordSets, kpis, referenceDate]);

  const handleRefreshSheets = useCallback(async () => {
    if (isRefreshing) return;
    try {
      setIsRefreshing(true);
      const result = await refreshAllSheetsAndCache();
      console.log('[BrandHomeScreen] Sheets refreshed:', {
        invoiced2025: result?.invoiced2025?.length,
        invoiced2024: result?.invoiced2024?.length,
        orders2025: result?.orders2025?.length,
        orders2024: result?.orders2024?.length,
        headerDates: result?._headerDates,
      });
      // Write last sync timestamp
      try {
        const nowISO = new Date().toISOString();
        await AsyncStorage.setItem('sync:last:playmobilSheets', nowISO);
        console.log('[BrandHomeScreen] Wrote last sync timestamp:', nowISO);
      } catch (err) {
        console.warn('[BrandHomeScreen] Failed to write last sync timestamp:', err);
      }
      // Trigger re-fetch in the hook
      setReloadToken((t) => t + 1);
      Alert.alert('Sheets refreshed', 'Τα δεδομένα ανανεώθηκαν από τα Google Sheets.');
    } catch (e) {
      console.error('[BrandHomeScreen] handleRefreshSheets ERROR:', e);
      Alert.alert('Refresh failed', e?.message || 'Unknown error');
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  const handleKpiCardPress = useCallback((dataset, periodType, metric) => {
    console.log('[BrandHomeScreen] KPI card pressed:', { dataset, periodType, metric });
    console.log('[BrandHomeScreen] recordSets:', recordSets);
    console.log('[BrandHomeScreen] recordSets structure:', {
      hasRecordSets: !!recordSets,
      hasInvoiced: !!recordSets?.invoiced,
      hasOrders: !!recordSets?.orders,
      invoicedCurrentLength: recordSets?.invoiced?.current?.length,
      invoicedPreviousLength: recordSets?.invoiced?.previous?.length,
      orderCurrentLength: recordSets?.orders?.current?.length,
      orderPreviousLength: recordSets?.orders?.previous?.length,
    });
    
    if (!recordSets) {
      Alert.alert('Δεδομένα μη διαθέσιμα', 'Τα δεδομένα δεν έχουν φορτωθεί ακόμα.');
      return;
    }

    const datasetTitle = dataset === 'invoiced' ? 'Τιμολογήσεις' : 'Παραγγελίες';
    
    // Use sheet reference date instead of system date
    const refDate = referenceMoment || new Date();
    console.log('[BrandHomeScreen] Using reference date from sheet:', refDate.toISOString());
    
    // Determine which records to show - include both current and previous year
    let currentRecords = [];
    let previousRecords = [];
    let title = '';
    let type = '';

    if (periodType === 'yearly') {
      // For yearly cards, show top 25 from current year and previous year
      type = 'yearly';
      const currentYearRecords = recordSets[dataset]?.current || [];
      const previousYearRecords = recordSets[dataset]?.previous || [];
      console.log('[BrandHomeScreen] Yearly - currentYearRecords length:', currentYearRecords.length);
      console.log('[BrandHomeScreen] Yearly - previousYearRecords length:', previousYearRecords.length);
      currentRecords = currentYearRecords;
      previousRecords = previousYearRecords;
      title = `${datasetTitle} - Top 25 Πελάτες (Ολόκληρο Έτος)`;
    } else if (periodType === 'ytd') {
      // For YTD cards, filter to YTD range for both years using sheet reference date
      type = 'ytd';
      const currentYearRecords = recordSets[dataset]?.current || [];
      const previousYearRecords = recordSets[dataset]?.previous || [];
      console.log('[BrandHomeScreen] YTD - currentYearRecords length:', currentYearRecords.length);
      console.log('[BrandHomeScreen] YTD - previousYearRecords length:', previousYearRecords.length);
      
      // Filter to YTD (from Jan 1 to reference date)
      const currentMonth = refDate.getMonth();
      const currentDay = refDate.getDate();
      const currentYear = refDate.getFullYear();
      const previousYear = currentYear - 1;
      
      currentRecords = currentYearRecords.filter(record => {
        const recordDate = new Date(record.date || record.Date);
        if (recordDate.getFullYear() !== currentYear) return false;
        const recordMonth = recordDate.getMonth();
        const recordDay = recordDate.getDate();
        return (recordMonth < currentMonth) || 
               (recordMonth === currentMonth && recordDay <= currentDay);
      });
      
      previousRecords = previousYearRecords.filter(record => {
        const recordDate = new Date(record.date || record.Date);
        if (recordDate.getFullYear() !== previousYear) return false;
        const recordMonth = recordDate.getMonth();
        const recordDay = recordDate.getDate();
        return (recordMonth < currentMonth) || 
               (recordMonth === currentMonth && recordDay <= currentDay);
      });
      
      console.log('[BrandHomeScreen] YTD - filtered current records length:', currentRecords.length);
      console.log('[BrandHomeScreen] YTD - filtered previous records length:', previousRecords.length);
      
      const monthName = refDate.toLocaleString('el-GR', { month: 'long' });
      title = `${datasetTitle} - YTD (1 Ιαν - ${currentDay} ${monthName})`;
    } else if (periodType === 'mtd') {
      // For monthly cards, filter to current month for both years using sheet reference date
      type = 'monthly';
      const currentYearRecords = recordSets[dataset]?.current || [];
      const previousYearRecords = recordSets[dataset]?.previous || [];
      console.log('[BrandHomeScreen] MTD - currentYearRecords length:', currentYearRecords.length);
      console.log('[BrandHomeScreen] MTD - previousYearRecords length:', previousYearRecords.length);
      
      // Filter to current month only
      const currentMonth = refDate.getMonth();
      const currentDay = refDate.getDate();
      const currentYear = refDate.getFullYear();
      const previousYear = currentYear - 1;
      
      currentRecords = currentYearRecords.filter(record => {
        const recordDate = new Date(record.date || record.Date);
        return recordDate.getMonth() === currentMonth && 
               recordDate.getDate() <= currentDay &&
               recordDate.getFullYear() === currentYear;
      });
      
      previousRecords = previousYearRecords.filter(record => {
        const recordDate = new Date(record.date || record.Date);
        return recordDate.getMonth() === currentMonth && 
               recordDate.getDate() <= currentDay &&
               recordDate.getFullYear() === previousYear;
      });
      
      console.log('[BrandHomeScreen] MTD - filtered current records length:', currentRecords.length);
      console.log('[BrandHomeScreen] MTD - filtered previous records length:', previousRecords.length);
      
      const monthName = refDate.toLocaleString('el-GR', { month: 'long' });
      title = `${datasetTitle} - ${monthName} MTD (1-${currentDay})`;
    }

    console.log('[BrandHomeScreen] Final modal data:', {
      title,
      currentRecordsLength: currentRecords.length,
      previousRecordsLength: previousRecords.length,
      type,
      sampleCurrentRecord: currentRecords[0],
      samplePreviousRecord: previousRecords[0]
    });

    setModalData({ title, data: currentRecords, previousData: previousRecords, type });
    setModalVisible(true);
  }, [recordSets]);

  const navigateToStack = useCallback(
    (routeName, params) => {
      let navigatorRef = navigation;
      let parentRef = navigation?.getParent?.();

      while (parentRef && typeof parentRef.navigate === 'function') {
        navigatorRef = parentRef;
        parentRef = parentRef.getParent?.();
      }

      if (typeof navigatorRef.navigate === 'function') {
        navigatorRef.navigate(routeName, params);
      } else {
        navigation.navigate(routeName, params);
      }
    },
    [navigation]
  );

  const goToMainHome = useCallback(() => {
    navigateToStack('MainHome');
  }, [navigateToStack]);

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = navigation.addListener('beforeRemove', (event) => {
        if (event.data.action?.type === 'GO_BACK') {
          event.preventDefault();
          goToMainHome();
        }
      });
      return () => unsubscribe();
    }, [goToMainHome, navigation])
  );

  const actions = useMemo(
    () =>
      buildActions({
        brand,
        navigation,
        supportsSuperMarket,
        hasOrdersTab,
        navigateToStack,
      }),
    [brand, navigation, supportsSuperMarket, hasOrdersTab, navigateToStack]
  );

  return (
    <SafeScreen
      title={title}
      style={styles.screen}
      bodyStyle={styles.body}
      contentContainerStyle={styles.scrollContent}
      scroll
    >
      <TouchableOpacity
        style={styles.headerCard}
        activeOpacity={0.85}
        onPress={() => navigateToStack('CompanyInfo', { brand })}
        accessibilityRole="button"
      >
        <Image source={art} style={styles.brandArt} resizeMode="contain" />
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.headerSubtitleRow}>
            <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
            <Text style={styles.headerSubtitle}>Πληροφορίες εταιρείας & IBAN</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
      </TouchableOpacity>

      {isPlaymobil && (
        <>
          <View style={styles.kpiHeader}>
            <Text style={styles.kpiTitle}>KPI Dashboard</Text>
            <View style={styles.kpiActions}>
              <Text style={styles.systemTag}>System: {systemDateLabel}</Text>
              {/* Salesmen Filter (chips) */}
              {isPlaymobil && (
                <View style={styles.salesmenFilterWrap}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <TouchableOpacity
                      style={[styles.filterChip, selectedSalesmenIds === null ? styles.filterChipActive : null]}
                      onPress={async () => {
                        console.log('[BrandHomeScreen] Setting filter to ALL');
                        setSelectedSalesmenIds(null); // All
                        try { 
                          await AsyncStorage.removeItem('playmobil:selectedSalesmenIds'); 
                          console.log('[BrandHomeScreen] Removed filter from storage');
                        } catch {}
                        setReloadToken(t => t + 1);
                      }}
                    >
                      <Text style={[styles.filterChipText, selectedSalesmenIds === null ? styles.filterChipTextActive : null]}>Όλοι</Text>
                    </TouchableOpacity>
                    {(availableSalesmen || []).map(s => {
                      const isActive = Array.isArray(selectedSalesmenIds)
                        ? selectedSalesmenIds.includes(s.id)
                        : false;
                      return (
                        <TouchableOpacity
                          key={s.id}
                          style={[styles.filterChip, isActive && styles.filterChipActive]}
                          onPress={async () => {
                            console.log('[BrandHomeScreen] Toggle filter for:', s.id);
                            const next = Array.isArray(selectedSalesmenIds) ? [...selectedSalesmenIds] : [];
                            if (isActive) {
                              // Remove from selection
                              const filtered = next.filter(id => id !== s.id);
                              const newSelection = filtered.length > 0 ? filtered : null;
                              console.log('[BrandHomeScreen] New selection after remove:', newSelection);
                              setSelectedSalesmenIds(newSelection);
                              try {
                                if (newSelection && newSelection.length) {
                                  await AsyncStorage.setItem('playmobil:selectedSalesmenIds', JSON.stringify(newSelection));
                                } else {
                                  await AsyncStorage.removeItem('playmobil:selectedSalesmenIds');
                                }
                              } catch {}
                              setReloadToken(t => t + 1); // Trigger data refresh
                            } else {
                              // Add to selection
                              next.push(s.id);
                              console.log('[BrandHomeScreen] New selection after add:', next);
                              setSelectedSalesmenIds(next);
                              try {
                                await AsyncStorage.setItem('playmobil:selectedSalesmenIds', JSON.stringify(next));
                              } catch {}
                              setReloadToken(t => t + 1); // Trigger data refresh
                            }
                            setReloadToken(t => t + 1);
                          }}
                        >
                          <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{s.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
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
              <TouchableOpacity
                style={[styles.iconButton, !recordSets && styles.iconButtonDisabled]}
                onPress={handleExportKpi}
                disabled={!recordSets}
              >
                <Ionicons name="download-outline" size={20} color="#1e88e5" />
              </TouchableOpacity>
            </View>
          </View>

          {status === 'awaiting_selection' ? (
            <View style={styles.selectionPrompt}>
              <Ionicons name="people-outline" size={64} color="#1976d2" />
              <Text style={styles.promptTitle}>Επιλογή Πωλητών</Text>
              <Text style={styles.promptText}>
                Έχετε {availableSalesmen.length} πωλητές συνδεδεμένους.{'\n'}
                Παρακαλώ επιλέξτε πωλητές για να δείτε τα KPIs.
              </Text>
              <Text style={styles.promptHint}>
                Χρησιμοποιήστε τα φίλτρα παραπάνω ή επιλέξτε "ΟΛΑ"
              </Text>
            </View>
          ) : kpisLoading ? (
            <View style={styles.kpiLoader}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.kpiLoaderText}>Φόρτωση KPI...</Text>
            </View>
          ) : error ? (
            <View style={styles.kpiError}>
              <Text style={styles.kpiErrorText}>{error}</Text>
            </View>
          ) : (
            <PlaymobilKpiCards
              status={status}
              metricSnapshot={metricSnapshot}
              referenceMoment={referenceMoment}
              error={error}
              onCardPress={handleKpiCardPress}
              activeSalesmenIds={activeSalesmenIds}
              availableSalesmen={availableSalesmen}
            />
          )}
        </>
      )}

      <Text style={styles.actionsTitle}>{STRINGS.quickActions}</Text>
      <View style={styles.actionGrid}>
        {actions.map((action) => (
          <TouchableOpacity
            key={`${brand}-${action.key}`}
            style={styles.actionCard}
            onPress={action.onPress}
            activeOpacity={0.85}
          >
            <View style={styles.actionIconWrap}>
              <Ionicons name={action.icon} size={28} color={colors.primary} />
            </View>
            <Text style={styles.actionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* KPI Data Modal */}
      <KpiDataModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={modalData.title}
        data={modalData.data}
        previousData={modalData.previousData}
        type={modalData.type}
        activeSalesmenIds={activeSalesmenIds}
        availableSalesmen={availableSalesmen}
      />
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,
    marginTop: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  brandArt: {
    width: 96,
    height: 72,
    marginRight: 18,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '48%',
    backgroundColor: colors.white,
    borderRadius: 18,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    paddingHorizontal: 12,
  },
  actionIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#e2efff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionLabel: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 8,
  },
  kpiTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  kpiActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  systemTag: {
    fontSize: 12,
    color: '#6b7280',
    marginRight: 6,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cfe1fb',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7fbff',
    marginLeft: 4,
  },
  iconButtonDisabled: {
    opacity: 0.6,
  },
  kpiLoader: {
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
  salesmenFilterWrap: {
    marginRight: 8,
    maxWidth: 220,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#eef5ff',
    borderWidth: 1,
    borderColor: '#cfe1fb',
    marginHorizontal: 4,
  },
  filterChipActive: {
    backgroundColor: '#1e88e5',
    borderColor: '#1e88e5',
  },
  filterChipText: {
    fontSize: 12,
    color: '#1e88e5',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  kpiLoaderText: {
    marginTop: 10,
    fontSize: 14,
    color: colors.textSecondary || '#495057',
  },
  kpiError: {
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  kpiErrorText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
  },
  selectionPrompt: {
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  promptTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  promptText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  promptHint: {
    fontSize: 13,
    color: '#1976d2',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default BrandHomeScreen;


