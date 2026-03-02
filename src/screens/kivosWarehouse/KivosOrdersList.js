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
  Modal,
  ScrollView,
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
import { computeOrderTotals } from '../../utils/orderTotals';

const KivosOrdersList = ({ navigation }) => {
  const statusOptions = [
    { value: 'sent', label: 'Sent' },
    { value: 'packed', label: 'Packed' },
    { value: 'backorder', label: 'Backorder' },
    { value: 'pending', label: 'Pending' },
  ];

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortDirection, setSortDirection] = useState('desc');
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);
  const [summaryOrder, setSummaryOrder] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [statusFilters, setStatusFilters] = useState(
    () => new Set(statusOptions.map((s) => s.value))
  );
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await firestore().collection('orders_kivos').get();

      const data = snap.docs
        .map((doc) => {
          const payload = doc.data() || {};
          const orderId = payload.orderId || payload.number || doc.id;
          const customerName =
            payload.customerName ||
            payload.customer?.name ||
            payload.customer?.displayName ||
            '';
          const statusLabel = payload.status || 'Pending';
          const status = statusLabel.toLowerCase();
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
          const items = normalizeItems(payload);
          const totals = computeOrderTotals({
            lines: items.map((it) => ({ ...it, quantity: it.qty })),
            brand: payload.brand || 'kivos',
            paymentMethod: payload.paymentMethod,
            customer: payload.customer || null,
          });
          const total = totals?.total ?? calculateTotal(payload, items);

          return {
            id: doc.id,
            orderId,
            customerName,
            status,
            statusLabel,
            createdAt,
            total,
          };
        })
        .filter((order) => {
          return statusFilters.has(order.status);
        });
      console.log('[KivosOrdersList] loaded orders', data.length);
      setOrders(data);
    } catch (e) {
      console.error('[KivosOrdersList] Failed to load orders', e);
      setError(
        e?.message ||
          'Σφάλμα φόρτωσης παραγγελιών.'
      );
    } finally {
      setLoading(false);
    }
  }, [calculateTotal, normalizeItems, statusFilters]);

  useEffect(() => {
    loadOrders();
    const unsubscribe = navigation.addListener('focus', loadOrders);
    return () => {
      unsubscribe?.();
    };
  }, [loadOrders, navigation]);

  const coerceToArray = (value) => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') {
      const numericKeys = Object.keys(value).filter((k) => !Number.isNaN(Number(k)));
      if (numericKeys.length) {
        return numericKeys
          .sort((a, b) => Number(a) - Number(b))
          .map((k) => value[k])
          .filter(Boolean);
      }
    }
    return [];
  };

  const normalizeItems = (data) => {
    const sources = [
      coerceToArray(data?.items),
      coerceToArray(data?.lines),
      coerceToArray(data?.orderItems),
    ];
    const raw = sources.find((arr) => arr.length) || [];
    return raw
      .map((item) => ({
        productCode:
          item?.productCode ||
          item?.code ||
          item?.id ||
          item?.product?.code ||
          item?.product_code ||
          '',
        description:
          item?.description ||
          item?.name ||
          item?.product?.description ||
          item?.product?.name ||
          '',
        qty: Number(
          item?.qty ??
            item?.quantity ??
            item?.orderedQty ??
            item?.orderedQuantity ??
            0
        ),
        quantity: Number(
          item?.quantity ??
            item?.qty ??
            item?.orderedQty ??
            item?.orderedQuantity ??
            0
        ),
        wholesalePrice: Number(
          item?.wholesalePrice ??
            item?.price ??
            item?.unitPrice ??
            item?.netPrice ??
            0
        ),
        price: Number(
          item?.wholesalePrice ??
            item?.price ??
            item?.unitPrice ??
            item?.netPrice ??
            0
        ),
        supplierBrand:
          item?.supplierBrand ||
          item?.brand ||
          item?.supplier ||
          item?.supplier_brand ||
          '',
      }))
      .filter((it) => it.productCode);
  };

  const calculateTotal = (data, items) => {
    const explicitTotal =
      data?.finalValue ??
      (Number(data?.netValue ?? 0) + Number(data?.vat ?? 0) - Number(data?.discount ?? 0));
    if (!Number.isNaN(explicitTotal)) return Number(explicitTotal);
    const sum = items.reduce(
      (acc, it) =>
        acc +
        Number(it.qty || 0) *
          (Number(it.price ?? it.wholesalePrice ?? 0) || 0),
      0
    );
    return Number(sum.toFixed(2));
  };

  const fetchItemDescriptions = useCallback(async (orderItems = []) => {
    const descriptions = {};
    for (const item of orderItems) {
      const code = item?.productCode;
      if (!code || descriptions[code]) continue;
      try {
        const snap = await firestore().collection('products_kivos').doc(String(code)).get();
        if (snap.exists) {
          const data = snap.data() || {};
          descriptions[code] =
            data.description ||
            data.name ||
            data.title ||
            data.productName ||
            '';
        }
      } catch (e) {
        console.warn('[KivosOrdersList] Failed to load product', code, e);
      }
    }
    return descriptions;
  }, []);

  const openSummary = useCallback(
    async (orderId) => {
      if (!orderId) return;
      setSummaryVisible(true);
      setSummaryLoading(true);
      setSummaryError(null);
      try {
        const snap = await firestore().collection('orders_kivos').doc(orderId).get();
        if (!snap.exists) {
          setSummaryError('Order not found.');
          setSummaryOrder(null);
          return;
        }
        const data = snap.data() || {};
        let items = normalizeItems(data);
        const descriptionMap = await fetchItemDescriptions(
          items.filter((it) => !it.description)
        );
        items = items.map((it) => ({
          ...it,
          description: it.description || descriptionMap[it.productCode] || '',
        }));
        const totals = computeOrderTotals({
          lines: items.map((it) => ({ ...it, quantity: it.qty })),
          brand: data.brand || 'kivos',
          paymentMethod: data.paymentMethod,
          customer: data.customer || null,
        });
        const total = calculateTotal(data, items);
        setSummaryOrder({
          id: snap.id,
          displayId: data.orderId || data.number || snap.id,
          customerName:
            data.customerName ||
            data.customer?.name ||
            data.customer?.displayName ||
            '',
          customerCode: data.customer?.customerCode || data.customerCode || '',
          contact: data.contact || data.customer?.contact || null,
          address: data.address || data.customer?.address || null,
          items,
          total: totals?.total ?? total,
          status: data.status || 'Pending',
        });
      } catch (e) {
        console.error('[KivosOrdersList] Failed to load order summary', e);
        setSummaryError(e?.message || 'Failed to load order.');
      } finally {
        setSummaryLoading(false);
      }
    },
    [calculateTotal, normalizeItems]
  );


  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const deleteSelected = useCallback(async () => {
    if (!selectedIds.size || deleting) return;
    const ids = Array.from(selectedIds);
    setDeleting(true);
    try {
      const batch = firestore().batch();
      ids.forEach((id) => {
        batch.delete(firestore().collection('orders_kivos').doc(id));
      });
      await batch.commit();
      setOrders((prev) => prev.filter((order) => !selectedIds.has(order.id)));
      setSelectedIds(new Set());
    } catch (e) {
      console.error('[KivosOrdersList] Failed to delete orders', e);
      Alert.alert('Σφάλμα', e?.message || 'Αποτυχία διαγραφής παραγγελιών.');
    } finally {
      setDeleting(false);
    }
  }, [deleting, selectedIds]);

  const toggleStatusFilter = useCallback((value) => {
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next.size ? next : new Set(prev);
    });
  }, []);
  const parseDateInput = useCallback((value) => {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }, []);

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
      if (!statusFilters.has(order.status)) return false;
      const time = order.createdAt ? order.createdAt.getTime() : null;
      if (startDate && (time == null || time < startDate.getTime())) {
        return false;
      }
      if (normalizedEnd && (time == null || time >= normalizedEnd.getTime())) {
        return false;
      }
      return true;
    });
  }, [orders, sortDirection, startDateInput, endDateInput, parseDateInput, statusFilters]);

  const renderItem = ({ item }) => {
    const dateLabel = item.createdAt
      ? item.createdAt.toLocaleDateString()
      : '-';
    const isSelected = selectedIds.has(item.id);
    const isPackable = item.status !== 'packed';

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() =>
          navigation.navigate('KivosPackingList', {
            orderId: item.id,
          })
        }
        onLongPress={() => toggleSelect(item.id)}
        activeOpacity={0.85}
      >
        <View style={styles.rowHeader}>
          <Text style={styles.status}>{item.statusLabel}</Text>
          <TouchableOpacity
            onPress={(e) => {
              e?.stopPropagation?.();
              toggleSelect(item.id);
            }}
            hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
          >
            <Ionicons
              name={isSelected ? 'checkbox' : 'square-outline'}
              size={18}
              color={isSelected ? colors.primary : colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.customerName}>{item.customerName || 'Unknown customer'}</Text>
          <Text style={styles.metaValue}>{dateLabel}</Text>
          <Text style={styles.metaValue}>
            {item.total != null ? `${item.total.toFixed(2)}€` : '-'}
          </Text>
          <Text style={styles.orderNumberLabel}>{item.orderId}</Text>
        </View>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionButtonGhost}
            activeOpacity={0.85}
            onPress={(e) => {
              e?.stopPropagation?.();
              e?.preventDefault?.();
              openSummary(item.id);
            }}
          >
            <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
            <Text style={styles.actionButtonGhostLabel}>Summary</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, !isPackable && styles.disabledButton]}
            activeOpacity={0.85}
            onPress={(e) => {
              e?.stopPropagation?.();
              e?.preventDefault?.();
              if (isPackable) {
                navigation.navigate('KivosPackingList', { orderId: item.id });
              }
            }}
            disabled={!isPackable}
          >
            <Ionicons name="cube-outline" size={16} color={colors.primary} />
            <Text style={[styles.actionButtonLabel, !isPackable && styles.disabledText]}>
              Packing List
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
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
      <Text style={styles.backLabel}>Back</Text>
    </TouchableOpacity>
  );

  return (
    <SafeScreen
      title="Kivos Orders"
      headerLeft={headerLeft}
      style={styles.screen}
      bodyStyle={styles.body}
      contentContainerStyle={styles.content}
      scroll={false}
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.statusText}>Loading orders...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <>
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
                  {sortDirection === 'desc'
                    ? 'Newest → Oldest'
                    : 'Oldest → Newest'}
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
              <TextInput
                value={startDateInput}
                onChangeText={setStartDateInput}
                placeholder="YYYY-MM-DD"
                style={styles.dateInput}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>To</Text>
              <TextInput
                value={endDateInput}
                onChangeText={setEndDateInput}
                placeholder="YYYY-MM-DD"
                style={styles.dateInput}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
              />
            </View>
            <Text style={styles.filterHint}>
              Dates are inclusive; leave blank to skip a bound.
            </Text>
            <Text style={styles.filterHint}>
              Showing {filteredOrders.length} of {orders.length} orders
            </Text>
            <TouchableOpacity
              style={styles.sortButton}
              activeOpacity={0.85}
              onPress={() => setStatusFilterOpen((prev) => !prev)}
            >
              <Text style={styles.sortButtonLabel}>
                Status filters ({statusFilters.size})
              </Text>
              <Ionicons
                name={statusFilterOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.primary}
              />
            </TouchableOpacity>
            {statusFilterOpen ? (
              <View style={styles.statusFilterList}>
                {statusOptions.map((opt) => {
                  const active = statusFilters.has(opt.value);
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={styles.statusFilterRow}
                      activeOpacity={0.85}
                      onPress={() => toggleStatusFilter(opt.value)}
                    >
                      <Ionicons
                        name={active ? 'checkbox' : 'square-outline'}
                        size={16}
                        color={active ? colors.primary : colors.textSecondary}
                      />
                      <Text style={styles.statusFilterLabel}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
            <TouchableOpacity
              style={[styles.deleteButton, (!selectedIds.size || deleting) && styles.disabledButton]}
              disabled={!selectedIds.size || deleting}
              activeOpacity={0.85}
              onPress={deleteSelected}
            >
              <Ionicons name="trash" size={16} color={colors.white} />
              <Text style={styles.deleteButtonLabel}>
                {deleting ? 'Deleting...' : `Delete (${selectedIds.size})`}
              </Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={filteredOrders}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.statusText}>No orders found.</Text>
              </View>
            }
            contentContainerStyle={
              filteredOrders.length ? null : styles.emptyContent
            }
          />
        </>
      )}

      <Modal
        visible={summaryVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSummaryVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order Summary</Text>
              <TouchableOpacity
                onPress={() => setSummaryVisible(false)}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {summaryLoading ? (
              <View style={styles.modalCenter}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.statusText}>Loading summary...</Text>
              </View>
            ) : summaryError ? (
              <View style={styles.modalCenter}>
                <Text style={styles.errorText}>{summaryError}</Text>
              </View>
            ) : summaryOrder ? (
              <ScrollView contentContainerStyle={styles.modalContent}>
                <Text style={styles.modalSubtitle}>
                  {summaryOrder.displayId || summaryOrder.id}
                </Text>
                <Text style={styles.modalMeta}>Status: {summaryOrder.status}</Text>
                <Text style={styles.modalMeta}>
                  Customer: {summaryOrder.customerName || '-'}
                  {summaryOrder.customerCode ? ` (${summaryOrder.customerCode})` : ''}
                </Text>
                {summaryOrder.contact?.telephone1 || summaryOrder.contact?.email ? (
                  <Text style={styles.modalMeta}>
                    Contact: {summaryOrder.contact?.telephone1 || ''}{' '}
                    {summaryOrder.contact?.email ? ` | ${summaryOrder.contact.email}` : ''}
                  </Text>
                ) : null}
                {summaryOrder.address?.street ? (
                  <Text style={styles.modalMeta}>
                    Address: {summaryOrder.address.street}{' '}
                    {summaryOrder.address.city ? `, ${summaryOrder.address.city}` : ''}
                  </Text>
                ) : null}

                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Items</Text>
                  {summaryOrder.items.length ? (
                    summaryOrder.items.map((it) => (
                      <View key={it.productCode} style={styles.itemRowModal}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemCode}>{it.productCode}</Text>
                          <Text style={styles.itemDescription}>
                            {it.description || 'No description'}
                          </Text>
                        </View>
                        <Text style={styles.itemQty}>Qty: {it.qty || 0}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.statusText}>No items found.</Text>
                  )}
                </View>

                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>
                    {Number.isNaN(summaryOrder.total) ? '-' : summaryOrder.total.toFixed(2)}
                  </Text>
                </View>
              </ScrollView>
            ) : (
              <View style={styles.modalCenter}>
                <Text style={styles.statusText}>No data.</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  status: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  customer: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  metaLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  metaValue: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  infoBlock: {
    marginTop: 4,
    gap: 2,
    alignItems: 'flex-start',
  },
  customerName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  orderNumberLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  actionsRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionButtonLabel: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '700',
  },
  disabledText: {
    opacity: 0.6,
  },
  actionButtonGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionButtonGhostLabel: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  deleteButton: {
    marginTop: 8,
    backgroundColor: '#c62828',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  deleteButtonLabel: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  filtersCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
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
  dateInput: {
    flex: 0.65,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d0d7de',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.textPrimary,
    backgroundColor: colors.white,
  },
  filterHint: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  statusFilterList: {
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d0d7de',
    borderRadius: 10,
    padding: 8,
    backgroundColor: colors.white,
    gap: 6,
  },
  statusFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusFilterLabel: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 6,
  },
  modalMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  modalContent: {
    paddingBottom: 12,
    gap: 8,
  },
  modalCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  modalSection: {
    marginTop: 8,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  itemRowModal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f6f8fa',
    borderRadius: 10,
    padding: 10,
  },
  totalRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
});

export default KivosOrdersList;
