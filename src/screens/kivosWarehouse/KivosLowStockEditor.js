import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
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
import firestore from '@react-native-firebase/firestore';

import SafeScreen from '../../components/SafeScreen';
import colors from '../../theme/colors';

const DEFAULT_LOW_STOCK_LIMIT = 0;

const KivosLowStockEditor = ({ navigation }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [expandedNodes, setExpandedNodes] = useState({});
  const [lowStockDrafts, setLowStockDrafts] = useState({});
  const [savingAll, setSavingAll] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [productsSnap, stockSnap] = await Promise.all([
        firestore().collection('products_kivos').get(),
        firestore().collection('stock_kivos').get(),
      ]);

      const stockMap = new Map();
      stockSnap.forEach((doc) => {
        const data = doc.data() || {};
        const code = String(data.productCode || doc.id || '').trim();
        if (!code) return;
        stockMap.set(code, { qtyOnHand: Number(data.qtyOnHand ?? 0), id: doc.id });
      });

      const merged = productsSnap.docs.map((doc) => {
        const data = doc.data() || {};
        const productCode = String(data.productCode || doc.id || '').trim();
        const description =
          data.description || data.name || data.productName || data.title || '';
        const lowStockLimit = Number(data.lowStockLimit ?? DEFAULT_LOW_STOCK_LIMIT);
        const stockEntry = stockMap.get(productCode);
        const qtyOnHand = stockEntry?.qtyOnHand ?? 0;
        return {
          id: doc.id,
          productCode,
          description,
          lowStockLimit: Number.isNaN(lowStockLimit) ? DEFAULT_LOW_STOCK_LIMIT : lowStockLimit,
          qtyOnHand,
          stockDocId: stockEntry?.id || null,
          supplierBrand: data.supplierBrand || data.SupplierBrand || '',
          category: data.category || data.Category || data.generalCategory || data.GeneralCategory || '',
        };
      });

      const extraStock = [];
      stockMap.forEach((value, code) => {
        const exists = merged.find((m) => m.productCode === code);
        if (!exists) {
          extraStock.push({
            id: code,
            productCode: code,
            description: '',
            lowStockLimit: DEFAULT_LOW_STOCK_LIMIT,
            qtyOnHand: value.qtyOnHand,
            stockDocId: value.id,
            supplierBrand: '',
            category: '',
          });
        }
      });

      const combined = [...merged, ...extraStock].sort((a, b) =>
        (a.productCode || '').localeCompare(b.productCode || '')
      );
      setItems(combined);
      const drafts = {};
      combined.forEach((item) => {
        drafts[item.productCode] = String(item.lowStockLimit ?? DEFAULT_LOW_STOCK_LIMIT);
      });
      setLowStockDrafts(drafts);
    } catch (e) {
      console.error('[KivosLowStockEditor] Failed to load data', e);
      setError(e?.message || 'Failed to load products.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const normalize = (v) => {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    return '';
  };

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => {
      const code = item.productCode?.toLowerCase?.() || '';
      const desc = item.description?.toLowerCase?.() || '';
      const supplier = item.supplierBrand?.toLowerCase?.() || '';
      const category = item.category?.toLowerCase?.() || '';
      return (
        code.includes(term) ||
        desc.includes(term) ||
        supplier.includes(term) ||
        category.includes(term)
      );
    });
  }, [items, search]);

  const makeNodeKey = useCallback((supplier, category) => `${supplier}::${category}`, []);

  const groupedData = useMemo(() => {
    const rows = [];
    if (!filteredItems.length) return rows;
    const autoExpand = search.trim().length > 0;

    const supplierMap = new Map();
    filteredItems.forEach((p) => {
      const supplier = normalize(p.supplierBrand || 'Unspecified supplier');
      const cat = normalize(p.category || 'Uncategorized');
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
              .sort((a, b) => (a.productCode || '').localeCompare(b.productCode || ''))
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

  const headerLeft = (
    <TouchableOpacity
      onPress={() => navigation.goBack()}
      style={styles.backButton}
      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      activeOpacity={0.75}
    >
      <Ionicons name="chevron-back" size={22} color={colors.primary} />
      <Text style={styles.backLabel}>Back</Text>
    </TouchableOpacity>
  );

  const renderProduct = ({ product }) => {
    const code = product.productCode;
    const draft =
      lowStockDrafts[code] != null
        ? lowStockDrafts[code]
        : String(product.lowStockLimit ?? DEFAULT_LOW_STOCK_LIMIT);

    return (
      <View style={styles.row}>
        <View style={styles.rowHeader}>
          <Text style={styles.productCode}>{product.productCode || '-'}</Text>
        </View>
        <Text style={styles.description} numberOfLines={2}>
          {product.description || 'No description'}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.qtyPill}>
            <Text style={styles.metaLabel}>Qty</Text>
            <Text style={styles.qtyValue}>{product.qtyOnHand ?? 0}</Text>
          </View>
          <View style={styles.minRow}>
            <Text style={styles.metaLabel}>Min</Text>
            <TextInput
              value={draft}
              onChangeText={(text) =>
                setLowStockDrafts((prev) => ({ ...prev, [code]: text }))
              }
              keyboardType="numeric"
              selectTextOnFocus
              style={styles.minInput}
              placeholder="0"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
        </View>
      </View>
    );
  };

  const renderRow = ({ item }) => {
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
  };

  return (
    <SafeScreen
      title="Low Stock Editor"
      headerLeft={headerLeft}
      style={styles.screen}
      bodyStyle={styles.body}
      contentContainerStyle={styles.content}
      scroll={false}
    >
      <Text style={styles.heading}>Low Stock Editor</Text>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search by code or description"
        placeholderTextColor={colors.textSecondary}
        style={styles.searchInput}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TouchableOpacity
        style={[styles.saveButton, (loading || savingAll) && styles.disabled]}
        onPress={async () => {
          if (loading || savingAll) return;
          const updates = [];
          items.forEach((item) => {
            const raw = lowStockDrafts[item.productCode];
            const parsed = Number(raw);
            const next = Number.isNaN(parsed)
              ? item.lowStockLimit
              : Math.max(0, parsed);
            if (next !== item.lowStockLimit) {
              updates.push({ code: item.productCode, value: next });
            }
          });
          if (!updates.length) {
            Alert.alert('No changes', 'Nothing to save.');
            return;
          }
          try {
            setSavingAll(true);
            await Promise.all(
              updates.map((u) =>
                firestore().collection('products_kivos').doc(u.code).update({
                  lowStockLimit: u.value,
                })
              )
            );
            Alert.alert('Saved', 'Low stock limits updated.');
            loadData();
          } catch (e) {
            console.error('[KivosLowStockEditor] Failed to save limits', e);
            Alert.alert('Error', e?.message || 'Could not update low stock limits.');
          } finally {
            setSavingAll(false);
          }
        }}
        activeOpacity={0.85}
        disabled={loading || savingAll}
      >
        <Text style={styles.saveButtonLabel}>{savingAll ? 'Saving...' : 'Save changes'}</Text>
      </TouchableOpacity>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.statusText}>Loading...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            onPress={loadData}
            style={styles.retryButton}
            activeOpacity={0.85}
          >
            <Text style={styles.retryLabel}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={groupedData}
          keyExtractor={(row, idx) => {
            if (row.type === 'header') return row.id;
            return row.product?.productCode || row.product?.id || String(idx);
          }}
          renderItem={renderRow}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.statusText}>No products found.</Text>
            </View>
          }
          contentContainerStyle={!groupedData.length ? styles.emptyContent : null}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
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
  searchInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: colors.white,
    color: colors.textPrimary,
  },
  saveButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  saveButtonLabel: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  statusText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: 14,
    color: '#c62828',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 10,
  },
  retryLabel: {
    color: colors.white,
    fontWeight: '700',
  },
  separator: {
    height: 10,
  },
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
    gap: 6,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productCode: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  qty: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  meta: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  minRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  minInput: {
    width: 80,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.white,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.7,
  },
  qtyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f6f7fb',
  },
  qtyValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});

export default KivosLowStockEditor;
