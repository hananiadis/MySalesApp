// src/screens/SuperMarketOrderReviewScreen.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { fetchSuperMarketListings } from '../services/supermarketData';
import { getStoreInventory } from '../services/supermarketInventory';

const STRINGS = {
  title: '\u0395\u03c0\u03b9\u03c3\u03ba\u03cc\u03c0\u03b7\u03c3\u03b7 \u03a0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03af\u03b1\u03c2 SuperMarket',
  backToProducts: '\u0395\u03c0\u03b9\u03c3\u03c4\u03c1\u03bf\u03c6\u03ae \u03c3\u03c4\u03b1 \u03c0\u03c1\u03bf\u03ca\u03cc\u03bd\u03c4\u03b1',
  headerBack: '\u03a0\u03c1\u03bf\u03ca\u03cc\u03bd\u03c4\u03b1',
  toggleTitle: '\u0395\u03c0\u03b9\u03bb\u03b5\u03b3\u03bc\u03ad\u03bd\u03b1 \u03c0\u03c1\u03bf\u03ca\u03cc\u03bd\u03c4\u03b1',
  productsEmpty: '\u0394\u03b5\u03bd \u03c5\u03c0\u03ac\u03c1\u03c7\u03bf\u03c5\u03bd \u03c0\u03c1\u03bf\u03ca\u03cc\u03bd\u03c4\u03b1.',
  quantity: '\u03a0\u03bf\u03c3\u03cc\u03c4\u03b7\u03c4\u03b1',
  wholesale: '\u03a7\u03bf\u03bd\u03b4\u03c1\u03b9\u03ba\u03ae',
  retail: '\u039b\u03b9\u03b1\u03bd\u03b9\u03ba\u03ae',
  totalsSection: '\u03a3\u03cd\u03bd\u03bf\u03bb\u03b1',
  net: '\u039a\u03b1\u03b8\u03b1\u03c1\u03ae \u03b1\u03be\u03af\u03b1',
  vat: '\u03a6\u03a0\u0391 24%',
  total: '\u03a3\u03c5\u03bd\u03bf\u03bb\u03b9\u03ba\u03ae \u03b1\u03be\u03af\u03b1',
  notes: '\u03a3\u03b7\u03bc\u03b5\u03b9\u03ce\u03c3\u03b5\u03b9\u03c2',
  notesPlaceholder: '\u03a0\u03c1\u03bf\u03c3\u03b8\u03ad\u03c3\u03c4\u03b5 \u03c3\u03b7\u03bc\u03b5\u03b9\u03ce\u03c3\u03b5\u03b9\u03c2 \u03b3\u03b9\u03b1 \u03c4\u03b7\u03bd \u03c0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03af\u03b1...',
  confirm: '\u0395\u03c0\u03cc\u03bc\u03b5\u03bd\u03bf',
  loading: '\u0393\u03af\u03bd\u03b5\u03c4\u03b1\u03b9 \u03c0\u03c1\u03bf\u03b5\u03c4\u03bf\u03b9\u03bc\u03b1\u03c3\u03af\u03b1...',
  errorTitle: '\u03a3\u03c6\u03ac\u03bb\u03bc\u03b1',
  errorMessage: '\u0397 \u03c0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03af\u03b1 \u03c0\u03c1\u03ad\u03c0\u03b5\u03b9 \u03bd\u03b1 \u03c0\u03b5\u03c1\u03b9\u03ad\u03c7\u03b5\u03b9 \u03c4\u03bf\u03c5\u03bb\u03ac\u03c7\u03b9\u03c3\u03c4\u03bf\u03bd \u03ad\u03bd\u03b1 \u03c0\u03c1\u03bf\u03ca\u03cc\u03bd.',
  removeProduct: '\u0391\u03c6\u03b1\u03af\u03c1\u03b5\u03c3\u03b7 \u03c0\u03c1\u03bf\u03ca\u03cc\u03bd\u03c4\u03bf\u03c2',
  stockInfo: '\u0391\u03c0\u03cc\u03b8\u03b5\u03bc\u03b1',
  suggestedInfo: '\u03a0\u03c1\u03bf\u03c4\u03b5\u03b9\u03bd\u03cc\u03bc\u03b5\u03bd\u03b7',
  srpInfo: '\u039b\u03b9\u03b1\u03bd\u03b9\u03ba\u03ae \u03c4\u03b9\u03bc\u03ae',
  packagingLabel: '\u03a3\u03c5\u03c3\u03ba\u03b5\u03c5\u03b1\u03c3\u03af\u03b1',
  unitsSuffix: '\u0020\u03c4\u03b5\u03bc.',
  storeInfoTitle: '\u03a3\u03c4\u03bf\u03b9\u03c7\u03b5\u03af\u03b1 \u03ba\u03b1\u03c4\u03b1\u03c3\u03c4\u03ae\u03bc\u03b1\u03c4\u03bf\u03c2',
  toysCategoryLabel: '\u039a\u03b1\u03c4\u03b7\u03b3. \u03c0\u03b1\u03b9\u03c7\u03bd\u03b9\u03b4\u03b9\u03ce\u03bd',
  summerCategoryLabel: '\u039a\u03b1\u03c4\u03b7\u03b3. \u03b5\u03c0\u03bf\u03c7\u03b9\u03ba\u03ce\u03bd',
  companyLabel: '\u0395\u03c0\u03c9\u03bd\u03c5\u03bc\u03af\u03b1',
  productCountSuffix: '\u0020\u03c0\u03c1\u03bf\u03ca\u03cc\u03bd\u03c4\u03b1',
  newBadge: '\u039d\u0395\u039f',
  listingsErrorTitle: '\u03a3\u03c6\u03ac\u03bb\u03bc\u03b1',
  listingsErrorMessage: '\u0397 \u03b5\u03bd\u03b7\u03bc\u03ad\u03c1\u03c9\u03c3\u03b7 \u03c4\u03b7\u03c2 \u03bb\u03af\u03c3\u03c4\u03b1\u03c2 \u03b1\u03c0\u03ad\u03c4\u03c5\u03c7\u03b5. \u03a0\u03c1\u03bf\u03c3\u03c0\u03b1\u03b8\u03ae\u03c3\u03c4\u03b5 \u03be\u03b1\u03bd\u03ac.',
  quickNavLabel: '\u0395\u03c0\u03b9\u03c3\u03c4\u03c1\u03bf\u03c6\u03ae \u03c3\u03c4\u03b7\u03bd \u03b5\u03c0\u03b9\u03bb\u03bf\u03b3\u03ae \u03c0\u03c1\u03bf\u03ca\u03cc\u03bd\u03c4\u03c9\u03bd',
};

