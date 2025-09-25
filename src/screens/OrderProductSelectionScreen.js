// src/screens/OrderProductSelectionScreen.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrder } from '../context/OrderContext';
import { getProductsFromLocal } from '../utils/localData';
import { getImmediateAvailabilityMap, lookupImmediateStockValue, normalizeStockCode } from '../utils/stockAvailability';

export default function OrderProductSelectionScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const listRef = useRef(null);

  const orderCtx = useOrder() || {};
  const orderLines = Array.isArray(orderCtx.orderLines) ? orderCtx.orderLines : [];
  const setOrderLines = typeof orderCtx.setOrderLines === 'function' ? orderCtx.setOrderLines : () => {};

  const routeProducts = Array.isArray(route?.params?.products) ? route.params.products : [];
  const [products, setProducts] = useState(routeProducts);
  const brandKey = route?.params?.brand ?? null;
  const fromOrders = Boolean(route?.params?.fromOrders);

  function ensureVisible(index) {
    try {
      if (!listRef?.current || typeof index !== 'number') return;
      setTimeout(() => {
        try {
          listRef.current.scrollToIndex({
            index,
            animated: true,
            viewPosition: Platform.OS === 'android' ? 0.2 : 0.4,
          });
        } catch {}
      }, 50);
    } catch {}
  }

  const [loading, setLoading] = useState(!routeProducts.length);
  const [search, setSearch] = useState('');
  const [kbPad, setKbPad] = useState(0);
  const [immediateStockMap, setImmediateStockMap] = useState(() => new Map());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const map = await getImmediateAvailabilityMap();
        if (!cancelled && map) setImmediateStockMap(new Map(map));
      } catch {
        if (!cancelled) setImmediateStockMap(new Map());
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const [expandedThemes, setExpandedThemes] = useState({});
  const [searchCollapsed, setSearchCollapsed] = useState({});

  const codeOf = (p) => p?.productCode ?? p?.code ?? p?.sku ?? p?.ProductCode ?? String(p?.id ?? '');
  const descOf = (p) => p?.description ?? p?.desc ?? p?.name ?? p?.productDescription ?? '';
  const wholesaleOf = (p) => Number(p?.wholesalePrice ?? p?.whPrice ?? p?.wh_price ?? p?.WholesalePrice ?? p?.wholesale ?? 0);
  const srpOf = (p) => p?.srp ?? p?.SRP ?? p?.retailPrice ?? p?.Retail ?? null;
  const playingThemeOf = (p) => {
    const theme = p?.playingTheme ?? p?.PlayingTheme ?? p?.playing_theme ?? p?.theme ?? '';
    const normalized = String(theme || '').trim();
    return normalized || 'Άγνωστη θεματική';
  };
  const cataloguePageOf = (p) => {
    const raw = p?.cataloguePage ?? p?.CataloguePage ?? p?.catalogPage ?? p?.CatalogPage ?? p?.catalogue_page ?? p?.catalog_page ?? null;
    if (raw == null) return Number.POSITIVE_INFINITY;
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    const match = String(raw).match(/\d+/);
    return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
  };
  const getImmediateStock = (code) => lookupImmediateStockValue(immediateStockMap, code);

  const stockOf = (p) => {
    const code = codeOf(p);
    const mapped = getImmediateStock(code);
    if (mapped != null && mapped !== '') return mapped;
    const normalizedCode = normalizeStockCode(code);
    if (normalizedCode && normalizedCode !== code) {
      const fallback = getImmediateStock(normalizedCode);
      if (fallback != null && fallback !== '') return fallback;
    }
    const fallback = p?.availableStock ?? p?.stock ?? p?.Stock ?? p?.AvailableStock ?? null;
    return fallback != null && fallback !== '' ? fallback : 'n/a';
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (routeProducts.length) return;
      try {
        setLoading(true);
        const local = await getProductsFromLocal();
        if (isMounted) setProducts(Array.isArray(local) ? local : []);
      } catch {
        if (isMounted) setProducts([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, [routeProducts.length]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      const h = e?.endCoordinates?.height || 0;
      setKbPad(h > 0 ? h : 0);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbPad(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const qtyFor = useMemo(() => new Map(orderLines.map((l) => [l.productCode, Number(l.quantity || 0)])), [orderLines]);
  const getQty = (code) => qtyFor.get(code) || 0;

  const setQty = (product, qty) => {
    const code = codeOf(product);
    const description = descOf(product);
    const wholesale = wholesaleOf(product);
    const srp = srpOf(product);
    const q = Math.max(0, Number(qty) || 0);
    setOrderLines((prev = []) => {
      const exists = prev.find((l) => l.productCode === code);
      if (exists) {
        if (q === 0) return prev.filter((l) => l.productCode !== code);
        return prev.map((l) => (l.productCode === code ? { ...l, quantity: q } : l));
      }
      if (q > 0) {
        return [
          ...prev,
          {
            productCode: code,
            description,
            wholesalePrice: Number(wholesale || 0),
            srp: srp != null ? Number(srp) : null,
            quantity: q,
          },
        ];
      }
      return prev;
    });
  };

  const increment = (p) => setQty(p, getQty(codeOf(p)) + 1);
  const decrement = (p) => setQty(p, Math.max(0, getQty(codeOf(p)) - 1));

  const { totalItems, totalValue } = useMemo(() => {
    let items = 0;
    let value = 0;
    for (const line of orderLines) {
      const q = Number(line.quantity || 0);
      const w = Number(line.wholesalePrice || 0);
      items += q;
      value += q * w;
    }
    return { totalItems: items, totalValue: Number(value.toFixed(2)) };
  }, [orderLines]);

  const goNext = () => {
    if (totalItems <= 0) return;
    if (fromOrders) {
      navigation.replace('OrderReviewScreen', { fromOrders: true, brand: brandKey ?? null });
    } else {
      navigation.navigate('OrderReviewScreen');
    }
  };

  const searchIndex = useMemo(() => {
    const idx = new Map();
    for (const p of products) {
      try {
        const s = Object.values(p || {})
          .flatMap((v) => {
            if (v == null) return [];
            if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return [String(v)];
            if (Array.isArray(v)) return v.map((x) => (x == null ? '' : String(x)));
            if (typeof v === 'object') return [JSON.stringify(v)];
            return [];
          })
          .join(' ')
          .toLowerCase();
        idx.set(p, s);
      } catch {}
    }
    return idx;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    const out = [];
    for (const p of products) {
      if ((searchIndex.get(p) || '').includes(q)) out.push(p);
    }
    return out;
  }, [products, search, searchIndex]);

  const groupedListData = useMemo(() => {
    const groups = new Map();
    for (const product of filteredProducts || []) {
      const theme = playingThemeOf(product);
      if (!groups.has(theme)) {
        groups.set(theme, { theme, items: [], minPage: Number.POSITIVE_INFINITY });
      }
      const entry = groups.get(theme);
      entry.items.push(product);
      entry.minPage = Math.min(entry.minPage, cataloguePageOf(product));
    }
    const sortedGroups = Array.from(groups.values());
    sortedGroups.sort((a, b) => {
      const aFinite = Number.isFinite(a.minPage);
      const bFinite = Number.isFinite(b.minPage);
      if (aFinite && bFinite && a.minPage !== b.minPage) return a.minPage - b.minPage;
      if (aFinite !== bFinite) return aFinite ? -1 : 1;
      return a.theme.localeCompare(b.theme);
    });

    const isSearching = search.trim().length > 0;
    const rows = [];
    for (const group of sortedGroups) {
      group.items.sort((a, b) => codeOf(a).localeCompare(codeOf(b)));

      let collapsed;
      if (isSearching) {
        collapsed = Boolean(searchCollapsed[group.theme]);
      } else {
        collapsed = !Boolean(expandedThemes[group.theme]);
      }

      rows.push({ type: 'header', theme: group.theme, count: group.items.length, collapsed });
      if (!collapsed) {
        for (const product of group.items) {
          rows.push({ type: 'item', theme: group.theme, product });
        }
      }
    }
    return rows;
  }, [filteredProducts, expandedThemes, searchCollapsed, search]);

  const toggleTheme = (theme) => {
    if (!theme) return;
    const isSearching = search.trim().length > 0;
    if (isSearching) {
      setSearchCollapsed((prev = {}) => {
        const next = { ...prev };
        if (next[theme]) delete next[theme]; else next[theme] = true;
        return next;
      });
    } else {
      setExpandedThemes((prev = {}) => {
        const next = { ...prev };
        if (next[theme]) delete next[theme]; else next[theme] = true;
        return next;
      });
    }
  };

  const handleExpandAll = () => {
    const isSearching = search.trim().length > 0;
    if (isSearching) {
      setSearchCollapsed({});
    } else {
      const allThemes = new Set(filteredProducts.map(playingThemeOf));
      const m = {};
      for (const t of allThemes) m[t] = true;
      setExpandedThemes(m);
    }
  };

  const handleCollapseAll = () => {
    const isSearching = search.trim().length > 0;
    if (isSearching) {
      const allThemes = new Set(filteredProducts.map(playingThemeOf));
      const m = {};
      for (const t of allThemes) m[t] = true;
      setSearchCollapsed(m);
    } else {
      setExpandedThemes({});
    }
  };

  const openProductDetails = (product) => {
    if (!product) return;
    const normalized = { ...product };
    const code = codeOf(product);
    if (code && !normalized.productCode) normalized.productCode = code;
    const description = descOf(product);
    if (description && !normalized.description) normalized.description = description;
    const wholesalePrice = wholesaleOf(product);
    if (Number.isFinite(wholesalePrice) && normalized.wholesalePrice == null) normalized.wholesalePrice = wholesalePrice;
    const srpValue = srpOf(product);
    if (srpValue != null && normalized.srp == null) normalized.srp = srpValue;
    const stockValue = stockOf(product);
    if (stockValue != null) normalized.availableStock = stockValue;
    const themeValue = playingThemeOf(product);
    if (themeValue && !normalized.playingTheme) normalized.playingTheme = themeValue;
    navigation.push('ProductDetail', { product: normalized, fromOrderFlow: true });
  };

  const renderRow = ({ item, index }) => {
    if (item?.type === 'header') {
      return (
        <TouchableOpacity
          onPress={() => toggleTheme(item.theme)}
          style={styles.sectionHeader}
          activeOpacity={0.8}
        >
          <Text style={styles.sectionHeaderTitle} numberOfLines={1}>{item.theme}</Text>
          <View style={styles.sectionHeaderMeta}>
            <Text style={styles.sectionHeaderCount}>({item.count})</Text>
            <Text style={styles.sectionHeaderIndicator}>{item.collapsed ? '>' : 'v'}</Text>
          </View>
        </TouchableOpacity>
      );
    }

    const product = item?.product;
    if (!product) return null;

    const code = codeOf(product);
    const q = getQty(code);
    const w = wholesaleOf(product);
    const srp = srpOf(product);
    const stock = stockOf(product);
    const stockDisplay = stock != null ? String(stock) : 'n/a';
    const isStockNA = stockDisplay === 'n/a';

    return (
      <View style={styles.card}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <TouchableOpacity
            onPress={() => openProductDetails(product)}
            activeOpacity={0.85}
            style={{ minWidth: 0 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', minWidth: 0 }}>
              <Text style={styles.code}>{code}</Text>
              <Text style={styles.desc} numberOfLines={1} ellipsizeMode="tail"> {' '} {descOf(product)}</Text>
            </View>
            <View style={{ flexDirection: 'row', marginTop: 4, flexWrap: 'wrap' }}>
            <Text style={styles.subInfo}>Χονδρική: <Text style={{ fontWeight: 'bold' }}>€{w.toFixed(2)}</Text></Text>
            {srp != null ? <Text style={styles.subInfo}> {' '}| Λιανική: <Text style={{ fontWeight: 'bold' }}>€{Number(srp || 0).toFixed(2)}</Text></Text> : null}
            <Text style={styles.subInfo}> {' '}| Stock: <Text style={[styles.stockValueText, isStockNA && styles.stockValueNA]}>{stockDisplay}</Text></Text>
          </View>
          </TouchableOpacity>
          <View style={styles.qtyRow}>
            <TouchableOpacity onPress={() => decrement(product)} style={styles.qtyTouch}><Text style={styles.qtyBtn}>-</Text></TouchableOpacity>
            <TextInput
              style={styles.qtyInput}
              keyboardType="numeric"
              value={String(q)}
              onChangeText={(v) => setQty(product, Math.max(0, parseInt(String(v).replace(/[^0-9]/g, ''), 10) || 0))}
              maxLength={4}
              placeholder="0"
              placeholderTextColor="#bbb"
              returnKeyType="done"
              blurOnSubmit
              selectTextOnFocus
              onFocus={() => ensureVisible(index)}
            />
            <TouchableOpacity onPress={() => increment(product)} style={styles.qtyTouch}><Text style={styles.qtyBtn}>+</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Επιλογή προϊόντων</Text>

        <View style={styles.searchRow}>
          <TextInput
            value={search}
            onChangeText={(v) => {
              setSearch(v);
              // όταν αλλάζει το query, καθάρισε τα "manual collapses" της αναζήτησης
              setSearchCollapsed({});
            }}
            placeholder="Αναζήτηση προϊόντων..."
            placeholderTextColor="#e0e7ff"
            style={styles.searchInput}
            returnKeyType="search"
          />
          <View style={styles.headerButtons}>
            <TouchableOpacity onPress={handleExpandAll} style={styles.headerBtn} activeOpacity={0.85}>
              <Text style={styles.headerBtnText}>Άνοιξε όλα</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCollapseAll} style={styles.headerBtn} activeOpacity={0.85}>
              <Text style={styles.headerBtnText}>Κλείσε όλα</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        {loading ? (
          <ActivityIndicator size="large" color="#1976d2" style={{ marginTop: 24 }} />
        ) : (
          <>
            <FlatList
              ref={listRef}
              data={groupedListData}
              keyExtractor={(row, idx) => {
                if (row?.type === 'header') return `header-${row?.theme || idx}`;
                const product = row?.product;
                const code = codeOf(product);
                return `item-${code || idx}`;
              }}
              renderItem={renderRow}
              contentContainerStyle={{ padding: 12, paddingBottom: 160 + (Platform.OS === 'android' ? kbPad : 0) }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#6b7280', marginTop: 24 }}>Δεν βρέθηκαν προϊόντα.</Text>}
            />

            <View style={[styles.fabWrap, { bottom: Math.max(insets.bottom + 16, 16) + (Platform.OS === 'android' ? kbPad : 0) }]}>
              <TouchableOpacity disabled={totalItems <= 0} onPress={goNext} activeOpacity={0.9} style={[styles.fab, totalItems <= 0 && styles.fabDisabled]}>
                <Text style={styles.fabText}>Σύνολο • {totalItems} τεμ. • €{totalValue.toFixed(2)}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f8fa' },
  header: { backgroundColor: '#1976d2', paddingHorizontal: 16, paddingVertical: 10 },
  headerText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  searchRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, height: 40 },
  headerButtons: { flexDirection: 'row', marginLeft: 8 },
  headerBtn: { backgroundColor: '#1565c0', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, marginLeft: 6 },
  headerBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  sectionHeader: { backgroundColor: '#e8f1ff', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionHeaderTitle: { color: '#0d47a1', fontSize: 15.5, fontWeight: '700', flex: 1, marginRight: 12 },
  sectionHeaderMeta: { flexDirection: 'row', alignItems: 'center' },
  sectionHeaderCount: { color: '#0d47a1', fontSize: 13, fontWeight: '600', marginRight: 8 },
  sectionHeaderIndicator: { color: '#0d47a1', fontSize: 15, fontWeight: '700' },

  card: { backgroundColor: '#fafdff', borderRadius: 12, padding: 10, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 2, shadowColor: '#1976d2', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, minHeight: 74 },
  code: { color: '#1565c0', fontWeight: 'bold', fontSize: 15, flexShrink: 0 },
  desc: { color: '#1976d2', fontSize: 14, fontWeight: '600', flexShrink: 1 },
  subInfo: { color: '#555', fontSize: 13, marginRight: 6 },
  stockValueText: { fontWeight: 'bold', color: '#0d47a1' },
  stockValueNA: { color: '#d32f2f' },

  qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: '#fff', borderRadius: 8, minHeight: 36, minWidth: 96, paddingHorizontal: 4, borderWidth: 1.3, borderColor: '#1976d2', alignSelf: 'flex-start' },
  qtyTouch: { paddingHorizontal: 6, paddingVertical: 4 },
  qtyBtn: { fontSize: 22, color: '#1976d2', fontWeight: 'bold' },
  qtyInput: { width: 40, height: 32, textAlign: 'center', fontSize: 17, color: '#111', marginHorizontal: 3, backgroundColor: '#f5fafd', borderRadius: 5, fontWeight: 'bold', paddingVertical: 0, paddingHorizontal: 0 },

  fabWrap: { position: 'absolute', right: 16, left: 16, alignItems: 'flex-end' },
  fab: { backgroundColor: '#1976d2', paddingVertical: 14, paddingHorizontal: 18, borderRadius: 28, elevation: 5, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  fabDisabled: { opacity: 0.5 },
  fabText: { color: '#fff', fontWeight: '800', fontSize: 15.5 },
});
