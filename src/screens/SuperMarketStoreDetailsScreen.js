import React, { useMemo } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { normalizeBrandKey } from '../constants/brands';

const BRAND_LOGOS = {
  john: require('../../assets/john_hellas_logo.png'),
  playmobil: require('../../assets/playmobil_logo.png'),
};

const STORE_LOGOS = {
  masoutis: require('../../assets/masoutis_logo.png'),
  sklavenitis: require('../../assets/sklavenitis_logo.png'),
};

const detectStoreKey = (store) => {
  const name = (store?.companyName || store?.storeName || '').toLowerCase();
  if (name.includes('μασούτ') || name.includes('masout')) return 'masoutis';
  if (name.includes('σκληρ') || name.includes('sklavenit')) return 'sklavenitis';
  return null;
};

const formatValue = (value) => {
  if (value === null || value === undefined) {
    return '-';
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : '-';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '-';
  }
  if (value?.seconds) {
    const date = new Date(value.seconds * 1000);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString();
    }
  }
  return String(value);
};

const buildSections = (store) => {
  if (!store) {
    return [];
  }

  const sections = [
    {
      title: 'Store Details',
      rows: [
        { label: 'Store Name', value: store.storeName },
        { label: 'Store Code', value: store.storeCode },
        { label: 'Company', value: store.companyName },
        { label: 'Store Number', value: store.storeNumber },
        { label: 'Opening Status', value: store.openingStatus },
      ],
    },
    {
      title: 'Location',
      rows: [
        { label: 'Address', value: store.address },
        { label: 'City', value: store.city },
        { label: 'Region', value: store.region },
        { label: 'Area', value: store.area },
        { label: 'Postal Code', value: store.postalCode },
        { label: 'Phone', value: store.phone },
      ],
    },
    {
      title: 'Categories',
      rows: [
        { label: 'Store Category', value: store.storeCategory || store.category },
        { label: 'Toys Category', value: store.toysCategory || store.hasToys },
        { label: 'Summer Category', value: store.summerCategory || store.hasSummerItems },
      ],
    },
    {
      title: 'Metadata',
      rows: [
        { label: 'Typology Notes', value: store.typologyNotes },
        { label: 'Brand', value: store.brand },
        { label: 'Reference ID', value: store.refId || store.id },
        { label: 'Updated At', value: store.updatedAt },
      ],
    },
  ];

  return sections
    .map((section) => ({
      ...section,
      rows: section.rows
        .map((row) => ({ ...row, value: formatValue(row.value) }))
        .filter((row) => row.value !== '-'),
    }))
    .filter((section) => section.rows.length > 0);
};

const SuperMarketStoreDetailsScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const store = route?.params?.store ?? null;
  const brandParam = route?.params?.brand ?? store?.brand ?? null;

  const normalizedBrand = useMemo(
    () => normalizeBrandKey(brandParam || 'john'),
    [brandParam]
  );

  const brandLogo = BRAND_LOGOS[normalizedBrand] ?? null;
  const storeLogoKey = useMemo(() => detectStoreKey(store), [store]);
  const storeLogo = storeLogoKey ? STORE_LOGOS[storeLogoKey] : null;

  const infoSections = useMemo(() => buildSections(store), [store]);

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.screen, { paddingTop: insets.top || 12 }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={22} color="#1f4f8f" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Store Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoRow}>
          {brandLogo ? (
            <Image source={brandLogo} style={styles.brandLogo} resizeMode="contain" />
          ) : null}
          {storeLogo ? (
            <Image source={storeLogo} style={styles.storeLogo} resizeMode="contain" />
          ) : null}
        </View>

        {store ? (
          <View style={styles.card}>
            <Text style={styles.storeName} numberOfLines={2}>
              {formatValue(store.storeName)}
            </Text>
            <Text style={styles.storeSubtitle}>
              {formatValue(store.companyName)} · {formatValue(store.storeCode)}
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.storeName}>Store details unavailable.</Text>
          </View>
        )}

        {infoSections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.rows.map((row) => (
              <View key={`${section.title}-${row.label}`} style={styles.row}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 12,
  },
  brandLogo: {
    width: 120,
    height: 60,
  },
  storeLogo: {
    width: 120,
    height: 60,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  storeName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  storeSubtitle: {
    fontSize: 14,
    color: '#475569',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f4f8f',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  rowLabel: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '600',
    width: '40%',
  },
  rowValue: {
    fontSize: 14,
    color: '#0f172a',
    width: '55%',
    textAlign: 'right',
  },
});

export default SuperMarketStoreDetailsScreen;
