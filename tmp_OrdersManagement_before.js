// src/screens/OrdersManagement.js
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getOrders, deleteOrder, deleteMany } from '../utils/localOrders';
import { useOrder } from '../context/OrderContext';
import { useOnlineStatus } from '../utils/OnlineStatusContext';

function calcTotals(o) {
  const lines = Array.isArray(o?.lines) ? o.lines : [];
  const net = lines.reduce(
    (s, l) => s + Number(l.wholesalePrice || 0) * Number(l.quantity || 0),
    0
  );
  const discount = o?.paymentMethod === 'prepaid_cash' ? +(net * 0.03).toFixed(2) : 0;
  const vat = +((net - discount) * 0.24).toFixed(2);
  const total = +(net - discount + vat).toFixed(2);
  return { net, discount, vat, total };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const formatId = (id) => {
  if (!id) return '-';
  const s = String(id);
  if (s.length <= 10) return s;
  return `${s.slice(0, 4)}...${s.slice(-4)}`;
};

export default function OrdersManagement() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const online = useOnlineStatus();
  const { loadOrder } = useOrder();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const purgeEmptyDrafts = useCallback(async (list) => {
    const toKeep = [];
    const toDeleteIds = [];
    list.forEach((o) => {
      const lines = Array.isArray(o?.lines) ? o.lines : [];
      const hasQty = lines.some((l) => Number(l.quantity || 0) > 0);
      const hasNotes = !!(o?.notes && String(o.notes).trim().length > 0);
      const hasCustomer = !!o?.customer;
      const isSent = o?.status === 'sent' || o?.sent === true || !!o?.exportedAt;
      if (!isSent && !hasCustomer && !hasQty && !hasNotes) {
        if (o?.id) toDeleteIds.push(o.id);
      } else {
        toKeep.push(o);
      }
    });
    await Promise.all(toDeleteIds.map((id) => deleteOrder(id)));
    return toKeep;
  }, []);

  const loadLocal = useCallback(async () => {
    setLoading(true);
    try {
      const all = Array.isArray(await getOrders()) ? await getOrders() : [];
      const cleaned = await purgeEmptyDrafts(all);
      cleaned.sort(
        (a, b) =>
          new Date(b?.updatedAt || b?.createdAt || 0) -
          new Date(a?.updatedAt || a?.createdAt || 0)
      );
      setOrders(cleaned);
    } catch (e) {
      console.warn('OrdersManagement load error', e);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [purgeEmptyDrafts]);

  useEffect(() => {
    (async () => {
      await loadLocal();
    })();
  }, [loadLocal]);

  const [selected, setSelected] = useState(() => new Set());
  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelected(new Set(orders.map((o) => o.id)));
  const clearSelection = () => setSelected(new Set());

  const removeFromState = useCallback((idsToRemove) => {
    setOrders((prev) => prev.filter((o) => !idsToRemove.has(o.id)));
    setSelected((prev) => {
      const next = new Set(prev);
      idsToRemove.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  // Clean Greek single-delete dialog (hardware back cancels)
  const confirmDeleteOneClean = (id) => {
    Alert.alert(
      '??a??af? pa?a??e??a?',
      '?a d?a??afe? ap? t? s?s?e??;',
      [
        { text: '?????s?', style: 'cancel' },
        {
          text: '??a??af?',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteOrder(id);
              removeFromState(new Set([id]));
            } catch (e) {
              Alert.alert('Sf??�a', '? d?a??af? ap?t??e. ????�?ste ?a??.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  // Clean Greek delete-selected dialog
  const deleteSelectedClean = () => {
    if (selected.size === 0) {
      Alert.alert('?????f???a', '?e? ????? ep??e?e? pa?a??e??e?.');
      return;
    }
    Alert.alert(
      '??a??af? ep??e?�????',
      `?a d?a??af??? ${selected.size} pa?a??e??e? ap? t? s?s?e??;`,
      [
        { text: '?????s?', style: 'cancel' },
        {
          text: '??a??af?',
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all([...selected].map((id) => deleteOrder(id)));
              removeFromState(new Set(selected));
              Alert.alert('???????????e', '?? ep??e?�??e? pa?a??e??e? d?a???f??a? ap? t? s?s?e??.');
            } catch (e) {
              Alert.alert('Sf??�a', '? d?a??af? ap?t??e. ????�?ste ?a??.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const confirmDeleteOne = (id) => {
    Alert.alert('Διαγραφή παραγγελίας', 'Να διαγραφεί από την συσκευή;', [
      { text: 'Ακύρωση', style: 'cancel' },
      {
        text: 'Διαγραφή',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteOrder(id);
            removeFromState(new Set([id]));
          } catch (e) {
            Alert.alert('Σφάλμα', 'Η διαγραφή απέτυχε. Δοκιμάστε ξανά.');
          }
        },
      },
    ]);
  };

  const deleteSelected = () => {
    if (selected.size === 0) {
      Alert.alert('Πληροφορία', 'Δεν έχουν επιλεγεί παραγγελίες.');
      return;
    }
    Alert.alert(
      'Διαγραφή επιλεγμένων',
      `Να διαγραφούν ${selected.size} παραγγελίες από την συσκευή;`,
      [
        { text: 'Ακύρωση', style: 'cancel' },
        {
          text: 'Διαγραφή',
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all([...selected].map((id) => deleteOrder(id)));
              removeFromState(new Set(selected));
              Alert.alert('Ολοκληρώθηκε', 'Οι επιλεγμένες παραγγελίες διαγράφηκαν από την συσκευή.');
            } catch (e) {
              Alert.alert('Σφάλμα', 'Η διαγραφή απέτυχε. Δοκιμάστε ξανά.');
            }
          },
        },
      ]
    );
  };

  const deleteAll = () => {
    if (orders.length === 0) {
      Alert.alert('Πληροφορία', 'Δεν υπάρχουν παραγγελίες για διαγραφή.');
      return;
    }
    Alert.alert('Διαγραφή όλων', 'Να διαγραφούν όλες οι παραγγελίες από την συσκευή;', [
      { text: 'Ακύρωση', style: 'cancel' },
      {
        text: 'Διαγραφή όλων',
        style: 'destructive',
        onPress: async () => {
          try {
            const ids = new Set(orders.map((o) => o.id));
            await Promise.all([...ids].map((id) => deleteOrder(id)));
            removeFromState(ids);
            clearSelection();
            Alert.alert('Ολοκληρώθηκε', 'Όλες οι παραγγελίες διαγράφηκαν από την συσκευή.');
          } catch (e) {
            Alert.alert('Σφάλμα', 'Η διαγραφή απέτυχε. Δοκιμάστε ξανά.');
          }
        },
      },
    ]);
  };

  const renderStatusChip = (o) => {
            <Text style={styles.iconText}>?pe?e??as?a</Text>
    return (
      <View style={[styles.chip, isSent ? styles.chipSent : styles.chipDraft]}>
        <Ionicons
          name={isSent ? 'checkmark-done-outline' : 'create-outline'}
          size={14}
          style={{ marginRight: 4 }}
        />
        <Text style={styles.chipText}>{isSent ? 'St?????e' : '????e???'}</Text>
            <Text style={[styles.iconText, { color: '#E53935' }]}>??a??af?</Text>
    );
  };

  const renderItem = ({ item }) => {
    const { total } = calcTotals(item);
    const isSentCard = item?.sent === true || item?.status === 'sent' || !!item?.exportedAt;

    return (
      <View style={[styles.card, isSentCard && styles.sentCard]}>
        <Text style={{ marginTop: 8 }}>F??t?s? pa?a??e????�</Text>
          <TouchableOpacity onPress={() => toggleSelect(item.id)} style={styles.checkbox}>
            <Ionicons
              name={selected.has(item.id) ? 'checkbox-outline' : 'square-outline'}
              size={22}
              color={selected.has(item.id) ? '#007AFF' : '#888'}
            />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.orderTitle}>
              {item?.customer?.name || '????? pe??t?'}{' '}
            </Text>
            <Text style={styles.detailText}>
              #{item?.number || formatId(item?.id)} � {new Date(item?.updatedAt || item?.createdAt || Date.now()).toLocaleString()}
            </Text>
          </View>

          <Text style={styles.totalText}>�{total.toFixed(2)}</Text>
        </View>

        <View style={styles.rowChips}>
          {renderStatusChip(item)}
        </View>

        <View style={styles.rowActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => {
              loadOrder(item);
              navigation.navigate('OrderReviewScreen');
            }}
          >
            <Ionicons name="create-outline" size={20} color="#007AFF" />
            <Text style={styles.iconText}>?pe?e??as?a</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconBtn, styles.trashBtn]}
            onPress={() => confirmDeleteOneClean(item.id)}
          >
            <Ionicons name="trash-outline" size={20} color="#E53935" />
            <Text style={[styles.iconText, { color: '#E53935' }]}>??a??af?</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>Φόρτωση παραγγελιών…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header with title, then action row underneath */}
      <View style={styles.header}>
      {/* Header with title, then action row underneath */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>??a?e???s? ?a?a??e????</Text>

        <View style={styles.headerActionsRow}>
          <TouchableOpacity style={styles.toolbarBtn} onPress={selectAll}>
            <Ionicons name="checkmark-done-outline" size={18} />
            <Text style={styles.toolbarBtnText}>?p????? ????</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.toolbarBtn} onPress={deleteSelectedClean}>
            <Ionicons name="trash-outline" size={18} />
            <Text style={styles.toolbarBtnText}>??a??af?</Text>
          </TouchableOpacity>
        </View>
      </View>

      {orders.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: '#666' }}>?e? ?p?????? pa?a??e??e?.</Text>
          <Text style={{ color: '#666' }}>?e? ?p?????? pa?a??e??e?.</Text>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  header: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: '#F4F6F8',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    paddingTop: 8,
    paddingBottom: 6,
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  toolbarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  toolbarBtnText: { marginLeft: 6, fontSize: 13, color: '#111827' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  sentCard: {
    borderColor: '#22C55E',
    backgroundColor: '#F0FFF4',
  },

  checkbox: { marginRight: 10 },

  orderTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  detailText: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  totalText: { fontSize: 16, fontWeight: '700', color: '#111827', marginLeft: 8 },

  rowChips: { flexDirection: 'row', marginTop: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginRight: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontSize: 12, fontWeight: '600' },
  chipDraft: { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' },
  chipSent: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },

  rowActions: {
    flexDirection: 'row',
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
  },
  iconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  iconText: { marginLeft: 6, color: '#111827', fontSize: 13 },
  trashBtn: { borderColor: '#FECACA', backgroundColor: '#FFF1F2' },
});



















