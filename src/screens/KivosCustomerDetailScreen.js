import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import SafeScreen from '../components/SafeScreen';
import { getKivosSpreadsheetRow } from '../services/kivosSpreadsheet';
import { getKivosCreditBreakdown } from '../services/kivosCreditBreakdown';
import { parseLocaleNumber } from '../utils/numberFormat';

const COLLECTION = 'customers_kivos';
const AVATAR = require('../../assets/Kivos_placeholder.png');

const toNumberOrNull = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const parsed = parseLocaleNumber(value, { defaultValue: Number.NaN });
  return Number.isFinite(parsed) ? parsed : null;
};

const formatCurrency = (value) => {
  const numeric = toNumberOrNull(value);
  return numeric == null
    ? null
    : numeric.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' });
};

const parseSheetActive = (value) => {
  if (typeof value === 'boolean') return value;
  if (value == null) return null;
  const text = String(value).trim().toLowerCase();
  if (!text) return null;
  if (['1', 'true', 'yes', 'y', 'active', 'ενεργός'].includes(text)) return true;
  if (['0', 'false', 'no', 'n', 'inactive', 'ανενεργός'].includes(text)) return false;
  return null;
};

const normalizeChannel = (value) => {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text === '1') return '1';
  if (text === '2') return '2';
  return text;
};

const channelLabel = (value) => {
  const normalized = normalizeChannel(value);
  if (!normalized) return null;
  if (normalized === '1') return 'Χαρτοπωλειακό';
  if (normalized === '2') return 'Τεχνικό';
  return normalized;
};

