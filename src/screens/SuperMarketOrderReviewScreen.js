import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOrder } from '../context/OrderContext';
import { computeOrderTotals } from '../utils/orderTotals';
import { normalizeBrandKey } from '../constants/brands';

const STRINGS = {
  title: 'Επισκόπηση Παραγγελίας SuperMarket',
  backToProducts: 'Επιστροφή στα προϊόντα',
  headerBack: 'Προϊόντα',
  toggleTitle: 'Επιλεγμένα προϊόντα',
  productsEmpty: 'Δεν υπάρχουν προϊόντα.',
  quantity: 'Ποσότητα',
  wholesale: 'Χονδρική',
  retail: 'Λιανική',
  totalsSection: 'Σύνολα',
  net: 'Καθαρή αξία',
  vat: 'ΦΠΑ 24%',
  total: 'Συνολική αξία',
  notes: 'Σημειώσεις',
  notesPlaceholder: 'Προαιρετικές σημειώσεις για την παραγγελία...',
  confirm: 'Επόμενο',
  errorTitle: 'Σφάλμα',
  errorMessage: 'Η παραγγελία πρέπει να περιέχει τουλάχιστον ένα προϊόν.',
  removeProduct: 'Αφαίρεση προϊόντος',
  stockInfo: 'Απόθεμα',
  suggestedInfo: 'Προτεινόμενη',
  srpInfo: 'Λιανική τιμή',
};

const calcSummary = (lines, brand, customer) => {
  const totals = computeOrderTotals({ lines, brand, paymentMethod: null, customer });
  const net = Number.isFinite(totals.net) ? totals.net : 0;
  const discount = 0; // SuperMarket orders have no discount
  const vat = Number.isFinite(totals.vat) ? totals.vat : 0;
  const total = Number.isFinite(totals.total) ? totals.total : net + vat;

  return {
    net,
    discount,
    vat,
    total,
  };
};

const SuperMarketOrderReviewScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);

  const {
    order,
    orderLines,
    setOrderLines,
    notes,
    setNotes,
    updateCurrentOrder,
  } = useOrder();

  const [collapsed, setCollapsed] = useState(false);
  const [keyboardPadding, setKeyboardPadding] = useState(0);

  const fromOrders = Boolean(route?.params?.fromOrders);
  const routeBrand = route?.params?.brand ?? null;
  const brandKey = order?.brand ?? routeBrand ?? null;
  const normalizedBrandKey = useMemo(() => normalizeBrandKey(brandKey), [brandKey]);
  const isSuperMarketOrder = order?.orderType === 'supermarket';

  const lines = useMemo(() => (Array.isArray(orderLines) ? orderLines : []), [orderLines]);
  const filteredLines = useMemo(
    () => lines.filter((line) => line && line.productCode && Number(line.quantity || 0) > 0),
    [lines]
  );

  const summary = useMemo(
    () => calcSummary(filteredLines, normalizedBrandKey, order?.customer),
    [filteredLines, normalizedBrandKey, order?.customer]
  );
  const { net, discount, vat, total } = summary;

  const showBackToProducts = order?.status !== 'sent';

  const goToProducts = useCallback(() => {
    if (fromOrders) {
      navigation.replace('SuperMarketProductSelection', {
        store: route?.params?.store,
        orderId: route?.params?.orderId,
        brand: brandKey ?? null,
        fromReview: true,
        fromOrders: true,
      });
    } else {
      navigation.navigate('SuperMarketProductSelection', { 
        store: route?.params?.store,
        orderId: route?.params?.orderId,
        brand: brandKey ?? null, 
        fromReview: true 
      });
    }
  }, [brandKey, fromOrders, navigation, route?.params]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (event) => {
      const height = event?.endCoordinates?.height || 0;
      setKeyboardPadding(height);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      });
    });

    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardPadding(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    navigation.setOptions({ title: STRINGS.title });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      if (!fromOrders) return undefined;

      navigation.setOptions({
        headerLeft: () => (
          <TouchableOpacity style={styles.headerBackButton} onPress={goToProducts}>
            <Ionicons name="arrow-back" size={20} color="#1f4f8f" />
            <Text style={styles.headerBackText}>{STRINGS.headerBack}</Text>
          </TouchableOpacity>
        ),
      });

      return () => {
        navigation.setOptions({ headerLeft: undefined });
      };
    }, [fromOrders, goToProducts, navigation])
  );

  const adjustQuantity = useCallback(
    (productCode, delta) => {
      setOrderLines((prev = []) => {
        const base = Array.isArray(prev) ? prev : [];
        return base.map((line) => {
          if (line?.productCode === productCode) {
            const currentQty = Number(line.quantity || 0);
            const newQty = Math.max(0, currentQty + delta);
            return { ...line, quantity: newQty };
          }
          return line;
        }).filter(line => Number(line?.quantity || 0) > 0);
      });
    },
    [setOrderLines]
  );

  const changeQuantity = useCallback(
    (productCode, value) => {
      const parsed = Math.max(0, parseInt(String(value).replace(/[^0-9]/g, ''), 10) || 0);
      setOrderLines((prev = []) => {
        const base = Array.isArray(prev) ? prev : [];
        return base.map((line) => {
          if (line?.productCode === productCode) {
            return { ...line, quantity: parsed };
          }
          return line;
        }).filter(line => Number(line?.quantity || 0) > 0);
      });
    },
    [setOrderLines]
  );

  const removeLine = useCallback(
    (productCode) => {
      setOrderLines((prev = []) => {
        const base = Array.isArray(prev) ? prev : [];
        return base.filter((line) => line?.productCode !== productCode);
      });
    },
    [setOrderLines]
  );

  const handleConfirm = useCallback(() => {
    if (!filteredLines.length) {
      Alert.alert(STRINGS.errorTitle, STRINGS.errorMessage);
      return;
    }

    updateCurrentOrder({
      paymentMethod: null, // SuperMarket orders have no payment method
      paymentMethodLabel: null,
      notes,
      deliveryInfo: '', // SuperMarket orders have no delivery info
      netValue: net,
      discount: 0, // SuperMarket orders have no discount
      vat,
      finalValue: total,
    });

    navigation.navigate('SuperMarketOrderSummary', {
      store: route?.params?.store,
      orderId: route?.params?.orderId,
      brand: brandKey,
    });
  }, [
    filteredLines.length,
    navigation,
    net,
    notes,
    total,
    updateCurrentOrder,
    vat,
    route?.params,
    brandKey,
  ]);

  const renderProductRow = useCallback(
    ({ item: line }) => {
      const stockLevel = line.currentStock || 0;
      const stockColor = stockLevel > 10 ? '#10b981' : stockLevel > 0 ? '#f59e0b' : '#ef4444';
      
      return (
        <View style={styles.productRow}>
          <View style={styles.productImageContainer}>
            {line.photoUrl ? (
              <Image source={{ uri: line.photoUrl }} style={styles.productImage} />
            ) : (
              <View style={styles.productImagePlaceholder}>
                <Ionicons name="image-outline" size={24} color="#9ca3af" />
              </View>
            )}
          </View>
          
          <View style={styles.productInfo}>
            <Text style={styles.productCode}>{line.productCode}</Text>
            <Text style={styles.productDescription} numberOfLines={2}>
              {line.description}
            </Text>
            
            <View style={styles.productDetails}>
              <View style={styles.stockContainer}>
                <View style={[styles.stockIndicator, { backgroundColor: stockColor }]} />
                <Text style={styles.stockText}>
                  {STRINGS.stockInfo}: {stockLevel} τεμ.
                </Text>
              </View>
              
              {line.suggestedQty > 0 && (
                <Text style={styles.suggestedText}>
                  {STRINGS.suggestedInfo}: {line.suggestedQty} τεμ.
                </Text>
              )}
              
              {line.isNew && (
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>ΝΕΟ</Text>
                </View>
              )}
            </View>
            
            <View style={styles.priceRow}>
              <Text style={styles.priceText}>
                Τιμή: €{line.price?.toFixed(2) || '0.00'}
              </Text>
              {line.srp && (
                <Text style={styles.srpText}>
                  {STRINGS.srpInfo}: €{line.srp}
                </Text>
              )}
            </View>
          </View>
          
          <View style={styles.quantityContainer}>
            <TouchableOpacity
              style={styles.qtyButton}
              onPress={() => adjustQuantity(line.productCode, -1)}
              disabled={Number(line.quantity || 0) <= 0}
            >
              <Ionicons name="remove" size={16} color={Number(line.quantity || 0) > 0 ? "#374151" : "#9ca3af"} />
            </TouchableOpacity>
            
            <TextInput
              style={styles.qtyInput}
              value={String(line.quantity || 0)}
              onChangeText={(text) => changeQuantity(line.productCode, text)}
              keyboardType="numeric"
              selectTextOnFocus
            />
            
            <TouchableOpacity
              style={styles.qtyButton}
              onPress={() => adjustQuantity(line.productCode, 1)}
            >
              <Ionicons name="add" size={16} color="#374151" />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => removeLine(line.productCode)}
          >
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
      );
    },
    [adjustQuantity, changeQuantity, removeLine]
  );

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: keyboardPadding + 100 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Store Information */}
          <View style={styles.storeInfoSection}>
            <Text style={styles.sectionTitle}>Πληροφορίες Καταστήματος</Text>
            <View style={styles.storeInfoCard}>
              <Text style={styles.storeName}>{order?.storeName || order?.customer?.name}</Text>
              <Text style={styles.storeCode}>Κωδικός: {order?.storeCode || order?.customer?.customerCode}</Text>
              <Text style={styles.storeCategory}>Κατηγορία: {order?.storeCategory || order?.customer?.storeCategory}</Text>
              {order?.companyName && (
                <Text style={styles.companyName}>Εταιρεία: {order.companyName}</Text>
              )}
            </View>
          </View>

          {/* Products Section */}
          <View style={styles.productsSection}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setCollapsed(!collapsed)}
              activeOpacity={0.7}
            >
              <Text style={styles.sectionTitle}>{STRINGS.toggleTitle}</Text>
              <View style={styles.sectionHeaderRight}>
                <Text style={styles.productCount}>{filteredLines.length} προϊόντα</Text>
                <Ionicons
                  name={collapsed ? 'chevron-down' : 'chevron-up'}
                  size={20}
                  color="#6b7280"
                />
              </View>
            </TouchableOpacity>

            {!collapsed && (
              <>
                {filteredLines.length === 0 ? (
                  <View style={styles.emptyProducts}>
                    <Text style={styles.emptyProductsText}>{STRINGS.productsEmpty}</Text>
                    {showBackToProducts && (
                      <TouchableOpacity style={styles.backToProductsButton} onPress={goToProducts}>
                        <Text style={styles.backToProductsText}>{STRINGS.backToProducts}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <View style={styles.productsList}>
                    {filteredLines.map((line, index) => (
                      <View key={`${line.productCode}-${index}`}>
                        {renderProductRow({ item: line })}
                        {index < filteredLines.length - 1 && <View style={styles.productSeparator} />}
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>

          {/* Totals Section */}
          <View style={styles.totalsSection}>
            <Text style={styles.sectionTitle}>{STRINGS.totalsSection}</Text>
            <View style={styles.totalsCard}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{STRINGS.net}</Text>
                <Text style={styles.totalValue}>€{net.toFixed(2)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{STRINGS.vat}</Text>
                <Text style={styles.totalValue}>€{vat.toFixed(2)}</Text>
              </View>
              <View style={[styles.totalRow, styles.finalTotalRow]}>
                <Text style={styles.finalTotalLabel}>{STRINGS.total}</Text>
                <Text style={styles.finalTotalValue}>€{total.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {/* Notes Section */}
          <View style={styles.notesSection}>
            <Text style={styles.sectionTitle}>{STRINGS.notes}</Text>
            <TextInput
              style={styles.notesInput}
              multiline
              value={notes}
              onChangeText={setNotes}
              placeholder={STRINGS.notesPlaceholder}
              placeholderTextColor="#9aa4b2"
              textAlignVertical="top"
            />
          </View>
        </ScrollView>

        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 16 + keyboardPadding }]}
          onPress={handleConfirm}
          activeOpacity={0.9}
          disabled={filteredLines.length === 0}
        >
          <Text style={[styles.fabText, filteredLines.length === 0 && styles.fabTextDisabled]}>
            {STRINGS.confirm}
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  headerBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerBackText: {
    marginLeft: 4,
    fontSize: 16,
    color: '#1f4f8f',
  },
  storeInfoSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  storeInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#1f2937',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  storeCode: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  storeCategory: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  companyName: {
    fontSize: 14,
    color: '#6b7280',
  },
  productsSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#1f2937',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productCount: {
    fontSize: 14,
    color: '#6b7280',
    marginRight: 8,
  },
  emptyProducts: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#1f2937',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  emptyProductsText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  backToProductsButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backToProductsText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  productsList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#1f2937',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  productImageContainer: {
    width: 60,
    height: 60,
    marginRight: 12,
  },
  productImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  productImagePlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: {
    flex: 1,
    marginRight: 12,
  },
  productCode: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  productDescription: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
    lineHeight: 18,
  },
  productDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
  },
  stockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  stockIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  stockText: {
    fontSize: 12,
    color: '#6b7280',
  },
  suggestedText: {
    fontSize: 12,
    color: '#10b981',
    marginRight: 8,
  },
  newBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '700',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  priceText: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '600',
    marginRight: 12,
  },
  srpText: {
    fontSize: 12,
    color: '#6b7280',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyInput: {
    width: 50,
    height: 32,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productSeparator: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginHorizontal: 16,
  },
  totalsSection: {
    marginBottom: 24,
  },
  totalsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#1f2937',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  finalTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
    marginTop: 8,
    marginBottom: 0,
  },
  finalTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  finalTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1976d2',
  },
  notesSection: {
    marginBottom: 24,
  },
  notesInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: '#0f172a',
    minHeight: 80,
    textAlignVertical: 'top',
    shadowColor: '#1f2937',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  fab: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#1976d2',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#1f2937',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fabText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  fabTextDisabled: {
    color: '#9ca3af',
  },
});

export default SuperMarketOrderReviewScreen;


