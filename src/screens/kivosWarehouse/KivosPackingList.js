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
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';

import SafeScreen from '../../components/SafeScreen';
import colors from '../../theme/colors';
import { useAuth } from '../../context/AuthProvider';

const KivosPackingList = ({ route, navigation }) => {
  const orderId = route?.params?.orderId || '';
  const { user } = useAuth() || {};

  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [packedState, setPackedState] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const coerceToArray = (value) => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') {
      const keys = Object.keys(value).filter((k) => !Number.isNaN(Number(k)));
      if (keys.length) {
        return keys
          .sort((a, b) => Number(a) - Number(b))
          .map((k) => value[k])
          .filter(Boolean);
      }
    }
    return [];
  };

  const fetchItemDescriptions = useCallback(async (orderItems = []) => {
    const descriptions = {};
    for (const item of orderItems) {
      const code = item?.productCode;
      if (!code || descriptions[code]) continue;
      try {
        const snap = await firestore()
          .collection('products_kivos')
          .doc(String(code))
          .get();
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
        console.warn('[KivosPackingList] Failed to load product', code, e);
      }
    }
    return descriptions;
  }, []);

  const loadOrder = useCallback(async () => {
    if (!orderId) {
      setError('Missing order id.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const snap = await firestore().collection('orders_kivos').doc(orderId).get();
      if (!snap.exists) {
        setError('Order not found.');
        setOrder(null);
        setItems([]);
        setPackedState({});
        return;
      }
      const data = snap.data() || {};
      const pickItems = () => {
        const sources = [
          coerceToArray(data.items),
          coerceToArray(data.lines),
          coerceToArray(data.orderItems),
        ];
        for (const source of sources) {
          if (source.length) return source;
        }
        return [];
      };

      const rawItems = pickItems();
      const normalizedItems = rawItems
        .map((item) => ({
          productCode:
            item?.productCode ||
            item?.code ||
            item?.id ||
            item?.product?.code ||
            item?.product?.productCode ||
            item?.product_code ||
            item?.productcode ||
            '',
          qty: Number(
            item?.qty ??
              item?.quantity ??
              item?.orderedQty ??
              item?.orderedQuantity ??
              0
          ),
          description:
            item?.description ||
            item?.name ||
            item?.product?.description ||
            item?.product?.name ||
            '',
        }))
        .filter((item) => item.productCode);

      const descriptionMap = await fetchItemDescriptions(normalizedItems);
      const itemsWithDescriptions = normalizedItems.map((item) => ({
        ...item,
        description: item.description || descriptionMap[item.productCode] || '',
      }));

      setOrder({ id: snap.id, ...data });
      setItems(itemsWithDescriptions);
      setPackedState(() => {
        const next = {};
        itemsWithDescriptions.forEach((item) => {
          next[item.productCode] = false;
        });
        return next;
      });
    } catch (e) {
      console.error('[KivosPackingList] Failed to load order', e);
      setError(e?.message || 'Failed to load order.');
    } finally {
      setLoading(false);
    }
  }, [fetchItemDescriptions, orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const totalItems = items.length;
  const packedItems = useMemo(
    () =>
      items.reduce(
        (count, item) => count + (packedState[item.productCode] ? 1 : 0),
        0
      ),
    [items, packedState]
  );
  const progress = totalItems ? packedItems / totalItems : 0;

  const togglePacked = useCallback((code) => {
    setPackedState((prev) => ({
      ...prev,
      [code]: !prev[code],
    }));
  }, []);

  const markAllPacked = useCallback(() => {
    setPackedState((prev) => {
      const next = { ...prev };
      items.forEach((item) => {
        next[item.productCode] = true;
      });
      return next;
    });
  }, [items]);

  const markOrderPacked = useCallback(async () => {
    if (saving) return;
    if (!packedItems) {
      Alert.alert('Δεν υπάρχουν συσκευασμένα', 'Επιλέξτε τουλάχιστον ένα είδος πριν την ολοκλήρωση.');
      return;
    }
    if (!user?.uid) {
      Alert.alert('Αποτυχία', 'Δεν βρέθηκε χρήστης. Συνδεθείτε ξανά.');
      return;
    }
    try {
      setSaving(true);
      await firestore().collection('orders_kivos').doc(orderId).update({
        status: 'packed',
        packedAt: firestore.FieldValue.serverTimestamp(),
        packedBy: user.uid,
      });
      setOrder((prev) => (prev ? { ...prev, status: 'packed' } : prev));
      Alert.alert('Η παραγγελία μαρκαρίστηκε ως συσκευασμένη', '', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (e) {
      console.error('[KivosPackingList] Failed to mark order packed', e);
      Alert.alert('Αποτυχία', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  }, [navigation, orderId, packedItems, saving, user?.uid]);

  const renderItem = ({ item }) => {
    const isPacked = !!packedState[item.productCode];
    return (
      <TouchableOpacity
        style={styles.itemRow}
        onPress={() => togglePacked(item.productCode)}
        activeOpacity={0.8}
      >
        <View style={styles.itemInfo}>
          <Text style={styles.itemCode}>{item.productCode}</Text>
          <Text style={styles.itemDescription}>
            {item.description || 'No description'}
          </Text>
          <Text style={styles.itemQty}>Qty: {item.qty || 0}</Text>
        </View>
        <View style={styles.packedToggle}>
          <Ionicons
            name={isPacked ? 'checkmark-circle' : 'ellipse-outline'}
            size={28}
            color={isPacked ? colors.success || colors.primary : colors.textSecondary}
          />
          <Text style={styles.packedLabel}>{isPacked ? 'Packed' : 'Pending'}</Text>
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

  const content = (() => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.statusText}>Loading order...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            onPress={loadOrder}
            style={[styles.primaryButton, styles.retryButton]}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonLabel}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!order) {
      return (
        <View style={styles.center}>
          <Text style={styles.statusText}>No order data.</Text>
        </View>
      );
    }

    if (!totalItems) {
      return (
        <View style={styles.center}>
          <Text style={styles.statusText}>Nothing to pack.</Text>
        </View>
      );
    }

    return (
      <>
        <View style={styles.summaryCard}>
          <Text style={styles.title}>Packing List for Order {orderId}</Text>
          <Text style={styles.subtitle}>
            Customer: {order.customerName || order.customer?.name || '-'}
          </Text>
          <Text style={styles.subtitle}>Status: {order.status || 'Pending'}</Text>
          <View style={styles.progressRow}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            <Text style={styles.progressLabel}>
              {packedItems} / {totalItems} packed
            </Text>
          </View>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={markAllPacked}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryButtonLabel}>Mark all packed</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                (!packedItems || saving) && styles.disabledButton,
              ]}
              disabled={!packedItems || saving}
              onPress={markOrderPacked}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonLabel}>
                {saving ? 'Saving...' : 'Mark Order as Packed'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={items}
          keyExtractor={(item) => item.productCode}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.listContent}
        />
      </>
    );
  })();

  return (
    <SafeScreen
      title="Packing List"
      headerLeft={headerLeft}
      style={styles.screen}
      bodyStyle={styles.body}
      contentContainerStyle={styles.content}
      scroll={false}
    >
      {content}
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
    padding: 16,
    gap: 12,
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
    gap: 12,
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
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  progressRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBar: {
    flex: 1,
    height: 10,
    borderRadius: 6,
    backgroundColor: '#e6ebf1',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  progressLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonLabel: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#e8f1fb',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonLabel: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
  retryButton: {
    paddingHorizontal: 18,
  },
  listContent: {
    paddingBottom: 16,
    gap: 10,
  },
  separator: {
    height: 10,
  },
  itemRow: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    gap: 12,
  },
  itemInfo: {
    flex: 1,
    gap: 4,
  },
  itemCode: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  itemDescription: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  itemQty: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  packedToggle: {
    alignItems: 'center',
    gap: 4,
  },
  packedLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});

export default KivosPackingList;
