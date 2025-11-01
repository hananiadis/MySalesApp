import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  Image,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import debounce from 'lodash.debounce';
import SafeScreen from '../components/SafeScreen';
import { useLocalOrRemoteImage } from '../utils/imageHelpers';
import { cacheImmediateAvailabilityMap, getImmediateAvailabilityMap, lookupImmediateStockValue } from '../utils/stockAvailability';
import { normalizeBrandKey } from '../constants/brands';
import { getProductsFromLocal } from '../utils/localData';

const FILTERS = [
  { label: 'Όλα', value: 'all' },
  { label: 'Ενεργά', value: 'active' },
];

const UI_TEXT = {
  title: 'Προϊόντα',
  empty: 'Δεν βρέθηκαν προϊόντα.',
  searchPlaceholder: 'Αναζήτηση προϊόντος...',
  expandAll: 'Άνοιγμα όλων',
  collapseAll: 'Κλείσιμο όλων',
};

const PRODUCT_PLACEHOLDERS = {
  playmobil: require('../../assets/playmobil_product_placeholder.png'),
  kivos: require('../../assets/Kivos_placeholder.png'),
  john: require('../../assets/john_hellas_logo.png'),
};

const normalizeBrand = (rawBrand) => normalizeBrandKey(rawBrand);

const ProductRow = ({ item, navigation, immediateStock, brand }) => {
  const resolvedBrand = normalizeBrand(item?.brand || brand);
  const stockValue = immediateStock ?? item.availableStock ?? 'N/A';
  const numericStock = Number(stockValue);
  const isOutOfStock = !Number.isNaN(numericStock) && numericStock === 0;
  const stockDisplay = stockValue != null && stockValue !== '' ? String(stockValue) : 'N/A';
  const imgUri = useLocalOrRemoteImage(item.productCode, item.frontCover);
  const placeholderSource = PRODUCT_PLACEHOLDERS[resolvedBrand] || PRODUCT_PLACEHOLDERS.playmobil;
  const showStock = resolvedBrand === 'playmobil';

  const formatPrice = (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return String(value);
    }
    return `\u20AC${parsed.toFixed(2)}`;
  };

  const wholesaleText = formatPrice(item.wholesalePrice);
  const retailText = formatPrice(item.srp);
  const offerText = formatPrice(item.offerPrice ?? item.offer_price ?? item.offer_price);
  const wholesaleLabel = (() => {
    if (resolvedBrand === 'john') {
      return 'Χ.Τ.';
    }
    if (resolvedBrand === 'kivos') {
      return 'Χ.Τ.';
    }
    return 'Χ.Τ.';
  })();
  const retailLabel = (() => {
    if (resolvedBrand === 'john') {
      return 'Π.Λ.Τ.';
    }
    if (resolvedBrand === 'kivos') {
      return 'Π.Λ.Τ.';
    }
    return 'Π.Λ.Τ.';
  })();
  const offerLabel = resolvedBrand === 'kivos' ? 'Τιμή Προσφοράς' : 'Offer';
  const handlePress = () => {
    navigation.navigate('ProductDetail', {
      product: {
        ...item,
        availableStock: stockDisplay,
        brand: item?.brand || resolvedBrand,
      },
      brand: resolvedBrand,
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
              : placeholderSource
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
            {showStock &&
              (isOutOfStock ? (
                <View style={styles.stockPill}>
                  <Text style={[styles.stockPillText, { fontSize: 12 }]}>Stock: 0</Text>
                </View>
              ) : (
                <Text style={styles.stock}>Stock: {stockDisplay}</Text>
              ))}
            {wholesaleText ? (
              <Text style={styles.price}>
                {wholesaleLabel}: <Text style={styles.priceValue}>{wholesaleText}</Text>
              </Text>
            ) : null}
            {resolvedBrand === 'kivos' && offerText ? (
              <Text style={styles.price}>
                {offerLabel}: <Text style={styles.priceValue}>{offerText}</Text>
              </Text>
            ) : null}
            {resolvedBrand !== 'kivos' && retailText ? (
              <Text style={styles.price}>
                {retailLabel}: <Text style={styles.priceValue}>{retailText}</Text>
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const ProductsScreen = ({ navigation }) => {
  const route = useRoute();
  const brand = useMemo(() => normalizeBrand(route?.params?.brand), [route?.params?.brand]);
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [immediateStockMap, setImmediateStockMap] = useState(() => new Map());
  const [expandedNodes, setExpandedNodes] = useState({}); // Start with all collapsed
  const searchInputRef = useRef(null);
  const handleGoBack = useCallback(() => {
    navigation.navigate('BrandHome', { brand });
  }, [navigation, brand]);
  const headerLeft = useMemo(
    () => (
      <TouchableOpacity
        style={styles.backButton}
        onPress={handleGoBack}
        accessibilityRole="button"
        accessibilityLabel="Πίσω"
      >
        <Ionicons name="arrow-back" size={22} color="#1f4f8f" />
      </TouchableOpacity>
    ),
    [handleGoBack],
  );
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
        if (!cancelled && map) {
          setImmediateStockMap(new Map(map));
        }
      } catch (error) {
        if (!cancelled) {
          setImmediateStockMap(new Map());
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const loadProducts = useCallback(async () => {
    try {
      const localProducts = await getProductsFromLocal(brand);
      setProducts(Array.isArray(localProducts) ? localProducts : []);
    } catch (error) {
      console.error(`Failed to load products for brand ${brand} from local storage`, error);
      setProducts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [brand]);

  // Grouping helper functions
  const codeOf = (p) => p?.productCode ?? p?.code ?? p?.sku ?? p?.ProductCode ?? String(p?.id ?? '');
  const descOf = (p) => p?.description ?? p?.desc ?? p?.name ?? p?.productDescription ?? '';
  const playingThemeOf = (p) => {
    const theme = p?.playingTheme ?? p?.PlayingTheme ?? p?.playing_theme ?? p?.theme ?? '';
    const normalized = String(theme || '').trim();
    return normalized || 'Άγνωστο Θέμα';
  };
  const sheetCategoryOf = (p) => {
    const value = p?.sheetCategory ?? p?.SheetCategory ?? '';
    const normalized = String(value || '').trim();
    return normalized || 'Άγνωστη Κατηγορία';
  };
  const generalCategoryOf = (p) => {
    const value = p?.generalCategory ?? p?.GeneralCategory ?? '';
    const normalized = String(value || '').trim();
    return normalized || 'Άγνωστη Γενική Κατηγορία';
  };
  const subCategoryOf = (p) => {
    const value = p?.subCategory ?? p?.SubCategory ?? '';
    const normalized = String(value || '').trim();
    return normalized || 'Άγνωστη Υποκατηγορία';
  };
  const supplierBrandOf = (p) => {
    const value = p?.supplierBrand ?? p?.SupplierBrand ?? p?.brand ?? '';
    const normalized = String(value || '').trim();
    return normalized || 'Άγνωστο Brand Προμηθευτή';
  };
  const kivosCategoryOf = (p) => {
    const value = p?.category ?? p?.Category ?? p?.generalCategory ?? '';
    const normalized = String(value || '').trim();
    return normalized || 'Άγνωστη Κατηγορία';
  };
  const cataloguePageOf = (p) => {
    const raw = p?.cataloguePage ?? p?.CataloguePage ?? p?.catalogPage ?? p?.CatalogPage ?? p?.catalogue_page ?? p?.catalog_page ?? null;
    if (raw == null) return Number.POSITIVE_INFINITY;
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    const match = String(raw).match(/\d+/);
    return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
  };
  const makeNodeKey = useCallback(
    (...parts) =>
      `${brand}::${parts
        .map((part) => encodeURIComponent(String(part ?? '').trim().toLowerCase() || 'n-a'))
        .join('>')}`,
    [brand]
  );
  const isCollapsed = (nodeId) => !expandedNodes[nodeId];
  const toggleNode = (nodeId) => {
    if (!nodeId) return;
    setExpandedNodes((prev = {}) => {
      const next = { ...prev };
      if (next[nodeId]) {
        delete next[nodeId];
      } else {
        next[nodeId] = true;
      }
      return next;
    });
  };
  useEffect(() => {
    setLoading(true);
    setProducts([]);
    loadProducts();
  }, [loadProducts]);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProducts();
  }, [loadProducts]);
  const groupedListData = useMemo(() => {
    const isSearching = debouncedSearch.trim().length > 0;
    
    let list = [...products];
    if (filter === 'active') {
      list = list.filter((p) => p.isActive);
    }
    if (isSearching) {
      const searchTerm = debouncedSearch.toLowerCase();
      list = list.filter((p) => {
        const productString = Object.values(p)
          .map((value) => {
            if (typeof value === 'string') return value;
            if (typeof value === 'number') return value.toString();
            if (typeof value === 'boolean') return value ? 'true' : 'false';
            return '';
          })
          .join(' ')
          .toLowerCase();
        return productString.includes(searchTerm);
      });
    }

    const rows = [];
    
    if (isSearching) {
      // When searching, show flat list
    list.sort((a, b) => {
      const acode = (a.productCode || '').toString();
      const bcode = (b.productCode || '').toString();
      if (sortAsc) {
        return acode.localeCompare(bcode, undefined, { numeric: true });
      }
      return bcode.localeCompare(acode, undefined, { numeric: true });
    });
      for (const product of list) {
        rows.push({ type: 'item', product });
      }
      return rows;
    }

    // Grouping logic based on brand - EXACTLY matching OrderProductSelectionScreen
    if (brand === 'john') {
      const sheetMap = new Map();
      for (const product of list) {
        const sheet = sheetCategoryOf(product);
        const sheetKey = makeNodeKey('sheet', sheet);
        if (!sheetMap.has(sheetKey)) {
          sheetMap.set(sheetKey, { id: sheetKey, title: sheet, count: 0, generals: new Map() });
        }
        const sheetNode = sheetMap.get(sheetKey);
        sheetNode.count += 1;

        const general = generalCategoryOf(product);
        const generalKey = makeNodeKey('sheet', sheet, 'general', general);
        if (!sheetNode.generals.has(generalKey)) {
          sheetNode.generals.set(generalKey, { id: generalKey, title: general, count: 0, subs: new Map() });
        }
        const generalNode = sheetNode.generals.get(generalKey);
        generalNode.count += 1;

        const sub = subCategoryOf(product);
        const subKey = makeNodeKey('sheet', sheet, 'general', general, 'sub', sub);
        if (!generalNode.subs.has(subKey)) {
          generalNode.subs.set(subKey, { id: subKey, title: sub, items: [] });
        }
        generalNode.subs.get(subKey).items.push(product);
      }

      const sheetNodes = Array.from(sheetMap.values()).sort((a, b) => a.title.localeCompare(b.title));
      for (const sheetNode of sheetNodes) {
        const sheetCollapsed = isCollapsed(sheetNode.id);
        rows.push({
          type: 'header',
          id: sheetNode.id,
          title: sheetNode.title,
          count: sheetNode.count,
          collapsed: sheetCollapsed,
          level: 1,
        });
        if (sheetCollapsed) continue;

        const generalNodes = Array.from(sheetNode.generals.values()).sort((a, b) => a.title.localeCompare(b.title));
        for (const generalNode of generalNodes) {
          const generalCollapsed = isCollapsed(generalNode.id);
          rows.push({
            type: 'header',
            id: generalNode.id,
            title: generalNode.title,
            count: generalNode.count,
            collapsed: generalCollapsed,
            level: 2,
          });
          if (generalCollapsed) continue;

          const subNodes = Array.from(generalNode.subs.values()).sort((a, b) => a.title.localeCompare(b.title));
          for (const subNode of subNodes) {
            const subCollapsed = isCollapsed(subNode.id);
            rows.push({
              type: 'header',
              id: subNode.id,
              title: subNode.title,
              count: subNode.items.length,
              collapsed: subCollapsed,
              level: 3,
            });
            if (subCollapsed) continue;
            
            const sortedItems = subNode.items.slice().sort((a, b) => codeOf(a).localeCompare(codeOf(b)));
            for (const product of sortedItems) {
              rows.push({ type: 'item', parent: subNode.id, product });
            }
          }
        }
      }
      return rows;
    }
    
    if (brand === 'kivos') {
      const supplierMap = new Map();
      for (const product of list) {
        const supplier = supplierBrandOf(product);
        const supplierKey = makeNodeKey('supplier', supplier);
        if (!supplierMap.has(supplierKey)) {
          supplierMap.set(supplierKey, { id: supplierKey, title: supplier, count: 0, categories: new Map() });
        }
        const supplierNode = supplierMap.get(supplierKey);
        supplierNode.count += 1;

        const category = kivosCategoryOf(product);
        const categoryKey = makeNodeKey('supplier', supplier, 'category', category);
        if (!supplierNode.categories.has(categoryKey)) {
          supplierNode.categories.set(categoryKey, { id: categoryKey, title: category, items: [] });
        }
        supplierNode.categories.get(categoryKey).items.push(product);
      }

      const supplierNodes = Array.from(supplierMap.values()).sort((a, b) => a.title.localeCompare(b.title));
      for (const supplierNode of supplierNodes) {
        const supplierCollapsed = isCollapsed(supplierNode.id);
        rows.push({
          type: 'header',
          id: supplierNode.id,
          title: supplierNode.title,
          count: supplierNode.count,
          collapsed: supplierCollapsed,
          level: 1,
        });
        if (supplierCollapsed) continue;

        const categoryNodes = Array.from(supplierNode.categories.values()).sort((a, b) => a.title.localeCompare(b.title));
        for (const categoryNode of categoryNodes) {
          const categoryCollapsed = isCollapsed(categoryNode.id);
          rows.push({
            type: 'header',
            id: categoryNode.id,
            title: categoryNode.title,
            count: categoryNode.items.length,
            collapsed: categoryCollapsed,
            level: 2,
          });
          if (categoryCollapsed) continue;
          
          const sortedItems = categoryNode.items.slice().sort((a, b) => codeOf(a).localeCompare(codeOf(b)));
          for (const product of sortedItems) {
            rows.push({ type: 'item', parent: categoryNode.id, product });
          }
        }
      }
      return rows;
    }
    
    // Default (Playmobil and others): group by playing theme - EXACTLY matching OrderProductSelectionScreen
    const themeMap = new Map();
    for (const product of list) {
      const theme = playingThemeOf(product);
      const themeKey = makeNodeKey('theme', theme);
      if (!themeMap.has(themeKey)) {
        themeMap.set(themeKey, { id: themeKey, title: theme, items: [], minPage: Number.POSITIVE_INFINITY });
      }
      const entry = themeMap.get(themeKey);
      entry.items.push(product);
      entry.minPage = Math.min(entry.minPage, cataloguePageOf(product));
    }

    const sortedThemes = Array.from(themeMap.values());
    sortedThemes.sort((a, b) => {
      const aFinite = Number.isFinite(a.minPage);
      const bFinite = Number.isFinite(b.minPage);
      if (aFinite && bFinite && a.minPage !== b.minPage) return a.minPage - b.minPage;
      if (aFinite !== bFinite) return aFinite ? -1 : 1;
      return a.title.localeCompare(b.title);
    });

    for (const themeNode of sortedThemes) {
      const themeCollapsed = isCollapsed(themeNode.id);
      const sortedItems = themeNode.items.slice().sort((a, b) => codeOf(a).localeCompare(codeOf(b)));
      rows.push({
        type: 'header',
        id: themeNode.id,
        title: themeNode.title,
        count: sortedItems.length,
        collapsed: themeCollapsed,
        level: 1,
      });
      if (!themeCollapsed) {
        for (const product of sortedItems) {
          rows.push({ type: 'item', parent: themeNode.id, product });
        }
      }
    }
    return rows;
  }, [products, filter, debouncedSearch, sortAsc, brand, expandedNodes, makeNodeKey, isCollapsed, codeOf, sheetCategoryOf, generalCategoryOf, subCategoryOf, supplierBrandOf, kivosCategoryOf, playingThemeOf, cataloguePageOf]);
  const renderFilterButton = ({ item }) => (
    <TouchableOpacity
      style={[styles.filterButton, filter === item.value && styles.filterButtonActive]}
      onPress={() => setFilter(item.value)}
    >
      <Text style={[styles.filterText, filter === item.value && styles.filterTextActive]}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );
  const FiltersBar = () => (
    <FlatList
      data={FILTERS}
      horizontal
      keyExtractor={(item) => item.value}
      renderItem={renderFilterButton}
      showsHorizontalScrollIndicator={false}
      style={styles.filtersRow}
      contentContainerStyle={{ paddingVertical: 8, paddingRight: 8 }}
      scrollEnabled={false}
    />
  );
  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Image
        source={require('../../assets/playmobil_no_data.png')}
        style={styles.emptyImage}
        resizeMode="contain"
      />
      <Text style={styles.emptyText}>{UI_TEXT.empty}</Text>
    </View>
  );
  return (
    <SafeScreen title={UI_TEXT.title} headerLeft={headerLeft} bodyStyle={styles.body}>
      <View style={styles.content}>
        <View style={styles.stickyHeader}>
          <FiltersBar />
          <View style={styles.searchRow}>
            <TouchableOpacity onPress={() => setSortAsc((v) => !v)} style={styles.sortButton}>
              <Ionicons name="swap-vertical-outline" size={22} color="#007AFF" />
            </TouchableOpacity>
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder={UI_TEXT.searchPlaceholder}
              placeholderTextColor="#4169e1"
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              autoCapitalize="none"
            />
            <TouchableOpacity 
              style={styles.filterIconButton} 
              onPress={() => {
                // Expand all
                const allNodeIds = {};
                groupedListData.forEach(item => {
                  if (item.type === 'header') {
                    allNodeIds[item.id] = true;
                  }
                });
                setExpandedNodes(allNodeIds);
              }}
            >
              <Text style={styles.headerBtnText}>{UI_TEXT.expandAll}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.filterIconButton} 
              onPress={() => {
                // Collapse all
                setExpandedNodes({});
              }}
            >
              <Text style={styles.headerBtnText}>{UI_TEXT.collapseAll}</Text>
            </TouchableOpacity>
          </View>
        </View>
        {loading ? (
          <ActivityIndicator style={styles.loader} size="large" color="#007AFF" />
        ) : (
          <FlashList
            data={groupedListData}
            renderItem={({ item }) => {
              if (item.type === 'header') {
                return (
                  <TouchableOpacity
                    style={[styles.headerRow, { paddingLeft: 8 + (item.level - 1) * 16 }]}
                    onPress={() => toggleNode(item.id)}
                  >
                    <View style={styles.headerContent}>
                      <Ionicons
                        name={item.collapsed ? 'chevron-forward' : 'chevron-down'}
                        size={16}
                        color="#666"
                        style={styles.headerIcon}
                      />
                      <Text style={styles.headerTitle}>{item.title}</Text>
                      <View style={styles.headerCount}>
                        <Text style={styles.headerCountText}>{item.count}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }
              
              const immediate = lookupImmediateStockValue(immediateStockMap, item.product.productCode);
              return (
                <ProductRow
                  item={item.product}
                  navigation={navigation}
                  immediateStock={immediate}
                  brand={brand}
                />
              );
            }}
            keyExtractor={(item, index) => {
              if (item.type === 'header') return `header-${item.id}`;
              return `item-${item.product.productCode?.toString() || index}`;
            }}
            estimatedItemSize={85}
            ListEmptyComponent={renderEmptyComponent}
            refreshing={refreshing}
            onRefresh={onRefresh}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 12, paddingTop: 2 }}
            style={styles.productList}
          />
        )}
      </View>
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: 6 },
  content: { flex: 1 },
  loader: { marginTop: 40 },
  productList: { flex: 1 },
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
  filterButtonActive: { backgroundColor: '#007AFF' },
  filterText: { color: '#333', fontWeight: '600', fontSize: 15 },
  filterTextActive: { color: '#fff' },
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
    backgroundColor: '#1565c0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 6,
  },
  headerBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  productTouchable: { marginBottom: 2 },
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
  emptyText: {
    textAlign: 'center',
    color: '#aaa',
    marginTop: 6,
    fontSize: 18,
    fontWeight: '500',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f1fb',
  },
  headerRow: {
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
  },
  headerCount: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default ProductsScreen;










