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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

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

const fetchProductsFromFirestore = async (collectionName) => {
  const snapshot = await firestore().collection(collectionName).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

const fetchCustomersFromFirestore = async (collectionName) => {
  const snapshot = await firestore().collection(collectionName).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

const STRINGS = {
  title: 'Συγχρονισμός δεδομένων Firestore',
  statusPlaceholder: 'Δεν υπάρχουν καταγεγραμμένες ενέργειες.',
  nav: {
    back: 'Πίσω',
  },
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
      downloadBtn: 'Λήψη εικόνων',
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
  imagesSummary: (success, failed) => `Λήφθηκαν: ${success}
Απέτυχαν: ${failed}`,
};

const SUPER_MARKET_UNAVAILABLE_MSG = 'Μη διαθέσιμο για αυτή τη μάρκα.';

const formatAction = (value) => value || STRINGS.statusPlaceholder;

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
    setLoading((state) => ({ ...state, products: true }));
    try {
      const products = await fetchProductsFromFirestore(productCollection);
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
      setLoading((state) => ({ ...state, products: false }));
      refreshActions();
    }
  };

  const handleDownloadCustomers = async () => {
    setLoading((state) => ({ ...state, customers: true }));
    try {
      const customers = await fetchCustomersFromFirestore(customerCollection);
      await saveCustomersToLocal(customers, brand);
      Alert.alert(STRINGS.alerts.success, MESSAGES.customersSaved(customers.length));
    } catch (error) {
      console.log('handleDownloadCustomers error:', error);
      Alert.alert(STRINGS.alerts.error, STRINGS.sections.customers.downloadError);
    } finally {
      setLoading((state) => ({ ...state, customers: false }));
      refreshActions();
    }
  };

  const handleDownloadSuperMarketStores = async () => {
    if (!supportsSuperMarket) {
      Alert.alert(STRINGS.alerts.error, SUPER_MARKET_UNAVAILABLE_MSG);
      return;
    }
    setLoading((state) => ({ ...state, smStores: true }));
    try {
      const stores = await fetchSuperMarketStores(brand);
      await saveSuperMarketStoresToLocal(stores, brand);
      Alert.alert(STRINGS.alerts.success, MESSAGES.supermarketStoresSaved(stores.length));
    } catch (error) {
      console.log('handleDownloadSuperMarketStores error:', error);
      Alert.alert(STRINGS.alerts.error, STRINGS.sections.supermarketStores.downloadError);
    } finally {
      setLoading((state) => ({ ...state, smStores: false }));
      refreshActions();
    }
  };

  const handleClearSuperMarketStores = async () => {
    if (!supportsSuperMarket) {
      Alert.alert(STRINGS.alerts.error, SUPER_MARKET_UNAVAILABLE_MSG);
      return;
    }
    setLoading((state) => ({ ...state, smStoresClear: true }));
    try {
      await clearSuperMarketStoresLocal(brand);
      Alert.alert(STRINGS.alerts.cleared, STRINGS.clearedMessages.supermarketStores);
    } catch (error) {
      console.log('handleClearSuperMarketStores error:', error);
      Alert.alert(STRINGS.alerts.error, STRINGS.sections.supermarketStores.clearError);
    } finally {
      setLoading((state) => ({ ...state, smStoresClear: false }));
      refreshActions();
    }
  };

  const handleDownloadSuperMarketListings = async () => {
    if (!supportsSuperMarket) {
      Alert.alert(STRINGS.alerts.error, SUPER_MARKET_UNAVAILABLE_MSG);
      return;
    }
    setLoading((state) => ({ ...state, smListings: true }));
    try {
      const listings = await fetchSuperMarketListings(brand);
      await saveSuperMarketListingsToLocal(listings, brand);
      Alert.alert(STRINGS.alerts.success, MESSAGES.supermarketListingsSaved(listings.length));
    } catch (error) {
      console.log('handleDownloadSuperMarketListings error:', error);
      Alert.alert(STRINGS.alerts.error, STRINGS.sections.supermarketListings.downloadError);
    } finally {
      setLoading((state) => ({ ...state, smListings: false }));
      refreshActions();
    }
  };

  const handleClearSuperMarketListings = async () => {
    if (!supportsSuperMarket) {
      Alert.alert(STRINGS.alerts.error, SUPER_MARKET_UNAVAILABLE_MSG);
      return;
    }
    setLoading((state) => ({ ...state, smListingsClear: true }));
    try {
      await clearSuperMarketListingsLocal(brand);
      Alert.alert(STRINGS.alerts.cleared, STRINGS.clearedMessages.supermarketListings);
    } catch (error) {
      console.log('handleClearSuperMarketListings error:', error);
      Alert.alert(STRINGS.alerts.error, STRINGS.sections.supermarketListings.clearError);
    } finally {
      setLoading((state) => ({ ...state, smListingsClear: false }));
      refreshActions();
    }
  };

  const handleClearProducts = async () => {
    setLoading((state) => ({ ...state, prodClear: true }));
    try {
      await clearProductsLocal(brand);
      Alert.alert(STRINGS.alerts.cleared, STRINGS.clearedMessages.products);
    } catch (error) {
      console.log('handleClearProducts error:', error);
      Alert.alert(STRINGS.alerts.error, STRINGS.sections.products.clearError);
    } finally {
      setLoading((state) => ({ ...state, prodClear: false }));
      refreshActions();
    }
  };

  const handleClearCustomers = async () => {
    setLoading((state) => ({ ...state, custClear: true }));
    try {
      await clearCustomersLocal(brand);
      Alert.alert(STRINGS.alerts.cleared, STRINGS.clearedMessages.customers);
    } catch (error) {
      console.log('handleClearCustomers error:', error);
      Alert.alert(STRINGS.alerts.error, STRINGS.sections.customers.clearError);
    } finally {
      setLoading((state) => ({ ...state, custClear: false }));
      refreshActions();
    }
  };

  const handleDownloadImages = async () => {
    setLoading((state) => ({ ...state, images: true }));
    try {
      const products = await getProductsFromLocal(brand);
      let success = 0;
      let failed = 0;

      for (const product of products) {
        if (product?.productCode && product?.frontCover) {
          const cached = await downloadAndCacheImage(product.productCode, product.frontCover);
          if (cached) success += 1;
          else failed += 1;
        }
      }

      Alert.alert(STRINGS.alerts.imageSummary, MESSAGES.imagesSummary(success, failed));
    } catch (error) {
      console.log('handleDownloadImages error:', error);
      Alert.alert(STRINGS.alerts.error, STRINGS.sections.images.downloadError);
    } finally {
      setLoading((state) => ({ ...state, images: false }));
      refreshActions();
    }
  };

  const handleClearImages = async () => {
    setLoading((state) => ({ ...state, imgClear: true }));
    try {
      await clearProductImagesCache();
      Alert.alert(STRINGS.alerts.cleared, STRINGS.clearedMessages.images);
    } catch (error) {
      console.log('handleClearImages error:', error);
      Alert.alert(STRINGS.alerts.error, STRINGS.sections.images.clearError);
    } finally {
      setLoading((state) => ({ ...state, imgClear: false }));
      refreshActions();
    }
  };

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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{STRINGS.sections.products.title}</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleDownloadProducts}
            disabled={loading.products}
          >
            {loading.products ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{STRINGS.sections.products.downloadBtn}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, styles.dangerButton]}
            onPress={handleClearProducts}
            disabled={loading.prodClear}
          >
            {loading.prodClear ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{STRINGS.sections.products.clearBtn}</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.status}>{formatAction(prodAction)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{STRINGS.sections.customers.title}</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleDownloadCustomers}
            disabled={loading.customers}
          >
            {loading.customers ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{STRINGS.sections.customers.downloadBtn}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, styles.dangerButton]}
            onPress={handleClearCustomers}
            disabled={loading.custClear}
          >
            {loading.custClear ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{STRINGS.sections.customers.clearBtn}</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.status}>{formatAction(custAction)}</Text>
        </View>

        {supportsSuperMarket && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{STRINGS.sections.supermarketStores.title}</Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleDownloadSuperMarketStores}
                disabled={loading.smStores}
              >
                {loading.smStores ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>{STRINGS.sections.supermarketStores.downloadBtn}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, styles.dangerButton]}
                onPress={handleClearSuperMarketStores}
                disabled={loading.smStoresClear}
              >
                {loading.smStoresClear ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>{STRINGS.sections.supermarketStores.clearBtn}</Text>
                )}
              </TouchableOpacity>
              <Text style={styles.status}>{formatAction(storeAction)}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{STRINGS.sections.supermarketListings.title}</Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleDownloadSuperMarketListings}
                disabled={loading.smListings}
              >
                {loading.smListings ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>{STRINGS.sections.supermarketListings.downloadBtn}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, styles.dangerButton]}
                onPress={handleClearSuperMarketListings}
                disabled={loading.smListingsClear}
              >
                {loading.smListingsClear ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>{STRINGS.sections.supermarketListings.clearBtn}</Text>
                )}
              </TouchableOpacity>
              <Text style={styles.status}>{formatAction(listingAction)}</Text>
            </View>
          </>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{STRINGS.sections.images.title}</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleDownloadImages}
            disabled={loading.images}
          >
            {loading.images ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{STRINGS.sections.images.downloadBtn}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, styles.dangerButton]}
            onPress={handleClearImages}
            disabled={loading.imgClear}
          >
            {loading.imgClear ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{STRINGS.sections.images.clearBtn}</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.status}>{formatAction(imgAction)}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6fb',
  },
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
  topBarText: {
    marginLeft: 6,
    fontSize: 15,
    fontWeight: '600',
    color: '#1f4f8f',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#0d6efd',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  dangerButton: {
    backgroundColor: '#dc3545',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  status: {
    marginTop: 4,
    fontSize: 13,
    color: '#475569',
    fontStyle: 'italic',
  },
});

export default DataScreen;






