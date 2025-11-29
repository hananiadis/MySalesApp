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
  FlatList,
  Platform,
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

const DateTimePicker = (() => {
  try {
    return require('@react-native-community/datetimepicker').default;
  } catch (e) {
    console.warn('[KivosSupplierOrdersList] DateTimePicker not available');
    return null;
  }
})();

const KivosSupplierOrdersList = ({ navigation }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortDirection, setSortDirection] = useState('desc');
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const startInputRef = useRef(null);
  const endInputRef = useRef(null);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await firestore()
        .collection('supplier_orders_kivos')
        .orderBy('createdAt', 'desc')
        .get();

      const supplierNameForGroup = {
        artline_penac: 'Παπάζογλου Γ. & Ο. Α. Ο.Ε',
        plus: 'LABEL ΕΠΕ',
        logo_family: 'Autofix ΑΒΕΕ',
        other: 'Supplier',
      };

      const data = snap.docs.map((doc) => {
        const payload = doc.data() || {};
        const createdAtRaw = payload.createdAt || payload.firestoreCreatedAt || null;
        const createdAt =
          typeof createdAtRaw?.toDate === 'function'
            ? createdAtRaw.toDate()
            : createdAtRaw
            ? new Date(createdAtRaw)
            : null;

        const items = Array.isArray(payload.items) ? payload.items : [];
        const supplierGroup = payload.supplierGroup || '';
        const supplierName =
          payload.supplierName ||
          supplierNameForGroup[supplierGroup] ||
          supplierNameForGroup.other;

        return {
          id: doc.id,
          status: payload.status || 'draft',
          createdAt,
          itemsCount: items.length,
          supplierName,
        };
      });

      setOrders(data);
    } catch (e) {
      console.error('[KivosSupplierOrdersList] Failed to load supplier orders', e);
      setError(e?.message || 'Failed to load supplier orders.');
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

  const renderItem = ({ item }) => {
    const dateLabel = item.createdAt ? item.createdAt.toLocaleString() : '-';

    return (
      <View style={styles.row}>
        <View style={styles.rowHeader}>
          <Text style={styles.orderId}>{item.id}</Text>
          <Text style={styles.status}>{item.status}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Supplier</Text>
          <Text style={styles.metaValue}>{item.supplierName}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Created</Text>
          <Text style={styles.metaValue}>{dateLabel}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Items</Text>
          <Text style={styles.metaValue}>{item.itemsCount}</Text>
        </View>
        <TouchableOpacity
          style={styles.openButton}
          onPress={() =>
            navigation.navigate('KivosSupplierOrderDetail', {
              supplierOrderId: item.id,
            })
          }
          activeOpacity={0.85}
        >
          <Text style={styles.openButtonLabel}>Open</Text>
        </TouchableOpacity>
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
      <Text style={styles.backLabel}>Back</Text>
    </TouchableOpacity>
  );

  return (
    <SafeScreen
      title="Supplier Orders"
      headerLeft={headerLeft}
      style={styles.screen}
      bodyStyle={styles.body}
      contentContainerStyle={styles.content}
      scroll={false}
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.statusText}>Loading supplier orders...</Text>
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

          <FlatList
            data={filteredOrders}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.statusText}>No supplier orders found.</Text>
              </View>
            }
            contentContainerStyle={
              filteredOrders.length ? null : styles.emptyContent
            }
          />
        </>
      )}

      {DateTimePicker && showStartPicker && (
        <DateTimePicker
          value={parseDateInput(startDateInput) || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(event, date) => {
            setShowStartPicker(Platform.OS === 'ios');
            if (date) setStartDateInput(formatDate(date));
          }}
        />
      )}
      {DateTimePicker && showEndPicker && (
        <DateTimePicker
          value={parseDateInput(endDateInput) || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(event, date) => {
            setShowEndPicker(Platform.OS === 'ios');
            if (date) setEndDateInput(formatDate(date));
          }}
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
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  status: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
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
  openButton: {
    marginTop: 10,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  openButtonLabel: {
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
});

export default KivosSupplierOrdersList;
