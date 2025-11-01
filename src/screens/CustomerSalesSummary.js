// /src/screens/CustomerSalesSummary.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SafeScreen from '../components/SafeScreen';
import { loadSpreadsheet } from '../services/spreadsheetCache';
import colors from '../theme/colors';

// -------------------- CONFIG --------------------
const STATUS = { IDLE: 'idle', LOADING: 'loading', READY: 'ready', ERROR: 'error' };
const sanitize = (v) => (!v || String(v).trim() === '' ? 'N/A' : String(v).trim());
const toNumber = (v) => {
  if (v == null || v === '') return 0;
  const cleaned = String(v).replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

// -------------------- MAIN --------------------
export default function CustomerSalesSummary({ route, navigation }) {
  const customerId = route?.params?.customerId;
  const brand = route?.params?.brand || 'playmobil';

  if (brand === 'kivos') return <KivosSalesSummary customerId={customerId} />;
  if (brand === 'john')
    return (
      <SafeScreen>
        <View style={styles.center}>
          <Text>John Hellas sales summary coming soon</Text>
        </View>
      </SafeScreen>
    );

  // -------------------- PLAYMOBIL --------------------
  const [customer, setCustomer] = useState(null);
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState(STATUS.LOADING);

  const now = new Date();
  const currentYear = now.getFullYear();
  const previousYear = currentYear - 1;
  const currentMonthName = now.toLocaleString('el-GR', { month: 'long' });

  useEffect(() => {
    (async () => {
      try {
        const json = await AsyncStorage.getItem('customers');
        const list = json ? JSON.parse(json) : [];
        const found = list.find((c) => c.id === customerId);
        setCustomer(found);

        const rows = await loadSpreadsheet('playmobilSales', { force: false });
        setRows(rows);
        setStatus(STATUS.READY);
      } catch (e) {
        console.warn(e);
        setStatus(STATUS.ERROR);
      }
    })();
  }, [customerId]);

  const renderPlaymobil = useMemo(() => {
    if (status === STATUS.LOADING)
      return <ActivityIndicator size="large" color={colors.primary} />;
    if (status === STATUS.ERROR)
      return <Text style={styles.error}>Αποτυχία φόρτωσης δεδομένων</Text>;
    if (!rows.length)
      return <Text style={styles.error}>Δεν υπάρχουν δεδομένα πωλήσεων</Text>;

    const headerIndex = rows.findIndex((r) => String(r[4]).trim() === 'Bill-to');
    const dataRows = headerIndex !== -1 ? rows.slice(headerIndex + 1) : rows;
    const customerCode = String(customer?.customerCode || '').trim();
    const row = dataRows.find((r) => String(r[4]).trim() === customerCode);

    if (!row)
      return (
        <Text style={styles.error}>
          Δεν βρέθηκαν δεδομένα για τον πελάτη {customer?.name}
        </Text>
      );

    const vInvoicesPrev = toNumber(row[8]);
    const vBudgetCurr = toNumber(row[13]);
    const vYtdPrev = toNumber(row[10]);
    const vInvoicedCurr = toNumber(row[15]);
    const vMonthPrev = toNumber(row[11]);
    const vMonthCurr = toNumber(row[12]);
    const vOpenOrders = toNumber(row[19]);
    const vOpenDlv = toNumber(row[20]);
    const vTotalOrders = toNumber(row[21]);
    const vOB = sanitize(row[22]);
    const vBalance = toNumber(row[23]);

    const pctYtd = vYtdPrev ? ((vInvoicedCurr - vYtdPrev) / vYtdPrev) * 100 : null;
    const pctMonth = vMonthPrev ? ((vMonthCurr - vMonthPrev) / vMonthPrev) * 100 : null;

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
          leftValue={vInvoicesPrev.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
          rightValue={vBudgetCurr.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
        />

        <Metric3Cols
          labelLeft={`Τιμολογημένα YTD ${previousYear}`}
          labelRight={`Τιμολογημένα ${currentYear}`}
          leftValue={vYtdPrev.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
          rightValue={vInvoicedCurr.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
          percent={pctYtd != null ? `${pctYtd.toFixed(1)}%` : '-'}
        />

        <Metric3Cols
          labelLeft={`Τιμολογημένα ${currentMonthName} ${previousYear}`}
          labelRight={`Τιμολογημένα ${currentMonthName} ${currentYear}`}
          leftValue={vMonthPrev.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
          rightValue={vMonthCurr.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
          percent={pctMonth != null ? `${pctMonth.toFixed(1)}%` : '-'}
        />

        <Text style={styles.sectionHeader}>Παραγγελίες</Text>
        <View style={styles.ordersRow}>
          <View style={styles.orderBox}>
            <Text style={styles.label}>Εκκρεμείς Παραγγελίες</Text>
            <Text style={styles.value}>
              {vOpenOrders.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
            </Text>
            <Text style={[styles.label, { marginTop: 8 }]}>Παραγγελίες σε Αποθήκη</Text>
            <Text style={styles.value}>
              {vOpenDlv.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
            </Text>
          </View>

          <View style={styles.orderBox}>
            <Text style={styles.label}>Συνολικές Παραγγελίες</Text>
            <Text style={styles.value}>
              {vTotalOrders.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
            </Text>
            <Text style={[styles.label, { marginTop: 8 }]}>% O/B</Text>
            <Text style={styles.value}>{vOB}</Text>
          </View>
        </View>

        <Text style={styles.sectionHeader}>Υπόλοιπο</Text>
        <View style={styles.balanceBox}>
          <Text style={styles.value}>
            {vBalance.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
          </Text>
        </View>
      </>
    );
  }, [rows, status]);

  return (
    <SafeScreen title="Σύνοψη Πωλήσεων" scroll>
      <ScrollView contentContainerStyle={styles.container}>{renderPlaymobil}</ScrollView>
    </SafeScreen>
  );
}

// -------------------- KIVOS SALES SUMMARY --------------------
function KivosSalesSummary({ customerId }) {
  const [customer, setCustomer] = useState(null);
  const [sheetData, setSheetData] = useState(null);
  const [status, setStatus] = useState(STATUS.LOADING);

  useEffect(() => {
    (async () => {
      try {
        const json = await AsyncStorage.getItem('customers');
        const list = json ? JSON.parse(json) : [];
        const found = list.find((c) => c.id === customerId);
        setCustomer(found);

        const rows = await loadSpreadsheet('kivosCustomers', { force: false });
        setSheetData(rows);
        setStatus(STATUS.READY);
      } catch (e) {
        console.warn(e);
        setStatus(STATUS.ERROR);
      }
    })();
  }, [customerId]);

  if (status === STATUS.LOADING)
    return (
      <SafeScreen>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeScreen>
    );

  const firestore = customer || {};

  const row = sheetData?.find(
    (r) =>
      String(r[0] || '').trim().replace(/^0+/, '') ===
      String(firestore.customerCode || '').trim().replace(/^0+/, '')
  );

  console.log('[Kivos customer]', firestore);
  console.log('[Kivos row]', row);
  console.log('[Kivos row length]', row?.length);

  const v22 = toNumber(firestore.InvSales2022);
  const v23 = toNumber(firestore.InvSales2023);
  const v24 = toNumber(firestore.InvSales2024);
  const v25 = row ? toNumber(row[16]) : 0;

  const arr = [
    { year: 2022, value: v22 },
    { year: 2023, value: v23 },
    { year: 2024, value: v24 },
    { year: 2025, value: v25 },
  ];

  return (
    <SafeScreen title="Σύνοψη Πωλήσεων">
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.sectionHeader}>Τζίρος</Text>
        <View style={styles.kivosRow}>
          {arr.map((item, i) => {
            const prev = i > 0 ? arr[i - 1].value : null;
            const delta = prev && prev !== 0 ? ((item.value - prev) / prev) * 100 : null;
            const color = delta == null ? colors.textPrimary : delta >= 0 ? 'green' : 'red';
            return (
              <View key={item.year} style={styles.kivosBox}>
                <Text style={styles.kivosLabel}>Τζίρος {item.year}</Text>
                <Text style={styles.kivosValue}>
                  {item.value.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
                </Text>
                {delta != null && (
                  <Text style={[styles.kivosDelta, { color }]}>{delta.toFixed(1)}%</Text>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeScreen>
  );
}

// -------------------- SMALL COMPONENT --------------------
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
      {percent && (
        <View style={[styles.metricBlock, styles.metricSmall]}>
          <Text style={styles.label}>Δ%</Text>
          <Text style={styles.value}>{percent}</Text>
        </View>
      )}
    </View>
  );
}

// -------------------- STYLES --------------------
const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { textAlign: 'center', color: 'red' },
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
  metricBlock: { flex: 1, backgroundColor: '#E3F2FD', margin: 4, padding: 8, borderRadius: 10 },
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
  balanceBox: { backgroundColor: '#E3F2FD', margin: 4, padding: 12, borderRadius: 10 },
  kivosRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  kivosBox: {
    width: '48%',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  kivosLabel: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  kivosValue: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  kivosDelta: { marginTop: 4, fontSize: 13, fontWeight: '600' },
  testButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  testButtonText: { color: '#fff', fontSize: 13 },
});
