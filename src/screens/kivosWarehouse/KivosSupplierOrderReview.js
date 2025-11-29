import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';
import RNFS from 'react-native-fs';
import XLSX from 'xlsx';
import Share from 'react-native-share';

import SafeScreen from '../../components/SafeScreen';
import colors from '../../theme/colors';
import { useAuth } from '../../context/AuthProvider';

const KivosSupplierOrderReview = ({ route, navigation }) => {
  const supplierOrderId = route?.params?.supplierOrderId || '';
  const { user } = useAuth();

  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const fetchProductsMeta = useCallback(async (codes = []) => {
    const map = {};
    if (!codes.length) return map;
    const uniqueCodes = Array.from(new Set(codes));
    const chunks = [];
    for (let i = 0; i < uniqueCodes.length; i += 10) {
      chunks.push(uniqueCodes.slice(i, i + 10));
    }
    for (const chunk of chunks) {
      const snap = await firestore()
        .collection('products_kivos')
        .where('productCode', 'in', chunk)
        .get();
      snap.docs.forEach((doc) => {
        const data = doc.data() || {};
        const code = data.productCode || doc.id;
        map[code] = {
          supplierBrand: data.supplierBrand || data.brand || '',
          description: data.name || data.description || '',
          barcode:
            data.barcode || data.barcodeUnit || data.barcodePrimary || '',
        };
      });
    }
    return map;
  }, []);

  const loadOrder = useCallback(async () => {
    if (!supplierOrderId) {
      setError('Missing supplier order id.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const snap = await firestore()
        .collection('supplier_orders_kivos')
        .doc(supplierOrderId)
        .get();
      if (!snap.exists) {
        setError('Supplier order not found.');
        setOrder(null);
        setItems([]);
        return;
      }
      const data = snap.data() || {};
      const orderItems = Array.isArray(data.items) ? data.items : [];
      setOrder({ id: snap.id, ...data });
      setItems(orderItems);

      const missingDescriptions = orderItems.filter(
        (item) => !item.description || !item.description.length
      );
      if (missingDescriptions.length) {
        const codes = missingDescriptions
          .map((it) => it.productCode)
          .filter(Boolean);
        const meta = await fetchProductsMeta(codes);
        setItems((prev) =>
          prev.map((it) => ({
            ...it,
            description: it.description || meta[it.productCode]?.description || '',
            supplierBrand: it.supplierBrand || meta[it.productCode]?.supplierBrand || '',
          }))
        );
      }
    } catch (e) {
      console.error('[KivosSupplierOrderReview] Failed to load supplier order', e);
      setError(e?.message || 'Failed to load supplier order.');
    } finally {
      setLoading(false);
    }
  }, [fetchProductsMeta, supplierOrderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const updateItemQty = useCallback((index, value) => {
    setItems((prev) => {
      const next = [...prev];
      const numeric = Number(value);
      next[index] = {
        ...next[index],
        totalQty: Number.isNaN(numeric) ? 0 : numeric,
      };
      return next;
    });
  }, []);

  const removeItem = useCallback((index) => {
    setItems((prev) => {
      if (prev.length <= 1) {
        Alert.alert('Cannot remove', 'At least one item is required.');
        return prev;
      }
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  }, []);

  const totalQty = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.totalQty || 0), 0),
    [items]
  );

  const saveChanges = useCallback(async () => {
    if (!supplierOrderId) {
      Alert.alert('Missing ID', 'Supplier order id is missing.');
      return;
    }
    if (!items.length) {
      Alert.alert('No items', 'At least one item is required.');
      return;
    }

    setSaving(true);
    try {
      await firestore().collection('supplier_orders_kivos').doc(supplierOrderId).update({
        items,
        status: 'reviewed',
        lastModified: firestore.FieldValue.serverTimestamp(),
        modifiedBy: user?.uid || 'warehouse_manager',
      });
      Alert.alert('Saved', 'Supplier order updated.');
      navigation.goBack();
    } catch (e) {
      console.error('[KivosSupplierOrderReview] Failed to save supplier order', e);
      Alert.alert('Error', e?.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  }, [items, navigation, supplierOrderId, user?.uid]);

  const searchProducts = useCallback(
    async (term) => {
      const raw = term ?? '';
      const trimmed = raw.trim();
      setSearchTerm(raw);
      if (!trimmed) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const [codeSnap, nameSnap, barcodeSnap] = await Promise.all([
          firestore()
            .collection('products_kivos')
            .orderBy('productCode')
            .startAt(trimmed)
            .endAt(trimmed + '\uf8ff')
            .limit(10)
            .get(),
          firestore()
            .collection('products_kivos')
            .orderBy('name')
            .startAt(trimmed)
            .endAt(trimmed + '\uf8ff')
            .limit(10)
            .get(),
          firestore()
            .collection('products_kivos')
            .where('barcode', '==', trimmed)
            .limit(5)
            .get(),
        ]);

        const mergeDocs = [...codeSnap.docs, ...nameSnap.docs, ...barcodeSnap.docs];
        const seen = new Set();
        const results = [];
        mergeDocs.forEach((doc) => {
          const data = doc.data() || {};
          const code = data.productCode || doc.id;
          if (seen.has(code)) return;
          seen.add(code);
          results.push({
            id: doc.id,
            productCode: code,
            description: data.name || data.description || '',
            supplierBrand: data.supplierBrand || data.brand || '',
          });
        });
        setSearchResults(results);
      } catch (e) {
        console.error('[KivosSupplierOrderReview] Search failed', e);
      } finally {
        setSearching(false);
      }
    },
    []
  );

  const addProduct = useCallback(
    (product) => {
      if (!product?.productCode) {
        return;
      }
      setItems((prev) => {
        const existingIndex = prev.findIndex(
          (it) => it.productCode === product.productCode
        );
        if (existingIndex >= 0) {
          const next = [...prev];
          next[existingIndex] = {
            ...next[existingIndex],
            totalQty: Number(next[existingIndex].totalQty || 0) + 1,
          };
          return next;
        }
        return [
          ...prev,
          {
            productCode: product.productCode,
            totalQty: 1,
            description: product.description || '',
            supplierBrand: product.supplierBrand || '',
          },
        ];
      });
      setSearchTerm('');
      setSearchResults([]);
    },
    []
  );

  const exportToExcel = useCallback(async () => {
    if (!order || !items.length) {
      Alert.alert('No items', 'Add at least one item before exporting.');
      return;
    }

    setExporting(true);
    try {
      const createdAt =
        typeof order.createdAt?.toDate === 'function'
          ? order.createdAt.toDate()
          : order.createdAt
          ? new Date(order.createdAt)
          : new Date();

      const rows = [];
      rows.push(['Supplier Order ID', order.id]);
      rows.push(['Created At', createdAt.toLocaleString()]);
      rows.push(['Reviewed By', user?.uid || 'warehouse_manager']);
      rows.push(['Status', order.status || 'draft']);
      rows.push(['Company', 'Ανανιάδου Αναστασία κ ΣΙΑ ΟΕ']);
      rows.push(['VAT', '']);
      rows.push(['Tax Office', '']);
      rows.push(['Telephone', '']);
      rows.push(['Email', '']);
      rows.push([]);
      rows.push(['Product Code', 'Description', 'Quantity', 'Supplier Brand']);

      items.forEach((item) => {
        rows.push([
          item.productCode,
          item.description || '',
          Number(item.totalQty || 0),
          item.supplierBrand || '',
        ]);
      });

      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'SupplierOrder');
      const wbout = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
      const fileName = `SupplierOrder_${order.id}.xlsx`;
      const baseDir =
        Platform.OS === 'android'
          ? RNFS.DownloadDirectoryPath
          : RNFS.DocumentDirectoryPath;
      const filePath = `${baseDir}/${fileName}`;
      await RNFS.writeFile(filePath, wbout, 'base64');

      try {
        await Share.open({
          url: Platform.select({ android: `file://${filePath}`, ios: filePath }),
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          failOnCancel: false,
        });
      } catch (shareErr) {
        // user cancelled or share failed; continue to status update
        console.warn('[KivosSupplierOrderReview] Share skipped', shareErr?.message);
      }

      await firestore().collection('supplier_orders_kivos').doc(order.id).update({
        status: 'exported',
        lastModified: firestore.FieldValue.serverTimestamp(),
        modifiedBy: user?.uid || 'warehouse_manager',
      });

      Alert.alert('Exported', `Supplier order exported to Excel:\n${filePath}`);
      navigation.navigate('KivosSupplierOrdersList');
    } catch (e) {
      console.error('[KivosSupplierOrderReview] Export failed', e);
      Alert.alert('Error', e?.message || 'Failed to export supplier order.');
    } finally {
      setExporting(false);
    }
  }, [items, navigation, order, user?.uid]);

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

  const renderItem = ({ item, index }) => (
    <View style={styles.itemRow}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemCode}>{item.productCode}</Text>
        <Text style={styles.itemDescription}>{item.description || ''}</Text>
      </View>
      <View style={styles.qtyControls}>
        <TextInput
          style={styles.qtyInput}
          keyboardType="numeric"
          value={String(item.totalQty ?? 0)}
          onChangeText={(text) => updateItemQty(index, text)}
        />
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => removeItem(index)}
          activeOpacity={0.8}
        >
          <Ionicons name="trash-outline" size={18} color="#c62828" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeScreen
      title="Review Supplier Order"
      headerLeft={headerLeft}
      style={styles.screen}
      bodyStyle={styles.body}
      contentContainerStyle={styles.content}
      scroll={false}
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.statusText}>Loading...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, index) =>
            `${item.productCode || 'item'}-${index}`
          }
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <View style={styles.summaryCard}>
                <Text style={styles.title}>Supplier Order: {order?.id}</Text>
                <Text style={styles.subtitle}>Status: {order?.status || 'draft'}</Text>
                <Text style={styles.subtitle}>Total items: {items.length}</Text>
                <Text style={styles.subtitle}>Total qty: {totalQty}</Text>
              </View>

              <View style={styles.searchCard}>
                <Text style={styles.sectionTitle}>Add product</Text>
                <TextInput
                  value={searchTerm}
                  onChangeText={searchProducts}
                  placeholder="Search code, name, or barcode"
                  style={styles.searchInput}
                  autoCapitalize="characters"
                />
                {searching ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : searchResults.length ? (
                  <View style={styles.searchResults}>
                    {searchResults.map((result) => (
                      <TouchableOpacity
                        key={result.id}
                        style={styles.searchResultRow}
                        onPress={() => addProduct(result)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.resultCode}>{result.productCode}</Text>
                        <Text style={styles.resultDescription}>
                          {result.description}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.statusText}>No items.</Text>
            </View>
          }
          ListFooterComponent={
            <View style={styles.footer}>
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={() => navigation.goBack()}
                  activeOpacity={0.85}
                  disabled={saving || exporting}
                >
                  <Text style={styles.secondaryLabel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.button,
                    saving && styles.buttonDisabled,
                  ]}
                  onPress={saveChanges}
                  activeOpacity={0.85}
                  disabled={saving || exporting}
                >
                  <Text style={styles.buttonLabel}>
                    {saving ? 'Saving...' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.button,
                  styles.exportButton,
                  exporting && styles.buttonDisabled,
                ]}
                onPress={exportToExcel}
                activeOpacity={0.85}
                disabled={exporting || saving}
              >
                <Text style={styles.buttonLabel}>
                  {exporting ? 'Exporting...' : 'Export to Excel'}
                </Text>
              </TouchableOpacity>
            </View>
          }
          contentContainerStyle={
            items.length ? styles.listContent : styles.emptyContent
          }
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
    padding: 14,
    gap: 10,
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: 14,
    color: '#c62828',
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  searchCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  searchInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d0d7de',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.textPrimary,
  },
  searchResults: {
    gap: 8,
  },
  searchResultRow: {
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  resultCode: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  resultDescription: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.white,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemCode: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  itemDescription: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyInput: {
    width: 70,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d0d7de',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlign: 'center',
    color: colors.textPrimary,
  },
  deleteButton: {
    padding: 6,
  },
  separator: {
    height: 10,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 20,
  },
  listContent: {
    paddingBottom: 24,
  },
  listHeader: {
    gap: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 10,
  },
  button: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  buttonLabel: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  secondaryButton: {
    backgroundColor: '#e5e7eb',
  },
  secondaryLabel: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  exportButton: {
    marginTop: 8,
  },
  footer: {
    paddingTop: 12,
    paddingBottom: 12,
    gap: 10,
  },
});

export default KivosSupplierOrderReview;
