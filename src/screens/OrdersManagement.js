// src/screens/OrdersManagement.js
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useFocusEffect, useRoute } from '@react-navigation/native';

import SafeScreen from '../components/SafeScreen';
import { listLocalOrders, deleteOrder, deleteMany } from '../utils/localOrders';
import { useAuth } from '../context/AuthProvider';
import { useOrder } from '../context/OrderContext';

const ADMIN_ROLES = ['owner', 'admin', 'developer'];

const STRINGS = {
  screenTitle: '\u0394\u03b9\u03b1\u03c7\u03b5\u03af\u03c1\u03b9\u03c3\u03b7 \u03a0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03b9\u03ce\u03bd',
  tabDraft: '\u03a0\u03c1\u03cc\u03c7\u03b5\u03b9\u03c1\u03b5\u03c2',
  tabSent: '\u0391\u03c0\u03b5\u03c3\u03c4\u03b1\u03bb\u03bc\u03ad\u03bd\u03b5\u03c2',
  selectAll: '\u0395\u03c0\u03b9\u03bb\u03bf\u03b3\u03ae \u03cc\u03bb\u03c9\u03bd',
  delete: '\u0394\u03b9\u03b1\u03b3\u03c1\u03b1\u03c6\u03ae',
  clear: '\u0391\u03ba\u03cd\u03c1\u03c9\u03c3\u03b7',
  startSelection: '\u0395\u03c0\u03b9\u03bb\u03bf\u03b3\u03ae',
  selectionHint: '\u0388\u03c7\u03b5\u03c4\u03b5 \u03b5\u03c0\u03b9\u03bb\u03ad\u03be\u03b5\u03b9: ',
  loading: '\u03a6\u03cc\u03c1\u03c4\u03c9\u03c3\u03b7\u2026',
  empty: '\u0394\u03b5\u03bd \u03b2\u03c1\u03ad\u03b8\u03b7\u03ba\u03b1\u03bd \u03c0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03af\u03b5\u03c2.',
  deleteTitle: '\u0394\u03b9\u03b1\u03b3\u03c1\u03b1\u03c6\u03ae \u03c0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03b9\u03ce\u03bd',
  deleteSingle: '\u0398\u03ad\u03bb\u03b5\u03b9\u03c2 \u03bd\u03b1 \u03b4\u03b9\u03b1\u03b3\u03c1\u03ac\u03c8\u03c9 \u03b1\u03c5\u03c4\u03ae \u03c4\u03b7\u03bd \u03c0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03af\u03b1;',
  deleteMultiplePrefix: '\u0398\u03ad\u03bb\u03b5\u03b9\u03c2 \u03bd\u03b1 \u03b4\u03b9\u03b1\u03b3\u03c1\u03ac\u03c8\u03c9 ',
  deleteMultipleSuffix: ' \u03c0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03af\u03b5\u03c2;',
  cancel: '\u0386\u03ba\u03c5\u03c1\u03bf',
  customerFallback: '\u03a7\u03c9\u03c1\u03af\u03c2 \u03c3\u03c4\u03bf\u03b9\u03c7\u03b5\u03af\u03b1 \u03c0\u03b5\u03bb\u03ac\u03c4\u03b7',
  linesLabel: '\u0393\u03c1\u03b1\u03bc\u03bc\u03ad\u03c2',
  totalLabel: '\u03a3\u03cd\u03bd\u03bf\u03bb\u03bf',
  badgeDraft: '\u03a0\u03c1\u03cc\u03c7\u03b5\u03b9\u03c1\u03b7',
  badgeSent: '\u0391\u03c0\u03b5\u03c3\u03c4\u03b1\u03bb\u03bc\u03ad\u03bd\u03b7',
  notAllowedTitle: '\u0394\u03b5\u03bd \u03b5\u03c0\u03b9\u03c4\u03c1\u03ad\u03c0\u03b5\u03c4\u03b5',
  notAllowedMessage: '\u0394\u03b5\u03bd \u03bc\u03c0\u03bf\u03c1\u03b5\u03af\u03c4\u03b5 \u03bd\u03b1 \u03b4\u03b5\u03af\u03c4\u03b5 \u03c0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03af\u03b5\u03c2 \u03b4\u03b7\u03bc\u03b9\u03bf\u03c5\u03b3\u03bc\u03ad\u03bd\u03c9\u03bd.',
  nothingToDelete: '\u0394\u03b5\u03bd \u03b2\u03c1\u03ad\u03b8\u03b7\u03ba\u03b1\u03bd \u03c0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03af\u03b5\u03c2 \u03b3\u03b9\u03b1 \u03b4\u03b9\u03b1\u03b3\u03c1\u03b1\u03c6\u03ae.',
};

const SYMBOLS = {
  euro: '\u20ac',
};

const formatDateTime = (value) => {
  if (!value) return '';
  try {
    const date = new Date(value);
    return date.toLocaleString();
  } catch (error) {
    return String(value);
  }
};

const formatCurrency = (value) => {
  const number = Number(value || 0);
  return `${SYMBOLS.euro}${number.toFixed(2)}`;
};

