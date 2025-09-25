// src/screens/OrderReviewScreen.js
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
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOrder } from '../context/OrderContext';

const STRINGS = {
  title: '\u0395\u03c0\u03b9\u03c3\u03ba\u03cc\u03c0\u03b7\u03c3\u03b7 \u03c0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03af\u03b1\u03c2',
  backToProducts: '\u0395\u03c0\u03b9\u03c3\u03c4\u03c1\u03bf\u03c6\u03ae \u03c3\u03c4\u03b1 \u03c0\u03c1\u03bf\u03ca\u03cc\u03bd\u03c4\u03b1',
  headerBack: '\u03a0\u03c1\u03bf\u03ca\u03cc\u03bd\u03c4\u03b1',
  toggleTitle: '\u0395\u03c0\u03b9\u03bb\u03b5\u03b3\u03bc\u03ad\u03bd\u03b1 \u03c0\u03c1\u03bf\u03ca\u03cc\u03bd\u03c4\u03b1',
  productsEmpty: '\u0394\u03b5\u03bd \u03c5\u03c0\u03ac\u03c1\u03c7\u03bf\u03c5\u03bd \u03c0\u03c1\u03bf\u03ca\u03cc\u03bd\u03c4\u03b1.',
  quantity: '\u03a0\u03bf\u03c3\u03cc\u03c4\u03b7\u03c4\u03b1',
  wholesale: '\u03a7\u03bf\u03bd\u03b4\u03c1\u03b9\u03ba\u03ae',
  retail: '\u039b\u03b9\u03b1\u03bd\u03b9\u03ba\u03ae',
  paymentSection: '\u03a4\u03c1\u03cc\u03c0\u03bf\u03c2 \u03c0\u03bb\u03b7\u03c1\u03c9\u03bc\u03ae\u03c2',
  totalsSection: '\u03a3\u03cd\u03bd\u03bf\u03bb\u03b1',
  net: '\u039a\u03b1\u03b8\u03b1\u03c1\u03ae \u03b1\u03be\u03af\u03b1',
  discount: '\u0388\u03ba\u03c0\u03c4\u03c9\u03c3\u03b7',
  vat: '\u03a6\u03a0\u0391 24%',
  total: '\u03a4\u03b5\u03bb\u03b9\u03ba\u03ae \u03b1\u03be\u03af\u03b1',
  notes: '\u03a3\u03b7\u03bc\u03b5\u03b9\u03ce\u03c3\u03b5\u03b9\u03c2',
  notesPlaceholder: '\u03a3\u03c7\u03cc\u03bb\u03b9\u03b1, \u03bf\u03b4\u03b7\u03b3\u03af\u03b5\u03c2, \u03c0\u03b1\u03c1\u03b1\u03c4\u03b7\u03c1\u03ae\u03c3\u03b5\u03b9\u03c2',
  confirm: '\u03a3\u03c5\u03bd\u03ad\u03c7\u03b5\u03b9\u03b1',
  errorTitle: '\u0395\u03bb\u03bb\u03b9\u03c0\u03ae \u03c3\u03c4\u03bf\u03b9\u03c7\u03b5\u03af\u03b1',
  errorMessage: '\u0394\u03b5\u03bd \u03c5\u03c0\u03ac\u03c1\u03c7\u03bf\u03c5\u03bd \u03c0\u03c1\u03bf\u03ca\u03cc\u03bd\u03c4\u03b1 \u03c3\u03c4\u03b7\u03bd \u03c0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03af\u03b1.',
  minus: '\u2212',
  plus: '+',
};

const PAYMENT_OPTIONS = [
  { key: 'prepaid_cash', label: '\u03a0\u03c1\u03bf\u03b5\u03af\u03c3\u03c0\u03c1\u03b1\u03be\u03b7 \u0028\u03ad\u03ba\u03c4\u03c0\u03c9\u03c3\u03b7 \u0033\u0025\u0029' },
  { key: 'free_shipping', label: '\u0395\u03bb\u03b5\u03cd\u03b8\u03b5\u03c1\u03b1' },
  { key: 'premium_invoicing', label: '\u03a0\u03c1\u03bf\u03bd\u03bf\u03bc\u03b9\u03b1\u03ba\u03ae \u03a0\u03b9\u03c3\u03c4\u03c9\u03c4\u03b9\u03ba\u03ae \u03a0\u03bf\u03bb\u03b9\u03c4\u03b9\u03ba\u03ae' },
  { key: 'bank_cheque', label: '\u0395\u03c0\u03b9\u03c4\u03b1\u03b3\u03ae \u03a1\u03bf\u03ae\u03c2' },
];

const SYMBOLS = {
  euro: '\u20ac',
};

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  return `${SYMBOLS.euro}${amount.toFixed(2)}`;
};

