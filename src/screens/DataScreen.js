// src/screens/DataScreen.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import firestore from '@react-native-firebase/firestore';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LottieView from 'lottie-react-native';

import {
  saveProductsToLocal,
  clearProductsLocal,
  getProductsLastAction,
  saveCustomersToLocal,
  clearCustomersLocal,
  getCustomersLastAction,
  getImagesLastAction,
  clearProductImagesCache,
  getProductsFromLocal,
  saveSuperMarketStoresToLocal,
  clearSuperMarketStoresLocal,
  getSuperMarketStoresLastAction,
  saveSuperMarketListingsToLocal,
  clearSuperMarketListingsLocal,
  getSuperMarketListingsLastAction,
  // New: store last action for listing images (optional)
  getSuperMarketListingImagesLastAction,
  saveSuperMarketListingImagesLastAction,
  saveImagesLastAction,
} from '../utils/localData';

import { downloadAndCacheImage } from '../utils/imageHelpers';
import { cacheImmediateAvailabilityMap, lookupImmediateStockValue } from '../utils/stockAvailability';
import {
  CUSTOMER_COLLECTIONS,
  PRODUCT_COLLECTIONS,
  normalizeBrandKey,
  isSuperMarketBrand,
} from '../constants/brands';
import { fetchSuperMarketStores, fetchSuperMarketListings } from '../services/supermarketData';

const LOTTIE_PROGRESS = require('../../assets/lottie/sync.json'); // put a loader animation here

const fetchProductsFromFirestore = async (collectionName, onProgress) => {
  const snapshot = await firestore().collection(collectionName).get();
  const docs = snapshot.docs;
  const out = [];
  for (let i = 0; i < docs.length; i += 1) {
    out.push({ id: docs[i].id, ...docs[i].data() });
    if (typeof onProgress === 'function') onProgress(i + 1, docs.length);
  }
  return out;
};

const fetchCustomersFromFirestore = async (collectionName, onProgress) => {
  const snapshot = await firestore().collection(collectionName).get();
  const docs = snapshot.docs;
  const out = [];
  for (let i = 0; i < docs.length; i += 1) {
    out.push({ id: docs[i].id, ...docs[i].data() });
    if (typeof onProgress === 'function') onProgress(i + 1, docs.length);
  }
  return out;
};

const STRINGS = {
  title: 'Συγχρονισμός δεδομένων Firestore',
  statusPlaceholder: 'Δεν υπάρχουν καταγεγραμμένες ενέργειες.',
  nav: { back: 'Πίσω' },
  alerts: {
    success: 'Ολοκληρώθηκε',
    error: 'Σφάλμα',
    cleared: 'Καθαρισμός',
    imageSummary: 'Σύνοψη λήψης εικόνων',
  },
  sections: {
    products: {
      title: 'Προϊόντα',
      downloadBtn: 'Λήψη από Firestore',
      clearBtn: 'Καθαρισμός τοπικής μνήμης',
      downloadError: 'Η λήψη των προϊόντων από το Firestore απέτυχε.',
      clearError: 'Ο καθαρισμός της μνήμης προϊόντων απέτυχε.',
    },
    customers: {
      title: 'Πελάτες',
      downloadBtn: 'Λήψη από Firestore',
      clearBtn: 'Καθαρισμός τοπικής μνήμης',
      downloadError: 'Η λήψη των πελατών από το Firestore απέτυχε.',
      clearError: 'Ο καθαρισμός της μνήμης πελατών απέτυχε.',
    },
    supermarketStores: {
      title: 'Καταστήματα SuperMarket',
      downloadBtn: 'Λήψη από Firestore',
      clearBtn: 'Καθαρισμός τοπικής μνήμης',
      downloadError: 'Η λήψη των καταστημάτων SuperMarket από το Firestore απέτυχε.',
      clearError: 'Ο καθαρισμός της μνήμης καταστημάτων SuperMarket απέτυχε.',
    },
    supermarketListings: {
      title: 'Listings SuperMarket',
      downloadBtn: 'Λήψη από Firestore',
      clearBtn: 'Καθαρισμός τοπικής μνήμης',
      downloadError: 'Η λήψη των listings SuperMarket από το Firestore απέτυχε.',
      clearError: 'Ο καθαρισμός της μνήμης listings SuperMarket απέτυχε.',
    },
    images: {
      title: 'Εικόνες προϊόντων',
      downloadBtn: 'Λήψη εικόνων (Προϊόντα & Listings)',
      clearBtn: 'Καθαρισμός cache εικόνων',
      downloadError: 'Η λήψη των εικόνων προϊόντων απέτυχε.',
      clearError: 'Ο καθαρισμός της cache εικόνων απέτυχε.',
    },
  },
  clearedMessages: {
    products: 'Η cache προϊόντων καθαρίστηκε.',
    customers: 'Η cache πελατών καθαρίστηκε.',
    supermarketStores: 'Η cache καταστημάτων SuperMarket καθαρίστηκε.',
    supermarketListings: 'Η cache listings SuperMarket καθαρίστηκε.',
    images: 'Η cache εικόνων καθαρίστηκε.',
  },
};