const isSentOrder = (order) =>
  order?.status === 'sent' || order?.sent === true || order?.exported === true;

const dedupeByIdLatest = (entries = []) => {
  if (!Array.isArray(entries)) return [];
  const byId = new Map();
  const withoutId = [];

  for (const entry of entries) {
    if (entry?.id != null) {
      const key = String(entry.id);
      const existing = byId.get(key);
      if (!existing) {
        byId.set(key, entry);
      } else {
        const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        const entryTime = new Date(entry.updatedAt || entry.createdAt || 0).getTime();
        if (entryTime >= existingTime) {
          byId.set(key, { ...existing, ...entry });
        }
      }
    } else {
      withoutId.push(entry);
    }
  }

  return [...byId.values(), ...withoutId];
};


export default function OrdersManagement({ navigation }) {
  const { user, profile } = useAuth();
  const currentUserId = user?.uid || profile?.uid || profile?.id || null;
  const isAdmin = ADMIN_ROLES.includes(profile?.role);
  const route = useRoute();
  const brandFilter = route?.params?.brand ?? null;
  const allowedBrands = useMemo(
    () => (Array.isArray(profile?.brands) ? profile.brands.filter(Boolean) : []),
    [profile?.brands]
  );
  const isBrandRestrictedAdmin = isAdmin && allowedBrands.length > 0;
  const defaultBrandForNewOrder = brandFilter ?? (allowedBrands.length === 1 ? allowedBrands[0] : null);

  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState('draft'); // 'draft' | 'sent'
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectionActive, setSelectionActive] = useState(false);

  const selectionMode = selectionActive || selectedIds.size > 0;

  const canManageOrder = useCallback(
    (orderItem) => {
      if (isAdmin) return true;
      if (!orderItem) return false;
      const ownerId = orderItem.userId || orderItem.createdBy || null;
      return ownerId === currentUserId;
    },
    [isAdmin, currentUserId]
  );

  const { loadOrder } = useOrder();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const fetched = await listLocalOrders();
      let all = dedupeByIdLatest(fetched);
      if (!Array.isArray(all)) all = [];

      if (brandFilter) {
        all = all.filter((order) => (order?.brand ?? null) === brandFilter);
      } else if (!isAdmin || isBrandRestrictedAdmin) {
        if (allowedBrands.length) {
          all = all.filter((order) => {
            const orderBrand = order?.brand;
            return !orderBrand || allowedBrands.includes(orderBrand);
          });
        }
      }

      if (!isAdmin && currentUserId) {
        all = all.filter((order) => order?.userId === currentUserId);
      }
      setOrders(all);
      setSelectedIds((prev) => {
        const next = new Set();
        all.forEach((order) => {
          if (prev.has(order.id)) next.add(order.id);
        });
        if (next.size === 0) {
          setSelectionActive(false);
        }
        return next;
      });
    } catch (error) {
      console.warn('Failed to list local orders', error);
      setOrders([]);
      setSelectedIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [allowedBrands, brandFilter, currentUserId, isAdmin, isBrandRestrictedAdmin]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSelectedIds(new Set());
    setSelectionActive(false);
  }, [tab]);

  const data = useMemo(() => {
    return orders.filter((order) => (tab === 'draft' ? !isSentOrder(order) : isSentOrder(order)));
  }, [orders, tab]);

  const toggleSelect = (id) => {
    setSelectionActive(true);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectionActive(true);
    const base = (isAdmin ? data : data.filter(canManageOrder)).filter((order) => order?.id);
    setSelectedIds(new Set(base.map((order) => order.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectionActive(false);
  };

  const openOrder = useCallback(
    async (orderItem) => {
      if (!orderItem) return;
      if (!canManageOrder(orderItem)) {
        Alert.alert(STRINGS.notAllowedTitle, STRINGS.notAllowedMessage);
        return;
      }
      if (typeof loadOrder === 'function') {
        try {
          await loadOrder(orderItem);
        } catch (error) {
          console.warn('Failed to load order into context', error);
        }
      }
      const target = isSentOrder(orderItem) ? 'OrderSummaryScreen' : 'OrderReviewScreen';
      const params = { id: orderItem?.id || orderItem?.orderId || null, brand: orderItem?.brand ?? null, fromOrders: true };
      navigation.navigate(target, params);
    },
    [canManageOrder, loadOrder, navigation]
  );

  const confirmDelete = (ids) => {
    const uniqueIds = Array.isArray(ids) ? Array.from(new Set(ids)) : [];
    const permittedIds = isAdmin
      ? uniqueIds
      : uniqueIds.filter((id) => {
          const orderItem = orders.find((entry) => String(entry?.id) === String(id));
          return canManageOrder(orderItem);
        });

    if (permittedIds.length === 0) {
      Alert.alert(STRINGS.notAllowedTitle, STRINGS.nothingToDelete);
      return;
    }

    const count = permittedIds.length;
    const message = count === 1
      ? STRINGS.deleteSingle
      : `${STRINGS.deleteMultiplePrefix}${count}${STRINGS.deleteMultipleSuffix}`;

    Alert.alert(
      STRINGS.deleteTitle,
      message,
      [
        { text: STRINGS.cancel, style: 'cancel' },
        {
          text: STRINGS.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              if (count === 1) {
                await deleteOrder(permittedIds[0]);
              } else {
                await deleteMany(permittedIds);
              }
            } catch (error) {
              console.warn('Failed to delete orders', error);
            }
            clearSelection();
            load();
          },
        },
      ]
    );
  };

  const headerRight = (
    <TouchableOpacity onPress={() => navigation.navigate('OrderCustomerSelectScreen', { brand: defaultBrandForNewOrder })}>
      <Icon name="add-outline" size={22} color="#1976d2" />
    </TouchableOpacity>
  );

  const renderRow = ({ item }) => {
    const isSelected = selectedIds.has(item?.id);
    const sent = isSentOrder(item);
    const pressHandler = () => {
      if (selectionMode) {
        toggleSelect(item?.id);
      } else {
        openOrder(item);
      }
    };

    return (
      <TouchableOpacity onPress={pressHandler} onLongPress={() => toggleSelect(item?.id)} style={styles.row}>
        {selectionMode && (
          <TouchableOpacity onPress={() => toggleSelect(item?.id)} style={styles.checkbox}>
            <Icon
              name={isSelected ? 'checkbox-outline' : 'square-outline'}
              size={20}
              color={isSelected ? '#1976d2' : '#94a3b8'}
            />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {item?.customer?.name || item?.customer?.displayName || STRINGS.customerFallback}
          </Text>
          <Text style={styles.sub}>{formatDateTime(item?.updatedAt || item?.createdAt)}</Text>
          <Text style={styles.sub}>
            {`${STRINGS.linesLabel}: ${Array.isArray(item?.lines) ? item.lines.length : 0}  |  ${STRINGS.totalLabel}: ${formatCurrency(item?.finalValue)}`}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', marginLeft: 10 }}>
          <View
            style={[
              styles.badge,
              { backgroundColor: sent ? '#e8fff0' : '#fff7e6' },
            ]}
          >
            <Text
              style={{
                color: sent ? '#059669' : '#b45309',
                fontWeight: '700',
                fontSize: 12,
              }}
            >
              {sent ? STRINGS.badgeSent : STRINGS.badgeDraft}
            </Text>
          </View>
          {!selectionMode && (
            <TouchableOpacity onPress={() => confirmDelete([item?.id])} style={styles.deleteButton}>
              <Icon name="trash-outline" size={20} color="#b91c1c" />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeScreen title={STRINGS.screenTitle} headerRight={headerRight}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'draft' && styles.tabActive]}
          onPress={() => setTab('draft')}
        >
          <Text style={[styles.tabText, tab === 'draft' && styles.tabTextActive]}>{STRINGS.tabDraft}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'sent' && styles.tabActive]}
          onPress={() => setTab('sent')}
        >
          <Text style={[styles.tabText, tab === 'sent' && styles.tabTextActive]}>{STRINGS.tabSent}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionsRow}>
        {selectionMode ? (
          <>
            <TouchableOpacity style={styles.actionButton} onPress={selectAll}>
              <Text style={styles.actionButtonText}>{STRINGS.selectAll}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => confirmDelete(Array.from(selectedIds))}>
              <Text style={[styles.actionButtonText, { color: '#b91c1c' }]}>{STRINGS.delete}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={clearSelection}>
              <Text style={styles.actionButtonText}>{STRINGS.clear}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              setSelectionActive(true);
              setSelectedIds(new Set());
            }}
          >
            <Text style={styles.actionButtonText}>{STRINGS.startSelection}</Text>
          </TouchableOpacity>
        )}
      </View>

      {selectionMode && (
        <Text style={styles.selectionHint}>
          {`${STRINGS.selectionHint}${selectedIds.size}`}
        </Text>
      )}

      <FlatList
        data={data}
        keyExtractor={(item, idx) => String(item?.id ?? idx)}
        refreshing={loading}
        onRefresh={load}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {loading ? STRINGS.loading : STRINGS.empty}
          </Text>
        }
        renderItem={renderRow}
      />
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#eef5ff',
    borderRadius: 10,
    marginTop: 10,
    overflow: 'hidden',
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  tabActive: { backgroundColor: '#e3f2fd' },
  tabText: { color: '#374151', fontWeight: '600' },
  tabTextActive: { color: '#1976d2', fontWeight: '800' },

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 12,
    gap: 12,
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#eef4ff',
  },
  actionButtonText: {
    color: '#1f4f8f',
    fontWeight: '600',
  },
  selectionHint: {
    marginTop: 8,
    marginBottom: 4,
    color: '#475569',
    fontStyle: 'italic',
  },

  sep: { height: StyleSheet.hairlineWidth, backgroundColor: '#e5e7eb' },
  row: {
    paddingVertical: 12,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    marginRight: 8,
  },
  title: { fontSize: 15, color: '#111827', fontWeight: '700' },
  sub: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  empty: { textAlign: 'center', color: '#6b7280', marginTop: 24 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  deleteButton: {
    marginTop: 10,
  },
});