const calcSummary = (lines, paymentMethod) => {
  const net = lines.reduce((sum, line) => {
    const quantity = Number(line?.quantity || 0);
    const price = Number(line?.wholesalePrice || 0);
    return sum + quantity * price;
  }, 0);

  const discount = paymentMethod === 'prepaid_cash' ? net * 0.03 : 0;
  const vat = (net - discount) * 0.24;
  const total = net - discount + vat;

  return {
    net,
    discount,
    vat,
    total,
  };
};

const OrderReviewScreen = () => {
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
    paymentMethod,
    setPaymentMethod,
    updateCurrentOrder,
  } = useOrder();

  const [collapsed, setCollapsed] = useState(false);
  const [keyboardPadding, setKeyboardPadding] = useState(0);

  const fromOrders = Boolean(route?.params?.fromOrders);
  const routeBrand = route?.params?.brand ?? null;
  const brandKey = order?.brand ?? routeBrand ?? null;

  const lines = useMemo(() => (Array.isArray(orderLines) ? orderLines : []), [orderLines]);
  const filteredLines = useMemo(
    () => lines.filter((line) => line && line.productCode),
    [lines]
  );

  const summary = useMemo(
    () => calcSummary(filteredLines, paymentMethod),
    [filteredLines, paymentMethod]
  );
  const { net, discount, vat, total } = summary;

  const paymentLabel = useMemo(() => {
    const option = PAYMENT_OPTIONS.find((item) => item.key === paymentMethod);
    return option ? option.label : '';
  }, [paymentMethod]);

  const showBackToProducts = order?.status !== 'sent';

  const goToProducts = useCallback(() => {
    if (fromOrders) {
      navigation.replace('OrderProductSelectionScreen', {
        brand: brandKey ?? null,
        fromReview: true,
        fromOrders: true,
      });
    } else {
      navigation.navigate('OrderProductSelectionScreen', { brand: brandKey ?? null, fromReview: true });
    }
  }, [brandKey, fromOrders, navigation]);

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
      setOrderLines((prev) => {
        const base = Array.isArray(prev) ? prev : [];
        return base.map((line) => {
          if (line?.productCode !== productCode) return line;
          const nextQuantity = Math.max(1, Number(line?.quantity || 1) + delta);
          return { ...line, quantity: nextQuantity };
        });
      });
    },
    [setOrderLines]
  );

  const changeQuantity = useCallback(
    (productCode, value) => {
      const numeric = Math.max(1, parseInt(String(value).replace(/[^0-9]/g, ''), 10) || 1);
      setOrderLines((prev) => {
        const base = Array.isArray(prev) ? prev : [];
        return base.map((line) =>
          line?.productCode === productCode ? { ...line, quantity: numeric } : line
        );
      });
    },
    [setOrderLines]
  );

  const removeLine = useCallback(
    (productCode) => {
      setOrderLines((prev) => {
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
      paymentMethod,
      paymentMethodLabel: paymentLabel,
      notes,
      netValue: net,
      discount,
      vat,
      finalValue: total,
    });

    navigation.navigate('OrderSummaryScreen');
  }, [discount, filteredLines.length, navigation, net, notes, paymentLabel, paymentMethod, total, updateCurrentOrder, vat]);

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 + keyboardPadding }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {showBackToProducts && (
            <TouchableOpacity onPress={goToProducts} style={styles.navButton} activeOpacity={0.85}>
              <Ionicons name="swap-horizontal-outline" size={18} color="#1565c0" />
              <Text style={styles.navButtonText}>{STRINGS.backToProducts}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.collapseHeader}
            onPress={() => setCollapsed((prev) => !prev)}
            activeOpacity={0.8}
          >
            <Text style={styles.collapseTitle}>{`${STRINGS.toggleTitle} (${filteredLines.length})`}</Text>
            <Text style={styles.collapseToggle}>{collapsed ? STRINGS.plus : STRINGS.minus}</Text>
          </TouchableOpacity>

          {!collapsed && (
            filteredLines.length > 0 ? (
              filteredLines.map((line, index) => (
                <View key={`${line.productCode || index}-${index}`} style={styles.card}>
                  <View style={styles.cardContent}>
                    <Text style={styles.productCode}>{line.productCode || '-'}</Text>
                    {line.description ? (
                      <Text style={styles.productTitle} numberOfLines={2}>{line.description}</Text>
                    ) : null}
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>{`${STRINGS.wholesale}: ${formatCurrency(line.wholesalePrice)}`}</Text>
                      {line.srp ? (
                        <Text style={styles.priceLabel}>{`${STRINGS.retail}: ${formatCurrency(line.srp)}`}</Text>
                      ) : null}
                    </View>
                    <View style={styles.qtyRow}>
                      <TouchableOpacity onPress={() => adjustQuantity(line.productCode, -1)} style={styles.qtyButton}>
                        <Text style={styles.qtyButtonText}>{STRINGS.minus}</Text>
                      </TouchableOpacity>
                      <TextInput
                        style={styles.qtyInput}
                        keyboardType="number-pad"
                        value={String(line.quantity || 1)}
                        onChangeText={(text) => changeQuantity(line.productCode, text)}
                        maxLength={4}
                        returnKeyType="done"
                      />
                      <TouchableOpacity onPress={() => adjustQuantity(line.productCode, 1)} style={styles.qtyButton}>
                        <Text style={styles.qtyButtonText}>{STRINGS.plus}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => removeLine(line.productCode)} style={styles.removeButton} accessibilityLabel="remove-line">
                    <Ionicons name="trash-outline" size={18} color="#c02626" />
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <Text style={styles.emptyProducts}>{STRINGS.productsEmpty}</Text>
            )
          )}

          <Text style={styles.sectionTitle}>{STRINGS.paymentSection}</Text>
          {PAYMENT_OPTIONS.map((option) => {
            const active = option.key === paymentMethod;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.paymentOption, active && styles.paymentOptionActive]}
                onPress={() => setPaymentMethod(option.key)}
                activeOpacity={0.85}
              >
                <Text style={[styles.paymentOptionText, active && styles.paymentOptionTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}

          <Text style={styles.sectionTitle}>{STRINGS.totalsSection}</Text>
          <View style={styles.totalsBlock}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>{STRINGS.net}</Text>
              <Text style={styles.totalsValue}>{formatCurrency(net)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>{STRINGS.discount}</Text>
              <Text style={styles.totalsValue}>{formatCurrency(discount)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>{STRINGS.vat}</Text>
              <Text style={styles.totalsValue}>{formatCurrency(vat)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>{STRINGS.total}</Text>
              <Text style={styles.totalsValueStrong}>{formatCurrency(total)}</Text>
            </View>
          </View>

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
        </ScrollView>

        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 16 + keyboardPadding }]}
          onPress={handleConfirm}
          activeOpacity={0.9}
        >
          <Text style={styles.fabText}>{STRINGS.confirm}</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fafdff' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 12 },
  headerBackButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6 },
  headerBackText: { marginLeft: 6, color: '#1f4f8f', fontWeight: '600', fontSize: 14 },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#90caf9',
    backgroundColor: '#e3f2fd',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  navButtonText: { marginLeft: 6, color: '#1565c0', fontWeight: '700', fontSize: 14 },
  collapseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#e3f2fd',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  collapseTitle: { fontSize: 15, fontWeight: '700', color: '#1565c0' },
  collapseToggle: { fontSize: 20, fontWeight: '700', color: '#1565c0' },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1e7f5',
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardContent: { flex: 1, paddingRight: 8 },
  productCode: { fontSize: 15, fontWeight: '700', color: '#1565c0' },
  productTitle: { marginTop: 4, fontSize: 14, fontWeight: '600', color: '#1f2d3d' },
  priceRow: { flexDirection: 'row', marginTop: 6 },
  priceLabel: { color: '#555', fontSize: 13, marginRight: 12 },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#1976d2',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 4,
  },
  qtyButton: { paddingHorizontal: 8, paddingVertical: 4 },
  qtyButtonText: { fontSize: 20, fontWeight: '700', color: '#1976d2' },
  qtyInput: {
    width: 56,
    height: 32,
    textAlign: 'center',
    fontSize: 16,
    color: '#111',
    marginHorizontal: 4,
    paddingVertical: 0,
  },
  removeButton: { padding: 6, justifyContent: 'flex-start' },
  sectionTitle: { marginTop: 20, marginBottom: 10, fontSize: 16, fontWeight: '700', color: '#1f2937' },
  paymentOption: {
    borderWidth: 1,
    borderColor: '#d1d7e2',
    borderRadius: 10,
    backgroundColor: '#f6fafd',
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  paymentOptionActive: { borderColor: '#1976d2', backgroundColor: '#e3f2fd' },
  paymentOptionText: { fontSize: 14, color: '#1f2d3d' },
  paymentOptionTextActive: { color: '#0f4fa6', fontWeight: '700' },
  totalsBlock: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1e7f5',
    padding: 12,
    marginBottom: 12,
  },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  totalsLabel: { fontSize: 14, color: '#555' },
  totalsValue: { fontSize: 14, color: '#111', fontWeight: '600' },
  totalsValueStrong: { fontSize: 16, color: '#0f172a', fontWeight: '700' },
  notesInput: {
    borderWidth: 1,
    borderColor: '#d1d7e2',
    borderRadius: 10,
    backgroundColor: '#fff',
    minHeight: 100,
    padding: 12,
    fontSize: 15,
    color: '#111',
    marginBottom: 24,
  },
  emptyProducts: { textAlign: 'center', color: '#6b7280', fontSize: 14, marginVertical: 12 },
  fab: {
    position: 'absolute',
    right: 20,
    borderRadius: 24,
    backgroundColor: '#1976d2',
    paddingVertical: 14,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

export default OrderReviewScreen;
