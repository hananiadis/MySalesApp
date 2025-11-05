// src/screens/DataScreen.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import firestore from '@react-native-firebase/firestore';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LottieView from 'lottie-react-native';

import { useAuth } from '../context/AuthProvider';
import { updateAllDataForUser, formatUpdateAllSummary } from '../services/updateAll';
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
  saveSuperMarketListingImagesLastAction,
  saveImagesLastAction,
} from '../utils/localData';
import { trimOldCaches, trimLargeCaches, clearAllSheetCaches } from '../services/googleSheetsCache';
import { downloadAndCacheImage } from '../utils/imageHelpers';
import { cacheImmediateAvailabilityMap, lookupImmediateStockValue } from '../utils/stockAvailability';
import {
  CUSTOMER_COLLECTIONS,
  PRODUCT_COLLECTIONS,
  BRAND_LABEL,
  normalizeBrandKey,
} from '../constants/brands';
import { fetchSuperMarketStores, fetchSuperMarketListings } from '../services/supermarketData';

const LOTTIE_PROGRESS = require('../../assets/lottie/sync.json');

const fetchProductsFromFirestore = async (collectionName, onProgress) => {
  console.log(`[DataScreen] fetchProductsFromFirestore start collection=${collectionName}`);
  const snapshot = await firestore().collection(collectionName).get();
  const docs = snapshot.docs;
  const out = [];
  for (let i = 0; i < docs.length; i += 1) {
    out.push({ id: docs[i].id, ...docs[i].data() });
    if (typeof onProgress === 'function') onProgress(i + 1, docs.length);
  }
  console.log(
    `[DataScreen] fetchProductsFromFirestore done collection=${collectionName} total=${docs.length}`
  );
  return out;
};


const fetchCustomersFromFirestore = async (collectionName, onProgress) => {
  console.log(`[DataScreen] fetchCustomersFromFirestore start collection=${collectionName}`);
  const snapshot = await firestore().collection(collectionName).get();
  const docs = snapshot.docs;
  const out = [];
  for (let i = 0; i < docs.length; i += 1) {
    out.push({ id: docs[i].id, ...docs[i].data() });
    if (typeof onProgress === 'function') onProgress(i + 1, docs.length);
  }
  console.log(
    `[DataScreen] fetchCustomersFromFirestore done collection=${collectionName} total=${docs.length}`
  );
  return out;
};

const BRAND_ORDER = ['playmobil', 'john', 'kivos'];
const BRAND_CONFIG = {
  playmobil: { showStores: true, showListings: true, showImages: true },
  john: { showStores: true, showListings: true, showImages: true },
  kivos: { showStores: true, showListings: false, showImages: true },
};

