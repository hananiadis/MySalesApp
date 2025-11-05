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
import { loadSpreadsheet } from '../services/spreadsheetCache';
import { getKivosSpreadsheetRow } from '../services/kivosSpreadsheet';
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
  const [status, setStatus] = useState(STATUS.LOADING);

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

        const sheetRows = await loadSpreadsheet('playmobilSales', { force: false });
        if (!cancelled) {
          setRows(Array.isArray(sheetRows) ? sheetRows : []);
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
    if (!rows.length) {
      return <Text style={styles.error}>Δεν υπάρχουν δεδομένα πωλήσεων</Text>;
    }

    const headerIndex = rows.findIndex((r) => String(r?.[4] ?? '').trim() === 'Bill-to');
    const dataRows = headerIndex !== -1 ? rows.slice(headerIndex + 1) : rows;
    const customerCode = String(customer?.customerCode || '').trim();
    const row = dataRows.find((r) => String(r?.[4] ?? '').trim() === customerCode);

    if (!row) {
      return (
        <Text style={styles.error}>
          Δεν βρέθηκαν δεδομένα για τον πελάτη {customer?.name || customerCode || '—'}
        </Text>
      );
    }

    const vInvoicesPrev = toNumber(row[8], 0);
    const vBudgetCurr = toNumber(row[13], 0);
    const vYtdPrev = toNumber(row[10], 0);
    const vInvoicedCurr = toNumber(row[15], 0);
    const vMonthPrev = toNumber(row[11], 0);
    const vMonthCurr = toNumber(row[12], 0);
    const vOpenOrders = toNumber(row[19], 0);
    const vOpenDlv = toNumber(row[20], 0);
    const vTotalOrders = toNumber(row[21], 0);
    const vOB = sanitize(row[22]);
    const vBalance = toNumber(row[23], 0);

    const pctYtd =
      vYtdPrev && Number.isFinite(vYtdPrev) ? ((vInvoicedCurr - vYtdPrev) / vYtdPrev) * 100 : null;
    const pctMonth =
      vMonthPrev && Number.isFinite(vMonthPrev)
        ? ((vMonthCurr - vMonthPrev) / vMonthPrev) * 100
        : null;

    return (
      <>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>Πωλήσεις</Text>
          <TouchableOpacity
            style={styles.testButton}
            onPress={() => navigation.navigate('CustomerSalesSummaryTest')}
          >
            <Text style={styles.testButtonText}>TEST</Text>
          </TouchableOpacity>
        </View>

        <Metric3Cols
          labelLeft={`Τιμολογήσεις ${previousYear}`}
          labelRight={`Budget ${currentYear}`}
          leftValue={formatCurrency(vInvoicesPrev)}
          rightValue={formatCurrency(vBudgetCurr)}
        />

        <Metric3Cols
          labelLeft={`Τιμολογημένα YTD ${previousYear}`}
          labelRight={`Τιμολογημένα ${currentYear}`}
          leftValue={formatCurrency(vYtdPrev)}
          rightValue={formatCurrency(vInvoicedCurr)}
          percent={pctYtd != null ? `${pctYtd.toFixed(1)}%` : null}
        />

        <Metric3Cols
          labelLeft={`Τιμολογημένα ${currentMonthName} ${previousYear}`}
          labelRight={`Τιμολογημένα ${currentMonthName} ${currentYear}`}
          leftValue={formatCurrency(vMonthPrev)}
          rightValue={formatCurrency(vMonthCurr)}
          percent={pctMonth != null ? `${pctMonth.toFixed(1)}%` : null}
        />

        <Text style={styles.sectionHeader}>Ανοικτές παραγγελίες</Text>
        <View style={styles.ordersRow}>
          <View style={styles.orderBox}>
            <Text style={styles.label}>Ανοικτές παραγγελίες</Text>
            <Text style={styles.value}>{formatCurrency(vOpenOrders)}</Text>
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
          <Text style={styles.value}>{formatCurrency(vBalance)}</Text>
        </View>
      </>
    );
  }, [customer, currentMonthName, currentYear, navigation, previousYear, rows, status]);

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
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const lookup = String(customerId || '').trim();
      if (!lookup) {
        if (!cancelled) {
          setState({ status: STATUS.ERROR, customer: null, sheetRow: null, error: 'Δεν βρέθηκε κωδικός πελάτη.' });
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

        if (!cancelled) {
          setState({
            status: STATUS.READY,
            customer: resolvedCustomer,
            sheetRow,
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

  const { status, customer, sheetRow, error } = state;

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
  const balance = toNumber(sheetRow?.balance);

  return (
    <SafeScreen title="Σύνοψη Πωλήσεων" scroll>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.sectionHeader}>Ιστορικό</Text>
        {!hasSalesData ? (
          <Text style={styles.error}>
            Δεν υπάρχουν διαθέσιμα ποσά πωλήσεων για τον συγκεκριμένο πελάτη.
          </Text>
        ) : (
          <View style={styles.kivosRow}>
            {sortedSales.map((item, index) => {
              const reference = sortedSales[index + 1]?.value ?? null;
              const delta =
                Number.isFinite(item.value) && Number.isFinite(reference) && reference !== 0
                  ? ((item.value - reference) / reference) * 100
                  : null;
              const trendColor = delta == null ? colors.textPrimary : delta >= 0 ? 'green' : 'red';
              return (
                <View key={item.year} style={styles.kivosBox}>
                  <Text style={styles.kivosLabel}>{`Τζίρος ${item.year}`}</Text>
                  <Text style={styles.kivosValue}>{formatCurrency(item.value)}</Text>
                  {delta != null ? (
                    <Text style={[styles.kivosDelta, { color: trendColor }]}>
                      {delta.toFixed(1)}%
                    </Text>
                  ) : null}
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

        {Number.isFinite(balance) ? (
          <View style={styles.balanceBox}>
            <Text style={styles.label}>Υπόλοιπο</Text>
            <Text style={styles.value}>{formatCurrency(balance)}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeScreen>
  );
}

function Metric3Cols({ labelLeft, labelRight, leftValue, rightValue, percent }) {
  return (
    <View style={styles.metric3}>
      <View style={styles.metricBlock}>
        <Text style={styles.label}>{labelLeft}</Text>
        <Text style={styles.value}>{leftValue}</Text>
      </View>
      <View style={styles.metricBlock}>
        <Text style={styles.label}>{labelRight}</Text>
        <Text style={styles.value}>{rightValue}</Text>
      </View>
      {percent ? (
        <View style={[styles.metricBlock, styles.metricSmall]}>
          <Text style={styles.label}>Δ%</Text>
          <Text style={styles.value}>{percent}</Text>
        </View>
      ) : null}
    </View>
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
  metric3: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metricBlock: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    margin: 4,
    padding: 8,
    borderRadius: 10,
  },
  metricSmall: { flex: 0.6 },
  label: { fontSize: 13, color: colors.textSecondary },
  value: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  ordersRow: { flexDirection: 'row', marginTop: 6 },
  orderBox: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    margin: 4,
    padding: 10,
    borderRadius: 10,
  },
  orderSpacer: { marginTop: 8 },
  balanceBox: { backgroundColor: '#E3F2FD', margin: 4, padding: 12, borderRadius: 10 },
  kivosRow: { flexDirection: 'row', flexWrap: 'wrap' },
  kivosBox: {
    flexGrow: 1,
    minWidth: 140,
    backgroundColor: '#E3F2FD',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginRight: 12,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kivosLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' },
  kivosValue: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  kivosDelta: { marginTop: 4, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  testButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  testButtonText: { color: '#fff', fontSize: 13 },
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
});
