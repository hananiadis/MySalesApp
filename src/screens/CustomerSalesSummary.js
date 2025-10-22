// src/screens/CustomerSalesSummary.js
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SafeScreen from '../components/SafeScreen';
import { getKivosSpreadsheetRow } from '../services/kivosSpreadsheet';

const SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1_HxZwIyB3Rhv3ZO4DgH-uIgr3uvr97vw-W3VM0GswFA/export?format=csv&gid=499925136';

const CUSTOMER_CODE_COLUMN = 4; // Column E / "Bill-to" in the sheet

const COMPARABLE_FIELDS = [
  {
    key: 'total-invoiced',
    previous: { index: 8, label: 'Συνολικές Τιμολογημένες Πωλήσεις 2024' },
    current: { index: 15, label: 'Τιμολογημένες Πωλήσεις 2025' },
    showDelta: true,
  },
  {
    key: 'net-sales',
    previous: { index: 9, label: 'Συνολικές Καθαρές Πωλήσεις 2024' },
    current: { index: 16, label: 'Καθαρές Πωλήσεις 2025' },
    showDelta: true,
  },
  {
    key: 'invoiced-to-date',
    previous: { index: 10, label: 'Τιμολογημένο έως Σήμερα 2024' },
    current: { index: 12, label: 'Τιμολογημένες Πωλήσεις Οκτώβριος 2025' },
    showDelta: true,
  },
  {
    key: 'invoiced-oct-total',
    previous: { index: 11, label: 'Τιμολογημένες Πωλήσεις έως Οκτώβριο 2024' },
    current: { index: 13, label: 'Συνολικός Προϋπολογισμός 2025' },
    showDelta: false,
  },
];

const COLUMN_TRANSLATIONS = {
  12: 'Τιμολογημένες Πωλήσεις Οκτώβριος 2025',
  13: 'Συνολικός Προϋπολογισμός 2025',
  14: 'Μηνιαίος Προϋπολογισμός 2025 (Ιαν-Οκτ)',
  15: 'Τιμολογημένες Πωλήσεις 2025',
  16: 'Καθαρές Πωλήσεις 2025',
  17: '% Τιμολογήσεων / Συνολικός Προϋπολογισμός 2025',
  18: 'Μεταβολή σε σχέση με Πέρυσι (%)',
  19: 'Ανοιχτές Παραγγελίες',
  20: 'Ανοιχτές Παραδόσεις',
  21: 'Συνολικές Παραγγελίες 2025',
  22: '% Backlog Παραγγελιών',
  23: 'Υπόλοιπο Πελάτη',
};

const FALLBACK_COLUMN_LABELS = (() => {
  const labels = { ...COLUMN_TRANSLATIONS };
  COMPARABLE_FIELDS.forEach(({ previous, current }) => {
    labels[previous.index] = previous.label;
    if (current?.index != null) {
      labels[current.index] = current.label;
    }
  });
  return labels;
})();

const PRIMARY_METRIC_CONFIG = [
  { key: 'col-8-13', previous: 8, current: 13, percent: 17 },
  { key: 'col-9-16', previous: 9, current: 16 },
  { key: 'col-10-15', previous: 10, current: 15, percent: 18 },
  { key: 'col-11-12', previous: 11, current: 12 },
];

const SECONDARY_METRIC_CONFIG = [
  { key: 'col-19-20', previous: 19, current: 20 },
  { key: 'col-21-22', previous: 21, current: 22 },
];

const STANDALONE_METRIC_COLUMNS = [23];

const STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error',
};

const parseCsv = (text) => {
  const rows = [];
  let current = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        value += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      current.push(value);
      value = '';
    } else if (char === '\r') {
      // ignore carriage returns
    } else if (char === '\n') {
      current.push(value);
      rows.push(current);
      current = [];
      value = '';
    } else {
      value += char;
    }
  }

  if (value.length > 0 || current.length > 0) {
    current.push(value);
    rows.push(current);
  }

  return rows;
};

const sanitizeCell = (cell) => {
  if (cell == null) {
    return 'N/A';
  }
  const trimmed = String(cell).trim();
  return trimmed === '' ? 'N/A' : trimmed;
};

const KIVOS_YEAR_FIELDS = [
  { key: 'sales2022', label: 'Τζίρος 2022' },
  { key: 'sales2023', label: 'Τζίρος 2023' },
  { key: 'sales2024', label: 'Τζίρος 2024' },
  { key: 'sales2025', label: 'Τζίρος 2025' },
];

