// src/screens/KivosHomeTab.js
// KPI Dashboard tab for Kivos brand
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import ExcelJS from 'exceljs';
import { Buffer } from 'buffer';

import SafeScreen from '../components/SafeScreen';
import KivosKpiCards from '../components/KivosKpiCards';
import KpiDataModal from '../components/KpiDataModal';
import { useKivosKpi } from '../hooks/useKivosKpi';
import { useAuth } from '../context/AuthProvider';
import { ROLES } from '../constants/roles';
import colors from '../theme/colors';

const BRAND_ART = {
  kivos: require('../../assets/kivos_logo.png'),
};

const BrandButton = ({ label, icon, iconName, onPress }) => (
  <TouchableOpacity style={styles.actionButton} onPress={onPress}>
    {iconName ? (
      <Ionicons name={iconName} size={32} color={colors.primary} />
    ) : (
      <Image source={icon} style={styles.brandButtonIcon} resizeMode="contain" />
    )}
    <Text style={styles.actionButtonText}>{label}</Text>
  </TouchableOpacity>
);

// Export helper functions
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

async function exportKivosKpiXLSX(records, kpis, referenceDate = new Date(), context = {}) {
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

  // Add Kivos sales summary
  if (kpis?.sales) {
    summarySheet.addRow({ field: 'KIVOS SALES', value: '' });
    ['year2025', 'year2024', 'year2023', 'year2022'].forEach(yearKey => {
      const yearData = kpis.sales[yearKey];
      if (yearData?.yearly) {
        summarySheet.addRow({
          field: `  ${yearKey.toUpperCase()} Total`,
          value: `${formatCurrency(yearData.yearly.amount)} (${yearData.yearly.customers || 0} customers)`,
        });
      }
    });
  }

  // Add data sheets for all 4 years
  const datasets = [
    { key: 'sales2025', name: 'Sales 2025', data: records?.sales?.year2025 || [] },
    { key: 'sales2024', name: 'Sales 2024', data: records?.sales?.year2024 || [] },
    { key: 'sales2023', name: 'Sales 2023', data: records?.sales?.year2023 || [] },
    { key: 'sales2022', name: 'Sales 2022', data: records?.sales?.year2022 || [] },
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
  const scopeLabel = context.scopeLabel || 'ALL';
  const directory = FileSystem.documentDirectory || '';
  const fileUri = `${directory}KivosKPI_${scopeLabel}_${timestamp}.xlsx`;

  await FileSystem.writeAsStringAsync(fileUri, buffer.toString('base64'), {
    encoding: 'base64',
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Export Kivos KPI',
    });
  }

  return fileUri;
}