const STRINGS = {
  title: 'Λήψη δεδομένων Firestore',
  statusPlaceholder: 'Δεν υπάρχουν καταγεγραμμένες ενέργειες.',
  nav: { back: 'Πίσω' },
  brandHint: 'Επιλέξτε brand για λήψη ή εκκαθάριση δεδομένων.',
  updateAll: 'Update All',
  alerts: {
    success: 'Ολοκληρώθηκε',
    error: 'Σφάλμα',
    cleared: 'Εκκαθάριση',
    imageSummary: 'Σύνοψη λήψης εικόνων',
    updateAllTitle: 'Update All',
  },
  sections: {
    products: {
      title: 'Προϊόντα',
      downloadBtn: 'Λήψη από Firestore',
      clearBtn: 'Εκκαθάριση τοπικών δεδομένων',
      downloadError: 'Η λήψη των προϊόντων από το Firestore απέτυχε.',
      clearError: 'Η εκκαθάριση των προϊόντων απέτυχε.',
    },
    customers: {
      title: 'Πελάτες',
      downloadBtn: 'Λήψη από Firestore',
      clearBtn: 'Εκκαθάριση τοπικών δεδομένων',
      downloadError: 'Η λήψη των πελατών από το Firestore απέτυχε.',
      clearError: 'Η εκκαθάριση των πελατών απέτυχε.',
    },
    supermarketStores: {
      title: 'Καταστήματα SuperMarket',
      downloadBtn: 'Λήψη από Firestore',
      clearBtn: 'Εκκαθάριση τοπικών δεδομένων',
      downloadError: 'Η λήψη των καταστημάτων SuperMarket απέτυχε.',
      clearError: 'Η εκκαθάριση των καταστημάτων SuperMarket απέτυχε.',
    },
    supermarketListings: {
      title: 'Listings SuperMarket',
      downloadBtn: 'Λήψη από Firestore',
      clearBtn: 'Εκκαθάριση τοπικών δεδομένων',
      downloadError: 'Η λήψη των listings SuperMarket απέτυχε.',
      clearError: 'Η εκκαθάριση των listings SuperMarket απέτυχε.',
    },
    images: {
      title: 'Εικόνες προϊόντων',
      downloadBtn: 'Λήψη εικόνων',
      clearBtn: 'Εκκαθάριση cache εικόνων',
      downloadError: 'Η λήψη των εικόνων απέτυχε.',
      clearError: 'Η εκκαθάριση της cache εικόνων απέτυχε.',
    },
  },
  clearedMessages: {
    products: 'Η cache προϊόντων εκκαθαρίστηκε.',
    customers: 'Η cache πελατών εκκαθαρίστηκε.',
    supermarketStores: 'Η cache καταστημάτων SuperMarket εκκαθαρίστηκε.',
    supermarketListings: 'Η cache listings SuperMarket εκκαθαρίστηκε.',
    images: 'Η cache εικόνων εκκαθαρίστηκε.',
  },
  notAvailable: 'Μη διαθέσιμο για αυτή τη μάρκα.',
};

const PRODUCT_IMAGE_FIELDS = ['frontCover', 'photoUrl', 'imageUrl', 'image', 'Front Cover'];

const resolveProductImageUrl = (product) => {
  if (!product || typeof product !== 'object') {
    return null;
  }

  for (const field of PRODUCT_IMAGE_FIELDS) {
    const raw = product?.[field];
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }

  return null;
};

const PROGRESS_STATUS = {
  active: 'Σε εξέλιξη...',
  idle: 'Τελευταία λήψη',
};

const MESSAGES = {
  productsSaved: (count) => `Αποθηκεύτηκαν ${count} προϊόντα.`,
  customersSaved: (count) => `Αποθηκεύτηκαν ${count} πελάτες.`,
  supermarketStoresSaved: (count) => `Αποθηκεύτηκαν ${count} καταστήματα SuperMarket.`,
  supermarketListingsSaved: (count) => `Αποθηκεύτηκαν ${count} listings SuperMarket.`,
  imagesSummary: (success, failed, successListings, failedListings) =>
    `Προϊόντα
  Επιτυχίες: ${success}
  Αποτυχίες: ${failed}

Listings
  Επιτυχίες: ${successListings}
  Αποτυχίες: ${failedListings}`,
};

const SUPER_MARKET_UNAVAILABLE_MSG = 'Μη διαθέσιμο για αυτή τη μάρκα.';
const formatAction = (value) => value || STRINGS.statusPlaceholder;

