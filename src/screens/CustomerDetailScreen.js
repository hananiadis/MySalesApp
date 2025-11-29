// src/screens/CustomerDetailScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, ActivityIndicator, Image } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
// import firestore from '@react-native-firebase/firestore'; // Uncomment for Firestore
import SafeScreen from '../components/SafeScreen';
import { getCustomersFromLocal } from '../utils/localData';

const openTel = (tel) => {
  if (tel) Linking.openURL(`tel:${tel}`);
};
const openEmail = (email) => {
  if (email) Linking.openURL(`mailto:${email}`);
};
const openMaps = (address, postalCode, city) => {
  const fullAddress = [address, postalCode, city].filter(Boolean).join(', ');
  if (fullAddress) {
    const encodedAddress = encodeURIComponent(fullAddress);
    // Opens the default maps app on both iOS and Android
    Linking.openURL(`https://maps.google.com/?q=${encodedAddress}`);
  }
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
    let cancelled = false;

    const fetchCustomer = async () => {
      setLoading(true);
      try {
        const list = await getCustomersFromLocal(brand);
        const found = Array.isArray(list) ? list.find((c) => c.id === customerId) : null;
        if (!cancelled) {
          setCustomer(found || null);
        }
      } catch (error) {
        console.warn('[CustomerDetailScreen] failed to load customer', {
          brand,
          customerId,
          message: error?.message || error,
        });
        if (!cancelled) {
          setCustomer(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchCustomer();

    return () => {
      cancelled = true;
    };
  }, [brand, customerId]);

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

  const { 
    customerCode, 
    name, 
    name3, 
    address, 
    city,
    postalCode,
    contact, 
    vatInfo, 
    salesInfo, 
    region, 
    transportation, 
    merch 
  } = customer;

  // Check if we have address data for Playmobil brand
  const hasAddressData = address || city || postalCode;

  return (
    <SafeScreen 
      style={styles.container}
      headerLeft={
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
      }
    >
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
        {hasAddressData && <SectionTitle>Διεύθυνση</SectionTitle>}
        {address && <InfoRow label="Οδός" value={address} icon="navigate-outline" />}
        {postalCode && <InfoRow label="ΤΚ" value={postalCode} icon="location-outline" />}
        {city && <InfoRow label="Πόλη" value={city} icon="business-outline" />}
        {hasAddressData && (
          <TouchableOpacity 
            style={styles.mapButton}
            onPress={() => openMaps(address, postalCode, city)}
          >
            <Ionicons name="map" size={18} color="#007AFF" style={{ marginRight: 6 }} />
            <Text style={styles.mapButtonText}>Άνοιγμα στους Χάρτες</Text>
          </TouchableOpacity>
        )}

        {/* Contact Section */}
        {(contact?.telephone1 || contact?.telephone2 || contact?.fax || contact?.email) && (
          <SectionTitle>Επικοινωνία</SectionTitle>
        )}
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
        {(vatInfo?.registrationNo || vatInfo?.office) && <SectionTitle>Φορολογικά</SectionTitle>}
        {vatInfo?.registrationNo && <InfoRow label="ΑΦΜ" value={vatInfo.registrationNo} icon="card-outline" />}
        {vatInfo?.office && <InfoRow label="ΔΟΥ" value={vatInfo.office} icon="file-tray-outline" />}

        {/* Sales Info */}
        {(salesInfo?.description || salesInfo?.groupKey || salesInfo?.groupKeyText) && (
          <SectionTitle>Πωλήσεις</SectionTitle>
        )}
        {salesInfo?.description && <InfoRow label="Περιγραφή" value={salesInfo.description} icon="pricetag-outline" />}
        {salesInfo?.groupKey && <InfoRow label="Group" value={salesInfo.groupKey} icon="grid-outline" />}
        {salesInfo?.groupKeyText && <InfoRow label="Κατηγορία" value={salesInfo.groupKeyText} icon="albums-outline" />}

        {/* Region/Transportation */}
        {(region?.name || region?.id || transportation?.zone || transportation?.zoneId) && (
          <SectionTitle>Περιοχή & Μεταφορά</SectionTitle>
        )}
        {region?.id && <InfoRow label="Region ID" value={region.id} icon="map-outline" />}
        {region?.name && <InfoRow label="Περιοχή" value={region.name} icon="map-outline" />}
        {transportation?.zoneId && <InfoRow label="Zone ID" value={transportation.zoneId} icon="car-outline" />}
        {transportation?.zone && <InfoRow label="Ζώνη" value={transportation.zone} icon="car-outline" />}

        {/* Merch */}
        {merch && <SectionTitle>Εμπορικός Αντιπρόσωπος</SectionTitle>}
        {merch && <InfoRow label="Merch" value={merch} icon="person-outline" />}

        {/* Navigation Buttons */}
        <View style={styles.modernNavContainer}>
          <TouchableOpacity
            style={styles.modernNavButton}
            onPress={() => navigation.navigate('CustomerSalesSummary', { customerId, brand })}
            activeOpacity={0.7}
          >
            <View style={styles.modernNavIconContainer}>
              <Ionicons name="analytics-outline" color="#007AFF" size={24} />
            </View>
            <Text style={styles.modernNavButtonText}>Ανάλυση Πωλήσεων</Text>
            <Ionicons name="chevron-forward" size={20} color="#007AFF" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.modernNavButton}
            onPress={() => navigation.navigate('CustomerMonthlySales', { customerId, brand })}
            activeOpacity={0.7}
          >
            <View style={styles.modernNavIconContainer}>
              <Ionicons name="calendar-outline" color="#007AFF" size={24} />
            </View>
            <Text style={styles.modernNavButtonText}>Μηνιαία Ανάλυση Πωλήσεων</Text>
            <Ionicons name="chevron-forward" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>

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
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  mapButtonText: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '600',
  },
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
    backgroundColor: '#f0f8ff',
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

export default CustomerDetailScreen;
