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

const COLLECTION = 'customers_kivos';

const AVATAR = require('../../assets/Kivos_placeholder.png');

const InfoRow = ({ label, value, icon, onPress }) => {
  if (!value) {
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
  if (!value) {
    return;
  }
  Linking.openURL(`tel:${value}`);
};

const openEmail = (value) => {
  if (!value) {
    return;
  }
  Linking.openURL(`mailto:${value}`);
};

const mergeCustomerData = (customerDoc, sheetRow, creditBreakdown, fallbackCode) => {
  const address = customerDoc?.address || {};
  const contact = customerDoc?.contact || {};
  const vatInfo = customerDoc?.vatInfo || {};

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
    
    // Sales data from Firestore (N-P)
    InvSales2022: customerDoc?.InvSales2022,
    InvSales2023: customerDoc?.InvSales2023,
    InvSales2024: customerDoc?.InvSales2024,
    
    // Sales data from Spreadsheet (Q-R)
    InvSales2025: sheetRow?.sales2025,
    balance: sheetRow?.balance,
    
    // Credit breakdown from credit spreadsheet
    creditDays30: creditBreakdown?.days30,
    creditDays60: creditBreakdown?.days60,
    creditDays90: creditBreakdown?.days90,
    creditDays90Plus: creditBreakdown?.days90plus,
    
    // Status fields from Firestore (S-T)
    isActive: customerDoc?.isActive,
    channel: customerDoc?.channel,
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
        let row = null;

        setSheetError('');
        try {
          row = await getKivosSpreadsheetRow(customerId);
        } catch (sheetFetchError) {
          console.warn('Kivos spreadsheet fetch failed', sheetFetchError);
          row = null;
          setSheetError('Δεν ήταν δυνατή η ανάκτηση στοιχείων πωλήσεων από το spreadsheet.');
        }

        setCreditError('');
        let creditData = null;
        try {
          creditData = await getKivosCreditBreakdown(customerId);
        } catch (creditFetchError) {
          console.warn('Kivos credit breakdown fetch failed', creditFetchError);
          creditData = null;
          setCreditError('Δεν ήταν δυνατή η ανάκτηση στοιχείων πιστωτικού υπολοίπου.');
        }

        if (!isMounted) {
          return;
        }

        if (!docData && !row) {
          setError('Δεν βρέθηκαν στοιχεία πελάτη για αυτόν τον κωδικό.');
        }

        setCustomerDoc(docData);
        setSheetRow(row);
        setCreditBreakdown(creditData);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        console.error('Failed to load Kivos customer detail', err);
        setError('Παρουσιάστηκε σφάλμα κατά τη φόρτωση των στοιχείων.');
        setCustomerDoc(null);
        setSheetRow(null);
        setCreditBreakdown(null);
        setSheetError('');
        setCreditError('');
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

  const merged = useMemo(() => mergeCustomerData(customerDoc, sheetRow, creditBreakdown, customerId), [customerDoc, sheetRow, creditBreakdown, customerId]);

  if (loading) {
    return (
      <SafeScreen style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator color="#1f4f8f" size="large" />
          <Text style={styles.helperText}>Φόρτωση στοιχείων πελάτη…</Text>
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
    <SafeScreen style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollInner}>
        <View style={styles.header}>
          <Image source={AVATAR} style={styles.avatar} resizeMode="cover" />
          <View style={styles.headerText}>
            <Text style={styles.title}>{merged.code}</Text>
            <Text style={styles.subtitle}>{merged.name}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Στοιχεία Διεύθυνσης</Text>
          <InfoRow label="Διεύθυνση" value={merged.street} icon="navigate-outline" />
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
          <Text style={styles.sectionTitle}>Λοιπές Πληροφορίες</Text>
          <InfoRow label="Επάγγελμα" value={merged.profession} icon="briefcase-outline" />
          <InfoRow label="Α.Φ.Μ." value={merged.vat} icon="card-outline" />
          <InfoRow label="Δ.Ο.Υ." value={merged.taxOffice} icon="file-tray-outline" />
          <InfoRow label="Πωλητής" value={merged.salesman} icon="person-outline" />
          <InfoRow label="Κατάσταση" value={merged.isActive ? 'Ενεργός' : 'Ανενεργός'} icon="checkmark-circle-outline" />
          <InfoRow label="Κανάλι" value={merged.channel === '1' ? 'Χαρτοπωλειακό' : merged.channel === '2' ? 'Τεχνικό' : merged.channel} icon="layers-outline" />
          <InfoRow label="Υπόλοιπο" value={merged.balance} icon="analytics-outline" />
        </View>

        {/* Credit Breakdown Section */}
        {(merged.creditDays30 || merged.creditDays60 || merged.creditDays90 || merged.creditDays90Plus) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Κατάτμηση Πιστωτικού Υπολοίπου</Text>
            <View style={styles.creditBreakdownRow}>
              <View style={styles.creditBreakdownLeft}>
                <View style={styles.creditBreakdownItem}>
                  <Text style={styles.creditBreakdownLabel}>001-030 Ημέρες:</Text>
                  <Text style={styles.creditBreakdownValue}>{merged.creditDays30 || '0'}</Text>
                </View>
                <View style={styles.creditBreakdownItem}>
                  <Text style={styles.creditBreakdownLabel}>031-060 Ημέρες:</Text>
                  <Text style={styles.creditBreakdownValue}>{merged.creditDays60 || '0'}</Text>
                </View>
                <View style={styles.creditBreakdownItem}>
                  <Text style={styles.creditBreakdownLabel}>061-090 Ημέρες:</Text>
                  <Text style={styles.creditBreakdownValue}>{merged.creditDays90 || '0'}</Text>
                </View>
                <View style={styles.creditBreakdownItem}>
                  <Text style={styles.creditBreakdownLabel}>90+ Ημέρες:</Text>
                  <Text style={styles.creditBreakdownValue}>{merged.creditDays90Plus || '0'}</Text>
                </View>
              </View>
              <View style={styles.creditBreakdownRight}>
                <Text style={styles.totalBalanceLabel}>Συνολικό Υπόλοιπο</Text>
                <Text style={styles.totalBalanceValue}>{merged.balance || '0'}</Text>
              </View>
            </View>
          </View>
        )}

        {sheetError ? <Text style={styles.noticeText}>{sheetError}</Text> : null}
        {creditError ? <Text style={styles.noticeText}>{creditError}</Text> : null}

        <TouchableOpacity
          style={styles.summaryButton}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('CustomerSalesSummary', { customerId: merged.code, brand: 'kivos' })}
        >
          <Ionicons name="stats-chart-outline" size={18} color="#fff" style={styles.summaryIcon} />
          <Text style={styles.summaryText}>Προβολή πωλήσεων</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollInner: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e0e6f0',
    marginRight: 16,
  },
  headerText: {
    flexShrink: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f4f8f',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 16,
    color: '#102a43',
    fontWeight: '500',
  },
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f4f8f',
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
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
  creditBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  creditBreakdownLeft: {
    flex: 1,
    marginRight: 16,
  },
  creditBreakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  creditBreakdownLabel: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  creditBreakdownValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '600',
  },
  creditBreakdownRight: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f4f8f',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 100,
    maxWidth: 110,
  },
  totalBalanceLabel: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
    marginBottom: 4,
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
});

export default KivosCustomerDetailScreen;
