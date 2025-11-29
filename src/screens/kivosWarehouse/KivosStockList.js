import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BarCodeScanner } from 'expo-barcode-scanner';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

import SafeScreen from '../../components/SafeScreen';
import colors from '../../theme/colors';
import { getProductsFromLocal } from '../../utils/localData';

const CHUNK_SIZE = 10;
const CACHE_KEY = 'kivos_stock_cache_v1';
const STOCK_CACHE_FILE = `${FileSystem.cacheDirectory}kivos_stock_cache.json`;
const CACHE_MAX_AGE_HOURS = 48;
const DEFAULT_LOW_STOCK_LIMIT = 0;

const KivosStockList = ({ navigation }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [showOnlyLow, setShowOnlyLow] = useState(false);
  const hasRetriedAfterCacheClear = useRef(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannerPermission, setScannerPermission] = useState(null);
  const [productsCache, setProductsCache] = useState([]);
  const [expandedNodes, setExpandedNodes] = useState({});

  const productsMap = useMemo(() => {
    const map = new Map();
    productsCache.forEach((p) => {
      const code = String(p.productCode || p.code || p.id || '').trim();
      if (!code) return;
      map.set(code, {
        description: p.description || p.name || p.productName || '',
        barcode: String(
          p.barcodeUnit || p.barcode || p.barcodeBox || p.barcodeCarton || ''
        ).trim(),
        barcodeUnit: String(p.barcodeUnit || '').trim(),
        barcodeBox: String(p.barcodeBox || '').trim(),
        barcodeCarton: String(p.barcodeCarton || '').trim(),
        supplierBrand: p.supplierBrand || p.SupplierBrand || '',
        category: p.category || p.Category || p.generalCategory || p.GeneralCategory || '',
        lowStockLimit: Number(p.lowStockLimit ?? DEFAULT_LOW_STOCK_LIMIT),
      });
    });
    return map;
  }, [productsCache]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const local = await getProductsFromLocal('kivos');
        if (active && Array.isArray(local)) {
          setProductsCache(local);
        }
      } catch (e) {
        console.warn('[KivosStockList] Failed to load local products', e);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const loadFromCache = useCallback(async () => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(STOCK_CACHE_FILE);
      if (fileInfo.exists) {
        const raw = await FileSystem.readAsStringAsync(STOCK_CACHE_FILE);
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.items)) {
          setItems(parsed.items);
          const savedAt = parsed?.savedAt || 0;
          const ageHours = (Date.now() - savedAt) / (1000 * 60 * 60);
          const hasBarcode = parsed.items.some((i) => !!i?.barcode);
          return { hasCache: true, isFresh: ageHours < CACHE_MAX_AGE_HOURS && hasBarcode };
        }
      }

      const legacyRaw = await AsyncStorage.getItem(CACHE_KEY);
      if (!legacyRaw) return { hasCache: false, isFresh: false };
      const legacyParsed = JSON.parse(legacyRaw);
      if (Array.isArray(legacyParsed?.items)) {
        setItems(legacyParsed.items);
        try {
          await FileSystem.writeAsStringAsync(STOCK_CACHE_FILE, legacyRaw, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          await AsyncStorage.removeItem(CACHE_KEY);
        } catch (writeErr) {
          console.warn('[KivosStockList] Failed to migrate cache to file', writeErr);
        }
        const savedAt = legacyParsed?.savedAt || 0;
        const ageHours = (Date.now() - savedAt) / (1000 * 60 * 60);
        const hasBarcode = legacyParsed.items.some((i) => !!i?.barcode);
        return { hasCache: true, isFresh: ageHours < CACHE_MAX_AGE_HOURS && hasBarcode };
      }
    } catch (e) {
      console.warn('[KivosStockList] Failed to read cache', e);
    }
    return { hasCache: false, isFresh: false };
  }, []);

  const loadStock = useCallback(async () => {
    console.log('[KivosStockList] loadStock start');
    setLoading(true);
    setError(null);

    try {
      const stockSnap = await firestore().collection('stock_kivos').get();
      console.log('[KivosStockList] stock snapshot received', stockSnap?.size, 'docs');
      const stockDocs = stockSnap.docs || [];

      // Preload product metadata for all stock product codes to ensure lowStockLimit and description stay fresh
      const productCodes = Array.from(
        new Set(
          stockDocs
            .map((doc) => {
              const data = doc.data() || {};
              return String(data.productCode || doc.id || '').trim();
            })
            .filter(Boolean)
        )
      );

      for (let i = 0; i < productCodes.length; i += CHUNK_SIZE) {
        const chunk = productCodes.slice(i, i + CHUNK_SIZE);
        if (!chunk.length) continue;
        try {
          const productsSnap = await firestore()
            .collection('products_kivos')
            .where(firestore.FieldPath.documentId(), 'in', chunk)
            .get();

          productsSnap.forEach((productDoc) => {
            const productData = productDoc.data() || {};
            productsMap.set(productDoc.id, {
              description:
                productData.description ||
                productData.name ||
                productData.productName ||
                '',
              barcode: String(
                productData.barcodeUnit ||
                  productData.barcode ||
                  productData.barcodeBox ||
                  productData.barcodeCarton ||
                  ''
              ).trim(),
              barcodeUnit: String(productData.barcodeUnit || '').trim(),
              barcodeBox: String(productData.barcodeBox || '').trim(),
              barcodeCarton: String(productData.barcodeCarton || '').trim(),
              lowStockLimit: Number(productData.lowStockLimit ?? DEFAULT_LOW_STOCK_LIMIT),
              supplierBrand: productData.supplierBrand || productData.SupplierBrand || '',
              category:
                productData.category ||
                productData.Category ||
                productData.generalCategory ||
                productData.GeneralCategory ||
                '',
            });
          });
        } catch (productError) {
          console.warn('[KivosStockList] Product chunk fetch failed', chunk, productError);
        }
      }

      const enriched = stockDocs.map((doc) => {
        const data = doc.data() || {};
        const productCode = String(data.productCode || doc.id || '').trim();
        const meta = productsMap.get(productCode) || {};
        const lowStockLimit = Number(meta.lowStockLimit ?? data.lowStockLimit ?? DEFAULT_LOW_STOCK_LIMIT);
        const qtyOnHand = Number(data.qtyOnHand ?? 0);
        return {
          id: doc.id,
          productCode,
          description: meta.description || data.description || data.name || '',
          barcode: String(meta.barcode || data.barcode || '').trim(),
          barcodeUnit: meta.barcodeUnit || data.barcodeUnit || '',
          barcodeBox: meta.barcodeBox || data.barcodeBox || '',
          barcodeCarton: meta.barcodeCarton || data.barcodeCarton || '',
          supplierBrand: meta.supplierBrand || data.supplierBrand || data.SupplierBrand || '',
          category:
            meta.category ||
            data.category ||
            data.Category ||
            data.generalCategory ||
            data.GeneralCategory ||
            '',
          qtyOnHand,
          lowStockLimit,
          isLowStock: qtyOnHand < lowStockLimit,
        };
      });

      console.log('[KivosStockList] items enriched', enriched.length);
      setItems(enriched);
      const payload = JSON.stringify({ items: enriched, savedAt: Date.now() });
      await FileSystem.writeAsStringAsync(STOCK_CACHE_FILE, payload, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    } catch (e) {
      console.error('[KivosStockList] Failed to load stock', e);
      const message = e?.message || '';

      if (!hasRetriedAfterCacheClear.current && message.toLowerCase().includes('sqlite_full')) {
        hasRetriedAfterCacheClear.current = true;
        try {
          console.warn('[KivosStockList] Clearing Firestore cache after SQLITE_FULL...');
          await firestore().clearPersistence();
          await firestore().terminate();
          return loadStock();
        } catch (clearErr) {
          console.error('[KivosStockList] Cache clear retry failed', clearErr);
        }
      }

      setError(message || 'Η φόρτωση αποθέματος απέτυχε. Δοκιμάστε ξανά.');
    } finally {
      console.log('[KivosStockList] loadStock end');
      setLoading(false);
    }
  }, [productsMap]);

  useEffect(() => {
    (async () => {
      const cacheInfo = await loadFromCache();
      if (!cacheInfo?.isFresh) {
        loadStock();
      }
    })();
  }, [loadFromCache, loadStock]);

  useEffect(() => {
    if (!items.length || !productsMap.size) return;
    const missingBarcodes = items.some(
      (i) => !i.barcode || !i.barcodeUnit || !i.description
    );
    if (!missingBarcodes) return;
    const enriched = items.map((item) => {
      const meta = productsMap.get(item.productCode) || {};
      return {
        ...item,
        description: meta.description || item.description,
        barcode: String(meta.barcode || item.barcode || '').trim(),
        barcodeUnit: meta.barcodeUnit || item.barcodeUnit || '',
        barcodeBox: meta.barcodeBox || item.barcodeBox || '',
        barcodeCarton: meta.barcodeCarton || item.barcodeCarton || '',
        supplierBrand: meta.supplierBrand || item.supplierBrand || '',
        category: meta.category || item.category || '',
      };
    });
    setItems(enriched);
  }, [items, productsMap]);

  const normalize = (v) => {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    return '';
  };

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = !term
      ? items
      : items.filter((item) => {
        const code = item.productCode?.toLowerCase?.() || '';
        const desc = item.description?.toLowerCase?.() || '';
        const barcode = item.barcode?.toLowerCase?.() || '';
        const barcodeUnit = item.barcodeUnit?.toLowerCase?.() || '';
        const barcodeBox = item.barcodeBox?.toLowerCase?.() || '';
        const barcodeCarton = item.barcodeCarton?.toLowerCase?.() || '';
        const supplier = item.supplierBrand?.toLowerCase?.() || '';
        const category = item.category?.toLowerCase?.() || '';
        return (
          code.includes(term) ||
          desc.includes(term) ||
          barcode.includes(term) ||
          barcodeUnit.includes(term) ||
          barcodeBox.includes(term) ||
          barcodeCarton.includes(term) ||
          supplier.includes(term) ||
          category.includes(term)
        );
      });

    return showOnlyLow ? base.filter((item) => item.isLowStock) : base;
  }, [items, search, showOnlyLow]);

  const makeNodeKey = useCallback((supplier, category) => `${supplier}::${category}`, []);

  const groupedData = useMemo(() => {
    const rows = [];
    if (!filteredItems.length) return rows;
    const autoExpand = search.trim().length > 0;

    const supplierMap = new Map();
    filteredItems.forEach((p) => {
      const supplier = normalize(p.supplierBrand || 'Λοιποί');
      const cat = normalize(p.category || 'Χωρίς κατηγορία');
      if (!supplierMap.has(supplier)) supplierMap.set(supplier, new Map());
      const catMap = supplierMap.get(supplier);
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat).push(p);
    });

    Array.from(supplierMap.keys())
      .sort((a, b) => a.localeCompare(b))
      .forEach((supplier) => {
        const supplierKey = makeNodeKey(supplier, '_root');
        const supplierCollapsed = autoExpand ? false : !expandedNodes[supplierKey];
        rows.push({
          type: 'header',
          level: 1,
          id: supplierKey,
          title: supplier,
          count: Array.from(supplierMap.get(supplier).values()).reduce(
            (acc, arr) => acc + arr.length,
            0
          ),
          collapsed: supplierCollapsed,
        });
        if (supplierCollapsed) return;
        const catMap = supplierMap.get(supplier);
        Array.from(catMap.keys())
          .sort((a, b) => a.localeCompare(b))
          .forEach((cat) => {
            const catKey = makeNodeKey(supplier, cat);
            const catCollapsed = autoExpand ? false : !expandedNodes[catKey];
            rows.push({
              type: 'header',
              level: 2,
              id: catKey,
              title: cat,
              count: catMap.get(cat).length,
              collapsed: catCollapsed,
            });
            if (catCollapsed) return;
            catMap
              .get(cat)
              .slice()
              .sort((a, b) => {
                if (a.isLowStock && !b.isLowStock) return -1;
                if (!a.isLowStock && b.isLowStock) return 1;
                return (a.productCode || '').localeCompare(b.productCode || '');
              })
              .forEach((product) => rows.push({ type: 'item', product, parent: catKey }));
          });
      });
    return rows;
  }, [expandedNodes, filteredItems, makeNodeKey, search]);

  const toggleNode = (id) => {
    setExpandedNodes((prev = {}) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  };

  const renderProduct = ({ product }) => {
    const anyBarcode =
      product.barcodeUnit || product.barcode || product.barcodeBox || product.barcodeCarton;
    return (
      <View style={[styles.row, product.isLowStock && styles.rowLowStock]}>
        <View style={styles.rowHeader}>
          <Text style={styles.productCode}>{product.productCode || '-'}</Text>
          <View style={styles.qtyWrap}>
            {product.isLowStock ? <Text style={styles.lowBadge}>LOW</Text> : null}
            <Text style={styles.qty}>{product.qtyOnHand}</Text>
          </View>
        </View>
        <Text style={styles.description}>{product.description || 'Χωρίς περιγραφή'}</Text>
        <Text style={styles.lowStockLimit}>Min: {product.lowStockLimit ?? 0}</Text>
        {anyBarcode ? (
          <Text style={styles.barcode}>
            {product.barcodeUnit ? `Barcode: ${product.barcodeUnit}` : ''}
            {product.barcodeBox ? `  Box: ${product.barcodeBox}` : ''}
            {product.barcodeCarton ? `  Carton: ${product.barcodeCarton}` : ''}
          </Text>
        ) : null}
      </View>
    );
  };

  const headerLeft = (
    <TouchableOpacity
      onPress={() => navigation.goBack()}
      style={styles.backButton}
      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      activeOpacity={0.75}
    >
      <Ionicons name="chevron-back" size={22} color={colors.primary} />
      <Text style={styles.backLabel}>Πίσω</Text>
    </TouchableOpacity>
  );

  return (
    <SafeScreen
      title="Απόθεμα Kivos"
      headerLeft={headerLeft}
      style={styles.screen}
      bodyStyle={styles.body}
      contentContainerStyle={styles.content}
      scroll={false}
    >
      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Αναζήτηση με κωδικό, περιγραφή ή barcode"
          placeholderTextColor={colors.textSecondary}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          onChangeText={(v) => {
            setSearch(v);
            setExpandedNodes({}); // reset; auto-expand when search is non-empty
          }}
        />
        <TouchableOpacity
          style={styles.barcodeButton}
          onPress={async () => {
            if (scannerPermission !== true) {
              const { status } = await BarCodeScanner.requestPermissionsAsync();
              const granted = status === 'granted';
              setScannerPermission(granted);
              if (!granted) {
                Alert.alert('Άδεια κάμερας', 'Χρειάζεται άδεια κάμερας για σάρωση barcode.');
                return;
              }
            }
            setScannerVisible(true);
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="barcode-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.refreshButton, loading && styles.disabled]}
        onPress={() => loadStock()}
        activeOpacity={0.85}
        disabled={loading}
      >
        <Text style={styles.refreshLabel}>
          {loading ? 'Φόρτωση...' : 'Ανανέωση αποθέματος'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.togglePill, showOnlyLow && styles.togglePillActive]}
        onPress={() => setShowOnlyLow((prev) => !prev)}
        activeOpacity={0.85}
      >
        <Ionicons
          name="alert-circle-outline"
          size={16}
          color={showOnlyLow ? colors.white : colors.textPrimary}
        />
        <Text
          style={[
            styles.togglePillLabel,
            showOnlyLow && styles.togglePillLabelActive,
          ]}
        >
          Show only low stock
        </Text>
      </TouchableOpacity>

      {scannerVisible ? (
        <View style={styles.scannerWrapper}>
          {scannerPermission === false ? (
            <Text style={styles.statusText}>Δεν δόθηκε άδεια κάμερας.</Text>
          ) : (
            <BarCodeScanner
              onBarCodeScanned={({ data }) => {
                setSearch(String(data || ''));
                setScannerVisible(false);
              }}
              style={StyleSheet.absoluteFillObject}
            />
          )}
          <TouchableOpacity
            style={styles.closeScanner}
            onPress={() => setScannerVisible(false)}
          >
            <Text style={styles.closeScannerText}>Κλείσιμο scanner</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.statusText}>Γίνεται φόρτωση αποθέματος...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={groupedData}
          keyExtractor={(row, idx) => {
            if (row.type === 'header') return row.id;
            return row.product?.id || row.product?.productCode || String(idx);
          }}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return (
                <TouchableOpacity
                  onPress={() => toggleNode(item.id)}
                  style={[
                    styles.headerRow,
                    item.level === 2 && styles.headerRowLevel2,
                  ]}
                  activeOpacity={0.8}
                >
                  <Text style={styles.headerTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View style={styles.headerMeta}>
                    <Text style={styles.headerCount}>({item.count})</Text>
                    <Text style={styles.headerIndicator}>{item.collapsed ? '>' : 'v'}</Text>
                  </View>
                </TouchableOpacity>
              );
            }
            return renderProduct(item);
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.statusText}>Δεν βρέθηκαν εγγραφές.</Text>
            </View>
          }
          contentContainerStyle={filteredItems.length ? null : styles.emptyContent}
        />
      )}
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: colors.white,
    color: colors.textPrimary,
  },
  barcodeButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  refreshButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  refreshLabel: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: 14,
    color: '#c62828',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  separator: {
    height: 8,
  },
  headerRow: {
    backgroundColor: '#e8f1ff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerRowLevel2: {
    marginLeft: 10,
    backgroundColor: '#f2f6ff',
  },
  headerTitle: { color: '#0d47a1', fontSize: 15, fontWeight: '700', flex: 1 },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerCount: { color: '#0d47a1', fontSize: 13, fontWeight: '600' },
  headerIndicator: { color: '#0d47a1', fontSize: 15, fontWeight: '700' },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  row: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  rowLowStock: {
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  qtyWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  productCode: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  qty: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  lowBadge: {
    backgroundColor: '#f59e0b',
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  barcode: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
  },
  lowStockLimit: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSecondary,
  },
  disabled: {
    opacity: 0.7,
  },
  togglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: colors.white,
    marginBottom: 10,
  },
  togglePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  togglePillLabel: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  togglePillLabelActive: {
    color: colors.white,
  },
  scannerWrapper: {
    height: 260,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0f172a0d',
    marginBottom: 12,
  },
  closeScanner: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  closeScannerText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
});

export default KivosStockList;