const formatSheetValue = (value) => {
  if (value == null) {
    return '—';
  }
  const text = String(value).trim();
  return text ? text : '—';
};

const KivosSalesSummary = ({ customerId }) => {
  const [status, setStatus] = useState(STATUS.LOADING);
  const [error, setError] = useState('');
  const [row, setRow] = useState(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!customerId) {
        setError('Δεν βρέθηκε κωδικός πελάτη.');
        setStatus(STATUS.ERROR);
        return;
      }

      setStatus(STATUS.LOADING);
      setError('');

      try {
        const sheetRow = await getKivosSpreadsheetRow(customerId);

        if (!active) {
          return;
        }

        if (!sheetRow) {
          setError('Ο πελάτης δεν εντοπίστηκε στο spreadsheet των Kivos.');
          setRow(null);
          setStatus(STATUS.ERROR);
          return;
        }

        setRow(sheetRow);
        setStatus(STATUS.READY);
      } catch (err) {
        if (!active) {
          return;
        }
        console.error('Failed to load Kivos spreadsheet data', err);
        setError('Δεν ήταν δυνατή η φόρτωση των στοιχείων από το spreadsheet.');
        setRow(null);
        setStatus(STATUS.ERROR);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [customerId]);

  if (status === STATUS.LOADING) {
    return (
      <SafeScreen style={styles.container}>
        <View style={styles.centeredBlock}>
          <ActivityIndicator size="large" color="#1f4f8f" />
          <Text style={styles.statusText}>Φόρτωση πωλήσεων από το spreadsheet…</Text>
        </View>
      </SafeScreen>
    );
  }

  if (status === STATUS.ERROR) {
    return (
      <SafeScreen style={styles.container}>
        <View style={styles.centeredBlock}>
          <Text style={styles.errorText}>{error || 'Δεν υπάρχουν διαθέσιμα δεδομένα.'}</Text>
          {customerId ? (
            <Text style={styles.helperText}>Πελάτης: {customerId}</Text>
          ) : null}
        </View>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen style={styles.container}>
      <View style={styles.kivosWrapper}>
        <Text style={styles.kivosHeader}>{row?.code || customerId}</Text>
        {row?.name ? <Text style={styles.kivosSubheader}>{row.name}</Text> : null}

        <View style={styles.kivosCardGrid}>
          {KIVOS_YEAR_FIELDS.map(({ key, label }) => (
            <View key={key} style={styles.kivosCard}>
              <Text style={styles.kivosYear}>{label}</Text>
              <Text style={styles.kivosValue}>{formatSheetValue(row?.[key])}</Text>
            </View>
          ))}
        </View>

        {row?.balance ? (
          <View style={styles.kivosBalanceCard}>
            <Text style={styles.kivosBalanceLabel}>Υπόλοιπο</Text>
            <Text style={styles.kivosBalanceValue}>{formatSheetValue(row.balance)}</Text>
          </View>
        ) : null}

        <View style={styles.kivosSourceBox}>
          <Text style={styles.kivosSourceTitle}>Πηγή δεδομένων</Text>
          <Text style={styles.kivosSourceText}>
            Οι αριθμοί αντλούνται απευθείας από το Google Spreadsheet των πελατών Kivos.
          </Text>
        </View>
      </View>
    </SafeScreen>
  );
};

const JohnSalesSummaryPlaceholder = ({ customerId }) => (
  <SafeScreen style={styles.container}>
    <View style={styles.centeredBlock}>
      <Text style={styles.placeholderTitle}>Δεν υπάρχουν δεδομένα πωλήσεων ακόμη</Text>
      <Text style={styles.placeholderText}>
        Οι αναλυτικές πωλήσεις για τους πελάτες John θα προστεθούν σύντομα.
      </Text>
      {customerId ? (
        <Text style={styles.placeholderCode}>Πελάτης: {customerId}</Text>
      ) : null}
    </View>
  </SafeScreen>
);

const CustomerSalesSummary = ({ route }) => {
  const customerId = route?.params?.customerId;
  const brand = route?.params?.brand || 'playmobil';

  if (brand === 'kivos') {
    return <KivosSalesSummary customerId={customerId} />;
  }

  if (brand === 'john') {
    return <JohnSalesSummaryPlaceholder customerId={customerId} />;
  }

  const [customerStatus, setCustomerStatus] = useState(STATUS.LOADING);
  const [customerError, setCustomerError] = useState('');
  const [customer, setCustomer] = useState(null);

  const [salesStatus, setSalesStatus] = useState(STATUS.IDLE);
  const [salesError, setSalesError] = useState('');
  const [metrics, setMetrics] = useState({ primaryPairs: [], secondaryPairs: [], standalone: [] });

  useEffect(() => {
    let active = true;

    const loadCustomer = async () => {
      if (!customerId) {
        setCustomerError('No customer context provided.');
        setCustomerStatus(STATUS.ERROR);
        return;
      }

      setCustomerStatus(STATUS.LOADING);
      setCustomerError('');

      try {
        const json = await AsyncStorage.getItem('customers');
        const list = json ? JSON.parse(json) : [];
        const found = list.find((entry) => entry.id === customerId);

        if (!active) {
          return;
        }

        if (found) {
          setCustomer(found);
          setCustomerStatus(STATUS.READY);
        } else {
          setCustomer(null);
          setCustomerError('Customer details not found in local storage.');
          setCustomerStatus(STATUS.ERROR);
        }
      } catch (err) {
        if (!active) {
          return;
        }
        setCustomer(null);
        setCustomerError('Unable to read cached customer data.');
        setCustomerStatus(STATUS.ERROR);
      }
    };

    loadCustomer();

    return () => {
      active = false;
    };
  }, [customerId]);

  useEffect(() => {
    let active = true;
    const code = customer?.customerCode ? String(customer.customerCode).trim() : '';

    if (!code) {
      setMetrics({ primaryPairs: [], secondaryPairs: [], standalone: [] });
      setSalesStatus(customerStatus === STATUS.READY ? STATUS.ERROR : STATUS.IDLE);
      setSalesError(customerStatus === STATUS.READY ? 'Customer code is missing.' : '');
      return () => {
        active = false;
      };
    }

    const loadSales = async () => {
      setSalesStatus(STATUS.LOADING);
      setSalesError('');

      try {
        const response = await fetch(SHEET_URL);
        if (!response.ok) {
          throw new Error(`Sheet request failed (${response.status})`);
        }

        const text = await response.text();
        const rows = parseCsv(text);
        const headerIndex = rows.findIndex((row) => sanitizeCell(row?.[CUSTOMER_CODE_COLUMN]) === 'Bill-to');

        if (headerIndex === -1) {
          throw new Error('Unable to locate column headers in the sheet.');
        }

        const dataRows = rows.slice(headerIndex + 1).filter((row) => row?.length);
        const entry = dataRows.find((row) => sanitizeCell(row[CUSTOMER_CODE_COLUMN]) === code);

        if (!entry) {
          throw new Error('No sales data found for the selected customer.');
        }

        const headerRow = rows[headerIndex] || [];
        const labelFor = (index) => {
          const raw = headerRow?.[index];
          if (raw == null) {
            return FALLBACK_COLUMN_LABELS[index] || `Column ${index + 1}`;
          }
          const trimmed = String(raw).trim();
          if (trimmed) {
            return trimmed;
          }
          return FALLBACK_COLUMN_LABELS[index] || `Column ${index + 1}`;
        };

        const primaryPairs = PRIMARY_METRIC_CONFIG.map((config) => {
          const previousValue = sanitizeCell(entry[config.previous]);
          const currentValue = sanitizeCell(entry[config.current]);
          const percentRaw = config.percent != null ? sanitizeCell(entry[config.percent]) : null;
          const percentValue = percentRaw && percentRaw !== 'N/A' ? percentRaw : null;

          if (previousValue === 'N/A' && currentValue === 'N/A' && !percentValue) {
            return null;
          }

          return {
            key: config.key,
            previous: {
              label: labelFor(config.previous),
              value: previousValue,
            },
            current: {
              label: labelFor(config.current),
              value: currentValue,
            },
            percent:
              config.percent != null
                ? {
                    label: labelFor(config.percent),
                    value: percentValue,
                  }
                : null,
          };
        }).filter(Boolean);

        const secondaryPairs = SECONDARY_METRIC_CONFIG.map((config) => {
          const previousValue = sanitizeCell(entry[config.previous]);
          const currentValue = sanitizeCell(entry[config.current]);

          if (previousValue === 'N/A' && currentValue === 'N/A') {
            return null;
          }

          return {
            key: config.key,
            previous: {
              label: labelFor(config.previous),
              value: previousValue,
            },
            current: {
              label: labelFor(config.current),
              value: currentValue,
            },
          };
        }).filter(Boolean);

        const standalone = STANDALONE_METRIC_COLUMNS.map((index) => {
          const value = sanitizeCell(entry[index]);
          if (value === 'N/A') {
            return null;
          }
          return {
            key: `col-${index}`,
            label: labelFor(index),
            value,
          };
        }).filter(Boolean);

        if (!active) {
          return;
        }

        setMetrics({ primaryPairs, secondaryPairs, standalone });
        setSalesStatus(STATUS.READY);
      } catch (err) {
        if (!active) {
          return;
        }
        setMetrics({ primaryPairs: [], secondaryPairs: [], standalone: [] });
        setSalesError(err?.message || 'Unable to load sales data.');
        setSalesStatus(STATUS.ERROR);
      }
    };

    loadSales();

    return () => {
      active = false;
    };
  }, [customer, customerStatus]);

  const renderSalesContent = useMemo(() => {
    if (salesStatus === STATUS.LOADING) {
      return (
        <View style={styles.centeredBlock}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.statusText}>Fetching Google Sheets data...</Text>
        </View>
      );
    }

    if (salesStatus === STATUS.ERROR) {
      return (
        <View style={styles.centeredBlock}>
          <Text style={styles.errorText}>{salesError}</Text>
          <Text style={styles.helperText}>Verify the customer code exists in the sheet (column E).</Text>
        </View>
      );
    }

    const hasMetrics =
      metrics.primaryPairs.length > 0 ||
      metrics.secondaryPairs.length > 0 ||
      metrics.standalone.length > 0;

    if (salesStatus === STATUS.READY && !hasMetrics) {
      return (
        <View style={styles.centeredBlock}>
          <Text style={styles.helperText}>No metrics available for this customer (columns I-X were empty).</Text>
        </View>
      );
    }

    const shouldShowDivider =
      metrics.primaryPairs.length > 0 &&
      (metrics.secondaryPairs.length > 0 || metrics.standalone.length > 0);

    return (
      <View style={styles.metricsSection}>
        <View style={styles.metricsCard}>
          {metrics.primaryPairs.map((item) => (
            <View key={item.key} style={styles.metricRow}>
              <View style={styles.metricColumn}>
                <Text style={styles.metricLabel}>{item.previous.label}</Text>
                <Text style={styles.metricValue}>{item.previous.value}</Text>
              </View>
              <Text style={styles.metricArrow}>{'->'}</Text>
              <View style={styles.metricColumn}>
                <Text style={styles.metricLabel}>{item.current.label}</Text>
                <View style={styles.metricValueGroup}>
                  <Text style={styles.metricValue}>{item.current.value}</Text>
                  {item.percent?.value ? (
                    <Text style={styles.metricPercent}>
                      ({item.percent.label}: {item.percent.value})
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          ))}

          {shouldShowDivider ? <View style={styles.metricsDivider} /> : null}

          {metrics.secondaryPairs.map((item) => (
            <View key={item.key} style={styles.metricRow}>
              <View style={styles.metricColumn}>
                <Text style={styles.metricLabel}>{item.previous.label}</Text>
                <Text style={styles.metricValue}>{item.previous.value}</Text>
              </View>
              <Text style={styles.metricArrow}>{'->'}</Text>
              <View style={styles.metricColumn}>
                <Text style={styles.metricLabel}>{item.current.label}</Text>
                <Text style={styles.metricValue}>{item.current.value}</Text>
              </View>
            </View>
          ))}

          {metrics.standalone.map((item) => (
            <View key={item.key} style={styles.standaloneRow}>
              <Text style={styles.metricLabel}>{item.label}</Text>
              <Text style={styles.metricValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }, [metrics, salesError, salesStatus]);

  return (
    <SafeScreen title="Sales Summary" scroll showUserMenu={false} contentContainerStyle={styles.contentInset}>
      <View style={styles.container}>
        <View style={[styles.customerCard, styles.sectionSpacing]}>
          {customerStatus === STATUS.LOADING && (
            <View style={styles.centeredBlock}>
              <ActivityIndicator size="large" color="#1976d2" />
              <Text style={styles.statusText}>Loading customer details...</Text>
            </View>
          )}

          {customerStatus === STATUS.ERROR && (
            <View>
              <Text style={styles.errorText}>{customerError}</Text>
              <Text style={styles.helperText}>Navigate through the customer list and retry.</Text>
            </View>
          )}

          {customerStatus === STATUS.READY && customer && (
            <>
              <Text style={styles.customerTitle}>
                {customer.customerCode} - {customer.name}
              </Text>
              {customer.name3 ? <Text style={styles.customerSubtitle}>{customer.name3}</Text> : null}
              {customer.salesInfo?.description ? (
                <Text style={styles.customerMeta}>{customer.salesInfo.description}</Text>
              ) : null}
              {customer.region?.name ? (
                <Text style={styles.customerMeta}>Region: {customer.region.name}</Text>
              ) : null}
            </>
          )}
        </View>

        <View style={styles.sectionSpacing}>{renderSalesContent}</View>

        <View style={[styles.sheetSource, styles.sectionSpacing]}>
          <Text style={styles.sheetSourceTitle}>Sheet Source</Text>
          <Text style={styles.sheetSourceText}>
            Data is pulled from the Google Sheet (columns I to X) using the customer code in column E.
          </Text>
        </View>
      </View>
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentInset: { paddingHorizontal: 18, paddingBottom: 24 },
  kivosWrapper: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: '#f5f8ff',
  },
  kivosHeader: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f4f8f',
    marginBottom: 2,
  },
  kivosSubheader: {
    fontSize: 16,
    color: '#102a43',
    fontWeight: '500',
    marginBottom: 18,
  },
  kivosCardGrid: {
    marginBottom: 16,
  },
  kivosCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#091e4240',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  kivosYear: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3e4c59',
    marginBottom: 6,
  },
  kivosValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1f36',
  },
  kivosBalanceCard: {
    backgroundColor: '#edf2ff',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 18,
  },
  kivosBalanceLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3957a5',
    marginBottom: 6,
  },
  kivosBalanceValue: {
    fontSize: 21,
    fontWeight: '700',
    color: '#1a237e',
  },
  kivosSourceBox: {
    backgroundColor: '#e8f1fe',
    borderRadius: 12,
    padding: 16,
  },
  kivosSourceTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a73e8',
    marginBottom: 6,
  },
  kivosSourceText: {
    fontSize: 14,
    color: '#1f2933',
    lineHeight: 20,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f4f8f',
    marginBottom: 10,
    textAlign: 'center',
  },
  placeholderText: {
    fontSize: 14,
    color: '#52606d',
    lineHeight: 20,
    textAlign: 'center',
  },
  placeholderCode: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2933',
  },
  sectionSpacing: { marginBottom: 18 },
  customerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 18,
    shadowColor: '#091e4240',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  customerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a73e8',
    marginBottom: 4,
  },
  customerSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2933',
    marginBottom: 6,
  },
  customerMeta: { fontSize: 14, color: '#52606d', marginBottom: 2 },
  sheetSource: {
    backgroundColor: '#e8f1fe',
    borderRadius: 12,
    padding: 16,
  },
  sheetSourceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a73e8',
    marginBottom: 4,
  },
  sheetSourceText: {
    fontSize: 14,
    color: '#1f2933',
    lineHeight: 20,
  },
  centeredBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  statusText: {
    marginTop: 10,
    fontSize: 14,
    color: '#52606d',
  },
  errorText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#c62828',
    marginBottom: 6,
    textAlign: 'center',
  },
  helperText: {
    fontSize: 13,
    color: '#52606d',
    textAlign: 'center',
    lineHeight: 18,
  },
  metricsSection: {},
  metricsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 18,
    shadowColor: '#091e4240',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  metricColumn: {
    flex: 1,
  },
  metricArrow: {
    marginHorizontal: 12,
    fontSize: 16,
    fontWeight: '700',
    color: '#1a73e8',
    alignSelf: 'center',
  },
  metricValueGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  metricPercent: {
    marginLeft: 8,
    fontSize: 13,
    color: '#52606d',
  },
  metricsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e0e6ed',
    marginVertical: 12,
  },
  standaloneRow: {
    marginTop: 12,
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3e4c59',
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1f36',
  },
});

export default CustomerSalesSummary;

