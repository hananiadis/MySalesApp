import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
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

  // NEW: normalize toys and summer categories
  const toysCategory =
    data.hasToys ||
    data.toysCategory ||
    translateCategoryCode(data.storeCategoryToys) ||
    '';
  const summerCategory =
    data.hasSummerItems ||
    data.summerCategory ||
    formatCategory(data.storeCategorySummer) ||
    '';

  return {
    id: doc.id || data.id,
    refId: doc.id || data.id,
    ...data,
    storeCategory: storeCategory || translateCategoryCode(data.category),
    toysCategory,
    summerCategory,
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

  const handleBackToBrand = useCallback(() => {
    navigation.navigate('BrandHome', { brand });
  }, [brand, navigation]);

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = navigation.addListener('beforeRemove', (event) => {
        if (event.data.action?.type === 'GO_BACK') {
          event.preventDefault();
          handleBackToBrand();
        }
      });
      return () => unsubscribe();
    }, [handleBackToBrand, navigation])
  );

  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState([]);
  const [error, setError] = useState(null);
  const [searchValue, setSearchValue] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('all');
  const [selectedHasToys, setSelectedHasToys] = useState('all');
  const [selectedHasSummerItems, setSelectedHasSummerItems] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedBrands, setExpandedBrands] = useState({});
  const [expandedCategories, setExpandedCategories] = useState({});

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

  const groupedStores = useMemo(() => {
    const brands = new Map();
    filteredStores.forEach((store) => {
      const brandName = store.companyName || store.companySlug || 'SuperMarket';
      const brandKey = normalize(brandName) || (store.companySlug || store.companyCode || store.id || 'brand');
      let brandEntry = brands.get(brandKey);
      if (!brandEntry) {
        brandEntry = {
          key: brandKey,
          name: brandName,
          categories: new Map(),
        };
        brands.set(brandKey, brandEntry);
      }
      const toyRaw = store.toysCategory || store.hasToys || '';
      const toyLabel = toyRaw ? formatCategory(toyRaw) || toyRaw : 'Χωρίς κατηγορία';
      const categoryKey = toyRaw || 'uncategorized';
      let categoryEntry = brandEntry.categories.get(categoryKey);
      if (!categoryEntry) {
        categoryEntry = {
          key: categoryKey,
          label: toyLabel || 'Χωρίς κατηγορία',
          stores: [],
        };
        brandEntry.categories.set(categoryKey, categoryEntry);
      }
      categoryEntry.stores.push(store);
    });
    return Array.from(brands.values())
      .map((brandEntry) => ({
        key: brandEntry.key || normalize(brandEntry.name) || 'brand',
        name: brandEntry.name,
        categories: Array.from(brandEntry.categories.values())
          .map((categoryEntry) => ({
            ...categoryEntry,
            stores: categoryEntry.stores
              .slice()
              .sort((a, b) => normalize(a.storeName).localeCompare(normalize(b.storeName))),
          }))
          .sort((a, b) => normalize(a.label).localeCompare(normalize(b.label))),
      }))
      .sort((a, b) => normalize(a.name).localeCompare(normalize(b.name)));
  }, [filteredStores]);

  useEffect(() => {
    setExpandedBrands((prev) => {
      const next = { ...prev };
      groupedStores.forEach((brand) => {
        if (next[brand.key] === undefined) {
          next[brand.key] = true;
        }
      });
      return next;
    });
    setExpandedCategories((prev) => {
      const next = { ...prev };
      groupedStores.forEach((brand) => {
        brand.categories.forEach((category) => {
          const key = `${brand.key}::${category.key}`;
          if (next[key] === undefined) {
            next[key] = true;
          }
        });
      });
      return next;
    });
  }, [groupedStores]);

  const toggleBrand = useCallback((brandKey) => {
    setExpandedBrands((prev) => ({
      ...prev,
      [brandKey]: !prev[brandKey],
    }));
  }, []);

  const toggleCategory = useCallback((brandKey, categoryKey) => {
    const compound = `${brandKey}::${categoryKey}`;
    setExpandedCategories((prev) => ({
      ...prev,
      [compound]: !prev[compound],
    }));
  }, []);

  const expandAllGroups = useCallback(() => {
    const nextBrands = {};
    const nextCategories = {};
    groupedStores.forEach((brand) => {
      nextBrands[brand.key] = true;
      brand.categories.forEach((category) => {
        nextCategories[`${brand.key}::${category.key}`] = true;
      });
    });
    setExpandedBrands(nextBrands);
    setExpandedCategories(nextCategories);
  }, [groupedStores]);

  const collapseAllGroups = useCallback(() => {
    const nextBrands = {};
    const nextCategories = {};
    groupedStores.forEach((brand) => {
      nextBrands[brand.key] = false;
      brand.categories.forEach((category) => {
        nextCategories[`${brand.key}::${category.key}`] = false;
      });
    });
    setExpandedBrands(nextBrands);
    setExpandedCategories(nextCategories);
  }, [groupedStores]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const goToJohn = useCallback(() => {
    navigation.navigate('John');
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

  const handleViewDetails = useCallback(
    (storeDetails) => {
      if (!storeDetails) {
        return;
      }
      navigation.navigate('SuperMarketStoreDetails', {
        store: storeDetails,
        brand,
      });
    },
    [navigation, brand]
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

  const renderStoreCard = useCallback(
    (store) => {
      const storeCategoryLabel = formatCategory(store.storeCategory || store.category || '');
      const toyCategoryDisplay = store.toysCategory || store.hasToys || '—';
      const summerCategoryDisplay = store.hasSummerItems || store.summerCategory || '—';

      return (
        <Pressable
          style={styles.card}
          onPress={() => handleSelectStore(store)}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <Text style={styles.companyTitle} numberOfLines={2}>
                {store.companyName || 'SuperMarket'} · {store.storeCode || '-'} · {store.storeName || 'Κατάστημα'}
              </Text>
              <Text style={styles.cardSubtitle} numberOfLines={1}>
                {store.city || '-'} · {store.region || '-'}
              </Text>
            </View>
            <Pressable
              style={styles.infoButton}
              hitSlop={8}
              onPress={(event) => {
                event.stopPropagation?.();
                handleViewDetails(store);
              }}
            >
              <Ionicons name="information-circle-outline" size={20} color="#1f4f8f" />
            </Pressable>
          </View>

          <View style={styles.cardDetailRow}>
            <Text style={styles.cardLabel}>Κατηγορία:</Text>
            <Text style={styles.cardValue}>{storeCategoryLabel || '—'}</Text>
          </View>

          <View style={styles.cardDetailRow}>
            <Text style={styles.cardLabel}>Παιχνίδια:</Text>
            <Text style={styles.cardValue}>{toyCategoryDisplay}</Text>
            <View style={styles.cardMetaDivider} />
            <Text style={styles.cardLabel}>Εποχικά:</Text>
            <Text style={styles.cardValue}>{summerCategoryDisplay}</Text>
          </View>
        </Pressable>
      );
    },
    [handleSelectStore, handleViewDetails]
  );

  const renderBrandSection = useCallback(
    ({ item: brandGroup }) => {
      const brandExpanded = expandedBrands[brandGroup.key] ?? true;
      const totalStores = brandGroup.categories.reduce(
        (sum, category) => sum + category.stores.length,
        0
      );

      return (
        <View style={styles.brandSection}>
          <TouchableOpacity
            style={styles.brandHeader}
            onPress={() => toggleBrand(brandGroup.key)}
            activeOpacity={0.8}
          >
            <Text style={styles.brandTitle}>
              {brandGroup.name} ({totalStores})
            </Text>
            <Ionicons
              name={brandExpanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color="#1f4f8f"
            />
          </TouchableOpacity>

          {brandExpanded &&
            brandGroup.categories.map((category) => {
              const categoryKey = `${brandGroup.key}::${category.key}`;
              const categoryExpanded = expandedCategories[categoryKey] ?? true;

              return (
                <View key={categoryKey} style={styles.categorySection}>
                  <TouchableOpacity
                    style={styles.categoryHeader}
                    onPress={() => toggleCategory(brandGroup.key, category.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.categoryTitle}>
                      {category.label} ({category.stores.length})
                    </Text>
                    <Ionicons
                      name={categoryExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color="#334155"
                    />
                  </TouchableOpacity>

                  {categoryExpanded && (
                    <View style={styles.categoryStores}>
                      {category.stores.map((store) => (
                        <View
                          key={store.refId || store.id || store.storeCode}
                          style={styles.storeCardWrapper}
                        >
                          {renderStoreCard(store)}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
        </View>
      );
    },
    [expandedBrands, expandedCategories, renderStoreCard, toggleBrand, toggleCategory]
  );

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Επιλογή Καταστήματος</Text>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={goToJohn}
          activeOpacity={0.8}
        >
          <Ionicons name="person-circle-outline" size={20} color="#1f4f8f" />
          <Text style={styles.headerActionText}>John</Text>
        </TouchableOpacity>
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
          <>
            {groupedStores.length > 0 && (
              <View style={styles.groupControls}>
                <TouchableOpacity
                  style={[styles.groupControlButton, styles.groupControlButtonPrimary]}
                  onPress={expandAllGroups}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chevron-down-circle-outline" size={18} color="#1f4f8f" />
                  <Text style={styles.groupControlText}>Άνοιγμα όλων</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.groupControlButton, styles.groupControlButtonSecondary]}
                  onPress={collapseAllGroups}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chevron-up-circle-outline" size={18} color="#1f4f8f" />
                  <Text style={styles.groupControlText}>Κλείσιμο όλων</Text>
                </TouchableOpacity>
              </View>
            )}
            <FlatList
              data={groupedStores}
              keyExtractor={(item) => item.key}
              renderItem={renderBrandSection}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
            />
          </>
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
    flex: 1,
    textAlign: 'center',
  },
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  headerActionText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#1f4f8f',
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
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
    shadowColor: '#1f2937',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  companyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#475569',
  },
  infoButton: {
    padding: 4,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
  },
  cardDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  cardLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
    marginRight: 6,
  },
  cardValue: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '500',
  },
  cardMetaDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 12,
  },
  brandSection: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingBottom: 8,
    marginTop: 12,
    shadowColor: '#1f2937',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  categorySection: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  categoryStores: {
    paddingBottom: 8,
  },
  storeCardWrapper: {
    marginTop: 8,
  },
  groupControls: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  groupControlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
  },
  groupControlButtonPrimary: {
    marginRight: 10,
  },
  groupControlButtonSecondary: {
    marginLeft: 10,
  },
  groupControlText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#1f4f8f',
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
