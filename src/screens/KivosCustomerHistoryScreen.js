import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';

import SafeScreen from '../components/SafeScreen';
import colors from '../theme/colors';
import { parseLocaleNumber } from '../utils/numberFormat';
import { getAllSheetsData } from '../services/kivosKpi';

const COLLECTION = 'customers_kivos';
const MONTH_NAMES = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαϊ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];

const formatCurrency = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return numeric.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' });
};

const SummaryCard = ({ label, value, helper }) => (
  <View style={styles.metricCard}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={styles.metricValue}>{value}</Text>
    {helper ? <Text style={styles.metricHelper}>{helper}</Text> : null}
  </View>
);

const MonthRow = ({ monthIndex, current, previous }) => (
  <View style={styles.row}>
    <Text style={styles.rowYear}>{MONTH_NAMES[monthIndex]}</Text>
    <Text style={styles.rowValue}>{formatCurrency(current)}</Text>
    <Text style={styles.rowValueSecondary}>{formatCurrency(previous)}</Text>
  </View>
);

const YearRow = ({ year, amount, invoices }) => (
  <View style={styles.row}>
    <Text style={styles.rowYear}>{year}</Text>
    <Text style={styles.rowValue}>{formatCurrency(amount)}</Text>
    <Text style={styles.rowValueSecondary}>{invoices} παραστατικά</Text>
  </View>
);

