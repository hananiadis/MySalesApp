// src/screens/MyCustomersScreen.js
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import SafeScreen from '../components/SafeScreen';
import { useAuth, ROLES } from '../context/AuthProvider';
import { getCustomersFromLocal } from '../utils/localData';
import { filterCustomersBySalesman } from '../utils/customerFiltering';

const BRAND_LABEL = {
  playmobil: 'Playmobil',
  john: 'John',
  kivos: 'Kivos',
};

const DETAIL_ROUTES = {
  playmobil: 'CustomerDetail',
  kivos: 'KivosCustomerDetail',
  john: 'JohnCustomerDetail',
};

const MyCustomersScreen = () => {
  const navigation = useNavigation();
  const { profile, hasRole } = useAuth();
  
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState(null);

  // Check if user has access to view customers
  const canViewCustomers = hasRole([ROLES.SALESMAN, ROLES.SALES_MANAGER, ROLES.ADMIN, ROLES.OWNER, ROLES.DEVELOPER]);
  
  // Get user's linked salesmen
  const userMerchIds = profile?.merchIds || [];
  
  // Get user's accessible brands
  const userBrands = profile?.brands || [];

  useEffect(() => {
    if (!canViewCustomers) {
      setLoading(false);
      return;
    }

    const loadCustomers = async () => {
      try {
        setLoading(true);
        const allCustomers = await getCustomersFromLocal();
        setCustomers(allCustomers);
      } catch (error) {
        console.error('Error loading customers:', error);
        Alert.alert('Σφάλμα', 'Προέκυψε πρόβλημα κατά τη φόρτωση των πελατών.');
        setCustomers([]);
      } finally {
        setLoading(false);
      }
    };

    loadCustomers();
  }, [canViewCustomers]);

  // Filter customers based on user's linked salesmen and selected brand
  const filteredCustomers = useMemo(() => {
    if (!canViewCustomers || userMerchIds.length === 0) {
      return [];
    }

    let filtered = filterCustomersBySalesman(customers, userMerchIds, selectedBrand);
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(customer => 
        customer.name?.toLowerCase().includes(query) ||
        customer.email?.toLowerCase().includes(query) ||
        customer.company?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [customers, userMerchIds, selectedBrand, searchQuery, canViewCustomers]);

  // Get available brands for filtering
  const availableBrands = useMemo(() => {
    const brands = new Set();
    filteredCustomers.forEach(customer => {
      if (customer.brand) {
        brands.add(customer.brand);
      }
    });
    return Array.from(brands).sort();
  }, [filteredCustomers]);

  const handleCustomerPress = (customer) => {
    const routeName = DETAIL_ROUTES[customer.brand] || 'CustomerDetail';
    navigation.navigate(routeName, { customer });
  };

  const renderCustomer = ({ item: customer }) => (
    <TouchableOpacity
      style={styles.customerCard}
      onPress={() => handleCustomerPress(customer)}
    >
      <View style={styles.customerInfo}>
        <Text style={styles.customerName} numberOfLines={1}>
          {customer.name || 'Άγνωστος πελάτης'}
        </Text>
        {customer.email && (
          <Text style={styles.customerEmail} numberOfLines={1}>
            {customer.email}
          </Text>
        )}
        {customer.company && (
          <Text style={styles.customerCompany} numberOfLines={1}>
            {customer.company}
          </Text>
        )}
        <View style={styles.customerMeta}>
          <View style={styles.brandChip}>
            <Text style={styles.brandChipText}>
              {BRAND_LABEL[customer.brand] || customer.brand}
            </Text>
          </View>
          {customer.merch && (
            <View style={styles.merchChip}>
              <Text style={styles.merchChipText}>
                {customer.merch}
              </Text>
            </View>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#64748b" />
    </TouchableOpacity>
  );

  const renderBrandFilter = (brand) => (
    <TouchableOpacity
      key={brand}
      style={[
        styles.brandFilter,
        selectedBrand === brand && styles.brandFilterActive,
      ]}
      onPress={() => setSelectedBrand(selectedBrand === brand ? null : brand)}
    >
      <Text
        style={[
          styles.brandFilterText,
          selectedBrand === brand && styles.brandFilterTextActive,
        ]}
      >
        {BRAND_LABEL[brand] || brand}
      </Text>
    </TouchableOpacity>
  );

  if (!canViewCustomers) {
    return (
      <SafeScreen title="Οι Πελάτες Μου">
        <View style={styles.centeredState}>
          <Ionicons name="shield-outline" size={56} color="#94a3b8" />
          <Text style={styles.centeredTitle}>Δεν έχετε πρόσβαση</Text>
          <Text style={styles.centeredSubtitle}>
            Επικοινωνήστε με έναν διαχειριστή για να αποκτήσετε τα κατάλληλα δικαιώματα.
          </Text>
        </View>
      </SafeScreen>
    );
  }

  if (userMerchIds.length === 0) {
    return (
      <SafeScreen title="Οι Πελάτες Μου">
        <View style={styles.centeredState}>
          <Ionicons name="people-outline" size={56} color="#94a3b8" />
          <Text style={styles.centeredTitle}>Δεν έχετε συνδεδεμένους πωλητές</Text>
          <Text style={styles.centeredSubtitle}>
            Επικοινωνήστε με έναν διαχειριστή για να συνδεθείτε με τους πωλητές σας.
          </Text>
        </View>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen title="Οι Πελάτες Μου">
      {/* Search Bar */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color="#64748b" />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Αναζήτηση πελατών..."
          placeholderTextColor="#94a3b8"
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Brand Filters */}
      {availableBrands.length > 1 && (
        <View style={styles.brandFilters}>
          <Text style={styles.brandFiltersLabel}>Μάρκες:</Text>
          <View style={styles.brandFiltersRow}>
            <TouchableOpacity
              style={[
                styles.brandFilter,
                selectedBrand === null && styles.brandFilterActive,
              ]}
              onPress={() => setSelectedBrand(null)}
            >
              <Text
                style={[
                  styles.brandFilterText,
                  selectedBrand === null && styles.brandFilterTextActive,
                ]}
              >
                Όλες
              </Text>
            </TouchableOpacity>
            {availableBrands.map(renderBrandFilter)}
          </View>
        </View>
      )}

      {/* Results Summary */}
      <View style={styles.resultsSummary}>
        <Text style={styles.resultsText}>
          {filteredCustomers.length} πελάτες
          {selectedBrand && ` (${BRAND_LABEL[selectedBrand] || selectedBrand})`}
        </Text>
      </View>

      {/* Customer List */}
      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#1f4f8f" />
          <Text style={styles.loadingLabel}>Φόρτωση πελατών...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCustomers}
          keyExtractor={(item) => item.id || item.email || Math.random().toString()}
          renderItem={renderCustomer}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color="#cbd5f5" />
              <Text style={styles.emptyTitle}>Δεν βρέθηκαν πελάτες</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery ? 'Δοκιμάστε διαφορετικό φίλτρο αναζήτησης.' : 'Δεν έχετε συνδεδεμένους πελάτες.'}
              </Text>
            </View>
          }
        />
      )}
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    margin: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 0,
  },
  brandFilters: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  brandFiltersLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  brandFiltersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  brandFilter: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f9fafb',
  },
  brandFilterActive: {
    borderColor: '#1f4f8f',
    backgroundColor: '#eef2ff',
  },
  brandFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  brandFilterTextActive: {
    color: '#1f4f8f',
  },
  resultsSummary: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  resultsText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 8,
  },
  customerInfo: {
    flex: 1,
    marginRight: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  customerEmail: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  customerCompany: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  customerMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  brandChip: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  brandChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  merchChip: {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  merchChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0369a1',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingLabel: {
    marginTop: 12,
    fontSize: 15,
    color: '#4b5563',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  centeredTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2d3d',
    marginTop: 16,
  },
  centeredSubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
});

export default MyCustomersScreen;
