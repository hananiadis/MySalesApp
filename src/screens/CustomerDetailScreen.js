// src/screens/CustomerDetailScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, ActivityIndicator, Image } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import firestore from '@react-native-firebase/firestore'; // Uncomment for Firestore
import SafeScreen from '../components/SafeScreen';

const openTel = (tel) => {
  if (tel) Linking.openURL(`tel:${tel}`);
};
const openEmail = (email) => {
  if (email) Linking.openURL(`mailto:${email}`);
};

const InfoRow = ({ label, value, icon }) =>
  value ? (
    <View style={styles.infoRow}>
      {icon && <Ionicons name={icon} size={19} color="#007AFF" style={{ marginRight: 10 }} />}
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  ) : null;

const SectionTitle = ({ children }) => <Text style={styles.sectionTitle}>{children}</Text>;

const CustomerDetailScreen = ({ route, navigation }) => {
  const { customerId } = route.params || {};
  const brand = route?.params?.brand || 'playmobil';
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  // -- Option 1: Load from AsyncStorage
  useEffect(() => {
    const fetchCustomer = async () => {
      setLoading(true);
      try {
        const json = await AsyncStorage.getItem('customers');
        const arr = json ? JSON.parse(json) : [];
        const found = arr.find((c) => c.id === customerId);
        setCustomer(found || null);
      } catch (e) {
        setCustomer(null);
      }
      setLoading(false);
    };
    fetchCustomer();
  }, [customerId]);

  // -- Option 2: Live from Firestore
  // useEffect(() => {
  //   setLoading(true);
  //   firestore().collection('customers').doc(customerId)
  //     .get()
  //     .then(doc => setCustomer({ id: doc.id, ...doc.data() }))
  //     .catch(() => setCustomer(null))
  //     .finally(() => setLoading(false));
  // }, [customerId]);

  if (loading) {
    return (
      <SafeScreen style={styles.container}>
        <ActivityIndicator color="#007AFF" size="large" />
      </SafeScreen>
    );
  }
  if (!customer) {
    return (
      <SafeScreen style={styles.container}>
        <Text style={styles.error}>Πελάτης δεν βρέθηκε.</Text>
      </SafeScreen>
    );
  }

  const { customerCode, name, name3, address, contact, vatInfo, salesInfo, region, transportation, merch } = customer;

  return (
    <SafeScreen style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollInner}>
        <View style={styles.headerSection}>
          <Image source={require('../../assets/customer_avatar.png')} style={styles.avatar} resizeMode="cover" />
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>
              {customerCode} - {name}
            </Text>
            <Text style={styles.headerSubtitle}>{name3}</Text>
          </View>
        </View>

        {/* Address Section */}
        <SectionTitle>Διεύθυνση</SectionTitle>
        <InfoRow label="Οδός" value={address?.street} icon="navigate-outline" />
        <InfoRow label="ΤΚ" value={address?.postalCode} icon="location-outline" />
        <InfoRow label="Πόλη" value={address?.city} icon="business-outline" />

        {/* Contact Section */}
        <SectionTitle>Επικοινωνία</SectionTitle>
        <View style={{ marginBottom: 4 }}>
          {contact?.telephone1 ? (
            <TouchableOpacity onPress={() => openTel(contact.telephone1)}>
              <View style={styles.infoRow}>
                <Ionicons name="call-outline" size={19} color="#007AFF" style={{ marginRight: 10 }} />
                <Text style={styles.label}>Τηλέφωνο 1</Text>
                <Text style={styles.linkValue}>{contact.telephone1}</Text>
              </View>
            </TouchableOpacity>
          ) : null}
          {contact?.telephone2 ? (
            <TouchableOpacity onPress={() => openTel(contact.telephone2)}>
              <View style={styles.infoRow}>
                <Ionicons name="call-outline" size={19} color="#007AFF" style={{ marginRight: 10 }} />
                <Text style={styles.label}>Τηλέφωνο 2</Text>
                <Text style={styles.linkValue}>{contact.telephone2}</Text>
              </View>
            </TouchableOpacity>
          ) : null}
          {contact?.fax ? <InfoRow label="Fax" value={contact.fax} icon="print-outline" /> : null}
          {contact?.email ? (
            <TouchableOpacity onPress={() => openEmail(contact.email)}>
              <View style={styles.infoRow}>
                <Ionicons name="mail-outline" size={19} color="#007AFF" style={{ marginRight: 10 }} />
                <Text style={styles.label}>Email</Text>
                <Text style={styles.linkValue}>{contact.email}</Text>
              </View>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* VAT Info */}
        <SectionTitle>Φορολογικά</SectionTitle>
        <InfoRow label="ΑΦΜ" value={vatInfo?.registrationNo} icon="card-outline" />
        <InfoRow label="ΔΟΥ" value={vatInfo?.office} icon="file-tray-outline" />

        {/* Sales Info */}
        <SectionTitle>Πωλήσεις</SectionTitle>
        <InfoRow label="Περιγραφή" value={salesInfo?.description} icon="pricetag-outline" />
        <InfoRow label="Group" value={salesInfo?.groupKey} icon="grid-outline" />
        <InfoRow label="Κατηγορία" value={salesInfo?.groupKeyText} icon="albums-outline" />

        {/* Region/Transportation */}
        <SectionTitle>Περιοχή & Μεταφορά</SectionTitle>
        <InfoRow label="Περιοχή" value={region?.name} icon="map-outline" />
        <InfoRow label="Ζώνη" value={transportation?.zone} icon="car-outline" />

        {/* Merch */}
        <SectionTitle>Εμπορικός Αντιπρόσωπος</SectionTitle>
        <InfoRow label="Merch" value={merch} icon="person-outline" />

        {/* Sales Summary Button */}
        <TouchableOpacity
          style={styles.salesButton}
          onPress={() => navigation.navigate('CustomerSalesSummary', { customerId, brand })}
        >
          <Ionicons name="stats-chart-outline" color="#fff" size={18} style={{ marginRight: 8 }} />
          <Text style={styles.salesButtonText}>Στοιχεία πελάτη</Text>
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollInner: { padding: 18 },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 18,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 10,
    backgroundColor: '#e0e0e0',
  },
  headerTitle: { fontSize: 21, fontWeight: 'bold', color: '#007AFF', marginBottom: 2 },
  headerSubtitle: { fontSize: 16, color: '#222', fontWeight: '500', marginBottom: 8, flexWrap: 'wrap' },
  sectionTitle: { fontSize: 17, color: '#4169e1', fontWeight: 'bold', marginTop: 10, marginBottom: 6 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2, flexWrap: 'wrap' },
  label: { minWidth: 70, fontWeight: 'bold', color: '#444', fontSize: 15, marginRight: 7 },
  value: { fontSize: 15, color: '#222', flexShrink: 1, flexWrap: 'wrap' },
  error: { color: '#b00', fontSize: 18, textAlign: 'center', marginTop: 40 },
  salesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 22,
    marginTop: 22,
    alignSelf: 'center',
  },
  linkValue: {
    color: '#007AFF',
    textDecorationLine: 'underline',
    fontSize: 15,
    fontWeight: '500',
    marginLeft: 8,
  },
  salesButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 17 },
});

export default CustomerDetailScreen;