const KivosCustomerHistoryScreen = ({ route }) => {
  const { customerCode, customerName } = route?.params || {};

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [salesData, setSalesData] = useState(null);

  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!customerCode) {
        setError('Δεν βρέθηκε κωδικός πελάτη');
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [snapshot, sheets] = await Promise.all([
          firestore()
            .collection(COLLECTION)
            .where('customerCode', '==', customerCode)
            .limit(1)
            .get(),
          getAllSheetsData(),
        ]);

        if (!mounted) return;

        const match = snapshot.docs[0];
        if (match?.exists) {
          setDoc({ id: match.id, ...match.data() });
        }

        // Filter sheet records for this customer across all years
        const normalize = (c) => String(c || '').trim().toUpperCase();
        const codeNorm = normalize(customerCode);

        const perYear = {};
        const addYear = (yearKey, year) => {
          const records = sheets[yearKey] || [];
          const filtered = records.filter((r) => normalize(r.customerCode) === codeNorm);
          const total = filtered.reduce((sum, r) => sum + Number(r.amount || r.total || 0), 0);
          const monthly = Array(12).fill(0);
          filtered.forEach((r) => {
            const month = r.date?.getMonth?.() ?? new Date(r.date).getMonth();
            if (month >= 0 && month < 12) {
              monthly[month] += Number(r.amount || r.total || 0);
            }
          });
          perYear[year] = { total, invoices: filtered.length, monthly };
        };

        addYear('sales2025', 2025);
        addYear('sales2024', 2024);
        addYear('sales2023', 2023);
        addYear('sales2022', 2022);

        setSalesData(perYear);
        setError(null);
      } catch (err) {
        console.error('[KivosCustomerHistory] fetch error', err);
        if (mounted) setError('Σφάλμα φόρτωσης δεδομένων');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [customerCode]);

  const name = customerName || doc?.name || 'Πελάτης';
  const code = customerCode || doc?.customerCode || '—';

  const summary = useMemo(() => {
    if (!salesData) return null;
    const current = salesData[currentYear] || { total: 0, invoices: 0 };
    const previous = salesData[previousYear] || { total: 0, invoices: 0 };
    return {
      current,
      previous,
      delta: current.total - previous.total,
    };
  }, [salesData, currentYear, previousYear]);

  const monthlyRows = useMemo(() => {
    if (!salesData) return [];
    const curMonths = salesData[currentYear]?.monthly || Array(12).fill(0);
    const prevMonths = salesData[previousYear]?.monthly || Array(12).fill(0);
    return MONTH_NAMES.map((_, idx) => ({
      monthIndex: idx,
      current: curMonths[idx] || 0,
      previous: prevMonths[idx] || 0,
    }));
  }, [salesData, currentYear, previousYear]);

  const yearlyRows = useMemo(() => {
    if (!salesData) return [];
    return Object.entries(salesData)
      .map(([year, data]) => ({ year: Number(year), amount: data.total || 0, invoices: data.invoices || 0 }))
      .sort((a, b) => b.year - a.year);
  }, [salesData]);

  return (
    <SafeScreen
      title="Ιστορικό Πωλήσεων"
      scroll
      bodyStyle={styles.screenBody}
      headerLeft={
        <Text style={styles.headerSubtitle} numberOfLines={1} ellipsizeMode="tail">
          {name} ({code})
        </Text>
      }
      showUserMenu={false}
    >
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderText}>Φόρτωση...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <>
          {summary && (
            <View style={styles.metricsRow}>
              <SummaryCard label={`Σύνολο ${currentYear}`} value={formatCurrency(summary.current.total)} helper={`${summary.current.invoices} παραστατικά`} />
              <SummaryCard label={`Σύνολο ${previousYear}`} value={formatCurrency(summary.previous.total)} helper={`${summary.previous.invoices} παραστατικά`} />
              <SummaryCard
                label="Μεταβολή"
                value={formatCurrency(summary.delta)}
                helper={
                  summary.previous.total
                    ? `${(((summary.delta) / summary.previous.total) * 100).toFixed(1)}%`
                    : '—'
                }
              />
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Μηνιαία απόδοση</Text>
            <View style={styles.rowHeader}>
              <Text style={[styles.rowYear, styles.headerCol]}>Μήνας</Text>
              <Text style={[styles.rowValue, styles.headerCol]}>{currentYear}</Text>
              <Text style={[styles.rowValueSecondary, styles.headerCol]}>{previousYear}</Text>
            </View>
            <FlatList
              data={monthlyRows}
              keyExtractor={(item) => String(item.monthIndex)}
              renderItem={({ item }) => (
                <MonthRow monthIndex={item.monthIndex} current={item.current} previous={item.previous} />
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              scrollEnabled={false}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Ετήσιες πωλήσεις</Text>
            {yearlyRows.length === 0 ? (
              <Text style={styles.emptyText}>Δεν υπάρχουν δεδομένα πωλήσεων.</Text>
            ) : (
              <FlatList
                data={yearlyRows}
                keyExtractor={(item) => String(item.year)}
                renderItem={({ item }) => <YearRow year={item.year} amount={item.amount} invoices={item.invoices} />}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                scrollEnabled={false}
              />
            )}
          </View>
        </>
      )}
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  screenBody: {
    paddingHorizontal: 14,
    paddingTop: 12,
    backgroundColor: colors.background,
  },
  headerSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  loader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  loaderText: {
    marginTop: 8,
    color: colors.textSecondary,
  },
  errorBox: {
    backgroundColor: '#fdecea',
    borderColor: '#f5c6cb',
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    borderRadius: 12,
  },
  errorText: {
    color: '#b71c1c',
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  metricHelper: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  rowYear: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  rowValue: {
    fontWeight: '700',
    color: colors.textSecondary,
  },
  rowValueSecondary: {
    fontWeight: '700',
    color: colors.textSecondary,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  headerCol: {
    fontWeight: '700',
    color: colors.textSecondary,
  },
  rowDelta: {
    width: 70,
    textAlign: 'right',
    fontWeight: '700',
    color: colors.textSecondary,
  },
  deltaUp: {
    color: '#2e7d32',
  },
  deltaDown: {
    color: '#c62828',
  },
  separator: {
    height: 1,
    backgroundColor: '#f1f3f5',
  },
  emptyText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
});

export default KivosCustomerHistoryScreen;
