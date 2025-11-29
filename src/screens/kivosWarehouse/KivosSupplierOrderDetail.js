import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
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

const KivosSupplierOrderDetail = ({ route, navigation }) => {
  const supplierOrderId = route?.params?.supplierOrderId || '';

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

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
        return;
      }
      setOrder({ id: snap.id, ...(snap.data() || {}) });
    } catch (e) {
      console.error('[KivosSupplierOrderDetail] Failed to load supplier order', e);
      setError(e?.message || 'Failed to load supplier order.');
    } finally {
      setLoading(false);
    }
  }, [supplierOrderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const createdAt =
    typeof order?.createdAt?.toDate === 'function'
      ? order.createdAt.toDate()
      : order?.createdAt
      ? new Date(order.createdAt)
      : null;

  const items = Array.isArray(order?.items) ? order.items : [];
  const sourceOrders = Array.isArray(order?.sourceOrders)
    ? order.sourceOrders
    : [];

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

  const renderItem = ({ item }) => (
    <View style={styles.itemRow}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemCode}>{item.productCode}</Text>
        <Text style={styles.itemDescription}>{item.description || '-'}</Text>
      </View>
      <Text style={styles.itemQty}>{Number(item.totalQty || 0)}</Text>
    </View>
  );

  return (
    <SafeScreen
      title="Supplier Order Detail"
      headerLeft={headerLeft}
      style={styles.screen}
      bodyStyle={styles.body}
      contentContainerStyle={styles.content}
      scroll={false}
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.statusText}>Loading supplier order...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : order ? (
        <>
          <View style={styles.card}>
            <Text style={styles.title}>ID: {order.id}</Text>
            <Text style={styles.subtitle}>Supplier: {order.supplierName || 'Supplier'}</Text>
            <Text style={styles.subtitle}>Status: {order.status || 'draft'}</Text>
            <Text style={styles.subtitle}>
              Created: {createdAt ? createdAt.toLocaleString() : '-'}
            </Text>
            <Text style={styles.subtitle}>Created by: {order.createdBy || '-'}</Text>
            <Text style={styles.subtitle}>
              Items: {items.length} | Source orders: {sourceOrders.length}
            </Text>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Source Orders</Text>
              {sourceOrders.length ? (
                sourceOrders.map((src) => (
                  <Text key={src} style={styles.sectionText}>
                    {src}
                  </Text>
                ))
              ) : (
                <Text style={styles.sectionText}>No source orders listed.</Text>
              )}
            </View>
          </View>

          <View style={[styles.section, styles.itemsSection]}>
            <Text style={styles.sectionTitle}>Items</Text>
            {items.length ? (
              <FlatList
                data={items}
                keyExtractor={(item, index) => `${item.productCode || index}-${index}`}
                renderItem={renderItem}
                ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
                style={styles.itemsList}
                contentContainerStyle={styles.itemsContent}
              />
            ) : (
              <Text style={styles.sectionText}>No items.</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, styles.stickyButton]}
            onPress={() =>
              navigation.navigate('KivosSupplierOrderReview', {
                supplierOrderId,
              })
            }
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonLabel}>Review & Edit</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.center}>
          <Text style={styles.statusText}>No supplier order found.</Text>
        </View>
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
    padding: 16,
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
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
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
  section: {
    marginTop: 12,
    gap: 6,
  },
  itemsSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sectionText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  itemsList: {
    flex: 1,
  },
  itemsContent: {
    paddingBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  itemInfo: {
    flex: 1,
    marginRight: 10,
  },
  itemCode: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  itemDescription: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  itemQty: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  itemSeparator: {
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  primaryButton: {
    marginTop: 14,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  stickyButton: {
    marginBottom: 8,
  },
  primaryButtonLabel: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default KivosSupplierOrderDetail;
