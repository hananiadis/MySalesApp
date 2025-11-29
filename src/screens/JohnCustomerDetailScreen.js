import React, { useEffect, useState } from 'react';
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

const COLLECTION = 'customers_john';

const AVATAR = require('../../assets/john_hellas_logo.png');

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

const JohnCustomerDetailScreen = ({ route, navigation }) => {
  const { customerId } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState(null);
  const [error, setError] = useState(null);

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
        const snap = await firestore().collection(COLLECTION).doc(customerId).get();
        const docData = snap.exists ? { id: snap.id, ...snap.data() } : null;
        if (!isMounted) {
          return;
        }

        if (!docData) {
          setError('Δεν βρέθηκαν στοιχεία πελάτη για αυτόν τον κωδικό.');
        }

        setCustomer(docData);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        console.error('Failed to load John customer detail', err);
        setError('Παρουσιάστηκε σφάλμα κατά τη φόρτωση των στοιχείων.');
        setCustomer(null);
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

  const address = customer?.address || {};
  const contact = customer?.contact || {};
  const vatInfo = customer?.vatInfo || {};

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
            <Text style={styles.title}>{customer?.customerCode || customerId}</Text>
            <Text style={styles.subtitle}>{customer?.name || '-'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Στοιχεία Διεύθυνσης</Text>
          <InfoRow label="Διεύθυνση" value={address.street} icon="navigate-outline" />
          <InfoRow label="Τ.Κ." value={address.postalCode} icon="location-outline" />
          <InfoRow label="Πόλη" value={address.city} icon="business-outline" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Επικοινωνία</Text>
          <InfoRow
            label="Τηλ. 1"
            value={contact.telephone1}
            icon="call-outline"
            onPress={() => openTel(contact.telephone1)}
          />
          <InfoRow
            label="Τηλ. 2"
            value={contact.telephone2}
            icon="call-outline"
            onPress={() => openTel(contact.telephone2)}
          />
          <InfoRow label="Fax" value={contact.fax} icon="print-outline" />
          <InfoRow
            label="Email"
            value={contact.email}
            icon="mail-outline"
            onPress={() => openEmail(contact.email)}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Λοιπές Πληροφορίες</Text>
          <InfoRow label="Επάγγελμα" value={customer?.profession} icon="briefcase-outline" />
          <InfoRow label="Α.Φ.Μ." value={vatInfo.registrationNo} icon="card-outline" />
          <InfoRow label="Δ.Ο.Υ." value={vatInfo.office} icon="file-tray-outline" />
          <InfoRow label="Πωλητής" value={customer?.merch} icon="person-outline" />
        </View>

        {/* Navigation Buttons */}
        <View style={styles.modernNavContainer}>
          <TouchableOpacity
            style={styles.modernNavButton}
            onPress={() =>
              navigation.navigate('CustomerSalesSummary', {
                customerId: customer?.customerCode || customerId,
                brand: 'john',
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
                customerId: customer?.customerCode || customerId,
                brand: 'john',
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

export default JohnCustomerDetailScreen;