const InfoRow = ({ label, value, icon, onPress }) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const content = (
    <View style={styles.infoRow}>
      {icon ? <Ionicons name={icon} size={18} color="#1f4f8f" style={styles.infoIcon} /> : null}
      <Text style={styles.infoLabel}>{label}:</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );

  if (typeof onPress === 'function') {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const openTel = (value) => {
  if (value) {
    Linking.openURL(`tel:${value}`);
  }
};

const openEmail = (value) => {
  if (value) {
    Linking.openURL(`mailto:${value}`);
  }
};

const mergeCustomerData = (customerDoc, sheetRow, creditBreakdown, fallbackCode) => {
  const address = customerDoc?.address || {};
  const contact = customerDoc?.contact || {};
  const vatInfo = customerDoc?.vatInfo || {};

  const sheetActive = parseSheetActive(sheetRow?.isActive);
  const docActive = parseSheetActive(customerDoc?.isActive);
  const resolvedActive = docActive ?? sheetActive ?? null;

  const docChannel = normalizeChannel(customerDoc?.channel);
  const sheetChannel = normalizeChannel(sheetRow?.channel);
  const resolvedChannel = docChannel ?? sheetChannel ?? null;

  const sheetBalance = toNumberOrNull(sheetRow?.balance);
  const creditBalanceRaw =
    creditBreakdown?.balance != null ? creditBreakdown.balance : creditBreakdown?.total;
  const creditBalance = toNumberOrNull(creditBalanceRaw);
  const resolvedBalance = creditBalance ?? sheetBalance ?? null;

  const creditDays30 = toNumberOrNull(creditBreakdown?.days30);
  const creditDays60 = toNumberOrNull(creditBreakdown?.days60);
  const creditDays90 = toNumberOrNull(creditBreakdown?.days90);
  const creditDays90Plus = toNumberOrNull(creditBreakdown?.days90plus);
  const hasCreditBreakdown =
    creditDays30 != null ||
    creditDays60 != null ||
    creditDays90 != null ||
    creditDays90Plus != null ||
    creditBalance != null;

  return {
    code: customerDoc?.customerCode || sheetRow?.code || fallbackCode,
    name: customerDoc?.name || sheetRow?.name || '-',
    street: address.street || sheetRow?.street,
    postalCode: address.postalCode || sheetRow?.postalCode,
    city: address.city || sheetRow?.city,
    telephone1: contact.telephone1 || sheetRow?.telephone1,
    telephone2: contact.telephone2 || sheetRow?.telephone2,
    fax: contact.fax || sheetRow?.fax,
    email: contact.email || sheetRow?.email,
    profession: customerDoc?.profession || sheetRow?.profession,
    vat: vatInfo.registrationNo || sheetRow?.vat,
    taxOffice: vatInfo.office || sheetRow?.taxOffice,
    salesman: customerDoc?.merch || sheetRow?.salesman,

    sales2022: toNumberOrNull(customerDoc?.InvSales2022),
    sales2023: toNumberOrNull(customerDoc?.InvSales2023),
    sales2024: toNumberOrNull(customerDoc?.InvSales2024),
    sales2025: toNumberOrNull(sheetRow?.sales2025),
    balance: resolvedBalance,

    creditDays30,
    creditDays60,
    creditDays90,
    creditDays90Plus,
    creditTotal: creditBalance ?? resolvedBalance,
    hasCreditBreakdown,

    isActive: resolvedActive,
    channel: resolvedChannel,
  };
};

const KivosCustomerDetailScreen = ({ route, navigation }) => {
  const { customerId } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [customerDoc, setCustomerDoc] = useState(null);
  const [sheetRow, setSheetRow] = useState(null);
  const [creditBreakdown, setCreditBreakdown] = useState(null);
  const [error, setError] = useState(null);
  const [sheetError, setSheetError] = useState('');
  const [creditError, setCreditError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!customerId) {
        setError('Δεν βρέθηκε κωδικός πελάτη.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const docSnap = await firestore().collection(COLLECTION).doc(customerId).get();
        const docData = docSnap.exists ? { id: docSnap.id, ...docSnap.data() } : null;

        setSheetError('');
        let row = null;
        const lookupCode = docData?.customerCode || customerId;
        try {
          row = await getKivosSpreadsheetRow(lookupCode);
          if (!row) {
            setSheetError('Δεν βρέθηκαν δεδομένα στο φύλλο Kivos Customers.');
          }
        } catch (fetchError) {
          console.warn('[KivosCustomerDetail] spreadsheet fetch failed', fetchError);
          setSheetError('Αποτυχία φόρτωσης του αρχείου Kivos Customers.');
        }

        setCreditError('');
        let credit = null;
        try {
          credit = await getKivosCreditBreakdown(lookupCode);
          if (!credit) {
            setCreditError('Δεν βρέθηκε ανάλυση πιστωτικού υπολοίπου για τον πελάτη.');
          }
        } catch (creditFetchError) {
          console.warn('[KivosCustomerDetail] credit fetch failed', creditFetchError);
          setCreditError('Αποτυχία φόρτωσης της ανάλυσης πιστωτικού.');
        }

        if (!isMounted) {
          return;
        }

        if (!docData && !row) {
          setError('Δεν εντοπίστηκαν δεδομένα για τον συγκεκριμένο πελάτη.');
        }

        setCustomerDoc(docData);
        setSheetRow(row);
        setCreditBreakdown(credit);
      } catch (err) {
        console.error('[KivosCustomerDetail] unexpected error', err);
        if (isMounted) {
          setError('Παρουσιάστηκε σφάλμα κατά τη φόρτωση των δεδομένων.');
          setCustomerDoc(null);
          setSheetRow(null);
          setCreditBreakdown(null);
          setSheetError('');
          setCreditError('');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [customerId]);

  const merged = useMemo(
    () => mergeCustomerData(customerDoc, sheetRow, creditBreakdown, customerId),
    [customerDoc, sheetRow, creditBreakdown, customerId]
  );

  if (loading) {
    return (
      <SafeScreen style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator color="#1f4f8f" size="large" />
          <Text style={styles.helperText}>Φόρτωση δεδομένων…</Text>
        </View>
      </SafeScreen>
    );
  }

  if (error) {
    return (
      <SafeScreen style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen 
      style={styles.container}
      headerLeft={
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1f4f8f" />
        </TouchableOpacity>
      }
    >
      <ScrollView contentContainerStyle={styles.scrollInner}>
        <View style={styles.header}>
          <Image source={AVATAR} style={styles.avatar} resizeMode="cover" />
          <View style={styles.headerText}>
            <Text style={styles.title}>{merged.code}</Text>
            <Text style={styles.subtitle}>{merged.name}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Διεύθυνση</Text>
          <InfoRow label="Οδός" value={merged.street} icon="navigate-outline" />
          <InfoRow label="Τ.Κ." value={merged.postalCode} icon="location-outline" />
          <InfoRow label="Πόλη" value={merged.city} icon="business-outline" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Επικοινωνία</Text>
          <InfoRow
            label="Τηλ. 1"
            value={merged.telephone1}
            icon="call-outline"
            onPress={() => openTel(merged.telephone1)}
          />
          <InfoRow
            label="Τηλ. 2"
            value={merged.telephone2}
            icon="call-outline"
            onPress={() => openTel(merged.telephone2)}
          />
          <InfoRow label="Fax" value={merged.fax} icon="print-outline" />
          <InfoRow
            label="Email"
            value={merged.email}
            icon="mail-outline"
            onPress={() => openEmail(merged.email)}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Φορολογικά & εμπορικά</Text>
          <InfoRow label="Επάγγελμα" value={merged.profession} icon="briefcase-outline" />
          <InfoRow label="Α.Φ.Μ." value={merged.vat} icon="card-outline" />
          <InfoRow label="Δ.Ο.Υ." value={merged.taxOffice} icon="file-tray-outline" />
          <InfoRow label="Πωλητής" value={merged.salesman} icon="person-outline" />
          <InfoRow
            label="Κατάσταση"
            value={
              merged.isActive == null ? null : merged.isActive ? 'Ενεργός' : 'Ανενεργός'
            }
            icon="checkmark-circle-outline"
          />
          <InfoRow label="Κανάλι" value={channelLabel(merged.channel)} icon="layers-outline" />
                 </View>

        {merged.hasCreditBreakdown ? (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Κατάτμηση πιστωτικού υπολοίπου</Text>
    <View style={styles.creditBreakdownContainer}>
      <View style={styles.creditBreakdownLeft}>
        <View style={styles.creditBreakdownItem}>
          <Text style={styles.creditBreakdownLabel}>001–030 Ημέρες:</Text>
          <Text style={styles.creditBreakdownValue}>
            {formatCurrency(merged.creditDays30) || '—'}
          </Text>
        </View>
        <View style={styles.creditBreakdownItem}>
          <Text style={styles.creditBreakdownLabel}>031–060 Ημέρες:</Text>
          <Text style={styles.creditBreakdownValue}>
            {formatCurrency(merged.creditDays60) || '—'}
          </Text>
        </View>
        <View style={styles.creditBreakdownItem}>
          <Text style={styles.creditBreakdownLabel}>061–090 Ημέρες:</Text>
          <Text style={styles.creditBreakdownValue}>
            {formatCurrency(merged.creditDays90) || '—'}
          </Text>
        </View>
        <View style={styles.creditBreakdownItem}>
          <Text style={styles.creditBreakdownLabel}>90+ Ημέρες:</Text>
          <Text style={styles.creditBreakdownValue}>
            {formatCurrency(merged.creditDays90Plus) || '—'}
          </Text>
        </View>
      </View>

      <View style={styles.totalBalanceBox}>
        <Text style={styles.totalBalanceLabel}>Συνολικό Υπόλοιπο</Text>
        <Text style={styles.totalBalanceValue}>
          {formatCurrency(merged.creditTotal) || '—'}
        </Text>
      </View>
    </View>
  </View>
) : null}


        {sheetError ? <Text style={styles.noticeText}>{sheetError}</Text> : null}
        {creditError ? <Text style={styles.noticeText}>{creditError}</Text> : null}

        {/* Navigation Buttons */}
        <View style={styles.modernNavContainer}>
          <TouchableOpacity
            style={styles.modernNavButton}
            onPress={() =>
              navigation.navigate('CustomerSalesSummary', {
                customerId: merged.code,
                brand: 'kivos',
              })
            }
            activeOpacity={0.7}
          >
            <View style={styles.modernNavIconContainer}>
              <Ionicons name="analytics-outline" color="#1f4f8f" size={24} />
            </View>
            <Text style={styles.modernNavButtonText}>Ανάλυση Πωλήσεων</Text>
            <Ionicons name="chevron-forward" size={20} color="#1f4f8f" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.modernNavButton}
            onPress={() =>
              navigation.navigate('CustomerMonthlySales', {
                customerId: merged.code,
                brand: 'kivos',
              })
            }
            activeOpacity={0.7}
          >
            <View style={styles.modernNavIconContainer}>
              <Ionicons name="calendar-outline" color="#1f4f8f" size={24} />
            </View>
            <Text style={styles.modernNavButtonText}>Μηνιαία Ανάλυση Πωλήσεων</Text>
            <Ionicons name="chevron-forward" size={20} color="#1f4f8f" />
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  scrollInner: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginRight: 16,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 16,
    color: '#334155',
    marginTop: 4,
  },
  section: {
    marginBottom: 22,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f4f8f',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  infoIcon: {
    marginRight: 8,
  },
  infoLabel: {
    fontWeight: '600',
    color: '#334e68',
    marginRight: 6,
  },
  infoValue: {
    color: '#102a43',
    fontSize: 15,
    flexShrink: 1,
  },
  summaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f4f8f',
    borderRadius: 12,
    paddingVertical: 14,
  },
  summaryIcon: {
    marginRight: 8,
  },
  summaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  noticeText: {
    marginTop: 4,
    marginBottom: 18,
    color: '#c62828',
    fontSize: 13,
  },
  creditBreakdownContainer: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  backgroundColor: '#f8fafc',
  borderRadius: 12,
  padding: 16,
},

creditBreakdownLeft: {
  flex: 1.2,
  marginRight: 10,
},

creditBreakdownItem: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginBottom: 6,
},

creditBreakdownLabel: {
  fontSize: 14,
  color: '#475569',
  fontWeight: '500',
  flex: 1.2,
},

creditBreakdownValue: {
  fontSize: 14,
  color: '#1f2937',
  fontWeight: '600',
  textAlign: 'right',
  flex: 0.8,
},

totalBalanceBox: {
  alignSelf: 'stretch',
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: '#1f4f8f',
  borderRadius: 10,
  paddingHorizontal: 10,
  paddingVertical: 8,
  minWidth: 95,
  elevation: 3,
  shadowColor: '#000',
  shadowOpacity: 0.15,
  shadowRadius: 3,
  shadowOffset: { width: 0, height: 2 },
},

totalBalanceLabel: {
  fontSize: 12,
  color: '#fff',
  fontWeight: '500',
  marginBottom: 4,
  textAlign: 'center',
},

totalBalanceValue: {
  fontSize: 16,
  color: '#fff',
  fontWeight: '700',
  textAlign: 'center',
},

  bottomSpacer: {
    height: 30,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  helperText: {
    marginTop: 12,
    color: '#52606d',
    fontSize: 14,
  },
  errorText: {
    color: '#c62828',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modernNavContainer: {
    marginTop: 24,
    gap: 12,
  },
  modernNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  modernNavIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modernNavButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
});

export default KivosCustomerDetailScreen;
