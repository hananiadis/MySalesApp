import React, {
  useCallback,
  useEffect,
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

import SafeScreen from '../../components/SafeScreen';
import colors from '../../theme/colors';
import { useAuth } from '../../context/AuthProvider';
import { getProductsFromLocal } from '../../utils/localData';

const HEADER_LEVEL_1 = 1;
const HEADER_LEVEL_2 = 2;

const normalize = (v) => {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
};

const KivosStockAdjust = ({ navigation }) => {
  const { user, profile } = useAuth() || {};
  const userId = user?.uid || 'warehouse_manager';
  const userRole = profile?.role || 'unknown';
  const userBrands = profile?.brands || [];

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState({});
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannerPermission, setScannerPermission] = useState(null);

  const searchIndexRef = useRef(new Map());
  const stockMapRef = useRef(new Map());
  const originalStockRef = useRef(new Map());

  useEffect(() => {
    console.log('[KivosStockAdjust] Auth debug', {
      uid: userId,
      role: userRole,
      brands: userBrands,
    });
  }, [userBrands, userId, userRole]);
  const requestScannerPermission = useCallback(async () => {
    try {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      const granted = status === 'granted';
      setScannerPermission(granted);
      if (!granted) {
        Alert.alert('Permission required', 'Please allow camera access to scan barcodes.');
      }
      return granted;
    } catch (err) {
      console.warn('[KivosStockAdjust] Permission error', err);
      setScannerPermission(false);
      return false;
    }
  }, []);

  const buildSearchIndex = (list) => {
    const idx = new Map();
    list.forEach((p) => {
      try {
        const joined = Object.values(p || {})
          .flatMap((v) => {
            if (v == null) return [];
            if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
              return [String(v)];
            if (Array.isArray(v)) return v.map((x) => (x == null ? '' : String(x)));
            if (typeof v === 'object') return [JSON.stringify(v)];
            return [];
          })
          .join(' ')
          .toLowerCase();
        idx.set(p, joined);
      } catch (e) {
        console.warn('[KivosStockAdjust] index error', e);
      }
    });
    return idx;
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const localProducts = await getProductsFromLocal('kivos');
      const list = Array.isArray(localProducts) ? localProducts : [];

      const stockSnap = await firestore().collection('stock_kivos').get();
      const stockMap = new Map();
      stockSnap.forEach((doc) => {
        const data = doc.data() || {};
        stockMap.set(String(doc.id), Number(data.qtyOnHand ?? 0));
      });
      stockMapRef.current = stockMap;
      originalStockRef.current = new Map(stockMap);

      searchIndexRef.current = buildSearchIndex(list);
      setProducts(list);
    } catch (e) {
      console.error('[KivosStockAdjust] loadData error', e);
      setError(e?.message || 'Αποτυχία φόρτωσης ειδών/αποθεμάτων.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    const result = [];
    for (const p of products) {
      const hay = searchIndexRef.current.get(p) || '';
      if (hay.includes(q)) result.push(p);
    }
    return result;
  }, [products, search]);

  const makeNodeKey = useCallback((supplier, category) => `${supplier}::${category}`, []);

  const groupedData = useMemo(() => {
    const rows = [];
    if (!filteredProducts.length) return rows;
    const autoExpand = search.trim().length > 0;

    const supplierMap = new Map();
    filteredProducts.forEach((p) => {
      const supplier = normalize(p.supplierBrand || p.SupplierBrand || 'Λοιποί');
      const cat = normalize(
        p.category || p.Category || p.generalCategory || p.GeneralCategory || 'Χωρίς κατηγορία'
      );
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
          level: HEADER_LEVEL_1,
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
              level: HEADER_LEVEL_2,
              id: catKey,
              title: cat,
              count: catMap.get(cat).length,
              collapsed: catCollapsed,
            });
            if (catCollapsed) return;
            catMap
              .get(cat)
              .slice()
              .sort((a, b) => (a.productCode || '').localeCompare(b.productCode || ''))
              .forEach((product) => {
                rows.push({ type: 'item', product, parent: catKey });
              });
          });
      });
    return rows;
  }, [expandedNodes, filteredProducts, makeNodeKey, search]);

  const toggleNode = (id) => {
    setExpandedNodes((prev = {}) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  };

  const qtyOf = (code) => Number(stockMapRef.current.get(code) ?? 0);
  const setQty = (code, newQty) => {
    const qty = Math.max(0, Number.isFinite(newQty) ? newQty : 0);
    const next = new Map(stockMapRef.current);
    next.set(code, qty);
    stockMapRef.current = next;
  };
  const adjustQty = (code, delta) => {
    const current = qtyOf(code);
    setQty(code, Math.max(0, current + delta));
    setProducts((prev) => [...prev]);
  };

  const logStockHistory = useCallback(
    async (productCode, oldQty, newQty, delta) => {
      try {
        const historyRef = firestore().collection('stock_kivos_history');
        console.log('[KivosStockAdjust] logStockHistory start', {
          productCode,
          oldQty,
          newQty,
          delta,
          userUid: user?.uid || userId,
        });
        await historyRef.add({
          productCode,
          oldQty,
          newQty,
          delta,
          updatedBy: user?.uid || userId,
          timestamp: firestore.FieldValue.serverTimestamp(),
        });
        console.log('[KivosStockAdjust] HISTORY WRITE OK', {
          productCode,
          oldQty,
          newQty,
          delta,
        });
      } catch (err) {
        console.error('[KivosStockAdjust] logStockHistory error', err);
      }
    },
    [user?.uid, userId]
  );

  const updateStock = useCallback(
    async (productCode, currentQty, delta) => {
      const ref = firestore().collection('stock_kivos').doc(productCode);
      const snap = await ref.get();
      const stock = snap.data() || {};
      const safeCurrent = Number(stock?.qtyOnHand ?? 0);
      const safeDelta = Number.isFinite(delta) ? delta : 0;
      const newQty = Math.max(0, safeCurrent + safeDelta);
      console.log('[KivosStockAdjust] updateStock start', {
        productCode,
        currentQty: safeCurrent,
        delta: safeDelta,
        newQty,
        updatedBy: userId,
      });

      await ref.set(
        {
          productCode,
          qtyOnHand: newQty,
          lastUpdated: firestore.FieldValue.serverTimestamp(),
          updatedBy: userId,
        },
        { merge: true }
      );

      console.log('[KivosStockAdjust] updateStock write success', {
        productCode,
        currentQty: safeCurrent,
        newQty,
        delta: safeDelta,
      });
      await logStockHistory(productCode, safeCurrent, newQty, safeDelta);
      return newQty;
    },
    [logStockHistory, userId]
  );

  const saveChanges = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const changes = [];
      stockMapRef.current.forEach((qty, code) => {
        const original = Number(originalStockRef.current.get(code) ?? 0);
        const newQty = Number(qty ?? 0);
        if (original === newQty) return;
        const delta = newQty - original;
        changes.push({ code, original, delta });
      });

      console.log('[KivosStockAdjust] saveChanges diff', {
        changeCount: changes.length,
        changes,
        userUid: user?.uid || userId,
      });

      for (const change of changes) {
        await updateStock(change.code, change.original, change.delta);
      }

      originalStockRef.current = new Map(stockMapRef.current);
      navigation.navigate('KivosWarehouseHome');
    } catch (e) {
      console.error('[KivosStockAdjust] saveChanges error', e);
      Alert.alert('Αποτυχία', e?.message || 'Αποτυχία αποθήκευσης αλλαγών αποθέματος.');
    } finally {
      setSaving(false);
    }
  };

  const renderHeader = ({ title, count, id, collapsed, level }) => (
    <TouchableOpacity
      onPress={() => toggleNode(id)}
      style={[
        styles.headerRow,
        level === HEADER_LEVEL_2 && styles.headerRowLevel2,
      ]}
      activeOpacity={0.8}
    >
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.headerMeta}>
        <Text style={styles.headerCount}>({count})</Text>
        <Text style={styles.headerIndicator}>{collapsed ? '>' : 'v'}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderItemRow = ({ product }) => {
    const code = String(product.productCode || product.code || product.id || '');
    const desc =
      product.description || product.name || product.productName || 'No description';
    const barcode =
      product.barcodeUnit ||
      product.barcode ||
      product.barcodeBox ||
      product.barcodeCarton ||
      '';
    const qty = qtyOf(code);
    return (
      <View style={styles.itemRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.itemCode}>{code}</Text>
          <Text style={styles.itemDesc} numberOfLines={2}>
            {desc}
          </Text>
          {barcode ? <Text style={styles.itemBarcode}>Barcode: {barcode}</Text> : null}
        </View>
        <View style={styles.qtyControls}>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => adjustQty(code, -10)}
            disabled={saving}
          >
            <Text style={styles.qtyBtnText}>-10</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => adjustQty(code, -1)}
            disabled={saving}
          >
            <Text style={styles.qtyBtnText}>-1</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.qtyInput}
            value={String(qty)}
            keyboardType="number-pad"
            onChangeText={(text) => {
              const parsed = Number(text.replace(/[^0-9]/g, ''));
              if (Number.isFinite(parsed)) {
                setQty(code, parsed);
                setProducts((prev) => [...prev]);
              } else if (text === '') {
                setQty(code, 0);
                setProducts((prev) => [...prev]);
              }
            }}
            selectTextOnFocus
          />
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => adjustQty(code, 1)}
            disabled={saving}
          >
            <Text style={styles.qtyBtnText}>+1</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => adjustQty(code, 10)}
            disabled={saving}
          >
            <Text style={styles.qtyBtnText}>+10</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderRow = ({ item }) => {
    if (item.type === 'header') return renderHeader(item);
    return renderItemRow(item);
  };

  return (
    <SafeScreen
      title="Απογραφή Kivos"
      style={styles.screen}
      bodyStyle={styles.body}
      contentContainerStyle={styles.content}
      scroll={false}
    >
      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={(v) => {
            setSearch(v);
            setExpandedNodes({}); // search auto-expands in groupedData
          }}
          placeholder="Αναζήτηση με κωδικό, περιγραφή ή barcode"
          placeholderTextColor={colors.textSecondary}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        <TouchableOpacity
          style={styles.scanButton}
          onPress={async () => {
            const granted =
              scannerPermission === true ? true : await requestScannerPermission();
            if (granted) setScannerVisible(true);
          }}
          disabled={loading || saving}
        >
          <Ionicons name="barcode-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadData}
          disabled={loading}
        >
          <Ionicons
            name={loading ? 'time-outline' : 'refresh-outline'}
            size={20}
            color={colors.primary}
          />
        </TouchableOpacity>
      </View>

      {scannerVisible ? (
        <View style={styles.scannerWrapper}>
          {scannerPermission === false ? (
            <Text style={styles.statusText}>I"I�I� I'IOI,I�I�I� I�I'I�I1I� I�I�I�I�I?I�I,.</Text>
          ) : (
            <BarCodeScanner
              onBarCodeScanned={({ data }) => {
                const val = String(data || '');
                setSearch(val);
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
          <Text style={styles.statusText}>Φόρτωση προϊόντων/αποθεμάτων...</Text>
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
            return row.product?.productCode || String(idx);
          }}
          renderItem={renderRow}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.statusText}>Δεν βρέθηκαν προϊόντα.</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 16 }}
        />
      )}

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.disabled]}
        onPress={saveChanges}
        disabled={saving}
        activeOpacity={0.85}
      >
        {saving ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.saveButtonText}>Αποθήκευση & Έξοδος</Text>
        )}
      </TouchableOpacity>
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 12, paddingVertical: 10 },
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
  scanButton: {
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
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
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
  itemRow: {
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  itemCode: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  itemDesc: { fontSize: 14, color: colors.textSecondary },
  itemBarcode: { marginTop: 4, fontSize: 12, color: colors.textSecondary },
  qtyControls: {
    alignItems: 'center',
    gap: 4,
    flexDirection: 'row',
  },
  qtyBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f8fafc',
  },
  qtyBtnText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  qtyInput: {
    minWidth: 68,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 16,
    color: colors.textPrimary,
  },
  separator: { height: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  statusText: { fontSize: 14, color: colors.textSecondary, marginTop: 6 },
  errorText: { fontSize: 14, color: '#c62828', textAlign: 'center', paddingHorizontal: 20 },
  scannerWrapper: {
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0f172a0d',
    marginBottom: 12,
  },
  closeScanner: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  closeScannerText: {
    color: colors.white,
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.6 },
});

export default KivosStockAdjust;
