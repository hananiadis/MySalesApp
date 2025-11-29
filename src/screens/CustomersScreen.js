// src/screens/CustomersScreen.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import SafeScreen from '../components/SafeScreen';
import { useAuth, ROLES } from '../context/AuthProvider';
import { getCustomersFromLocal } from '../utils/localData';
import { normalizeBrandKey } from '../constants/brands';
import { filterCustomersBySalesman } from '../utils/customerFiltering';
import { getKivosCreditBreakdown } from '../services/kivosCreditBreakdown';

const CUSTOMER_PLACEHOLDERS = {
  playmobil: require('../../assets/avatar_placeholder.png'),
  kivos: require('../../assets/Kivos_placeholder.png'),
  john: require('../../assets/john_hellas_logo.png'),
};

// Which roles can see all customers (not only their own)
const MANAGEMENT_ROLES = [ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER];

// UI text (shared by all brands)
const UI_TEXT = {
  title: '\u03A0\u03b5\u03bb\u03ac\u03c4\u03b5\u03c2',
  searchPlaceholder: '\u0391\u03bd\u03b1\u03b6\u03ae\u03c4\u03b7\u03c3\u03b7...',
  empty: '\u0397 \u03b1\u03bd\u03b1\u03b6\u03ae\u03c4\u03b7\u03c3\u03b7 \u03b4\u03ad\u03bd \u03b2\u03c1\u03ae\u03ba\u03b5 \u03c0\u03b5\u03bb\u03ac\u03c4\u03b5\u03c2.',
};

// Detail screen route names per brand
const DETAIL_ROUTES = {
  playmobil: 'CustomerDetail',
  kivos: 'KivosCustomerDetail',
  john: 'JohnCustomerDetail',
};


const normalizeBrand = (rawBrand) => normalizeBrandKey(rawBrand);

const collectValues = (value, acc) => {
  if (value == null) {
    return;
  }
  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean') {
    acc.push(String(value));
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectValues(item, acc));
    return;
  }
  if (type === 'object') {
    Object.values(value).forEach((item) => collectValues(item, acc));
  }
};

