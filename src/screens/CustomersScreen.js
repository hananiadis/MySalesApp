import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getCustomersFromLocal } from '../utils/localData';

const PLACEHOLDER_AVATAR = require('../../assets/avatar_placeholder.png'); // change to your path

export default function CustomersScreen() {
  const navigation = useNavigation();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCustomersFromLocal()
      .then((data) => setCustomers(data))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const trimmed = search.trim().toLowerCase();
    if (!trimmed) return customers;

    const collectValues = (value, acc) => {
      if (value == null) return;
      const type = typeof value;
      if (type === 'string' || type === 'number' || type === 'boolean') {
        acc.push(String(value));
      } else if (Array.isArray(value)) {
        value.forEach((item) => collectValues(item, acc));
      } else if (type === 'object') {
        Object.values(value).forEach((item) => collectValues(item, acc));
      }
    };

    return customers.filter((customer) => {
      try {
        const bag = [];
        collectValues(customer, bag);
        return bag.join(' ').toLowerCase().includes(trimmed);
      } catch {
        return false;
      }
    });
  }, [customers, search]);

  const renderItem = ({ item }) => (
    <View style={styles.infoRow}>
      {/* Whole row clickable except cart icon */}
      <TouchableOpacity
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
        activeOpacity={0.75}
        onPress={() => navigation.navigate('CustomerDetail', { customerId: item.id })}
      >
        <Image
          source={PLACEHOLDER_AVATAR}
          style={styles.avatar}
          resizeMode="contain"
        />
        <View style={styles.infoCol}>
          <Text style={styles.customerMain}>
            {item.customerCode} - {item.name}
          </Text>
          <Text style={styles.customerSub}>
            {item.address?.street || ''} {item.address?.city || ''}
          </Text>
        </View>
      </TouchableOpacity>
      {/* Cart icon to start new order */}
      <TouchableOpacity
        style={styles.cartBtn}
        onPress={() =>
          navigation.navigate('OrderCustomerSelectScreen', { prefillCustomer: item })
        }
      >
        <Ionicons name="cart" size={28} color="#007AFF" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Πελάτες</Text>
      <TextInput
        style={styles.searchInput}
        placeholder="Αναζήτηση επωνυμίας, ΑΦΜ, ή κωδικού"
        value={search}
        onChangeText={setSearch}
        autoCorrect={false}
        autoCapitalize="none"
        placeholderTextColor="#90caf9"
      />
      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id || item.customerCode || Math.random().toString()}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 80 }}
          ListEmptyComponent={
            <Text style={{ color: '#aaa', textAlign: 'center', marginTop: 30 }}>
              Δεν βρέθηκαν πελάτες
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafdff', padding: 18, paddingTop: 34 },
  title: { fontSize: 23, fontWeight: 'bold', color: '#007AFF', marginBottom: 9 },
  searchInput: {
    borderWidth: 1, borderColor: '#90caf9', backgroundColor: '#fff',
    borderRadius: 12, fontSize: 17, color: '#222',
    paddingHorizontal: 13, paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    marginBottom: 13
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 11, marginBottom: 6, padding: 12, elevation: 1,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }
  },
  avatar: { width: 44, height: 44, borderRadius: 24, marginRight: 14, backgroundColor: '#e6e6e6' },
  infoCol: { flex: 1, justifyContent: 'center' },
  customerMain: { fontWeight: 'bold', color: '#00599d', fontSize: 15 },
  customerSub: { color: '#444', fontSize: 13 },
  cartBtn: {
    backgroundColor: '#eaf6ff', borderRadius: 22, padding: 7,
    alignItems: 'center', justifyContent: 'center', marginLeft: 8
  },
});
