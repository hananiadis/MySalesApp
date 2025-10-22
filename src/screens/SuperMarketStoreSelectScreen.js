import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { useOrder } from '../context/OrderContext';
import { normalizeBrandKey, isSuperMarketBrand } from '../constants/brands';
import { fetchSuperMarketStores } from '../services/supermarketData';

const DEFAULT_SUPERMARKET_BRAND = 'john';

const normalize = (value) => (value ? String(value).trim().toLowerCase() : '');

const formatCategory = (value) => {
  const text = normalize(value);
  if (!text) return '-';
  if (text.includes('μεγ')) return 'Μεγάλο';
  if (text.includes('μεσα')) return 'Μεσαίο';
  if (text.includes('μικρ')) return 'Μικρό';
  if (text.includes('grand')) return 'Grand';
  if (text.includes('express')) return 'Express';
  return value;
};

const translateCategoryCode = (value) => {
  const text = normalize(value).replace(/\s+/g, '');
  switch (text) {
    case 'α':
    case 'a':
      return 'Α';
    case 'β':
    case 'b':
      return 'Β';
    case 'γ':
    case 'g':
    case 'c':
      return 'Γ';
    case 'δ':
    case 'd':
      return 'Δ';
    default:
      return '';
  }
};

const buildStorePayload = (doc) => {
  if (!doc) return null;
  const data = doc.data ? doc.data() : doc;
  const storeCategory =
    data.storeCategory ||
    data.storeCategoryCode ||
    translateCategoryCode(data.hasToys) ||
    '';

  return {
    id: doc.id || data.id,
    refId: doc.id || data.id,
    ...data,
    storeCategory: storeCategory || translateCategoryCode(data.category),
  };
};

const SuperMarketStoreSelectScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { startSuperMarketOrder } = useOrder();
  const cleanupRef = useRef(null);

  const requestedBrand = route?.params?.brand;
  const brand = useMemo(() => {
    const normalized = normalizeBrandKey(requestedBrand || DEFAULT_SUPERMARKET_BRAND);
    return isSuperMarketBrand(normalized) ? normalized : DEFAULT_SUPERMARKET_BRAND;
  }, [requestedBrand]);

  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState([]);
  const [error, setError] = useState(null);
  const [searchValue, setSearchValue] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('all');
  const [selectedHasToys, setSelectedHasToys] = useState('all');
  const [selectedHasSummerItems, setSelectedHasSummerItems] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadStores = async () => {
      setLoading(true);
      setError(null);
      try {
        setSelectedCompany('all');
        const rawStores = await fetchSuperMarketStores(brand);

        if (!mounted) return;

        const items = rawStores
          .map((store) => buildStorePayload(store))
          .filter(Boolean)
          .sort((a, b) => normalize(a.storeName).localeCompare(normalize(b.storeName)));

        setStores(items);
      } catch (err) {
        if (mounted) {
          console.warn('Failed to load SuperMarket stores', err);
          setError(err);
          setStores([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadStores();
    return () => {
      mounted = false;
      if (cleanupRef.current) {
        try {
          cleanupRef.current();
        } catch (cleanupError) {
          console.warn('Failed to run SuperMarket order cleanup', cleanupError);
        }
        cleanupRef.current = null;
      }
    };
  }, [brand]);

  const companies = useMemo(() => {
    const unique = new Map();
    stores.forEach((store) => {
      const key = store.companySlug || normalize(store.companyName || '');
      if (!key) return;
      if (!unique.has(key)) {
        unique.set(key, {
          slug: key,
          name: store.companyName || store.companySlug || store.companyCode || store.company || 'Company',
        });
      }
    });
    return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [stores]);

  const filteredStores = useMemo(() => {
    const query = normalize(searchValue);
    return stores.filter((store) => {
      // Company filter
      if (selectedCompany !== 'all') {
        const slug = store.companySlug || normalize(store.companyName || '');
        if (slug !== selectedCompany) {
          return false;
        }
      }
      
      // HasToys filter (Α, Β, Γ, Δ, Ε)
      if (selectedHasToys !== 'all') {
        const hasToysValue = store.hasToys || '';
        if (hasToysValue !== selectedHasToys) {
          return false;
        }
      }
      
      // HasSummerItems filter (GRAND, ΜΕΓΑΛΑ, ΜΕΓΑΛΑ PLUS, ΜΕΣΑΙΑ, ΜΙΚΡΑ)
      if (selectedHasSummerItems !== 'all') {
        const hasSummerValue = store.hasSummerItems || '';
        if (hasSummerValue !== selectedHasSummerItems) {
          return false;
        }
      }
      
      // Search filter
      if (!query) {
        return true;
      }
      const haystack = [
        store.storeName,
        store.storeCode,
        store.city,
        store.region,
        store.address,
        store.category,
        store.companyName,
      ]
        .map(normalize)
        .filter(Boolean);
      return haystack.some((value) => value.includes(query));
    });
  }, [searchValue, selectedCompany, selectedHasToys, selectedHasSummerItems, stores]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleSelectStore = useCallback(
    async (store) => {
      if (!store || !startSuperMarketOrder) {
        return;
      }
      try {
        const orderId = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const payload = { ...buildStorePayload(store), brand };
        const result = await startSuperMarketOrder(orderId, payload, brand);
        if (result?.cleanup) {
          cleanupRef.current = result.cleanup;
        }
        navigation.replace('SuperMarketProductSelection', {
          store: payload,
          orderId,
          brand,
        });
      } catch (err) {
        console.warn('Failed to start SuperMarket order', err);
      }
    },
    [navigation, startSuperMarketOrder, brand]
  );

  const renderFilters = () => {
    if (!showFilters) return null;

    const hasToysOptions = ['all', 'Α', 'Β', 'Γ', 'Δ', 'Ε'];
    const hasSummerOptions = ['all', 'GRAND', 'ΜΕΓΑΛΑ', 'ΜΕΓΑΛΑ PLUS', 'ΜΕΣΑΙΑ', 'ΜΙΚΡΑ'];

    return (
      <View style={styles.filtersContainer}>
        {/* Company Filter */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Εταιρεία:</Text>
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterChip, selectedCompany === 'all' && styles.filterChipActive]}
              onPress={() => setSelectedCompany('all')}
            >
              <Text style={[styles.filterChipText, selectedCompany === 'all' && styles.filterChipTextActive]}>
                Όλες
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterChip, selectedCompany === 'MASOUTIS' && styles.filterChipActive]}
              onPress={() => setSelectedCompany('MASOUTIS')}
            >
              <Text style={[styles.filterChipText, selectedCompany === 'MASOUTIS' && styles.filterChipTextActive]}>
                MASOUTIS
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* HasToys Filter */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Παιχνίδια:</Text>
          <View style={styles.filterRow}>
            {hasToysOptions.map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.filterChip, selectedHasToys === option && styles.filterChipActive]}
                onPress={() => setSelectedHasToys(option)}
              >
                <Text style={[styles.filterChipText, selectedHasToys === option && styles.filterChipTextActive]}>
                  {option === 'all' ? 'Όλα' : option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* HasSummerItems Filter */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Καλοκαιρινά:</Text>
          <View style={styles.filterRow}>
            {hasSummerOptions.map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.filterChip, selectedHasSummerItems === option && styles.filterChipActive]}
                onPress={() => setSelectedHasSummerItems(option)}
              >
                <Text style={[styles.filterChipText, selectedHasSummerItems === option && styles.filterChipTextActive]}>
                  {option === 'all' ? 'Όλα' : option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  };

  const renderStoreRow = ({ item }) => {
    const storeCategoryLabel = translateCategoryCode(item.storeCategory || item.hasToys);
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => handleSelectStore(item)}
      >
        {/* Company Name with Store Code and Store Name */}
        <View style={styles.cardHeader}>
          <Text style={styles.companyTitle}>
            {item.companyName || 'MASOUTIS'} - {item.storeCode || '-'} - {item.storeName || 'Κατάστημα'}
          </Text>
        </View>
        
        {/* Area and Region */}
        <View style={styles.cardDetailRow}>
          <Text style={styles.cardLabel}>Περιοχή:</Text>
          <Text style={styles.cardValue}>
            {item.area || '-'} - {item.region || '-'}
          </Text>
        </View>
        
        {/* Category, HasToys, HasSummerItems in single row */}
        <View style={styles.cardDetailRow}>
          <Text style={styles.cardLabel}>Τυπολογία:</Text>
          <Text style={styles.cardValue}>
            {formatCategory(item.category)} Παιχνίδια: {item.hasToys || '—'} Καλοκαιρινά: {item.hasSummerItems || '—'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Επιλογή Καταστήματος</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color="#6b7280" style={{ marginRight: 6 }} />
        <TextInput
          value={searchValue}
          onChangeText={setSearchValue}
          placeholder="Αναζήτηση με όνομα, κωδικό ή πόλη"
          placeholderTextColor="#9ca3af"
          style={styles.searchInput}
        />
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons 
            name="filter" 
            size={18} 
            color="#6b7280" 
          />
          <Text style={styles.filterButtonText}>Φίλτρα</Text>
          <Ionicons 
            name={showFilters ? "chevron-up" : "chevron-down"} 
            size={16} 
            color="#6b7280" 
          />
        </TouchableOpacity>
      </View>

      {renderFilters()}

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color="#1976d2" style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Αδυναμία φόρτωσης των καταστημάτων.</Text>
            <Text style={styles.emptyHint}>Ελέγξτε τη σύνδεσή σας ή προσπαθήστε ξανά.</Text>
          </View>
        ) : filteredStores.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Δεν βρέθηκαν καταστήματα.</Text>
            <Text style={styles.emptyHint}>Τροποποιήστε τα φίλτρα ή την αναζήτηση.</Text>
          </View>
        ) : (
          <FlatList
            data={filteredStores}
            keyExtractor={(item) => item.refId || item.id || item.storeCode}
            renderItem={renderStoreRow}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSpacer: {
    width: 40,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbe1f1',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    color: '#111827',
    fontSize: 15,
    paddingVertical: 0,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    marginHorizontal: 4,
  },
  filtersContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#1f2937',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  filterSection: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterChip: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#fff',
    marginRight: 8,
    marginBottom: 8,
  },
  filterChipActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#1d4ed8',
  },
  filterChipText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
    shadowColor: '#1f2937',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    marginRight: 12,
  },
  companyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  categoryBadge: {
    backgroundColor: '#111827',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  categoryBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  cardDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  cardLabel: {
    fontSize: 13,
    color: '#6b7280',
    width: 90,
  },
  cardValue: {
    fontSize: 14,
    color: '#1f2937',
    flex: 1,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default SuperMarketStoreSelectScreen;