export default function CustomersScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const brand = useMemo(() => normalizeBrand(route?.params?.brand), [route?.params?.brand]);
  const { profile, hasRole } = useAuth();
  const canManageAll = hasRole(MANAGEMENT_ROLES);

  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState(new Map());

  // Get user's linked salesmen (merchIds)
  const userMerchIds = profile?.merchIds || [];

  const accessibleCustomers = useMemo(() => {
    if (canManageAll) {
      console.log(`[CustomersScreen] Admin access: showing all ${customers.length} customers for brand ${brand}`);
      return customers;
    }

    if (!userMerchIds.length) {
      console.log(`[CustomersScreen] No linked salesmen: showing 0 customers for brand ${brand}`);
      return [];
    }

    const filtered = filterCustomersBySalesman(customers, userMerchIds, null);
    console.log(
      `[CustomersScreen] User filtering: ${filtered.length}/${customers.length} customers for brand ${brand}`,
      {
        userMerchIds,
        brand,
        totalCustomers: customers.length,
        filteredCustomers: filtered.length,
      }
    );
    return filtered;
  }, [customers, userMerchIds, brand, canManageAll]);

  const handleGoBack = useCallback(() => {
    navigation.navigate('BrandHome', { brand });
  }, [navigation, brand]);

  const headerLeft = useMemo(
    () => (
      <TouchableOpacity
        style={styles.backButton}
        onPress={handleGoBack}
        accessibilityRole="button"
        accessibilityLabel="Επιστροφή"
      >
        <Ionicons name="arrow-back" size={22} color="#1f4f8f" />
      </TouchableOpacity>
    ),
    [handleGoBack],
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (event.data.action?.type === 'GO_BACK') {
        event.preventDefault();
        handleGoBack();
      }
    });
    return unsubscribe;
  }, [navigation, handleGoBack]);

  useEffect(() => {
    let isActive = true;

    const fetchCustomers = async () => {
      setLoading(true);
      setCustomers([]);
      try {
        const localCustomers = await getCustomersFromLocal(brand);
        if (!isActive) {
          return;
        }
        setCustomers(Array.isArray(localCustomers) ? localCustomers : []);
      } catch (error) {
        if (!isActive) {
          return;
        }
        console.error(`Failed to load customers for brand ${brand} from local storage`, error);
        setCustomers([]);
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    fetchCustomers();

    return () => {
      isActive = false;
    };
  }, [brand]);

  // Fetch balances for Kivos customers
  useEffect(() => {
    if (brand !== 'kivos' || !accessibleCustomers.length) {
      return;
    }

    let isActive = true;
    const fetchBalances = async () => {
      const balanceMap = new Map();
      
      // Fetch balances in parallel (limit concurrency to avoid overwhelming the API)
      const batchSize = 10;
      for (let i = 0; i < accessibleCustomers.length; i += batchSize) {
        const batch = accessibleCustomers.slice(i, i + batchSize);
        const promises = batch.map(async (customer) => {
          try {
            const creditBreakdown = await getKivosCreditBreakdown(customer.customerCode);
            return { code: customer.customerCode, balance: creditBreakdown?.balance ?? 0 };
          } catch (error) {
            console.warn(`Failed to fetch balance for ${customer.customerCode}:`, error);
            return { code: customer.customerCode, balance: 0 };
          }
        });
        
        const results = await Promise.all(promises);
        if (!isActive) return;
        
        results.forEach(({ code, balance }) => {
          balanceMap.set(code, balance);
        });
        
        // Update state after each batch
        setBalances(new Map(balanceMap));
      }
    };

    fetchBalances();

    return () => {
      isActive = false;
    };
  }, [brand, accessibleCustomers]);

  const filtered = useMemo(() => {
    const trimmed = search.trim().toLowerCase();
    const source = accessibleCustomers;
    if (!trimmed) {
      return source;
    }

    return source.filter((customer) => {
      try {
        const bag = [];
        collectValues(customer, bag);
        return bag.join(' ').toLowerCase().includes(trimmed);
      } catch (error) {
        return false;
      }
    });
  }, [accessibleCustomers, search]);

  const detailRouteName = DETAIL_ROUTES[brand] || DETAIL_ROUTES.playmobil;

  const placeholderSource = useMemo(
    () => CUSTOMER_PLACEHOLDERS[brand] || CUSTOMER_PLACEHOLDERS.playmobil,
    [brand]
  );

  const renderItem = ({ item }) => {
    const isKivos = brand === 'kivos';
    const balance = isKivos ? balances.get(item.customerCode) : null;
    const hasBalance = balance != null && Number.isFinite(balance);
    // Only show balance if it's significant (more than ±0.10)
    const showBalance = hasBalance && Math.abs(balance) > 0.10;
    
    return (
      <View style={styles.infoRow}>
        <TouchableOpacity
          style={styles.infoButton}
          activeOpacity={0.75}
          onPress={() => navigation.navigate(detailRouteName, { customerId: item.id, brand })}
        >
          <Image source={placeholderSource} style={styles.avatar} resizeMode="contain" />
          <View style={styles.infoCol}>
            <Text style={styles.customerMain}>
              {item.customerCode} - {item.name}
            </Text>
            <Text style={styles.customerSub}>
              {item.address?.street || ''} {item.address?.city || ''}
            </Text>
            {isKivos && showBalance && (
              <Text style={[styles.customerBalance, balance > 0 && styles.customerBalanceNegative]}>
                Υπόλοιπο: {balance.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
              </Text>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.cartBtn}
          onPress={() => navigation.navigate('OrderCustomerSelectScreen', { prefillCustomer: item, brand })}
          accessibilityRole="button"
          accessibilityLabel="Νέα παραγγελία"
        >
          <Ionicons name="cart" size={28} color="#007AFF" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeScreen title={UI_TEXT.title} headerLeft={headerLeft} bodyStyle={styles.body}>
      <View style={styles.searchSection}>
        <TextInput
          style={styles.searchInput}
          placeholder={UI_TEXT.searchPlaceholder}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
          placeholderTextColor="#90caf9"
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id || item.customerCode || Math.random().toString()}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>{UI_TEXT.empty}</Text>
          }
        />
      )}
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  searchSection: { paddingHorizontal: 18, paddingTop: 16 },
  searchInput: {
    borderWidth: 1,
    borderColor: '#90caf9',
    backgroundColor: '#fff',
    borderRadius: 12,
    fontSize: 17,
    color: '#222',
    paddingHorizontal: 13,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    marginBottom: 8,
  },
  loader: { marginTop: 16 },
  listContent: { paddingBottom: 80, paddingHorizontal: 18 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 11,
    marginBottom: 6,
    padding: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  infoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: { width: 44, height: 44, borderRadius: 24, marginRight: 14, backgroundColor: '#e6e6e6' },
  infoCol: { flex: 1, justifyContent: 'center' },
  customerMain: { fontWeight: 'bold', color: '#00599d', fontSize: 15 },
  customerSub: { color: '#444', fontSize: 13 },
  customerBalance: { 
    color: '#22c55e', 
    fontSize: 13, 
    fontWeight: '600', 
    marginTop: 2,
  },
  customerBalanceNegative: {
    color: '#ef4444',
  },
  cartBtn: {
    backgroundColor: '#eaf6ff',
    borderRadius: 22,
    padding: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  emptyText: { color: '#aaa', textAlign: 'center', marginTop: 30 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f1fb',
  },
});