const ProgressRow = ({ active, label, current, total }) => {
  const animationRef = useRef(null);
  const safeCurrent = Number.isFinite(current) && current > 0 ? current : 0;
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
  const hasTotal = safeTotal > 0;
  const cappedCurrent = hasTotal ? Math.min(safeCurrent, safeTotal) : safeCurrent;
  const pct = hasTotal
    ? Math.min(100, Math.round((cappedCurrent / safeTotal) * 100))
    : safeCurrent > 0
      ? 100
      : 0;
  const progressText = hasTotal
    ? `${cappedCurrent}/${safeTotal}`
    : safeCurrent > 0
      ? `${safeCurrent}`
      : '';

  useEffect(() => {
    const anim = animationRef.current;
    if (!anim) return;
    if (active) {
      anim.play?.();
    } else {
      anim.reset?.();
    }
  }, [active]);

  return (
    <View style={[styles.progressRow, !active && styles.progressRowInactive]}>
      <View style={styles.progressLeft}>
        <LottieView
          ref={animationRef}
          source={LOTTIE_PROGRESS}
          autoPlay={false}
          loop
          style={styles.progressAnimation}
        />
      </View>
      <View style={styles.progressRight}>
        <Text style={styles.progressLabel}>
          {label}
          {progressText ? ` (${progressText})` : ''}
        </Text>
        <View style={styles.progressBarWrap}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${pct}%`, opacity: pct ? 1 : 0 },
            ]}
          />
        </View>
        <Text style={styles.progressStatusText}>
          {active ? PROGRESS_STATUS.active : PROGRESS_STATUS.idle}
        </Text>
      </View>
    </View>
  );
};

const DataScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { profile } = useAuth();
  
  const [cacheLoading, setCacheLoading] = useState(null);

  const handleTrimOld = async () => {
    try {
      setCacheLoading('old');
      await trimOldCaches(['2024', '2025']);
      Alert.alert('🧹 Εκκαθάριση', 'Παλαιά cache (πριν το 2024) διαγράφηκαν με επιτυχία.');
    } catch (err) {
      console.error('trimOldCaches error:', err);
      Alert.alert('Σφάλμα', 'Αποτυχία καθαρισμού παλαιών cache.');
    } finally {
      setCacheLoading(null);
    }
  };

  const handleTrimLarge = async () => {
    try {
      setCacheLoading('large');
      await trimLargeCaches(1_000_000);
      Alert.alert('⚖️ Εκκαθάριση', 'Μεγάλες cache (>1 MB) διαγράφηκαν με επιτυχία.');
    } catch (err) {
      console.error('trimLargeCaches error:', err);
      Alert.alert('Σφάλμα', 'Αποτυχία εκκαθάρισης μεγάλων cache.');
    } finally {
      setCacheLoading(null);
    }
  };

  const handleClearAll = async () => {
    Alert.alert(
      'Προσοχή',
      'Αυτή η ενέργεια θα διαγράψει όλα τα αποθηκευμένα CSV δεδομένα (Playmobil KPI). Θέλετε να συνεχίσετε;',
      [
        { text: 'Άκυρο', style: 'cancel' },
        {
          text: 'Διαγραφή',
          style: 'destructive',
          onPress: async () => {
            try {
              setCacheLoading('all');
              await clearAllSheetCaches();
              Alert.alert('✅ Ολοκληρώθηκε', 'Όλες οι cache διαγράφηκαν επιτυχώς.');
            } catch (err) {
              console.error('clearAllSheetCaches error:', err);
              Alert.alert('Σφάλμα', 'Αποτυχία εκκαθάρισης όλων των cache.');
            } finally {
              setCacheLoading(null);
            }
          },
        },
      ]
    );
  };


  const userBrands = useMemo(() => {
    const raw = Array.isArray(profile?.brands) && profile.brands.length ? profile.brands : BRAND_ORDER;
    const normalized = raw
      .map((b) => normalizeBrandKey(b))
      .filter((b) => BRAND_ORDER.includes(b));
    const unique = Array.from(new Set(normalized));
    return unique.length ? unique : BRAND_ORDER;
  }, [profile?.brands]);

  const [brand, setBrand] = useState(() => {
    const initial = normalizeBrandKey(route?.params?.brand ?? userBrands[0] ?? BRAND_ORDER[0]);
    return userBrands.includes(initial) ? initial : userBrands[0];
  });

  useEffect(() => {
    const normalized = normalizeBrandKey(route?.params?.brand);
    if (normalized && userBrands.includes(normalized)) {
      setBrand(normalized);
    }
  }, [route?.params?.brand, userBrands]);

  useEffect(() => {
    if (!userBrands.includes(brand)) {
      setBrand(userBrands[0]);
    }
  }, [brand, userBrands]);

  useEffect(() => {
    console.log(`[DataScreen] brand set to ${brand}`);
  }, [brand]);

  const brandConfig = BRAND_CONFIG[brand] || BRAND_CONFIG.playmobil;
  const showStores = brandConfig.showStores;
  const showListings = brandConfig.showListings;
  const showImages = brandConfig.showImages;

  const productCollection = PRODUCT_COLLECTIONS[brand] ?? PRODUCT_COLLECTIONS.playmobil;
  const customerCollection = CUSTOMER_COLLECTIONS[brand] ?? CUSTOMER_COLLECTIONS.playmobil;

  const [prodAction, setProdAction] = useState(STRINGS.statusPlaceholder);
  const [custAction, setCustAction] = useState(STRINGS.statusPlaceholder);
  const [imgAction, setImgAction] = useState(STRINGS.statusPlaceholder);
  const [storeAction, setStoreAction] = useState(STRINGS.statusPlaceholder);
  const [listingAction, setListingAction] = useState(STRINGS.statusPlaceholder);

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
    updateAll: false,
  });

  const setBusy = (key, value) => setLoading((prev) => ({ ...prev, [key]: value }));

  const [progress, setProgress] = useState({
    products: { current: 0, total: 0, label: 'Λήψη προϊόντων' },
    customers: { current: 0, total: 0, label: 'Λήψη πελατών' },
    smStores: { current: 0, total: 0, label: 'Λήψη καταστημάτων' },
    smListings: { current: 0, total: 0, label: 'Λήψη listings' },
    imagesProducts: { current: 0, total: 0, label: 'Εικόνες προϊόντων' },
    imagesListings: { current: 0, total: 0, label: 'Εικόνες listings' },
  });

  const updateProgress = (key, current, total) =>
    setProgress((p) => ({ ...p, [key]: { ...p[key], current, total } }));

  const refreshActions = useCallback(async () => {
    console.log(`[DataScreen] refreshActions start brand=${brand}`);
    try {
      const [productsLast, customersLast] = await Promise.all([
        getProductsLastAction(brand),
        getCustomersLastAction(brand),
      ]);

      setProdAction(formatAction(productsLast));
      setCustAction(formatAction(customersLast));

      if (showStores) {
        const storesLast = await getSuperMarketStoresLastAction(brand);
        setStoreAction(formatAction(storesLast));
      } else {
        setStoreAction(STRINGS.notAvailable);
      }

      if (showListings) {
        const listingsLast = await getSuperMarketListingsLastAction(brand);
        setListingAction(formatAction(listingsLast));
      } else {
        setListingAction(STRINGS.notAvailable);
      }

      if (showImages) {
        const imagesLast = await getImagesLastAction();
        setImgAction(formatAction(imagesLast));
      } else {
        setImgAction(STRINGS.notAvailable);
      }

      console.log(`[DataScreen] refreshActions success brand=${brand}`);
    } catch (error) {
      console.error('[DataScreen] refreshActions error', error);
    }
  }, [brand, showStores, showListings, showImages]);

  useEffect(() => {
    refreshActions();
  }, [refreshActions]);

  const [updatingAll, setUpdatingAll] = useState(false);

  const handleUpdateAll = async () => {
    if (updatingAll) return;
    try {
      setUpdatingAll(true);
      const summary = await updateAllDataForUser({
        brandAccess: userBrands,
        supportsSuperMarketBrand: (b) => brandAccessSupportsSuperMarket(b),
      });
      const message = formatUpdateAllSummary(summary);
      Alert.alert(STRINGS.alerts.updateAllTitle, message);
    } catch (error) {
      console.error('[DataScreen] handleUpdateAll error', error);
      Alert.alert(STRINGS.alerts.updateAllTitle, error?.message ?? 'Αποτυχία λειτουργίας Update All.');
    } finally {
      setUpdatingAll(false);
    }
  };


  const handleDownloadProducts = async () => {
    console.log(`[DataScreen] handleDownloadProducts start brand=${brand}`);
    setBusy('products', true);
    updateProgress('products', 0, 0);
    try {
      const products = await fetchProductsFromFirestore(productCollection, (c, t) =>
        updateProgress('products', c, t)
      );

      let stockMap = null;
      try {
        stockMap = await cacheImmediateAvailabilityMap(true);
      } catch (error) {
        console.warn('cacheImmediateAvailabilityMap error:', error);
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
      console.log(
        `[DataScreen] handleDownloadProducts success brand=${brand} count=${normalised.length}`
      );
      Alert.alert(STRINGS.alerts.success, MESSAGES.productsSaved(normalised.length));
    } catch (error) {
      console.error('[DataScreen] handleDownloadProducts error', error);
      Alert.alert(STRINGS.alerts.error, STRINGS.sections.products.downloadError);
    } finally {
      setBusy('products', false);
      refreshActions();
      console.log(`[DataScreen] handleDownloadProducts end brand=${brand}`);
    }
  };

  const handleDownloadCustomers = async () => {
    console.log(`[DataScreen] handleDownloadCustomers start brand=${brand}`);
    setBusy('customers', true);
    updateProgress('customers', 0, 0);
    try {
      const customers = await fetchCustomersFromFirestore(customerCollection, (c, t) =>
        updateProgress('customers', c, t)
      );
      await saveCustomersToLocal(customers, brand);
      console.log(
        `[DataScreen] handleDownloadCustomers success brand=${brand} count=${customers.length}`
      );
      Alert.alert(STRINGS.alerts.success, MESSAGES.customersSaved(customers.length));
    } catch (error) {
      console.error('[DataScreen] handleDownloadCustomers error', error);
      Alert.alert(STRINGS.alerts.error, STRINGS.sections.customers.downloadError);
    } finally {
      setBusy('customers', false);
      refreshActions();
      console.log(`[DataScreen] handleDownloadCustomers end brand=${brand}`);
    }
  };

  const handleDownloadSuperMarketStores = async () => {
    console.log(`[DataScreen] handleDownloadSuperMarketStores start brand=${brand}`);
    if (!showStores) {
      console.warn(`[DataScreen] handleDownloadSuperMarketStores aborted brand=${brand} not supported`);
      Alert.alert(STRINGS.alerts.error, STRINGS.notAvailable);
      return;
    }
    setBusy('smStores', true);
    updateProgress('smStores', 0, 0);
    try {
      const stores = await fetchSuperMarketStores(brand, (c, t) =>
        updateProgress('smStores', c, t)
      ); // fetch can ignore cb if not implemented; harmless
      await saveSuperMarketStoresToLocal(stores, brand);
      const storeCount = Array.isArray(stores) ? stores.length : 0;
      console.log(
        `[DataScreen] handleDownloadSuperMarketStores success brand=${brand} count=${storeCount}`
      );
      Alert.alert(STRINGS.alerts.success, MESSAGES.supermarketStoresSaved(storeCount));
    } catch (error) {
      console.error('[DataScreen] handleDownloadSuperMarketStores error', error);
      Alert.alert(STRINGS.alerts.error, STRINGS.sections.supermarketStores.downloadError);
    } finally {
      setBusy('smStores', false);
      refreshActions();
      console.log(`[DataScreen] handleDownloadSuperMarketStores end brand=${brand}`);
    }
  };

  const handleClearSuperMarketStores = async () => {
    console.log(`[DataScreen] handleClearSuperMarketStores start brand=${brand}`);
    if (!showStores) {
      console.warn(`[DataScreen] handleClearSuperMarketStores aborted brand=${brand} not supported`);
      Alert.alert(STRINGS.alerts.error, STRINGS.notAvailable);
      return;
    }
    setBusy('smStoresClear', true);
    try {
      await clearSuperMarketStoresLocal(brand);
      console.log(`[DataScreen] handleClearSuperMarketStores success brand=${brand}`);
      Alert.alert(STRINGS.alerts.cleared, STRINGS.clearedMessages.supermarketStores);
    } catch (error) {
      console.error('[DataScreen] handleClearSuperMarketStores error', error);
      Alert.alert(STRINGS.alerts.error, STRINGS.sections.supermarketStores.clearError);
    } finally {
      setBusy('smStoresClear', false);
      refreshActions();
      console.log(`[DataScreen] handleClearSuperMarketStores end brand=${brand}`);
    }
  };

  const handleDownloadSuperMarketListings = async () => {
    console.log(`[DataScreen] handleDownloadSuperMarketListings start brand=${brand}`);
    if (!showListings) {
      console.warn(`[DataScreen] handleDownloadSuperMarketListings aborted brand=${brand} not supported`);
      Alert.alert(STRINGS.alerts.error, STRINGS.notAvailable);
      return;
    }
    setBusy('smListings', true);
    updateProgress('smListings', 0, 0);
    try {
      const listings = await fetchSuperMarketListings(brand, {
        onProgress: (c, t) => updateProgress('smListings', c, t),
      });
      await saveSuperMarketListingsToLocal(listings, brand);
      const listingCount = Array.isArray(listings) ? listings.length : 0;
      console.log(
        `[DataScreen] handleDownloadSuperMarketListings success brand=${brand} count=${listingCount}`
      );
      Alert.alert(STRINGS.alerts.success, MESSAGES.supermarketListingsSaved(listingCount));
    } catch (error) {
      console.error('[DataScreen] handleDownloadSuperMarketListings error', error);
      Alert.alert(STRINGS.alerts.error, STRINGS.sections.supermarketListings.downloadError);
    } finally {
      setBusy('smListings', false);
      refreshActions();
      console.log(`[DataScreen] handleDownloadSuperMarketListings end brand=${brand}`);
    }
  };

  const handleClearSuperMarketListings = async () => {
    console.log(`[DataScreen] handleClearSuperMarketListings start brand=${brand}`);
    if (!showListings) {
      console.warn(`[DataScreen] handleClearSuperMarketListings aborted brand=${brand} not supported`);
      Alert.alert(STRINGS.alerts.error, STRINGS.notAvailable);
      return;
    }
    setBusy('smListingsClear', true);
    try {
      await clearSuperMarketListingsLocal(brand);
      console.log(`[DataScreen] handleClearSuperMarketListings success brand=${brand}`);
      Alert.alert(STRINGS.alerts.cleared, STRINGS.clearedMessages.supermarketListings);
    } catch (error) {
      console.error('[DataScreen] handleClearSuperMarketListings error', error);
      Alert.alert(STRINGS.alerts.error, STRINGS.sections.supermarketListings.clearError);
    } finally {
      setBusy('smListingsClear', false);
      refreshActions();
      console.log(`[DataScreen] handleClearSuperMarketListings end brand=${brand}`);
    }
  };

  const handleClearProducts = async () => {
    console.log(`[DataScreen] handleClearProducts start brand=${brand}`);
    setLoading((s) => ({ ...s, prodClear: true }));
    try {
      await clearProductsLocal(brand);
      console.log(`[DataScreen] handleClearProducts success brand=${brand}`);
      Alert.alert(STRINGS.alerts.cleared, STRINGS.clearedMessages.products);
    } catch (error) {
      console.error('[DataScreen] handleClearProducts error', error);
      Alert.alert(STRINGS.alerts.error, STRINGS.sections.products.clearError);
    } finally {
      setLoading((s) => ({ ...s, prodClear: false }));
      refreshActions();
      console.log(`[DataScreen] handleClearProducts end brand=${brand}`);
    }
  };

  const handleClearCustomers = async () => {
    console.log(`[DataScreen] handleClearCustomers start brand=${brand}`);
    setLoading((s) => ({ ...s, custClear: true }));
    try {
      await clearCustomersLocal(brand);
      console.log(`[DataScreen] handleClearCustomers success brand=${brand}`);
      Alert.alert(STRINGS.alerts.cleared, STRINGS.clearedMessages.customers);
    } catch (error) {
      console.error('[DataScreen] handleClearCustomers error', error);
      Alert.alert(STRINGS.alerts.error, STRINGS.sections.customers.clearError);
    } finally {
      setLoading((s) => ({ ...s, custClear: false }));
      refreshActions();
      console.log(`[DataScreen] handleClearCustomers end brand=${brand}`);
    }
  };

  const safeDownload = async (code, url) => {
    try {
      if (!url || !code) return false;
      const cached = await downloadAndCacheImage(code, url);
      return !!cached;
    } catch (error) {
      console.warn(`[DataScreen] safeDownload failed code=${code}`, error);
      return false;
    }
  };

  const handleDownloadImages = async () => {
    if (!showImages) {
      Alert.alert(STRINGS.alerts.error, STRINGS.notAvailable);
      return;
    }
    console.log(`[DataScreen] handleDownloadImages start brand=${brand}`);
    setBusy('images', true);
    updateProgress('imagesProducts', 0, 0);
    if (showListings) {
      updateProgress('imagesListings', 0, 0);
    }
    try {
      // 1) products images
      const products = await getProductsFromLocal(brand);
      const productImageItems = Array.isArray(products)
        ? products
            .map((p) => ({
              productCode: p?.productCode,
              imageUrl: resolveProductImageUrl(p),
            }))
            .filter((item) => item.productCode && item.imageUrl)
        : [];
      updateProgress('imagesProducts', 0, productImageItems.length);

      let success = 0;
      let failed = 0;
      for (let i = 0; i < productImageItems.length; i += 1) {
        const item = productImageItems[i];
        const ok = await safeDownload(item.productCode, item.imageUrl);
        if (ok) success += 1;
        else failed += 1;
        updateProgress('imagesProducts', i + 1, productImageItems.length);
      }

      // 2) supermarket listings images (if brand supports)
      let successListings = 0;
      let failedListings = 0;
      if (showListings) {
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

      const productTotal = productImageItems.length;
      const listingTotal = successListings + failedListings;
      const listingsSummary = showListings
        ? `${successListings}/${listingTotal || 0}`
        : 'n/a';
      console.log(
        `[DataScreen] handleDownloadImages success brand=${brand} products=${success}/${productTotal} listings=${listingsSummary}`
      );
      Alert.alert(
        STRINGS.alerts.imageSummary,
        MESSAGES.imagesSummary(success, failed, successListings, failedListings)
      );
    } catch (error) {
      console.error('[DataScreen] handleDownloadImages error', error);
      Alert.alert(STRINGS.alerts.error, STRINGS.sections.images.downloadError);
    } finally {
      setBusy('images', false);
      refreshActions();
      console.log(`[DataScreen] handleDownloadImages end brand=${brand}`);
    }
  };

  const handleClearImages = async () => {
    if (!showImages) {
      Alert.alert(STRINGS.alerts.error, STRINGS.notAvailable);
      return;
    }
    console.log('[DataScreen] handleClearImages start');
    setBusy('imgClear', true);
    try {
      await clearProductImagesCache();
      console.log('[DataScreen] handleClearImages success');
      Alert.alert(STRINGS.alerts.cleared, STRINGS.clearedMessages.images);
    } catch (error) {
      console.error('[DataScreen] handleClearImages error', error);
      Alert.alert(STRINGS.alerts.error, STRINGS.sections.images.clearError);
    } finally {
      setBusy('imgClear', false);
      refreshActions();
      console.log('[DataScreen] handleClearImages end');
    }
  };
  
  

  const Section = ({ title, children }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );

  const brandAccessSupportsSuperMarket = (brandKey) => {
    const config = BRAND_CONFIG[brandKey];
    return Boolean(config?.showStores || config?.showListings);
  };

  const brandTitle = BRAND_LABEL[brand] || BRAND_LABEL.playmobil;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.topBarButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={STRINGS.nav.back}
        >
          <Ionicons name="arrow-back" size={18} color="#1f4f8f" />
          <Text style={styles.topBarText}>{STRINGS.nav.back}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.topBarButton, styles.updateAllButton]}
          onPress={handleUpdateAll}
          disabled={updatingAll}
          accessibilityRole="button"
          accessibilityLabel={STRINGS.updateAll}
        >
          {updatingAll ? (
            <ActivityIndicator color="#1f4f8f" size="small" />
          ) : (
            <Ionicons name="cloud-download-outline" size={18} color="#1f4f8f" />
          )}
          <Text style={styles.topBarText}>{STRINGS.updateAll}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{STRINGS.title}</Text>
        <Text style={styles.brandTitle}>{brandTitle}</Text>
        <Text style={styles.brandHint}>{STRINGS.brandHint}</Text>
        <View style={styles.brandChips}>
          {userBrands.map((item) => {
            const active = item === brand;
            return (
              <TouchableOpacity
                key={item}
                style={[styles.brandChip, active && styles.brandChipActive]}
                onPress={() => setBrand(item)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.brandChipText, active && styles.brandChipTextActive]}>
                  {BRAND_LABEL[item] || item}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

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

        {/* SuperMarket stores */}
        {showStores && (
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
        )}

        {showListings && (
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
        )}

        {showImages && (
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
            <ProgressRow
              active={loading.images}
              label={progress.imagesProducts.label}
              current={progress.imagesProducts.current}
              total={progress.imagesProducts.total}
            />
            {showListings && (
              <ProgressRow
                active={loading.images}
                label={progress.imagesListings.label}
                current={progress.imagesListings.current}
                total={progress.imagesListings.total}
              />
            )}
            <Text style={styles.status}>{formatAction(imgAction)}</Text>
          </Section>
        )}
		<View style={styles.section}>
          <Text style={styles.sectionTitle}>Offline Cache</Text>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              cacheLoading === 'old' && styles.disabledButton,
            ]}
            onPress={handleTrimOld}
            disabled={cacheLoading !== null}
          >
            {cacheLoading === 'old' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>🧹 Καθαρισμός παλαιών cache</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              cacheLoading === 'large' && styles.disabledButton,
            ]}
            onPress={handleTrimLarge}
            disabled={cacheLoading !== null}
          >
            {cacheLoading === 'large' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>⚖️ Διαγραφή μεγάλων cache</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              styles.dangerButton,
              cacheLoading === 'all' && styles.disabledButton,
            ]}
            onPress={handleClearAll}
            disabled={cacheLoading !== null}
          >
            {cacheLoading === 'all' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>❌ Διαγραφή όλων των cache</Text>
            )}
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6fb' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f4f6fb',
  },
  disabledButton: {
    opacity: 0.6,
  },
  topBarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#e8f1ff',
  },
  topBarText: { marginLeft: 6, fontSize: 15, fontWeight: '600', color: '#1f4f8f' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  brandHint: {
    fontSize: 14,
    color: '#5d6b82',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  brandChips: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  brandChip: {
    borderWidth: 1,
    borderColor: '#bcd0f5',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#fff',
    marginHorizontal: 6,
    marginVertical: 6,
  },
  brandChipActive: {
    backgroundColor: '#0d6efd',
    borderColor: '#0d6efd',
  },
  brandChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#113061',
  },
  brandChipTextActive: {
    color: '#fff',
  },
  updateAllButton: {
    borderWidth: 1,
    borderColor: '#c1d6f9',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 18,
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
    borderRadius: 12,
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
  progressRowInactive: {
    opacity: 0.6,
  },
  progressLeft: {
    width: 46,
    height: 46,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressAnimation: {
    width: 42,
    height: 42,
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
    backgroundColor: '#1976d2',
  },
  progressStatusText: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748b',
  },
});

export default DataScreen;