const KivosHomeTab = ({ navigation, route }) => {
  const auth = useAuth();
  const user = auth?.profile || {};
  // Extract brand from route params
  const brand = route?.params?.brand || 'kivos';
  
  // KPI state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [referenceDate] = useState(() => new Date());
  const [selectedSalesmenIds, setSelectedSalesmenIds] = useState(null); // null = All
  
  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalData, setModalData] = useState({ title: '', data: [], type: '' });

  // Persist salesman selection
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('kivos:selectedSalesmenIds');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length) {
            setSelectedSalesmenIds(parsed);
          }
        }
      } catch (e) {
        console.warn('[KivosHomeTab] Failed to read saved salesman selection', e?.message);
      }
    })();
  }, []);

  // Use Kivos KPI hook
  const {
    loading: kpisLoading,
    error,
    kpis,
    recordSets,
    referenceMoment,
    availableSalesmen = [],
    activeSalesmenIds = [],
  } = useKivosKpi(selectedSalesmenIds, referenceDate, reloadToken);

  // Debug logging
  useEffect(() => {
    console.log('[KivosHomeTab] ========================================');
    console.log('[KivosHomeTab] State update:', {
      kpisLoading,
      hasError: !!error,
      errorMessage: error,
      hasKpis: !!kpis,
      hasRecordSets: !!recordSets,
      availableSalesmenCount: availableSalesmen.length,
      availableSalesmen: availableSalesmen.map(s => ({ id: s.id, label: s.label })),
      activeSalesmenIdsCount: activeSalesmenIds.length,
      activeSalesmenIds,
      selectedSalesmenIds,
    });
    
    if (kpis) {
      console.log('[KivosHomeTab] KPI data structure:', {
        hasSales: !!kpis.sales,
        hasReferenceMoment: !!kpis.referenceMoment,
        hasContext: !!kpis.context,
        hasRecords: !!kpis.records,
      });
      
      if (kpis.sales) {
        console.log('[KivosHomeTab] Sales data per year:', {
          year2025: {
            ytd: kpis.sales.year2025?.ytd?.amount || 0,
            mtd: kpis.sales.year2025?.mtd?.amount || 0,
            yearly: kpis.sales.year2025?.yearly?.amount || 0,
          },
          year2024: {
            ytd: kpis.sales.year2024?.ytd?.amount || 0,
            mtd: kpis.sales.year2024?.mtd?.amount || 0,
            yearly: kpis.sales.year2024?.yearly?.amount || 0,
          },
          year2023: {
            ytd: kpis.sales.year2023?.ytd?.amount || 0,
            mtd: kpis.sales.year2023?.mtd?.amount || 0,
            yearly: kpis.sales.year2023?.yearly?.amount || 0,
          },
          year2022: {
            ytd: kpis.sales.year2022?.ytd?.amount || 0,
            mtd: kpis.sales.year2022?.mtd?.amount || 0,
            yearly: kpis.sales.year2022?.yearly?.amount || 0,
          },
        });
      }
    }
    
    if (recordSets) {
      console.log('[KivosHomeTab] Record counts:', {
        sales2025: recordSets.sales?.year2025?.length || 0,
        sales2024: recordSets.sales?.year2024?.length || 0,
        sales2023: recordSets.sales?.year2023?.length || 0,
        sales2022: recordSets.sales?.year2022?.length || 0,
      });
      
      // Log sample records from each year
      if (recordSets.sales?.year2025?.length > 0) {
        console.log('[KivosHomeTab] Sample 2025 records:', recordSets.sales.year2025.slice(0, 3).map(r => ({
          date: r.dateStr,
          customer: r.customerCode,
          amount: r.amount,
          docType: r.docType,
        })));
      }
    }
    console.log('[KivosHomeTab] ========================================');
  }, [kpisLoading, error, kpis, recordSets, availableSalesmen, activeSalesmenIds, selectedSalesmenIds]);

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

      const fileUri = await exportKivosKpiXLSX(recordSets, kpis, referenceDate, {
        activeSalesmenIds,
        availableSalesmen,
        scopeLabel,
      });
      console.log('[KivosHomeTab] Export successful:', fileUri);
      Alert.alert('Export Successful', 'KPI data exported successfully.', [{ text: 'OK' }]);
    } catch (exportError) {
      console.error('[KivosHomeTab] Export failed:', exportError);
      Alert.alert('Export failed', exportError?.message || 'Unknown error');
    }
  }, [recordSets, kpis, referenceDate, selectedSalesmenIds, availableSalesmen, activeSalesmenIds]);

  const handleRefreshSheets = useCallback(async () => {
    if (isRefreshing) return;
    try {
      setIsRefreshing(true);
      
      console.log('[KivosHomeTab] Triggering data reload');
      
      // Write last sync timestamp
      try {
        const nowISO = new Date().toISOString();
        await AsyncStorage.setItem('sync:last:kivosSheets', nowISO);
        console.log('[KivosHomeTab] Wrote last sync timestamp:', nowISO);
      } catch (err) {
        console.warn('[KivosHomeTab] Failed to write last sync timestamp:', err);
      }
      
      // Trigger re-fetch in the hook
      setReloadToken((t) => t + 1);
      Alert.alert('Ανανέωση δεδομένων', 'Τα δεδομένα ανανεώθηκαν από τα Google Sheets.');
    } catch (e) {
      console.error('[KivosHomeTab] handleRefreshSheets ERROR:', e);
      Alert.alert('Αποτυχία ανανέωσης', e?.message || 'Άγνωστο σφάλμα');
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  const handleKpiCardPress = useCallback((dataset, periodType, metric) => {
    console.log('[KivosHomeTab] KPI card pressed:', { dataset, periodType, metric });
    
    if (!recordSets) {
      Alert.alert('Δεδομένα μη διαθέσιμα', 'Τα δεδομένα δεν έχουν φορτωθεί ακόμα.');
      return;
    }

    const datasetTitle = 'Πωλήσεις Kivos';
    
    // Use sheet reference date
    const refDate = referenceMoment || new Date();
    
    // Determine which records to show - include all 4 years
    let current2025 = [];
    let previous2024 = [];
    let year2023 = [];
    let year2022 = [];
    let title = '';
    let type = '';

    if (periodType === 'yearly') {
      type = 'yearly';
      current2025 = recordSets.sales?.year2025 || [];
      previous2024 = recordSets.sales?.year2024 || [];
      year2023 = recordSets.sales?.year2023 || [];
      year2022 = recordSets.sales?.year2022 || [];
      title = `${datasetTitle} - Top 25 Πελάτες (Ολόκληρο Έτος)`;
    } else if (periodType === 'ytd') {
      type = 'ytd';
      const allRecords2025 = recordSets.sales?.year2025 || [];
      const allRecords2024 = recordSets.sales?.year2024 || [];
      const allRecords2023 = recordSets.sales?.year2023 || [];
      const allRecords2022 = recordSets.sales?.year2022 || [];
      
      const currentMonth = refDate.getMonth();
      const currentDay = refDate.getDate();
      
      current2025 = allRecords2025.filter(record => {
        const recordDate = new Date(record.date);
        if (recordDate.getFullYear() !== 2025) return false;
        const recordMonth = recordDate.getMonth();
        const recordDay = recordDate.getDate();
        return (recordMonth < currentMonth) || 
               (recordMonth === currentMonth && recordDay <= currentDay);
      });
      
      previous2024 = allRecords2024.filter(record => {
        const recordDate = new Date(record.date);
        if (recordDate.getFullYear() !== 2024) return false;
        const recordMonth = recordDate.getMonth();
        const recordDay = recordDate.getDate();
        return (recordMonth < currentMonth) || 
               (recordMonth === currentMonth && recordDay <= currentDay);
      });
      
      year2023 = allRecords2023.filter(record => {
        const recordDate = new Date(record.date);
        if (recordDate.getFullYear() !== 2023) return false;
        const recordMonth = recordDate.getMonth();
        const recordDay = recordDate.getDate();
        return (recordMonth < currentMonth) || 
               (recordMonth === currentMonth && recordDay <= currentDay);
      });
      
      year2022 = allRecords2022.filter(record => {
        const recordDate = new Date(record.date);
        if (recordDate.getFullYear() !== 2022) return false;
        const recordMonth = recordDate.getMonth();
        const recordDay = recordDate.getDate();
        return (recordMonth < currentMonth) || 
               (recordMonth === currentMonth && recordDay <= currentDay);
      });
      
      const monthName = refDate.toLocaleString('el-GR', { month: 'long' });
      title = `${datasetTitle} - YTD (1 Ιαν - ${currentDay} ${monthName})`;
    } else if (periodType === 'mtd') {
      type = 'monthly';
      const allRecords2025 = recordSets.sales?.year2025 || [];
      const allRecords2024 = recordSets.sales?.year2024 || [];
      const allRecords2023 = recordSets.sales?.year2023 || [];
      const allRecords2022 = recordSets.sales?.year2022 || [];
      
      const currentMonth = refDate.getMonth();
      const currentDay = refDate.getDate();
      
      current2025 = allRecords2025.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate.getMonth() === currentMonth && 
               recordDate.getDate() <= currentDay &&
               recordDate.getFullYear() === 2025;
      });
      
      previous2024 = allRecords2024.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate.getMonth() === currentMonth && 
               recordDate.getDate() <= currentDay &&
               recordDate.getFullYear() === 2024;
      });
      
      year2023 = allRecords2023.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate.getMonth() === currentMonth && 
               recordDate.getDate() <= currentDay &&
               recordDate.getFullYear() === 2023;
      });
      
      year2022 = allRecords2022.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate.getMonth() === currentMonth && 
               recordDate.getDate() <= currentDay &&
               recordDate.getFullYear() === 2022;
      });
      
      const monthName = refDate.toLocaleString('el-GR', { month: 'long' });
      title = `${datasetTitle} - ${monthName} MTD (1-${currentDay})`;
    }

    setModalData({ 
      title, 
      data: current2025, 
      previousData: previous2024,
      year2023Data: year2023,
      year2022Data: year2022,
      type 
    });
    setModalVisible(true);
  }, [recordSets, referenceMoment]);

  return (
    <SafeScreen
      title="Ανανιάδου Αναστασία Κ ΣΙΑ ΟΕ"
      style={styles.screen}
      bodyStyle={styles.body}
      contentContainerStyle={styles.scrollContent}
      scroll
    >
      {/* Brand Header with Logo */}
      <TouchableOpacity
        style={styles.headerCard}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('CompanyInfo', { brand })}
        accessibilityRole="button"
      >
        <Image source={BRAND_ART.kivos} style={styles.brandArt} resizeMode="contain" />
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Ανανιάδου Αναστασία Κ ΣΙΑ ΟΕ</Text>
          <View style={styles.headerSubtitleRow}>
            <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
            <Text style={styles.headerSubtitle}>Company info & IBAN</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
      </TouchableOpacity>

      <View style={styles.kpiHeader}>
        <Text style={styles.kpiTitle}>Δείκτες Απόδοσης</Text>
        <View style={styles.kpiActions}>
          <Text style={styles.systemTag}>Ημ/νία: {systemDateLabel}</Text>
          
          {/* Salesmen Filter (chips) */}
          <View style={styles.salesmenFilterWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  (!activeSalesmenIds?.length || !selectedSalesmenIds) && styles.filterChipActive,
                ]}
                onPress={async () => {
                  setSelectedSalesmenIds(null);
                  try {
                    await AsyncStorage.removeItem('kivos:selectedSalesmenIds');
                  } catch {}
                  setReloadToken((t) => t + 1);
                }}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    (!activeSalesmenIds?.length || !selectedSalesmenIds) && styles.filterChipTextActive,
                  ]}
                >
                  Όλοι
                </Text>
              </TouchableOpacity>
              {(availableSalesmen || []).map((s) => {
                const isActive = Array.isArray(selectedSalesmenIds)
                  ? selectedSalesmenIds.includes(s.id)
                  : false;
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                    onPress={async () => {
                      let next;
                      setSelectedSalesmenIds((prev) => {
                        next = Array.isArray(prev) ? [...prev] : [];
                        if (isActive) {
                          next = next.filter((id) => id !== s.id);
                        } else {
                          next.push(s.id);
                        }
                        if (!next.length) next = null;
                        return next;
                      });
                      try {
                        if (next && next.length) {
                          await AsyncStorage.setItem('kivos:selectedSalesmenIds', JSON.stringify(next));
                        } else {
                          await AsyncStorage.removeItem('kivos:selectedSalesmenIds');
                        }
                      } catch {}
                      setReloadToken((t) => t + 1);
                    }}
                  >
                    <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
          
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

      {kpisLoading ? (
        <View style={styles.kpiLoader}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.kpiLoaderText}>Φόρτωση KPI...</Text>
        </View>
      ) : error ? (
        <View style={styles.kpiError}>
          <Text style={styles.kpiErrorText}>{error}</Text>
        </View>
      ) : !kpisLoading && availableSalesmen.length === 0 ? (
        <View style={styles.noSalesmenContainer}>
          <Ionicons name="person-outline" size={64} color="#9ca3af" />
          <Text style={styles.noSalesmenTitle}>Δεν υπάρχουν πωλητές</Text>
          <Text style={styles.noSalesmenText}>
            Δεν υπάρχουν πωλητές συνδεδεμένοι με τον λογαριασμό σας για το brand Kivos.
          </Text>
          <Text style={styles.noSalesmenHint}>
            Επικοινωνήστε με τον διαχειριστή για να συνδέσετε πελάτες με πωλητές.
          </Text>
        </View>
      ) : (
        <KivosKpiCards
          kpis={kpis}
          referenceMoment={referenceMoment}
          onCardPress={handleKpiCardPress}
        />
      )}

      {/* Quick Actions */}
      <View style={styles.actionsContainer}>
        <Text style={styles.actionsTitle}>Γρήγορες ενέργειες</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('NewOrder', { brand })}
          >
            <Ionicons name="add-circle-outline" size={32} color={colors.primary} />
            <Text style={styles.actionButtonText}>Νέα παραγγελία</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              const parentNav = navigation.getParent?.();
              if (parentNav?.navigate) {
                parentNav.navigate('KivosBrandStatistics', { brand });
              } else {
                navigation.navigate('KivosBrandStatistics', { brand });
              }
            }}
          >
            <Ionicons name="stats-chart-outline" size={32} color={colors.primary} />
            <Text style={styles.actionButtonText}>Στατιστικά & Πωλήσεις</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              // Navigate to Orders Management tab if available, otherwise use stack navigator
              const state = navigation.getState();
              const routeNames = state?.routeNames || [];
              if (routeNames.includes('OrdersMgmt')) {
                navigation.navigate('OrdersMgmt', { brand });
              } else {
                // Navigate up to parent and then to OrdersManagement
                const parentNav = navigation.getParent();
                if (parentNav) {
                  parentNav.navigate('OrdersManagement', { brand });
                }
              }
            }}
          >
            <Ionicons name="file-tray-full-outline" size={32} color={colors.primary} />
            <Text style={styles.actionButtonText}>Διαχείριση παραγγελιών</Text>
          </TouchableOpacity>
          
          {user.role === ROLES.WAREHOUSE_MANAGER && user.brands?.includes("kivos") && (
            <BrandButton
              label="Αποθήκη"
              iconName="storefront-outline"
              onPress={() => navigation.navigate("KivosWarehouseNavigator")}
            />
          )}

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              // Navigate back to MainHome
              const parentNav = navigation.getParent();
              if (parentNav) {
                parentNav.navigate('MainHome');
              }
            }}
          >
            <Ionicons name="arrow-back-circle-outline" size={32} color={colors.primary} />
            <Text style={styles.actionButtonText}>Επιστροφή στην κεντρική</Text>
          </TouchableOpacity>
        </View>
      </View>

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
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  brandArt: {
    width: 70,
    height: 70,
    marginRight: 16,
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  kpiHeader: {
    marginTop: 12,
    marginBottom: 12,
  },
  kpiTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  kpiActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  systemTag: {
    fontSize: 12,
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    fontWeight: '500',
  },
  salesmenFilterWrap: {
    flex: 1,
    marginRight: 8,
  },
  filterChip: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterChipActive: {
    backgroundColor: '#1e88e5',
    borderColor: '#1e88e5',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  iconButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  iconButtonDisabled: {
    opacity: 0.5,
  },
  kpiLoader: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiLoaderText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  kpiError: {
    padding: 20,
    backgroundColor: '#fee',
    borderRadius: 12,
    marginVertical: 20,
  },
  kpiErrorText: {
    fontSize: 14,
    color: '#c62828',
    textAlign: 'center',
  },
  noSalesmenContainer: {
    paddingVertical: 60,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    marginVertical: 20,
  },
  noSalesmenTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  noSalesmenText: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  noSalesmenHint: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  actionsContainer: {
    marginTop: 24,
    marginBottom: 16,
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    minWidth: 100,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  brandButtonIcon: {
    width: 40,
    height: 40,
  },
  actionButtonText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
});

export default KivosHomeTab;
