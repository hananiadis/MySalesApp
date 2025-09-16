// src/screens/OrderCustomerSelectScreen.js
import React, { useEffect, useState, useRef } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard, Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOrder } from '../context/OrderContext';
import { getCustomersFromLocal } from '../utils/localData';

export default function OrderCustomerSelectScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const cleanupRef = useRef(null); // Store cleanup function reference

  const { startOrder, setCurrentCustomer } = useOrder();

  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualVat, setManualVat] = useState('');
  const [loading, setLoading] = useState(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        console.log('Cleaning up GPS capture');
        cleanupRef.current();
      }
    };
  }, []);

  // Load customers exactly like the "latest working" behavior
  useEffect(() => {
    (async () => {
      try {
        const arr = await getCustomersFromLocal();
        setCustomers(arr || []);
      } catch (e) {
        console.log('getCustomersFromLocal error:', e);
        setCustomers([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // If navigated with a pre-selected customer (e.g., from CustomersScreen cart)
  useEffect(() => {
    if (route.params?.prefillCustomer) {
      selectCustomerAndGo(route.params.prefillCustomer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.prefillCustomer]);

  const filtered = customers.filter((c) => {
    const q = search.trim().toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      (c.vatInfo?.registrationNo || '').toLowerCase().includes(q) ||
      (c.customerCode || '').toLowerCase().includes(q)
    );
  });

  async function selectCustomerAndGo(customerObj) {
    try {
      Keyboard.dismiss();
      setCurrentCustomer?.(customerObj);

      const orderId = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

      if (!startOrder) {
        throw new Error('startOrder is undefined from OrderContext');
      }

      // Context handles GPS internally; we keep API simple: (orderId, customer)
      const result = await startOrder(orderId, customerObj);
      
      // Store cleanup function reference
      if (result && result.cleanup) {
        cleanupRef.current = result.cleanup;
      }

      navigation.replace('OrderProductSelectionScreen');
    } catch (e) {
      console.log('startOrder/select crash:', e);
      Alert.alert('Σφάλμα', 'Δεν ήταν δυνατή η έναρξη παραγγελίας.');
    }
  }

  function handleManualCustomer() {
    if (!manualName && !manualVat) {
      Alert.alert('Συμπληρώστε επωνυμία ή ΑΦΜ!');
      return;
    }
    selectCustomerAndGo({ name: manualName, vatno: manualVat });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fafdff' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top + 30}
      >
        <View style={{ flex: 1, padding: 16, paddingBottom: insets.bottom + 8 }}>
          <Text style={styles.title}>Επιλογή Πελάτη</Text>

          <TextInput
            style={styles.searchBox}
            placeholder="Αναζήτηση επωνυμίας, ΑΦΜ ή κωδικού"
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="none"
            placeholderTextColor="#90caf9"
            returnKeyType="search"
          />

          {loading ? (
            <ActivityIndicator size="large" color="#1976d2" style={{ marginTop: 30 }} />
          ) : (
            <FlatList
              data={search ? filtered : customers}
              keyExtractor={(item) => item.id || item.customerCode || item.name}
              keyboardShouldPersistTaps="handled"
              style={{ marginVertical: 5 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.customerRow}
                  activeOpacity={0.8}
                  onPress={() => selectCustomerAndGo(item)}
                >
                  <View>
                    <Text style={styles.customerMain}>
                      {item.customerCode || '--'} – {item.name}
                    </Text>
                    <Text style={styles.customerSub}>
                      ΑΦΜ: {item.vatInfo?.registrationNo || item.vatno || '-'}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={{ color: '#888', textAlign: 'center', marginVertical: 24 }}>
                  Δεν βρέθηκαν πελάτες
                </Text>
              }
            />
          )}

          <View style={{ height: 1, backgroundColor: '#bbdefb', marginVertical: 16, borderRadius: 1 }} />

          <Text style={styles.sectionLabel}>Ή καταχώρηση νέου πελάτη</Text>
          <View style={styles.manualRow}>
            <TextInput
              style={[styles.input, { flex: 2, marginRight: 6 }]}
              placeholder="Επωνυμία"
              value={manualName}
              onChangeText={setManualName}
              autoCorrect={false}
              placeholderTextColor="#aaa"
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="ΑΦΜ"
              value={manualVat}
              onChangeText={setManualVat}
              keyboardType="number-pad"
              maxLength={9}
              placeholderTextColor="#aaa"
            />
            <TouchableOpacity style={styles.addBtn} onPress={handleManualCustomer}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 23, fontWeight: '700', color: '#1565c0', marginBottom: 10, marginTop: 7,
  },
  searchBox: {
    backgroundColor: '#fff',
    borderRadius: 9,
    paddingVertical: 9, paddingHorizontal: 12,
    borderWidth: 1.2, borderColor: '#90caf9',
    fontSize: 16, color: '#102027', marginBottom: 10,
    elevation: 1,
  },
  customerRow: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    padding: 13,
    marginVertical: 3,
    borderColor: '#bbdefb',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  customerMain: { fontWeight: 'bold', color: '#1565c0', fontSize: 15.5 },
  customerSub: { color: '#444', fontSize: 13, marginTop: 2 },
  sectionLabel: { color: '#1976d2', fontWeight: '600', fontSize: 14, marginBottom: 7 },
  manualRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 11,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#90caf9',
    color: '#222',
  },
  addBtn: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    marginLeft: 8,
    paddingHorizontal: 15,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
  },
});