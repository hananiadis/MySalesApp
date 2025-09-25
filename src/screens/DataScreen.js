// src/screens/DataScreen.js
import React, { useState, useEffect } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import SafeScreen from '../components/SafeScreen';

import {
  saveProductsToLocal,
  clearProductsLocal,
  getProductsLastAction,
  saveCustomersToLocal,
  clearCustomersLocal,
  getCustomersLastAction,
  getImagesLastAction,
  clearProductImagesCache,
} from '../utils/localData';
import { downloadAndCacheImage } from '../utils/imageHelpers';
import {
  cacheImmediateAvailabilityMap,
  lookupImmediateStockValue,
} from '../utils/stockAvailability';

const fetchProductsFromFirestore = async () => {
  const snapshot = await firestore().collection('products').get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

const fetchCustomersFromFirestore = async () => {
  const snapshot = await firestore().collection('customers').get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

const DataScreen = () => {
  const [prodAction, setProdAction] = useState('');
  const [custAction, setCustAction] = useState('');
  const [imgAction, setImgAction] = useState('');
  const [loading, setLoading] = useState({
    products: false,
    customers: false,
    prodClear: false,
    custClear: false,
    images: false,
    imgClear: false,
  });

  const refreshActions = async () => {
    setProdAction(await getProductsLastAction());
    setCustAction(await getCustomersLastAction());
    setImgAction(await getImagesLastAction());
  };

  useEffect(() => {
    refreshActions();
  }, []);

  const handleDownloadProducts = async () => {
    setLoading((l) => ({ ...l, products: true }));
    try {
      const products = await fetchProductsFromFirestore();
      let stockMap = null;

      try {
        stockMap = await cacheImmediateAvailabilityMap(true);
      } catch {
        stockMap = null;
      }

      const normalizedProducts = Array.isArray(products)
        ? products.map((prod = {}) => {
            const normalized =
              prod && typeof prod === 'object' ? { ...prod } : {};
            const fallbackId =
              typeof normalized.id === 'string' || typeof normalized.id === 'number'
                ? normalized.id
                : prod?.id;
            const rawCode =
              normalized.productCode ??
              normalized.code ??
              fallbackId ??
              null;
            const code =
              typeof rawCode === 'string' || typeof rawCode === 'number'
                ? String(rawCode).trim()
                : '';

            if (code) {
              normalized.productCode = code;
              if (
                normalized.code === undefined ||
                normalized.code === null ||
                normalized.code === ''
              ) {
                normalized.code = code;
              }
            }

            if (stockMap && typeof stockMap.get === 'function' && code) {
              const value = lookupImmediateStockValue(stockMap, code);
              if (value !== undefined && value !== null && value !== '') {
                normalized.availableStock = value;
              } else if (
                normalized.availableStock === undefined ||
                normalized.availableStock === null ||
                normalized.availableStock === ''
              ) {
                normalized.availableStock = 'n/a';
              }
            }

            return normalized;
          })
        : [];

      await saveProductsToLocal(normalizedProducts);
      Alert.alert('Επιτυχία', `Αποθηκεύτηκαν ${normalizedProducts.length} προϊόντα.`);
    } catch (e) {
      Alert.alert('Σφάλμα', 'Αποτυχία λήψης προϊόντων από το Firestore.');
    }
    setLoading((l) => ({ ...l, products: false }));
    refreshActions();
  };

  const handleDownloadCustomers = async () => {
    setLoading((l) => ({ ...l, customers: true }));
    try {
      const customers = await fetchCustomersFromFirestore();
      await saveCustomersToLocal(customers);
      Alert.alert('Ενημέρωση πελατών', `Λήψη ολοκληρώθηκε!\nΣύνολο: ${customers.length}`);
    } catch (e) {
      Alert.alert('Σφάλμα', 'Δεν έγινε λήψη πελατών');
    }
    setLoading((l) => ({ ...l, customers: false }));
    refreshActions();
  };

  const handleClearProducts = async () => {
    setLoading((l) => ({ ...l, prodClear: true }));
    try {
      await clearProductsLocal();
      Alert.alert('Διαγραφή προϊόντων', 'Η cache προϊόντων διαγράφηκε!');
    } catch (e) {
      Alert.alert('Σφάλμα', 'Δεν διαγράφηκε η cache προϊόντων');
    }
    setLoading((l) => ({ ...l, prodClear: false }));
    refreshActions();
  };

  const handleClearCustomers = async () => {
    setLoading((l) => ({ ...l, custClear: true }));
    try {
      await clearCustomersLocal();
      Alert.alert('Διαγραφή πελατών', 'Η cache πελατών διαγράφηκε!');
    } catch (e) {
      Alert.alert('Σφάλμα', 'Δεν διαγράφηκε η cache πελατών');
    }
    setLoading((l) => ({ ...l, custClear: false }));
    refreshActions();
  };

  const handleDownloadImages = async () => {
    setLoading((l) => ({ ...l, images: true }));
    try {
      const json = await AsyncStorage.getItem('products');
      const products = json ? JSON.parse(json) : [];
      let ok = 0;
      let fail = 0;

      for (const p of products) {
        if (p?.productCode && p?.frontCover) {
          const res = await downloadAndCacheImage(p.productCode, p.frontCover);
          if (res) ok++;
          else fail++;
        }
      }

      Alert.alert('Ενημέρωση εικόνων', `Λήψη ολοκληρώθηκε!\nΕπιτυχείς: ${ok}\nΑποτυχίες: ${fail}`);
    } catch (err) {
      Alert.alert('Σφάλμα', 'Σφάλμα κατά τη λήψη εικόνων');
    }
    setLoading((l) => ({ ...l, images: false }));
    refreshActions();
  };

  const handleClearImages = async () => {
    setLoading((l) => ({ ...l, imgClear: true }));
    try {
      await clearProductImagesCache();
      Alert.alert('Διαγραφή εικόνων', 'Η cache εικόνων διαγράφηκε!');
    } catch (e) {
      Alert.alert('Σφάλμα', 'Σφάλμα κατά τη διαγραφή cache εικόνων');
    }
    setLoading((l) => ({ ...l, imgClear: false }));
    refreshActions();
  };

  return (
    <SafeScreen style={styles.container}>
      <ScrollView>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Διαχείριση Δεδομένων</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Προϊόντα</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={handleDownloadProducts}
            disabled={loading.products}
          >
            {loading.products ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Λήψη από Firestore</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.clearButton]}
            onPress={handleClearProducts}
            disabled={loading.prodClear}
          >
            {loading.prodClear ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Διαγραφή τοπικών</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.statusText}>{prodAction}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Πελάτες</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={handleDownloadCustomers}
            disabled={loading.customers}
          >
            {loading.customers ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Λήψη από Firestore</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.clearButton]}
            onPress={handleClearCustomers}
            disabled={loading.custClear}
          >
            {loading.custClear ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Διαγραφή τοπικών</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.statusText}>{custAction}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Εικόνες Προϊόντων</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={handleDownloadImages}
            disabled={loading.images}
          >
            {loading.images ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Λήψη Εικόνων</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.clearButton]}
            onPress={handleClearImages}
            disabled={loading.imgClear}
          >
            {loading.imgClear ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Διαγραφή Εικόνων</Text>
            )}
          </TouchableOpacity>
          {/* <Text style={styles.statusText}>{imgAction}</Text> */}
        </View>
      </ScrollView>
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: { fontSize: 26, fontWeight: 'bold', textAlign: 'left', color: '#007AFF' },
  section: {
    marginBottom: 32,
    padding: 16,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    elevation: 2,
  },
  sectionTitle: { fontSize: 20, fontWeight: '600', marginBottom: 10, color: '#007AFF' },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 6,
    padding: 12,
    marginVertical: 6,
    alignItems: 'center',
  },
  clearButton: { backgroundColor: '#FF5733' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  statusText: { marginTop: 8, color: '#555', fontStyle: 'italic', textAlign: 'right' },
});

export default DataScreen;
