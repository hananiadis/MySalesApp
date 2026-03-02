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
          supplierBrand:
            item?.supplierBrand ||
            item?.brand ||
            item?.supplier ||
            item?.supplier_brand ||
            '',
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
  const packedCount = useMemo(
    () =>
      items.reduce(
        (count, item) => count + (packedState[item.productCode] ? 1 : 0),
        0
      ),
    [items, packedState]
  );
  const progress = totalItems ? packedCount / totalItems : 0;

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
    if (!packedCount) {
      Alert.alert(
        'Δεν έχουν επιλεγεί είδη',
        'Παρακαλώ επιλέξτε τουλάχιστον ένα είδος για συσκευασία.'
      );
      return;
    }
    if (!user?.uid) {
      Alert.alert('Σφάλμα', 'Δεν βρέθηκε χρήστης. Παρακαλώ συνδεθείτε ξανά.');
      return;
    }
    try {
      setSaving(true);
      console.log('[KivosPackingList] markOrderPacked start', { orderId, packedCount });

      const packedItemsPayload = items
        .map((item) => {
          const packedValue = packedState[item.productCode];
          const candidatePackedQty =
            typeof packedValue === 'number' && !Number.isNaN(packedValue)
              ? packedValue
              : packedValue
              ? Number(item.qty ?? 0)
              : 0;
          const packedQty = Math.max(0, Math.min(Number(item.qty ?? 0), Number(candidatePackedQty) || 0));
          return {
            productCode: item.productCode,
            description: item.description || '',
            qty: packedQty,
            quantity: packedQty,
            wholesalePrice: Number(
              item.wholesalePrice ??
                item.price ??
                item.unitPrice ??
                item.netPrice ??
                0
            ),
            supplierBrand:
              item.supplierBrand ||
              item.brand ||
              item.supplier ||
              item.supplier_brand ||
              '',
          };
        })
        .filter((entry) => entry.qty > 0);

      const orderRef = firestore().collection('orders_kivos').doc(orderId);
      const orderSnap = await orderRef.get();
      if (!orderSnap.exists) {
        throw new Error('Order not found.');
      }
      const orderData = orderSnap.data() || {};
      const pickItems = () => {
        const sources = [
          coerceToArray(orderData.items),
          coerceToArray(orderData.lines),
          coerceToArray(orderData.orderItems),
        ];
        for (const source of sources) {
          if (source.length) return source;
        }
        return [];
      };

      const rawOrderItems = pickItems();
      const normalizedOrderItems = (rawOrderItems.length ? rawOrderItems : items)
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
              item?.originalQty ??
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

      console.log('[KivosPackingList] packedItemsPayload', packedItemsPayload);
      console.log('[KivosPackingList] normalizedOrderItems', normalizedOrderItems);

      const remainingItems = normalizedOrderItems
        .map((item) => {
          const packed = packedItemsPayload.find(
            (p) => p.productCode === item.productCode
          );
          const originalQty = Number(item.qty ?? 0);
          const packedQty = Math.min(packed?.qty ?? 0, originalQty);
          const remainingQty = originalQty - packedQty;
          return {
            productCode: item.productCode,
            qty: remainingQty,
            quantity: remainingQty,
            description: item.description || '',
            wholesalePrice:
              packed?.wholesalePrice ??
              Number(
                item.wholesalePrice ??
                  item.price ??
                  item.unitPrice ??
                  item.netPrice ??
                  0
              ),
            supplierBrand:
              item.supplierBrand ||
              item.brand ||
              item.supplier ||
              item.supplier_brand ||
              '',
          };
        })
        .filter((i) => i.qty > 0);

      console.log('[KivosPackingList] remainingItems', remainingItems);

      await orderRef.update({
        status: 'packed',
        packedAt: firestore.FieldValue.serverTimestamp(),
        packedBy: user.uid,
        items: packedItemsPayload,
        lines: packedItemsPayload,
        orderItems: packedItemsPayload,
      });

      let backorderId = null;
      if (remainingItems.length > 0) {
        const backorderPayload = {
          status: 'backorder',
          parentOrderId: orderId,
          parentOrderNumber: orderData.number || orderData.orderId || orderId,
          createdAt: new Date().toISOString(),
          createdBy: user.uid,
          items: remainingItems,
          brand: orderData.brand || 'kivos',
          channel: orderData.channel,
          customer: orderData.customer || null,
          customerName:
            orderData.customerName ||
            orderData.customer?.name ||
            orderData.customer?.displayName ||
            '',
          customerCode:
            orderData.customer?.customerCode ||
            orderData.customerCode ||
            orderData.customer?.code ||
            '',
          customerId:
            orderData.customer?.id ||
            orderData.customerId ||
            orderData.customer_id ||
            orderData.customerCode ||
            '',
          contact: orderData.contact || orderData.customer?.contact || null,
          address: orderData.address || orderData.customer?.address || null,
          deliveryInfo: orderData.deliveryInfo || null,
          paymentMethod: orderData.paymentMethod || null,
          paymentMethodLabel: orderData.paymentMethodLabel || null,
          exported: false,
        };

        console.log('[KivosPackingList] creating backorder doc', backorderPayload);
        try {
          const backorderRef = await firestore()
            .collection('orders_kivos')
            .add(backorderPayload);
          backorderId = backorderRef.id;
          console.log('[KivosPackingList] backorder created', backorderId);
        } catch (backorderErr) {
          console.error('[KivosPackingList] Failed to create backorder', backorderErr);
          throw new Error(backorderErr?.message || 'Failed to create backorder');
        }
      } else {
        console.log('[KivosPackingList] no remaining items, skipping backorder');
      }

      setOrder((prev) =>
        prev
          ? {
              ...prev,
              status: 'packed',
              packedAt: new Date(),
              items: packedItemsPayload,
              lines: packedItemsPayload,
              orderItems: packedItemsPayload,
            }
          : prev
      );

      const result = {
        success: true,
        backorderCreated: !!backorderId,
        backorderId: backorderId || null,
      };

      const message = backorderId
        ? `Δημιουργήθηκε backorder για τα μη συσκευασμένα είδη (ID: ${backorderId}).`
        : 'Η παραγγελία μαρκαρίστηκε ως συσκευασμένη.';
      Alert.alert('Παραγγελία ενημερώθηκε', message, [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
      return result;
    } catch (e) {
      console.error('[KivosPackingList] Failed to mark order packed', e);
      Alert.alert('Σφάλμα', e?.message || 'Please try again.');
      return { success: false, error: e?.message };
    } finally {
      setSaving(false);
    }
  }, [items, navigation, orderId, packedCount, packedState, saving, user?.uid]);

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
              {packedCount} / {totalItems} packed
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
                (!packedCount || saving) && styles.disabledButton,
              ]}
              disabled={!packedCount || saving}
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