const MESSAGES = {
  productsSaved: (count) => `Αποθηκεύτηκαν ${count} προϊόντα.`,
  customersSaved: (count) => `Αποθηκεύτηκαν ${count} πελάτες.`,
  supermarketStoresSaved: (count) => `Αποθηκεύτηκαν ${count} καταστήματα SuperMarket.`,
  supermarketListingsSaved: (count) => `Αποθηκεύτηκαν ${count} listings SuperMarket.`,
  imagesSummary: (success, failed, successListings, failedListings) =>
    `Προϊόντα\n  Λήφθηκαν: ${success}\n  Απέτυχαν: ${failed}\n\nListings\n  Λήφθηκαν: ${successListings}\n  Απέτυχαν: ${failedListings}`,
};

const SUPER_MARKET_UNAVAILABLE_MSG = 'Μη διαθέσιμο για αυτή τη μάρκα.';
const formatAction = (value) => value || STRINGS.statusPlaceholder;

const ProgressRow = ({ active, label, current, total }) => {
  if (!active) return null;
  const haveTotal = Number.isFinite(total) && total > 0;
  const pct = haveTotal ? Math.min(100, Math.round((current / total) * 100)) : 0;
  return (
    <View style={styles.progressRow}>
      <View style={styles.progressLeft}>
        <LottieView
          source={LOTTIE_PROGRESS}
          autoPlay
          loop
          style={{ width: 42, height: 42 }}
        />
      </View>
      <View style={styles.progressRight}>
        <Text style={styles.progressLabel}>
          {label} {haveTotal ? `(${current}/${total})` : ''}
        </Text>
        <View style={styles.progressBarWrap}>
          <View style={[styles.progressBarFill, { width: haveTotal ? `${pct}%` : '0%' }]} />
        </View>
      </View>
    </View>
  );
};

const DataScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const brand = useMemo(() => normalizeBrandKey(route?.params?.brand), [route?.params?.brand]);
  const supportsSuperMarket = useMemo(() => isSuperMarketBrand(brand), [brand]);
  const productCollection = PRODUCT_COLLECTIONS[brand] ?? PRODUCT_COLLECTIONS.playmobil;
  const customerCollection = CUSTOMER_COLLECTIONS[brand] ?? CUSTOMER_COLLECTIONS.playmobil;

  const [prodAction, setProdAction] = useState('');
  const [custAction, setCustAction] = useState('');
  const [imgAction, setImgAction] = useState('');
  const [storeAction, setStoreAction] = useState('');
  const [listingAction, setListingAction] = useState('');

  const [loading, setLoading] = useState({
    products: false,
    customers: false,
    prodClear: false,
    custClear: false,
    images: false,
    imgClear: false,
    smStores: false,
    smStoresClear: false,
    smListings: false,
    smListingsClear: false,
  });

  // per-action progress
  const [progress, setProgress] = useState({
    products: { current: 0, total: 0, label: 'Λήψη προϊόντων' },
    customers: { current: 0, total: 0, label: 'Λήψη πελατών' },
    smStores: { current: 0, total: 0, label: 'Λήψη καταστημάτων' },
    smListings: { current: 0, total: 0, label: 'Λήψη listings' },
    imagesProducts: { current: 0, total: 0, label: 'Εικόνες (Προϊόντα)' },
    imagesListings: { current: 0, total: 0, label: 'Εικόνες (Listings)' },
  });

  const updateProgress = (key, current, total) =>
    setProgress((p) => ({ ...p, [key]: { ...p[key], current, total } }));

  const refreshActions = useCallback(async () => {
    const [productsLast, customersLast, imagesLast] = await Promise.all([
      getProductsLastAction(brand),
      getCustomersLastAction(brand),
      getImagesLastAction(),
    ]);

    let storesLast = SUPER_MARKET_UNAVAILABLE_MSG;
    let listingsLast = SUPER_MARKET_UNAVAILABLE_MSG;

    if (supportsSuperMarket) {
      const [storesValue, listingsValue] = await Promise.all([
        getSuperMarketStoresLastAction(brand),
        getSuperMarketListingsLastAction(brand),
      ]);
      storesLast = storesValue;
      listingsLast = listingsValue;
    }

    setProdAction(formatAction(productsLast));
    setCustAction(formatAction(customersLast));
    setImgAction(formatAction(imagesLast));
    setStoreAction(supportsSuperMarket ? formatAction(storesLast) : SUPER_MARKET_UNAVAILABLE_MSG);
    setListingAction(supportsSuperMarket ? formatAction(listingsLast) : SUPER_MARKET_UNAVAILABLE_MSG);
  }, [brand, supportsSuperMarket]);

  useEffect(() => {
    refreshActions();
  }, [brand, refreshActions]);

  const handleDownloadProducts = async () => {
    setLoading((s) => ({ ...s, products: true }));
    updateProgress('products', 0, 0);
    try {
      const products = await fetchProductsFromFirestore(productCollection, (c, t) =>
        updateProgress('products', c, t)
      );

      let stockMap = null;
      try {
        stockMap = await cacheImmediateAvailabilityMap(true);
      } catch (error) {
        console.log('cacheImmediateAvailabilityMap error:', error);
      }

      const normalised = Array.isArray(products)
        ? products.map((product = {}) => {
            if (!stockMap || typeof stockMap.get !== 'function') {
              return product;
            }
            const stockValue = lookupImmediateStockValue(stockMap, product?.productCode);
            if (stockValue != null && stockValue !== '') {
              return { ...product, availableStock: stockValue };
            }
            return { ...product, availableStock: 'n/a' };
          })
        : products;

      await saveProductsToLocal(normalised, brand);
      Alert.alert(STRINGS.alerts.success, MESSAGES.productsSaved(normalised.length));
    } catch (error) {
      console.log('handleDownloadProducts error:', error);
      Alert.alert(STRINGS.alerts.error, STRINGS.sections.products.downloadError);
    } finally {
      setLoading((s) => ({ ...s, products: false }));
      refreshActions();
    }
  };

  const handleDownloadCustomers = async () => {
    setLoading((s) => ({ ...s, customers: true }));
    updateProgress('customers', 0, 0);
    try {
      const customers = await fetchCustomersFromFirestore(customerCollection, (c, t) =>
        updateProgress('customers', c, t)
      );
      await saveCustomersToLocal(customers, brand);
      Alert.alert(STRINGS.alerts.success, MESSAGES.customersSaved(customers.length));
    } catch (error) {
      console.log('handleDownloadCustomers error:', error);
      Alert.alert(STRINGS.alerts.error, STRINGS.sections.customers.downloadError);
    } finally {
      setLoading((s) => ({ ...s, customers: false }));
      refreshActions();
    }
  };

  const handleDownloadSuperMarketStores = async () => {
    if (!supportsSuperMarket) {
      Alert.alert(STRINGS.alerts.error, SUPER_MARKET_UNAVAILABLE_MSG);
      return;
    }
    setLoading((s) => ({ ...s, smStores: true }));
    updateProgress('smStores', 0, 0);
    try {
      const stores = await fetchSuperMarketStores(brand, (c, t) =>
        updateProgress('smStores', c, t)
      ); // fetch can ignore cb if not implemented; harmless
      await saveSuperMarketStoresToLocal(stores, brand);
      Alert.alert(STRINGS.alerts.success, MESSAGES.supermarketStoresSaved(stores.length));
    } catch (error) {
      console.log('handleDownloadSuperMarketStores error:', error);
      Alert.alert(STRINGS.alerts.error, STRINGS.sections.supermarketStores.downloadError);
    } finally {
      setLoading((s) => ({ ...s, smStores: false }));
      refreshActions();
    }
  };

  const handleClearSuperMarketStores = async () => {
    if (!supportsSuperMarket) {
      Alert.alert(STRINGS.alerts.error, SUPER_MARKET_UNAVAILABLE_MSG);
      return;
    }
    setLoading((s) => ({ ...s, smStoresClear: true }));
    try {
      await clearSuperMarketStoresLocal(brand);
      Alert.alert(STRINGS.alerts.cleared, STRINGS.clearedMessages.supermarketStores);
    } catch (error) {
      console.log('handleClearSuperMarketStores error:', error);
      Alert.alert(STRINGS.alerts.error, STRINGS.sections.supermarketStores.clearError);
    } finally {
      setLoading((s) => ({ ...s, smStoresClear: false }));
      refreshActions();
    }
  };

  const handleDownloadSuperMarketListings = async () => {
    if (!supportsSuperMarket) {
      Alert.alert(STRINGS.alerts.error, SUPER_MARKET_UNAVAILABLE_MSG);
      return;
    }
    setLoading((s) => ({ ...s, smListings: true }));
    updateProgress('smListings', 0, 0);
    try {
      const listings = await fetchSuperMarketListings(brand, { onProgress: (c, t) => updateProgress('smListings', c, t) });
      await saveSuperMarketListingsToLocal(listings, brand);
      Alert.alert(STRINGS.alerts.success, MESSAGES.supermarketListingsSaved(listings.length));
    } catch (error) {
      console.log('handleDownloadSuperMarketListings error:', error);
      Alert.alert(STRINGS.alerts.error, STRINGS.sections.supermarketListings.downloadError);
    } finally {
      setLoading((s) => ({ ...s, smListings: false }));
      refreshActions();
    }
  };

  const handleClearSuperMarketListings = async () => {
    if (!supportsSuperMarket) {
      Alert.alert(STRINGS.alerts.error, SUPER_MARKET_UNAVAILABLE_MSG);
      return;
    }
    setLoading((s) => ({ ...s, smListingsClear: true }));
    try {
      await clearSuperMarketListingsLocal(brand);
      Alert.alert(STRINGS.alerts.cleared, STRINGS.clearedMessages.supermarketListings);
    } catch (error) {
      console.log('handleClearSuperMarketListings error:', error);
      Alert.alert(STRINGS.alerts.error, STRINGS.sections.supermarketListings.clearError);
    } finally {
      setLoading((s) => ({ ...s, smListingsClear: false }));
      refreshActions();
    }
  };

  const handleClearProducts = async () => {
    setLoading((s) => ({ ...s, prodClear: true }));
    try {
      await clearProductsLocal(brand);
      Alert.alert(STRINGS.alerts.cleared, STRINGS.clearedMessages.products);
    } catch (error) {
      console.log('handleClearProducts error:', error);
      Alert.alert(STRINGS.alerts.error, STRINGS.sections.products.clearError);
    } finally {
      setLoading((s) => ({ ...s, prodClear: false }));
      refreshActions();
    }
  };

  const handleClearCustomers = async () => {
    setLoading((s) => ({ ...s, custClear: true }));
    try {
      await clearCustomersLocal(brand);
      Alert.alert(STRINGS.alerts.cleared, STRINGS.clearedMessages.customers);
    } catch (error) {
      console.log('handleClearCustomers error:', error);
      Alert.alert(STRINGS.alerts.error, STRINGS.sections.customers.clearError);
    } finally {
      setLoading((s) => ({ ...s, custClear: false }));
      refreshActions();
    }
  };

  const safeDownload = async (code, url) => {
    try {
      if (!url || !code) return false;
      const cached = await downloadAndCacheImage(code, url);
      return !!cached;
    } catch {
      return false;
    }
  };

  const handleDownloadImages = async () => {
    setLoading((s) => ({ ...s, images: true }));
    updateProgress('imagesProducts', 0, 0);
    updateProgress('imagesListings', 0, 0);
    try {
      // 1) products images
      const products = await getProductsFromLocal(brand);
      const prodItems = Array.isArray(products) ? products.filter((p) => p?.productCode && p?.frontCover) : [];
      updateProgress('imagesProducts', 0, prodItems.length);

      let success = 0;
      let failed = 0;
      for (let i = 0; i < prodItems.length; i += 1) {
        const p = prodItems[i];
        const ok = await safeDownload(p.productCode, p.frontCover);
        if (ok) success += 1;
        else failed += 1;
        updateProgress('imagesProducts', i + 1, prodItems.length);
      }

      // 2) supermarket listings images (if brand supports)
      let successListings = 0;
      let failedListings = 0;
      if (supportsSuperMarket) {
        const listings = await fetchSuperMarketListings(brand);
        const listItems = Array.isArray(listings)
          ? listings.filter((l) => l?.productCode && l?.photoUrl)
          : [];
        updateProgress('imagesListings', 0, listItems.length);

        for (let i = 0; i < listItems.length; i += 1) {
          const l = listItems[i];
          const ok = await safeDownload(l.productCode, l.photoUrl);
          if (ok) successListings += 1;
          else failedListings += 1;
          updateProgress('imagesListings', i + 1, listItems.length);
        }
        await saveSuperMarketListingImagesLastAction?.(brand);
      }

      await saveImagesLastAction?.();

      Alert.alert(
        STRINGS.alerts.imageSummary,
        MESSAGES.imagesSummary(success, failed, successListings, failedListings)
      );
    } catch (error) {
      console.log('handleDownloadImages error:', error);
      Alert.alert(STRINGS.alerts.error, STRINGS.sections.images.downloadError);
    } finally {
      setLoading((s) => ({ ...s, images: false }));
      refreshActions();
    }
  };

  const handleClearImages = async () => {
    setLoading((s) => ({ ...s, imgClear: true }));
    try {
      await clearProductImagesCache();
      Alert.alert(STRINGS.alerts.cleared, STRINGS.clearedMessages.images);
    } catch (error) {
      console.log('handleClearImages error:', error);
      Alert.alert(STRINGS.alerts.error, STRINGS.sections.images.clearError);
    } finally {
      setLoading((s) => ({ ...s, imgClear: false }));
      refreshActions();
    }
  };

  const Section = ({ title, children }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.topBarButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={STRINGS.nav.back}
        >
          <Ionicons name="arrow-back" size={20} color="#1f4f8f" />
          <Text style={styles.topBarText}>{STRINGS.nav.back}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{STRINGS.title}</Text>

        {/* Products */}
        <Section title={STRINGS.sections.products.title}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleDownloadProducts}
            disabled={loading.products}
          >
            {loading.products ? <ActivityIndicator color="#fff" /> :
              <Text style={styles.buttonText}>{STRINGS.sections.products.downloadBtn}</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, styles.dangerButton]}
            onPress={handleClearProducts}
            disabled={loading.prodClear}
          >
            {loading.prodClear ? <ActivityIndicator color="#fff" /> :
              <Text style={styles.buttonText}>{STRINGS.sections.products.clearBtn}</Text>}
          </TouchableOpacity>
          <ProgressRow
            active={loading.products}
            label={progress.products.label}
            current={progress.products.current}
            total={progress.products.total}
          />
          <Text style={styles.status}>{formatAction(prodAction)}</Text>
        </Section>

        {/* Customers */}
        <Section title={STRINGS.sections.customers.title}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleDownloadCustomers}
            disabled={loading.customers}
          >
            {loading.customers ? <ActivityIndicator color="#fff" /> :
              <Text style={styles.buttonText}>{STRINGS.sections.customers.downloadBtn}</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, styles.dangerButton]}
            onPress={handleClearCustomers}
            disabled={loading.custClear}
          >
            {loading.custClear ? <ActivityIndicator color="#fff" /> :
              <Text style={styles.buttonText}>{STRINGS.sections.customers.clearBtn}</Text>}
          </TouchableOpacity>
          <ProgressRow
            active={loading.customers}
            label={progress.customers.label}
            current={progress.customers.current}
            total={progress.customers.total}
          />
          <Text style={styles.status}>{formatAction(custAction)}</Text>
        </Section>

        {/* Supermarket sections */}
        {supportsSuperMarket && (
          <>
            <Section title={STRINGS.sections.supermarketStores.title}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleDownloadSuperMarketStores}
                disabled={loading.smStores}
              >
                {loading.smStores ? <ActivityIndicator color="#fff" /> :
                  <Text style={styles.buttonText}>{STRINGS.sections.supermarketStores.downloadBtn}</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, styles.dangerButton]}
                onPress={handleClearSuperMarketStores}
                disabled={loading.smStoresClear}
              >
                {loading.smStoresClear ? <ActivityIndicator color="#fff" /> :
                  <Text style={styles.buttonText}>{STRINGS.sections.supermarketStores.clearBtn}</Text>}
              </TouchableOpacity>
              <ProgressRow
                active={loading.smStores}
                label={progress.smStores.label}
                current={progress.smStores.current}
                total={progress.smStores.total}
              />
              <Text style={styles.status}>{formatAction(storeAction)}</Text>
            </Section>

            <Section title={STRINGS.sections.supermarketListings.title}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleDownloadSuperMarketListings}
                disabled={loading.smListings}
              >
                {loading.smListings ? <ActivityIndicator color="#fff" /> :
                  <Text style={styles.buttonText}>{STRINGS.sections.supermarketListings.downloadBtn}</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, styles.dangerButton]}
                onPress={handleClearSuperMarketListings}
                disabled={loading.smListingsClear}
              >
                {loading.smListingsClear ? <ActivityIndicator color="#fff" /> :
                  <Text style={styles.buttonText}>{STRINGS.sections.supermarketListings.clearBtn}</Text>}
              </TouchableOpacity>
              <ProgressRow
                active={loading.smListings}
                label={progress.smListings.label}
                current={progress.smListings.current}
                total={progress.smListings.total}
              />
              <Text style={styles.status}>{formatAction(listingAction)}</Text>
            </Section>
          </>
        )}

        {/* Images */}
        <Section title={STRINGS.sections.images.title}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleDownloadImages}
            disabled={loading.images}
          >
            {loading.images ? <ActivityIndicator color="#fff" /> :
              <Text style={styles.buttonText}>{STRINGS.sections.images.downloadBtn}</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, styles.dangerButton]}
            onPress={handleClearImages}
            disabled={loading.imgClear}
          >
            {loading.imgClear ? <ActivityIndicator color="#fff" /> :
              <Text style={styles.buttonText}>{STRINGS.sections.images.clearBtn}</Text>}
          </TouchableOpacity>

          {/* Two separate progress rows for products & listings images */}
          <ProgressRow
            active={loading.images}
            label={progress.imagesProducts.label}
            current={progress.imagesProducts.current}
            total={progress.imagesProducts.total}
          />
          <ProgressRow
            active={loading.images}
            label={progress.imagesListings.label}
            current={progress.imagesListings.current}
            total={progress.imagesListings.total}
          />

          <Text style={styles.status}>{formatAction(imgAction)}</Text>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6fb' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#f4f6fb',
  },
  topBarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#e3f2fd',
  },
  topBarText: { marginLeft: 6, fontSize: 15, fontWeight: '600', color: '#1f4f8f' },
  content: { padding: 20, paddingBottom: 40 },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 24,
    textAlign: 'center',
    alignSelf: 'center',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#0f172a', marginBottom: 12 },
  primaryButton: {
    backgroundColor: '#0d6efd',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  dangerButton: { backgroundColor: '#dc3545' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  status: { marginTop: 4, fontSize: 13, color: '#475569', fontStyle: 'italic' },

  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 6,
  },
  progressLeft: {
    width: 46,
    height: 46,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRight: { flex: 1 },
  progressLabel: { fontSize: 13, color: '#0f172a', marginBottom: 6, fontWeight: '600' },
  progressBarWrap: {
    height: 8,
    borderRadius: 6,
    backgroundColor: '#e5efff',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 8,
    backgroundColor: '#0d6efd',
  },
});

export default DataScreen;