const SYMBOLS = {
  euro: '\u20ac',
};


const formatEuro = (value) => `${SYMBOLS.euro}${Number(value || 0).toFixed(2)}`;

const calcSummary = (lines, brand, customer) => {
  const totals = computeOrderTotals({ lines, brand, paymentMethod: null, customer });
  const net = Number.isFinite(totals.net) ? totals.net : 0;
  const discount = 0;
  const vat = Number.isFinite(totals.vat) ? totals.vat : 0;
  const total = Number.isFinite(totals.total) ? totals.total : net + vat;

  return { net, discount, vat, total };
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
  const [loadingListings, setLoadingListings] = useState(false);

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
  const storeSource = route?.params?.store ?? order?.store ?? order?.customer ?? {};
  const storeNameDisplay =
    storeSource.storeName ||
    storeSource.name ||
    order?.storeName ||
    order?.customer?.name ||
    '-';
  const storeCodeDisplay =
    storeSource.storeCode ||
    storeSource.code ||
    order?.storeCode ||
    order?.customer?.customerCode ||
    null;
  const toysCategoryDisplay =
    storeSource.hasToys ??
    storeSource.storeCategory ??
    order?.storeCategory ??
    order?.customer?.storeCategory ??
    '-';
  const summerCategoryDisplay =
    storeSource.hasSummerItems ??
    storeSource.summerCategory ??
    order?.storeSummerCategory ??
    order?.customer?.storeSummerCategory ??
    order?.customer?.summerCategory ??
    '-';
  const companyNameDisplay =
    storeSource.companyName ||
    order?.companyName ||
    order?.customer?.companyName ||
    null;

  const goToProducts = useCallback(() => {
    if (!fromOrders && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

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

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = navigation.addListener('beforeRemove', (event) => {
        if (event.data.action?.type === 'GO_BACK') {
          event.preventDefault();
          goToProducts();
        }
      });
      return () => unsubscribe();
    }, [goToProducts, navigation])
  );

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

  // Load full listings and inventory snapshot for export
  const handleConfirm = useCallback(async () => {
    if (!filteredLines.length) {
      Alert.alert(STRINGS.errorTitle, STRINGS.errorMessage);
      return;
    }

    console.log('[Review] Loading listings and inventory for export...');
    setLoadingListings(true);

    try {
      // Fetch full listings for potential listing export
      const allListings = await fetchSuperMarketListings(normalizedBrandKey);
      console.log('[Review] Loaded listings:', allListings.length);

      // Fetch current inventory snapshot
      const storeCode = order?.storeCode || order?.customer?.storeCode;
      const inventorySnapshot = storeCode ? await getStoreInventory(storeCode) : {};
      console.log('[Review] Loaded inventory for store:', storeCode, 'items:', Object.keys(inventorySnapshot).length);

      updateCurrentOrder({
        paymentMethod: null,
        paymentMethodLabel: null,
        notes,
        deliveryInfo: '',
        netValue: net,
        discount: 0,
        vat,
        finalValue: total,
        supermarketListings: allListings,
        inventorySnapshot,
      });

      navigation.navigate('SuperMarketOrderSummary', {
        store: route?.params?.store,
        orderId: route?.params?.orderId,
        brand: brandKey,
      });
    } catch (error) {
      console.error('[Review] Failed to load listings:', error);
      Alert.alert(STRINGS.listingsErrorTitle, STRINGS.listingsErrorMessage);
    } finally {
      setLoadingListings(false);
    }
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
    normalizedBrandKey,
    order,
  ]);

const renderProductRow = useCallback(
  ({ item: line }) => {
    const stockLevel = Number(line.currentStock || 0);
    const stockColor = stockLevel > 10 ? '#10b981' : stockLevel > 0 ? '#f59e0b' : '#ef4444';
    const displayCode = line.displayProductCode || line.productCode;
    const packagingLabel = (line.packaging || '').trim();
    const wholesaleValue = Number(line.wholesalePrice ?? line.price ?? 0);
    const formattedWholesale = formatEuro(wholesaleValue);
    const srpValue = Number(line.srp ?? 0);
    const formattedSrp = Number.isFinite(srpValue) && srpValue > 0 ? formatEuro(srpValue) : null;
    const orderedQty = Number(line.quantity || 0);

    return (
      <View style={styles.productRow}>
        {line.photoUrl ? (
          <Image source={{ uri: line.photoUrl }} style={styles.productImage} />
        ) : (
          <View style={styles.productImagePlaceholder}>
            <Ionicons name="image-outline" size={24} color="#9ca3af" />
          </View>
        )}

        <View style={styles.productContent}>
          <View style={styles.productHeader}>
            <Text style={styles.productCode} numberOfLines={1}>
              {displayCode}
            </Text>
            <View style={styles.headerChips}>
              {packagingLabel ? (
                <View style={styles.packagingChip}>
                  <Text style={styles.packagingText}>{packagingLabel}</Text>
                </View>
              ) : null}
              {line.isNew && (
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>{STRINGS.newBadge}</Text>
                </View>
              )}
            </View>
          </View>

          <Text style={styles.productDescription} numberOfLines={2}>
            {line.description}
          </Text>

          <View style={styles.productMetaRow}>
            <View style={styles.metaItem}>
              <View style={[styles.stockDot, { backgroundColor: stockColor }]} />
              <Text style={styles.metaLabel}>{STRINGS.stockInfo}</Text>
              <Text style={styles.metaValue}>
                {stockLevel}
                {STRINGS.unitsSuffix}
              </Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>{STRINGS.quantity}</Text>
              <Text style={styles.metaValue}>{orderedQty}</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>{STRINGS.wholesale}</Text>
              <Text style={styles.metaValue}>{formattedWholesale}</Text>
            </View>
            {formattedSrp ? (
              <>
                <View style={styles.metaDivider} />
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>{STRINGS.srpInfo}</Text>
                  <Text style={styles.metaValue}>{formattedSrp}</Text>
                </View>
              </>
            ) : null}
          </View>

          {line.suggestedQty > 0 && (
            <Text style={styles.suggestedText}>
              {STRINGS.suggestedInfo}:{' '}
              <Text style={styles.metaValue}>
                {line.suggestedQty}
                {STRINGS.unitsSuffix}
              </Text>
            </Text>
          )}
        </View>

        <View style={styles.actionsColumn}>
          <TouchableOpacity style={styles.removeButton} onPress={() => removeLine(line.productCode)}>
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
          </TouchableOpacity>
          <View style={styles.quantityControls}>
            <TouchableOpacity
              style={[styles.qtyButton, orderedQty <= 0 && styles.qtyButtonDisabled]}
              onPress={() => adjustQuantity(line.productCode, -1)}
              disabled={orderedQty <= 0}
            >
              <Ionicons
                name="remove"
                size={18}
                color={orderedQty > 0 ? '#0f172a' : '#9ca3af'}
              />
            </TouchableOpacity>

            <TextInput
              style={styles.qtyInput}
              value={String(orderedQty)}
              onChangeText={(text) => changeQuantity(line.productCode, text)}
              keyboardType="numeric"
              selectTextOnFocus
            />

            <TouchableOpacity style={styles.qtyButton} onPress={() => adjustQuantity(line.productCode, 1)}>
              <Ionicons name="add" size={18} color="#0f172a" />
            </TouchableOpacity>
          </View>
        </View>
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
            <Text style={styles.sectionTitle}>{STRINGS.storeInfoTitle}</Text>
            <View style={styles.storeInfoCard}>
              <View style={styles.storeInfoTopRow}>
                <Text style={styles.storeName} numberOfLines={1}>{storeNameDisplay}</Text>
                {storeCodeDisplay ? (
                  <View style={styles.storeCodePill}>
                    <Text style={styles.storeCodePillText}>{storeCodeDisplay}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.storeMetaRow}>
                <Text style={styles.storeMetaLabel}>{STRINGS.toysCategoryLabel}</Text>
                <Text style={styles.storeMetaValue}>{toysCategoryDisplay || '-'}</Text>
                <View style={styles.storeMetaDivider} />
                <Text style={styles.storeMetaLabel}>{STRINGS.summerCategoryLabel}</Text>
                <Text style={styles.storeMetaValue}>{summerCategoryDisplay || '-'}</Text>
              </View>
              {companyNameDisplay ? (
                <Text style={styles.companyName} numberOfLines={1}>{STRINGS.companyLabel}: {companyNameDisplay}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.quickNavRow}>
            <TouchableOpacity
              style={styles.quickNavButton}
              onPress={goToProducts}
              activeOpacity={0.8}
            >
              <Ionicons name="cube-outline" size={16} color="#1f4f8f" />
              <Text style={styles.quickNavText}>{STRINGS.quickNavLabel}</Text>
            </TouchableOpacity>
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
                <Text style={styles.productCount}>{filteredLines.length}{STRINGS.productCountSuffix}</Text>
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
      <Text style={styles.totalValue}>{formatEuro(net)}</Text>
    </View>
    <View style={styles.totalRow}>
      <Text style={styles.totalLabel}>{STRINGS.vat}</Text>
      <Text style={styles.totalValue}>{formatEuro(vat)}</Text>
    </View>
    <View style={[styles.totalRow, styles.finalTotalRow]}>
      <Text style={styles.finalTotalLabel}>{STRINGS.total}</Text>
      <Text style={styles.finalTotalValue}>{formatEuro(total)}</Text>
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
          disabled={filteredLines.length === 0 || loadingListings}
        >
          {loadingListings ? (
            <View style={styles.loadingContent}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.loadingText}>{STRINGS.loading}</Text>
            </View>
          ) : (
            <Text style={[styles.fabText, filteredLines.length === 0 && styles.fabTextDisabled]}>
              {STRINGS.confirm}
            </Text>
                    )}
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
    padding: 14,
    shadowColor: '#1f2937',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  storeInfoTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    marginRight: 12,
  },
  storeCodePill: {
    backgroundColor: '#e2e8f0',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  storeCodePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
  storeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  storeMetaLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginRight: 4,
  },
  storeMetaValue: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '600',
    marginRight: 16,
  },
  storeMetaDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#cbd5f5',
    marginRight: 12,
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
  quickNavRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  quickNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  quickNavText: {
    marginLeft: 6,
    color: '#0f172a',
    fontWeight: '600',
    fontSize: 13,
  },
  productsList: {
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 8,
    marginVertical: 6,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  productImage: {
    width: 52,
    height: 52,
    borderRadius: 10,
    marginRight: 10,
    backgroundColor: '#f3f4f6',
  },
  productImagePlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  productContent: {
    flex: 1,
    marginRight: 10,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  headerChips: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  productCode: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    flexShrink: 1,
  },
  packagingChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#e2e8f0',
    marginLeft: 6,
  },
  packagingText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1f2937',
  },
  productDescription: {
    fontSize: 12.5,
    color: '#475569',
    marginTop: 2,
    lineHeight: 16,
  },
  productMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 4,
  },
  metaLabel: {
    fontSize: 11,
    color: '#64748b',
    marginRight: 4,
  },
  metaValue: {
    fontSize: 11,
    color: '#0f172a',
    fontWeight: '600',
  },
  metaDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 6,
    marginTop: 4,
  },
  stockDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 4,
  },
  suggestedText: {
    marginTop: 6,
    fontSize: 11,
    color: '#64748b',
  },
  newBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  newBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '700',
  },
  actionsColumn: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginLeft: 8,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 18,
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginTop: 8,
  },
  qtyButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyButtonDisabled: {
    opacity: 0.4,
  },
  qtyInput: {
    width: 44,
    height: 28,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productSeparator: {
    height: 12,
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
  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    marginLeft: 8,
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default SuperMarketOrderReviewScreen;

