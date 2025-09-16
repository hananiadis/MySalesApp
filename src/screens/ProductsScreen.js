import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, FlatList, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import debounce from 'lodash.debounce';
import { useLocalOrRemoteImage } from '../utils/imageHelpers';
import { cacheImmediateAvailabilityMap, getImmediateAvailabilityMap, lookupImmediateStockValue } from '../utils/stockAvailability';

const FILTERS = [
  { label: 'Όλα', value: 'all' },
  { label: 'Ενεργά', value: 'active' },
];

const getStockColor = (stock) => {
  const s = Number(stock);
  if (s === 0) return '#FF3333';
  if (s > 0 && s <= 10) return '#FFA500';
  if (s > 10) return '#222';
  return '#222';
};

// Extracted to not break Rules of Hooks
const ProductRow = ({ item, navigation, immediateStock }) => {
  const stockValue = immediateStock ?? item.availableStock ?? '—';
  const numericStock = Number(stockValue);
  const isOutOfStock = !Number.isNaN(numericStock) && numericStock === 0;
  const stockDisplay = stockValue != null && stockValue !== '' ? String(stockValue) : 'n/a';
  const isStockNA = stockDisplay === 'n/a';
  const imgUri = useLocalOrRemoteImage(item.productCode, item.frontCover);

  const handlePress = () => {
    navigation.navigate('ProductDetail', {
      product: {
        ...item,
        availableStock: stockDisplay,
      },
    });
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      style={styles.productTouchable}
    >
      <View style={styles.itemContainer}>
        <Image
          source={
            imgUri
              ? { uri: imgUri }
              : require('../../assets/playmobil_product_placeholder.png')
          }
          style={styles.productImage}
          resizeMode="cover"
        />
        <View style={styles.productInfo}>
          <View style={styles.codeDescRow}>
            <Text style={styles.productCode}>{item.productCode}</Text>
            <Text style={styles.desc}>{item.description}</Text>
          </View>
          <View style={styles.infoRow}>
            {isOutOfStock ? (
              <View style={styles.stockPill}>
                <Text style={[styles.stockPillText, { fontSize: 12 }]}>Stock: 0</Text>
              </View>
            ) : (
              <Text style={[styles.stock, isStockNA && styles.stockNA]}>
                Stock: {stockDisplay}
              </Text>
            )}
            <Text style={styles.price}>
              Χονδρική: <Text style={styles.priceValue}>
                {item.wholesalePrice !== undefined ? `€${Number(item.wholesalePrice).toFixed(2)}` : '—'}
              </Text>
            </Text>
            <Text style={styles.price}>
              Λιανική: <Text style={styles.priceValue}>
                {item.srp !== undefined ? `€${Number(item.srp).toFixed(2)}` : '—'}
              </Text>
            </Text>
            <TouchableOpacity
              style={styles.quickAddBtn}
              onPress={(e) => { e.stopPropagation && e.stopPropagation(); Alert.alert('Quick Add', 'Θα υλοποιηθεί σύντομα'); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPressIn={(ev) => ev.stopPropagation && ev.stopPropagation()}
            >
              <Ionicons name="cart-outline" size={18} color="#00ADEF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const ProductsScreen = ({ navigation }) => {
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [immediateStockMap, setImmediateStockMap] = useState(() => new Map());

  const searchInputRef = useRef();

  // Debounce search input (300ms delay)
  useEffect(() => {
    const debouncer = debounce((text) => setDebouncedSearch(text), 300);
    debouncer(search);
    return () => debouncer.cancel();
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let map = await getImmediateAvailabilityMap();
        if ((!map || map.size === 0) && !cancelled) {
          map = await cacheImmediateAvailabilityMap(true);
        }
        if (!cancelled && map) setImmediateStockMap(new Map(map));
      } catch {
        if (!cancelled) setImmediateStockMap(new Map());
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load products from AsyncStorage
  const loadProducts = async () => {
    try {
      const json = await AsyncStorage.getItem('products');
      setProducts(json ? JSON.parse(json) : []);
    } catch (e) {
      setProducts([]);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
  };

  const filteredProducts = useMemo(() => {
    let list = [...products];
    if (filter === 'active') {
      list = list.filter(p => p.isActive);
    }
    if (debouncedSearch.trim()) {
      const searchTerm = debouncedSearch.toLowerCase();
      list = list.filter(p => {
        const productString = Object.values(p)
          .map(value =>
            typeof value === 'string' ? value :
              typeof value === 'number' ? value.toString() :
                typeof value === 'boolean' ? (value ? 'true' : 'false') : ''
          )
          .join(' ')
          .toLowerCase();
        return productString.includes(searchTerm);
      });
    }
    list.sort((a, b) => {
      const acode = (a.productCode || '').toString();
      const bcode = (b.productCode || '').toString();
      if (sortAsc) return acode.localeCompare(bcode, undefined, { numeric: true });
      return bcode.localeCompare(acode, undefined, { numeric: true });
    });
    return list;
  }, [products, filter, debouncedSearch, sortAsc]);

  // Render filter buttons
  const renderFilterButton = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        filter === item.value && styles.filterButtonActive
      ]}
      onPress={() => setFilter(item.value)}
    >
      <Text
        style={[
          styles.filterText,
          filter === item.value && styles.filterTextActive
        ]}
      >
        {item.label}
      </Text>
    </TouchableOpacity>
  );

  // Filters row
  const FiltersBar = () => (
    <FlatList
      data={FILTERS}
      horizontal
      keyExtractor={item => item.value}
      renderItem={renderFilterButton}
      showsHorizontalScrollIndicator={false}
      style={styles.filtersRow}
      contentContainerStyle={{ paddingVertical: 8, paddingRight: 8 }}
      scrollEnabled={false}
    />
  );

  // Empty state with image
  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Image
        source={require('../../assets/playmobil_no_data.png')}
        style={styles.emptyImage}
        resizeMode="contain"
      />
      <Text style={styles.emptyText}>Δεν εντοπίστηκαν προϊόντα στην τοπική αποθήκευση.</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeContainer} edges={['top', 'left', 'right']}>
      {/* Search bar OUTSIDE the list for perfect focus */}
      <View style={styles.stickyHeader}>
        <FiltersBar />
        <View style={styles.searchRow}>
          <TouchableOpacity onPress={() => setSortAsc(v => !v)} style={styles.sortButton}>
            <Ionicons name="swap-vertical-outline" size={22} color="#007AFF" />
          </TouchableOpacity>
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Αναζήτηση προϊόντων..."
            placeholderTextColor="#4169e1"
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.filterIconButton} onPress={() => { }}>
            <Ionicons name="filter-outline" size={22} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#007AFF" />
      ) : (
        <FlashList
          data={filteredProducts}
          renderItem={({ item }) => {
            const immediate = lookupImmediateStockValue(immediateStockMap, item.productCode);
            return (
              <ProductRow
                item={item}
                navigation={navigation}
                immediateStock={immediate}
              />
            );
          }}
          keyExtractor={item => item.productCode?.toString() || Math.random().toString()}
          estimatedItemSize={85}
          ListEmptyComponent={renderEmptyComponent}
          refreshing={refreshing}
          onRefresh={onRefresh}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 12, paddingTop: 2 }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeContainer: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 6 },
  stickyHeader: {
    backgroundColor: '#fff',
    zIndex: 99,
  },
  filtersRow: { maxHeight: 50, marginBottom: 6 },
  filterButton: {
    backgroundColor: '#f1f1f1',
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 7,
    marginRight: 8,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 15,
  },
  filterTextActive: {
    color: '#fff',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
    backgroundColor: '#F4F6FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00ADEF',
    shadowColor: '#00ADEF',
    shadowOpacity: 0.07,
    shadowRadius: 2,
    elevation: 1,
  },
  sortButton: {
    backgroundColor: '#f5f5f5',
    borderRadius: 7,
    padding: 6,
    marginRight: 7,
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 13,
    fontSize: 16,
    color: '#4169e1',
    marginRight: 7,
    fontWeight: '500',
  },
  filterIconButton: {
    backgroundColor: '#f5f5f5',
    borderRadius: 7,
    padding: 6,
  },
  productTouchable: {
    marginBottom: 2,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F4F6FA',
    marginVertical: 3,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    elevation: 1,
    minHeight: 85,
  },
  productImage: {
    width: 48,
    height: 48,
    borderRadius: 7,
    backgroundColor: '#e0e0e0',
    marginRight: 12,
    alignSelf: 'flex-start',
  },
  productInfo: { flex: 1, justifyContent: 'center' },
  codeDescRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 3,
    flexWrap: 'wrap',
    gap: 8,
  },
  productCode: { fontSize: 17, fontWeight: 'bold', color: '#007AFF', marginRight: 7 },
  desc: { fontSize: 17, fontWeight: 'bold', color: '#212121', flexShrink: 1 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 2,
    marginBottom: 3,
    flexWrap: 'wrap',
  },
  stock: {
    fontSize: 13,
    fontWeight: 'bold',
    minWidth: 20,
    marginRight: 8,
    color: '#007AFF',
  },
  stockNA: { color: '#d32f2f', fontWeight: 'bold' },
  price: {
    fontSize: 12,
    color: '#444',
    marginRight: 4,
  },
  priceValue: {
    fontWeight: 'bold',
    color: '#007AFF',
    fontSize: 12,
  },
  quickAddBtn: {
    marginLeft: 'auto',
    padding: 4,
    backgroundColor: '#e6f6fa',
    borderRadius: 14,
    alignSelf: 'center',
  },
  stockPill: {
    backgroundColor: '#FF3333',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 1,
    marginRight: 7,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
  },
  stockPillText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 55,
    marginBottom: 44,
  },
  emptyImage: {
    width: 250,
    height: 250,
    marginBottom: 12,
    alignSelf: 'center',
  },
  emptyText: { textAlign: 'center', color: '#aaa', marginTop: 6, fontSize: 18, fontWeight: '500' },
});

export default ProductsScreen;

