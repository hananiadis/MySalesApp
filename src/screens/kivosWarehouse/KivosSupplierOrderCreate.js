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
  Platform,
  FlatList,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';

import SafeScreen from '../../components/SafeScreen';
import { useAuth } from '../../context/AuthProvider';
import colors from '../../theme/colors';

const DateTimePicker = (() => {
  try {
    return require('@react-native-community/datetimepicker').default;
  } catch (e) {
    console.warn('[KivosSupplierOrderCreate] DateTimePicker not available');
    return null;
  }
})();

const KivosSupplierOrderCreate = ({ navigation }) => {
  const { user } = useAuth();

  const [orders, setOrders] = useState([]);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [sortDirection, setSortDirection] = useState('desc');
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');

  const startInputRef = useRef(null);
  const endInputRef = useRef(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

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

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snapshot = await firestore().collection('orders_kivos').get();

      const eligibleStatuses = ['sent', 'approved'];

      const data = snapshot.docs
        .map((doc) => {
          const payload = doc.data() || {};
          const lines = Array.isArray(payload.lines) ? payload.lines : [];
          const orderLines = Array.isArray(payload.orderLines)
            ? payload.orderLines
            : [];
          const items = Array.isArray(payload.items)
            ? payload.items
            : lines.length
            ? lines
            : orderLines;
          const orderId = payload.orderId || payload.number || doc.id;
        const customerName =
          payload.customerName ||
          payload.customer?.name ||
          payload.customer?.displayName ||
          'Unknown customer';
        const status = String(payload.status || '').trim() || 'sent';
        const statusKey = status.toLowerCase();
        const createdAtRaw =
          payload.createdAt ||
          payload.firestoreCreatedAt ||
          payload.startedAt ||
          null;
        const createdAt =
          typeof createdAtRaw?.toDate === 'function'
            ? createdAtRaw.toDate()
            : createdAtRaw
            ? new Date(createdAtRaw)
            : null;
        const totalAmount = Number(
          payload.finalValue ??
            payload.total ??
            payload.netValue ??
            payload.amount ??
            0
        );

        if (!eligibleStatuses.includes(statusKey)) {
          return null;
        }

        if (!items.length) {
          console.log('[KivosSupplierOrderCreate] Loaded order with no items', {
            id: doc.id,
            orderId,
            status,
            hasLines: lines.length,
            hasOrderLines: orderLines.length,
            hasItemsField: Array.isArray(payload.items) ? payload.items.length : 'not-array',
          });
        }

        return {
          id: doc.id,
          orderId,
          customerName,
          status,
          createdAt,
          totalAmount,
          items,
          lines,
          orderLines,
        };
      })
      .filter(Boolean);

      setOrders(data);
    } catch (e) {
      console.error('[KivosSupplierOrderCreate] Failed to load orders', e);
      setError(
        e?.message || 'Failed to load eligible orders. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const parseDateInput = useCallback((value) => {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }, []);

  const formatDate = (dateObj) => {
    if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return '';
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const filteredOrders = useMemo(() => {
    const startDate = parseDateInput(startDateInput);
    const endDate = parseDateInput(endDateInput);
    const normalizedEnd =
      endDate != null ? new Date(endDate.getTime() + 24 * 60 * 60 * 1000) : null;

    const sorted = [...orders].sort((a, b) => {
      const aTime = a.createdAt ? a.createdAt.getTime() : 0;
      const bTime = b.createdAt ? b.createdAt.getTime() : 0;
      return sortDirection === 'asc' ? aTime - bTime : bTime - aTime;
    });

    return sorted.filter((order) => {
      const time = order.createdAt ? order.createdAt.getTime() : null;
      if (startDate && (time == null || time < startDate.getTime())) {
        return false;
      }
      if (normalizedEnd && (time == null || time >= normalizedEnd.getTime())) {
        return false;
      }
      return true;
    });
  }, [orders, sortDirection, startDateInput, endDateInput, parseDateInput]);

  const toggleOrderSelection = useCallback((orderId) => {
    setSelectedOrders((prev) => {
      if (prev.includes(orderId)) {
        return prev.filter((id) => id !== orderId);
      }
      return [...prev, orderId];
    });
  }, []);

  const allSelected =
    filteredOrders.length > 0 &&
    filteredOrders.every((o) => selectedOrders.includes(o.id));

  const toggleSelectAll = useCallback(() => {
    setSelectedOrders((prev) => {
      if (filteredOrders.length === 0) {
        return prev;
      }
      if (filteredOrders.every((o) => prev.includes(o.id))) {
        return prev.filter((id) => !filteredOrders.some((o) => o.id === id));
      }
      const filteredIds = filteredOrders.map((o) => o.id);
      const merged = new Set([...prev, ...filteredIds]);
      return Array.from(merged);
    });
  }, [filteredOrders]);

  const combinedItemsArray = useMemo(() => {
    const combined = {};

    orders.forEach((order) => {
      if (!selectedOrders.includes(order.id)) {
        return;
      }

      const items = Array.isArray(order.items)
        ? order.items
        : Array.isArray(order.lines)
        ? order.lines
        : Array.isArray(order.orderLines)
        ? order.orderLines
        : [];
      if (!items.length) {
        console.log(
          '[KivosSupplierOrderCreate] Order has no items to combine',
          order.id,
          {
            itemKeys: Object.keys(order || {}),
            itemsType: Array.isArray(order.items) ? 'array' : typeof order.items,
            linesLength: Array.isArray(order.lines) ? order.lines.length : null,
            orderLinesLength: Array.isArray(order.orderLines)
              ? order.orderLines.length
              : null,
          }
        );
      } else {
        console.log(
          '[KivosSupplierOrderCreate] Combining order items',
          order.id,
          'count:',
          items.length
        );
      }

      items.forEach((item, index) => {
        const productCode =
          item?.productCode ||
          item?.code ||
          item?.sku ||
          item?.product ||
          item?.id;
        const qtyRaw =
          item?.qty ??
          item?.quantity ??
          item?.qtyOrdered ??
          item?.qtyRequested ??
          item?.qtyRequested ??
          0;
        const qty = Number(qtyRaw);

        if (!productCode) {
          console.log(
            '[KivosSupplierOrderCreate] Skipping item with missing product code',
            { orderId: order.id, index, item }
          );
          return;
        }
        if (Number.isNaN(qty)) {
          console.log(
            '[KivosSupplierOrderCreate] Skipping item with invalid qty',
            { orderId: order.id, index, item }
          );
          return;
        }
        combined[productCode] = (combined[productCode] || 0) + qty;
      });
    });

    return Object.entries(combined).map(([productCode, totalQty]) => ({
      productCode,
      totalQty,
    }));
  }, [orders, selectedOrders]);

  const totalCombinedQty = useMemo(
    () => combinedItemsArray.reduce((sum, item) => sum + Number(item.totalQty), 0),
    [combinedItemsArray]
  );

  const handleGenerateSupplierOrder = useCallback(async () => {
    if (!selectedOrders.length) {
      Alert.alert('No orders selected', 'Please select at least one order.');
      return;
    }

    if (!combinedItemsArray.length) {
      Alert.alert(
        'No items found',
        'The selected orders do not contain any items to combine.'
      );
      return;
    }

    setSaving(true);
    try {
      const selectedOrdersData = orders.filter((o) =>
        selectedOrders.includes(o.id)
      );

      console.log('[KivosSupplierOrderCreate] Selected orders', selectedOrders);
      console.log(
        '[KivosSupplierOrderCreate] Selected orders items',
        selectedOrdersData.map((o) => ({
          id: o.id,
          orderId: o.orderId,
          itemsCount: Array.isArray(o.items) ? o.items.length : 0,
        }))
      );
      console.log(
        '[KivosSupplierOrderCreate] Combined items payload',
        combinedItemsArray
      );

      const productCodes = combinedItemsArray.map((item) => item.productCode);

      const fetchProductMeta = async (codes) => {
        const map = {};
        const chunks = [];
        for (let i = 0; i < codes.length; i += 10) {
          chunks.push(codes.slice(i, i + 10));
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
              barcode: data.barcode || data.barcodeUnit || '',
            };
          });
        }
        return map;
      };

      const productMap = await fetchProductMeta(productCodes);

      const normalizeBrand = (brandRaw) => {
        const brand = (brandRaw || '').trim().toLowerCase();
        if (['artline', 'penac'].includes(brand)) return 'artline_penac';
        if (brand === 'plus') return 'plus';
        if (
          ['logo', 'logo scripto', 'logo scripto and good and borg', 'good', 'borg', 'scripto'].includes(
            brand
          )
        ) {
          return 'logo_family';
        }
        return 'other';
      };

      const groupLabel = {
        artline_penac: 'Artline/Penac',
        plus: 'Plus',
        logo_family: 'Logo',
        other: 'Other',
      };

      const supplierNameForGroup = {
        artline_penac: 'Παπάζογλου Γ. & Ο. Α. Ο.Ε',
        plus: 'LABEL ΕΠΕ',
        logo_family: 'Autofix ΑΒΕΕ',
        other: 'Supplier',
      };

      const grouped = {};
      combinedItemsArray.forEach((item) => {
        const meta = productMap[item.productCode] || {};
        const groupKey = normalizeBrand(meta.supplierBrand);
        if (!grouped[groupKey]) grouped[groupKey] = [];
        grouped[groupKey].push({
          ...item,
          description: meta.description || '',
          supplierBrand: meta.supplierBrand || '',
          barcode: meta.barcode || '',
        });
      });

      const createdIds = [];

      for (const [groupKey, itemsForGroup] of Object.entries(grouped)) {
        if (!itemsForGroup.length) continue;
        const payload = {
          createdAt: firestore.FieldValue.serverTimestamp(),
          createdBy: user?.uid || 'warehouse_manager',
          sourceOrders: selectedOrders,
          items: itemsForGroup,
          status: 'draft',
          supplierGroup: groupLabel[groupKey] || groupKey,
          supplierName: supplierNameForGroup[groupKey] || supplierNameForGroup.other,
        };

        const docRef = await firestore()
          .collection('supplier_orders_kivos')
          .add(payload);
        createdIds.push(docRef.id);
      }

      Alert.alert(
        'Supplier orders created',
        `New supplier order IDs: ${createdIds.join(', ')}`
      );
      setSelectedOrders([]);

      const routeNames = navigation?.getState?.()?.routeNames || [];
      if (routeNames.includes('KivosSupplierOrdersList')) {
        navigation.navigate('KivosSupplierOrdersList');
      }
    } catch (e) {
      console.error(
        '[KivosSupplierOrderCreate] Failed to create supplier order',
        e
      );
      Alert.alert(
        'Error',
        e?.message || 'Could not create the supplier order. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }, [combinedItemsArray, navigation, selectedOrders, user?.uid]);

  const renderOrder = ({ item }) => {
    const isSelected = selectedOrders.includes(item.id);
    const dateLabel = item.createdAt
      ? item.createdAt.toLocaleDateString()
      : '-';
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => toggleOrderSelection(item.id)}
        activeOpacity={0.9}
      >
        <View style={styles.rowHeader}>
          <View>
            <Text style={styles.orderId}>{item.orderId}</Text>
            <Text style={styles.customer}>{item.customerName}</Text>
          </View>
          <Ionicons
            name={isSelected ? 'checkbox' : 'square-outline'}
            size={24}
            color={isSelected ? colors.primary : colors.textSecondary}
          />
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Total</Text>
          <Text style={styles.metaValue}>{item.totalAmount.toFixed(2)}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Status</Text>
          <Text style={styles.status}>{item.status}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Date</Text>
          <Text style={styles.metaValue}>{dateLabel}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeScreen
      title="Generate Supplier Order"
      headerLeft={headerLeft}
      style={styles.screen}
      bodyStyle={styles.body}
      contentContainerStyle={styles.content}
      scroll={false}
    >
      <View style={styles.filtersCard}>
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Sort</Text>
          <TouchableOpacity
            style={styles.sortButton}
            onPress={() =>
              setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))
            }
            activeOpacity={0.8}
          >
            <Text style={styles.sortButtonLabel}>
              {sortDirection === 'desc' ? 'Newest → Oldest' : 'Oldest → Newest'}
            </Text>
            <Ionicons
              name={sortDirection === 'desc' ? 'arrow-down' : 'arrow-up'}
              size={16}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>From</Text>
          <View style={styles.dateInputWrapper}>
            <TextInput
              ref={startInputRef}
              value={startDateInput}
              onChangeText={setStartDateInput}
              placeholder="YYYY-MM-DD"
              style={styles.dateInput}
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => {
                if (DateTimePicker) {
                  setShowStartPicker(true);
                } else {
                  startInputRef.current?.focus();
                }
              }}
              style={styles.calendarButton}
              hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
            >
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>To</Text>
          <View style={styles.dateInputWrapper}>
            <TextInput
              ref={endInputRef}
              value={endDateInput}
              onChangeText={setEndDateInput}
              placeholder="YYYY-MM-DD"
              style={styles.dateInput}
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => {
                if (DateTimePicker) {
                  setShowEndPicker(true);
                } else {
                  endInputRef.current?.focus();
                }
              }}
              style={styles.calendarButton}
              hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
            >
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.filterHint}>
          Dates are inclusive; leave blank to skip a bound.
        </Text>
        <Text style={styles.filterHint}>
          Showing {filteredOrders.length} of {orders.length} orders
        </Text>
      </View>

      <View style={styles.topBar}>
        <View style={styles.selectAllRow}>
          <Text style={styles.title}>Select all</Text>
          <Switch value={allSelected} onValueChange={toggleSelectAll} />
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.subtitle}>
            Selected orders: {selectedOrders.length}
          </Text>
          <Text style={styles.subtitle}>
            Combined items: {totalCombinedQty}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.statusText}>Loading orders...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={[styles.button, styles.retryButton]}
            onPress={loadOrders}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonLabel}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrder}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.statusText}>
                No eligible orders found right now.
              </Text>
            </View>
          }
          contentContainerStyle={filteredOrders.length ? null : styles.emptyContent}
        />
      )}

      <TouchableOpacity
        style={[styles.button, saving && styles.buttonDisabled]}
        onPress={handleGenerateSupplierOrder}
        activeOpacity={0.85}
        disabled={saving}
      >
        <Text style={styles.buttonLabel}>
          {saving ? 'Saving...' : 'Generate Supplier Order'}
        </Text>
      </TouchableOpacity>

      {DateTimePicker && showStartPicker ? (
        <DateTimePicker
          value={parseDateInput(startDateInput) || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(event, date) => {
            setShowStartPicker(Platform.OS === 'ios');
            if (date) {
              setStartDateInput(formatDate(date));
            }
          }}
        />
      ) : null}
      {DateTimePicker && showEndPicker ? (
        <DateTimePicker
          value={parseDateInput(endDateInput) || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(event, date) => {
            setShowEndPicker(Platform.OS === 'ios');
            if (date) {
              setEndDateInput(formatDate(date));
            }
          }}
        />
      ) : null}
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
    gap: 12,
  },
  filtersCard: {
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
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  filterLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 0.35,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#e8f1fb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flex: 0.65,
  },
  sortButtonLabel: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  dateInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 0.65,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d0d7de',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 2,
    backgroundColor: colors.white,
  },
  dateInput: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 0,
    color: colors.textPrimary,
  },
  calendarButton: {
    paddingLeft: 8,
  },
  filterHint: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  topBar: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
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
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  customer: {
    marginTop: 2,
    fontSize: 14,
    color: colors.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  metaLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  status: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  separator: {
    height: 10,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
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
  button: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  retryButton: {
    alignSelf: 'center',
    width: '60%',
  },
  buttonLabel: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default KivosSupplierOrderCreate;
