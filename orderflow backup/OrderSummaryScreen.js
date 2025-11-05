// src/screens/OrderSummaryScreen.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import SafeScreen from '../components/SafeScreen';

import { useOrder } from '../context/OrderContext';
import { getPaymentLabel } from '../constants/paymentOptions';
import { normalizeBrandKey } from '../constants/brands';
import { exportOrderAsXLSX } from '../utils/exportOrderUtils';
import Share from 'react-native-share';

const STRINGS = {
  screenTitle: "\u03a3\u03cd\u03bd\u03bf\u03c8\u03b7 \u03a0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03af\u03b1\u03c2",
  clearTitle: "\u039a\u03b1\u03b8\u03b1\u03c1\u03b9\u03c3\u03bc\u03cc\u03c2",
  clearMessage: "\u0398\u03ad\u03bb\u03b5\u03b9\u03c2 \u03bd\u03b1 \u03b1\u03ba\u03c5\u03c1\u03ce\u03c3\u03b5\u03b9\u03c2 \u03b1\u03c5\u03c4\u03ae \u03c4\u03b7\u03bd \u03c0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03af\u03b1;",
  exportedTitle: "\u0397 \u03c0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03af\u03b1 \u03b5\u03c4\u03bf\u03b9\u03bc\u03ac\u03c3\u03c4\u03b7\u03ba\u03b5",
  exportedMessage: "\u0398\u03ad\u03bb\u03b5\u03b9\u03c2 \u03bd\u03b1 \u03be\u03b5\u03ba\u03b9\u03bd\u03ae\u03c3\u03b5\u03b9\u03c2 \u03bd\u03ad\u03b1 \u03c0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03af\u03b1;",
  newOrder: "\u039d\u03ad\u03b1 \u03c0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03af\u03b1",
  cancel: "\u0386\u03ba\u03c5\u03c1\u03bf",
  yes: "\u039d\u03b1\u03b9",
  no: "\u038c\u03c7\u03b9",
  customerSection: "\u03a0\u03b5\u03bb\u03ac\u03c4\u03b7\u03c2",
  backToReview: "\u0395\u03c0\u03b9\u03c3\u03c4\u03c1\u03bf\u03c6\u03ae\u0020\u03c3\u03c4\u03b7\u03bd\u0020\u03b5\u03c0\u03b5\u03be\u03b5\u03c1\u03b3\u03b1\u03c3\u03af\u03b1",
  name: "\u0395\u03c0\u03c9\u03bd\u03c5\u03bc\u03af\u03b1",
  vat: "\u0391\u03a6\u039c",
  phone: "\u03a4\u03b7\u03bb\u03ad\u03c6\u03c9\u03bd\u03bf",
  address: "\u0394\u03b9\u03b5\u03cd\u03b8\u03c5\u03bd\u03c3\u03b7",
  city: "\u03a0\u03cc\u03bb\u03b7",
  customerCode: "\u039a\u03c9\u03b4\u03b9\u03ba\u03cc\u03c2 \u03c0\u03b5\u03bb\u03ac\u03c4\u03b7",
  company: "\u0395\u03c4\u03b1\u03b9\u03c1\u03b5\u03af\u03b1",
  storeCategory: "\u039a\u03b1\u03c4\u03b7\u03b3\u03bf\u03c1\u03af\u03b1 \u03ba\u03b1\u03c4\u03b1\u03c3\u03c4\u03ae\u03bc\u03b1\u03c4\u03bf\u03c2",
  products: "\u03a0\u03c1\u03bf\u03ca\u03cc\u03bd\u03c4\u03b1",
  noProducts: "\u0394\u03b5\u03bd \u03c5\u03c0\u03ac\u03c1\u03c7\u03bf\u03c5\u03bd \u03c0\u03c1\u03bf\u03ca\u03cc\u03bd\u03c4\u03b1.",
  totals: "\u03a3\u03cd\u03bd\u03bf\u03bb\u03b1",
  netValue: "\u039a\u03b1\u03b8\u03b1\u03c1\u03ae \u03b1\u03be\u03af\u03b1",
  discount: "\u0388\u03ba\u03c0\u03c4\u03c9\u03c3\u03b7",
  vat24: "\u03a6\u03a0\u0391 24%",
  finalValue: "\u03a4\u03b5\u03bb\u03b9\u03ba\u03ae \u03b1\u03be\u03af\u03b1",
  paymentMethod: "Payment Method",
  deliveryInfo: "Delivery Info",
  notes: "\u03a3\u03b7\u03bc\u03b5\u03b9\u03ce\u03c3\u03b5\u03b9\u03c2",
  exportOptions: "\u0395\u03c0\u03b9\u03bb\u03bf\u03b3\u03ad\u03c2 \u03b5\u03be\u03b1\u03b3\u03c9\u03b3\u03ae\u03c2",
  exportModeOrder: "\u039c\u03cc\u03bd\u03bf \u03c0\u03c1\u03bf\u03ca\u03cc\u03bd\u03c4\u03b1 \u03c0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03af\u03b1\u03c2",
  exportModeListing: "\u039f\u03bb\u03cc\u03ba\u03bb\u03b7\u03c1\u03bf listing \u03ba\u03b1\u03c4\u03b1\u03c3\u03c4\u03ae\u03bc\u03b1\u03c4\u03bf\u03c2",
  insufficientDataTitle: "\u0395\u03bb\u03bb\u03b9\u03c0\u03ae \u03c3\u03c4\u03bf\u03b9\u03c7\u03b5\u03af\u03b1",
  insufficientDataMessage: "\u0394\u03b5\u03bd \u03c5\u03c0\u03ac\u03c1\u03c7\u03bf\u03c5\u03bd \u03c0\u03c1\u03bf\u03ca\u03cc\u03bd\u03c4\u03b1 \u03c3\u03b5 \u03b1\u03c5\u03c4\u03ae \u03c4\u03b7\u03bd \u03c0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03af\u03b1.",
  listingUnavailable: "\u0394\u03b5\u03bd \u03b2\u03c1\u03ad\u03b8\u03b7\u03ba\u03b5 \u03b4\u03b9\u03b1\u03b8\u03ad\u03c3\u03b9\u03bc\u03bf listing \u03b3\u03b9\u03b1 \u03b5\u03be\u03b1\u03b3\u03c9\u03b3\u03ae.",
  exportFailed: "\u0397 \u03b5\u03be\u03b1\u03b3\u03c9\u03b3\u03ae \u03b1\u03c0\u03ad\u03c4\u03c5\u03c7\u03b5. \u03a0\u03c1\u03bf\u03c3\u03c0\u03ac\u03b8\u03b7\u03c3\u03b5 \u03be\u03b1\u03bd\u03ac.",
  exportInProgress: "\u0395\u03be\u03b1\u03b3\u03c9\u03b3\u03ae\u2026",
  exportToExcel: "\u0395\u03be\u03b1\u03b3\u03c9\u03b3\u03ae \u03c3\u03b5 Excel",
  error: "\u03a3\u03c6\u03ac\u03bb\u03bc\u03b1",
  quantity: "\u03a0\u03bf\u03c3\u03cc\u03c4\u03b7\u03c4\u03b1",
  price: "\u03a4\u03b9\u03bc\u03ae",
  value: "\u0391\u03be\u03af\u03b1",
  minus: "\u2212",
};

const SYMBOLS = {
  euro: '\u20ac',
  middleDot: ' \u00b7 ',
};

const formatEuro = (value) => `${SYMBOLS.euro}${Number(value || 0).toFixed(2)}`;

const OrderSummaryScreen = ({ navigation }) => {
  const isMounted = useRef(true);
  useEffect(() => () => { isMounted.current = false; }, []);

  const { order, cancelOrder, markOrderSent } = useOrder();

  const handleBackToReview = useCallback(() => {
    const brandParam = order?.brand ?? null;
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('OrderReviewScreen', {
        brand: brandParam,
        fromSummary: true,
      });
    }
  }, [navigation, order?.brand]);

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = navigation.addListener('beforeRemove', (event) => {
        if (event.data.action?.type === 'GO_BACK') {
          event.preventDefault();
          handleBackToReview();
        }
      });
      return () => unsubscribe();
    }, [handleBackToReview, navigation])
  );

  const isSuperMarket = order?.orderType === 'supermarket';
  const [loading, setLoading] = useState(false);
  const [showProducts, setShowProducts] = useState(true);
  const [exportMode, setExportMode] = useState('order');



  const linesData = Array.isArray(order?.lines) ? order.lines : [];
  const hasProducts = linesData.length > 0;

  const customer = order?.customer || {};
  const brandKey = order?.brand ?? null;
  const brandRoute = brandKey ? brandKey.charAt(0).toUpperCase() + brandKey.slice(1) : 'Playmobil';
  const hasListingSnapshot = Array.isArray(order?.supermarketListings) && order.supermarketListings.length > 0;

  const getVat = () =>
    customer?.vatno ||
    customer?.vat ||
    customer?.vatNumber ||
    customer?.vatInfo?.registrationNo ||
    customer?.companyVat ||
    order?.storeVat ||
    '';

  const getPhone = () =>
    customer?.telephone ||
    customer?.phone ||
    customer?.contact?.telephone1 ||
    customer?.contact?.mobile ||
    order?.storePhone ||
    '';

  const addressObject =
    customer?.address && typeof customer.address === 'object' ? customer.address : null;
  const streetLine =
    addressObject?.street ??
    order?.storeAddress ??
    (typeof customer?.address === 'string' ? customer.address : '');
  const postalCodeLine = addressObject?.postalCode ?? order?.storePostalCode ?? '';
  const regionLine = addressObject?.region ?? order?.storeRegion ?? '';
  const cityLine = addressObject?.city ?? order?.storeCity ?? '';
  const composedAddress = [streetLine, postalCodeLine].filter(Boolean).join(' ').trim();
  const cityDisplay = [cityLine, regionLine].filter(Boolean).join(', ');
  const companyName = order?.companyName ?? customer?.companyName ?? '';
  const storeCategoryLabel = order?.storeCategory ?? customer?.storeCategory ?? '';

  const netValue = Number(order?.netValue || 0);
  const discount = Number(order?.discount || 0);
  const vat = Number(order?.vat || 0);
  const finalValue = Number(order?.finalValue || 0);
  const effectiveDiscount = isSuperMarket ? 0 : discount;
  const normalizedBrand = normalizeBrandKey(order?.brand);
  const paymentMethodLabel = isSuperMarket
    ? '-'
    : getPaymentLabel(order?.paymentMethod, normalizedBrand) ||
      order?.paymentMethodLabel ||
      order?.paymentMethod ||
      '';
  const deliveryInfo = isSuperMarket ? '' : order?.deliveryInfo || '';
  const exportOptionsList = [
    { key: 'order', label: STRINGS.exportModeOrder, disabled: false },
    { key: 'listing', label: STRINGS.exportModeListing, disabled: !hasListingSnapshot },
  ];

  useEffect(() => {
    if (!isSuperMarket) {
      if (exportMode !== 'order') {
        setExportMode('order');
      }
      return;
    }
    if (!hasListingSnapshot && exportMode === 'listing') {
      setExportMode('order');
    }
  }, [exportMode, hasListingSnapshot, isSuperMarket]);


  const handleClear = () => {
    Alert.alert(STRINGS.clearTitle, STRINGS.clearMessage, [
      { text: STRINGS.no, style: 'cancel' },
      {
        text: STRINGS.yes,
        style: 'destructive',
        onPress: () => {
          try { cancelOrder?.(); } catch {}
          navigation.popToTop();
        },
      },
    ]);
  };

  const showPostExportDialog = () => {
    Alert.alert(
      STRINGS.exportedTitle,
      STRINGS.exportedMessage,
      [
        {
          text: brandRoute,
          onPress: () => {
            try { cancelOrder?.(); } catch {}
            navigation.reset({ index: 0, routes: [{ name: brandRoute }] });
          },
        },
        {
          text: STRINGS.newOrder,
          onPress: () => {
            try { cancelOrder?.(); } catch {}
            navigation.reset({ index: 0, routes: [{ name: 'OrderCustomerSelectScreen', params: { brand: brandKey ?? null } }] });
          },
        },
        { text: STRINGS.cancel, style: 'cancel' },
      ],
      { cancelable: true },
    );
  };

  const handleExport = async () => {
    const allowEmptyExport = isSuperMarket && exportMode === 'listing';
    if (!hasProducts && !allowEmptyExport) {
      Alert.alert(STRINGS.insufficientDataTitle, STRINGS.insufficientDataMessage);
      return;
    }
    if (isSuperMarket && exportMode === 'listing' && !hasListingSnapshot) {
      Alert.alert(STRINGS.insufficientDataTitle, STRINGS.listingUnavailable);
      return;
    }
    if (isMounted.current) setLoading(true);
    try {
      const sentOrder = await markOrderSent();
      const exportPayload = sentOrder || {
        ...order,
        status: 'sent',
        sent: true,
        exported: true,
        exportedAt: new Date().toISOString(),
      };
      const exportConfig = isSuperMarket
        ? { mode: exportMode, includeImages: true }
        : { mode: 'order', includeImages: false };
      const { uri, mime, fileName } = await exportOrderAsXLSX(exportPayload, exportConfig);
      await Share.open({ url: uri, type: mime, failOnCancel: false, filename: fileName });
      setTimeout(() => {
        if (isMounted.current) showPostExportDialog();
      }, 200);
    } catch (err) {
      Alert.alert(STRINGS.error, String(err?.message || STRINGS.exportFailed));
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  return (
    <SafeScreen
      title={STRINGS.screenTitle}
      headerRight={(
        <TouchableOpacity
          onPress={handleClear}
          style={styles.headerAction}
          accessibilityLabel={STRINGS.clearTitle}
        >
          <Icon name="trash-outline" size={20} color="#fff" />
        </TouchableOpacity>
      )}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackToReview}
          activeOpacity={0.85}
        >
          <Icon name="arrow-back" size={18} color="#1565c0" />
          <Text style={styles.backButtonText}>{STRINGS.backToReview}</Text>
        </TouchableOpacity>
        <Text style={styles.sectionTitle}>{STRINGS.customerSection}</Text>
        <Row label={STRINGS.name} value={customer?.name || customer?.displayName || order?.storeName || ""} />
        {companyName ? <Row label={STRINGS.company} value={companyName} /> : null}
        <Row label={STRINGS.vat} value={getVat() || "-"} />
        <Row label={STRINGS.phone} value={getPhone() || "-"} />
        <Row label={STRINGS.address} value={composedAddress || "-"} />
        <Row label={STRINGS.city} value={cityDisplay || "-"} />
        {storeCategoryLabel ? <Row label={STRINGS.storeCategory} value={storeCategoryLabel} /> : null}
        <Row label={STRINGS.customerCode} value={customer?.customerCode ?? customer?.code ?? order?.storeCode ?? ""} />

        <TouchableOpacity
          style={[styles.sectionHeader, { marginTop: 12 }]}
          onPress={() => setShowProducts((prev) => !prev)}
          activeOpacity={0.8}
        >
          <Text style={styles.sectionTitle}>{STRINGS.products}</Text>
          <Text style={{ color: "#1976d2", fontWeight: "700" }}>{showProducts ? STRINGS.minus : "+"}</Text>
        </TouchableOpacity>

        {showProducts && (
          linesData.length ? (
            linesData.map((line, idx) => (
              <View key={`${line?.productCode || idx}-${idx}`} style={styles.card}>
                <Text style={styles.lineTitle}>
                  {(line?.productCode || "") + SYMBOLS.middleDot + (line?.description || "")}
                </Text>
                <Text style={styles.lineBody}>
                  {`${STRINGS.quantity}: ${Number(line?.quantity || 0)}${SYMBOLS.middleDot}${STRINGS.price}: ${formatEuro(line?.wholesalePrice)}${SYMBOLS.middleDot}${STRINGS.value}: ${formatEuro(Number(line?.quantity || 0) * Number(line?.wholesalePrice || 0))}`}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>{STRINGS.noProducts}</Text>
          )
        )}

        <Text style={styles.sectionTitle}>{STRINGS.totals}</Text>
        <Row label={STRINGS.netValue} value={formatEuro(netValue)} />
        {!isSuperMarket && <Row label={STRINGS.discount} value={formatEuro(effectiveDiscount)} />}
        <Row label={STRINGS.vat24} value={formatEuro(vat)} />
        <Row label={STRINGS.finalValue} value={formatEuro(finalValue)} />

        {!isSuperMarket && (
          <>
            <Text style={styles.sectionTitle}>{STRINGS.paymentMethod}</Text>
            <Text style={styles.text}>{paymentMethodLabel}</Text>

            <Text style={styles.sectionTitle}>{STRINGS.deliveryInfo}</Text>
            <Text style={styles.text}>{deliveryInfo || '-'}</Text>
          </>
        )}

        <Text style={styles.sectionTitle}>{STRINGS.notes}</Text>
        <Text style={[styles.text, { marginBottom: 12 }]}>{order?.notes || ""}</Text>

        {isSuperMarket && (
          <>
            <Text style={styles.sectionTitle}>{STRINGS.exportOptions}</Text>
            <View style={styles.exportModeContainer}>
              {exportOptionsList.map((option) => {
                const active = exportMode === option.key;
                const disabled = option.disabled;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.exportModeButton,
                      active && styles.exportModeButtonActive,
                      disabled && styles.exportModeButtonDisabled,
                    ]}
                    onPress={() => !disabled && setExportMode(option.key)}
                    activeOpacity={disabled ? 1 : 0.85}
                    disabled={disabled}
                  >
                    <Text
                      style={[
                        styles.exportModeButtonText,
                        active && styles.exportModeButtonTextActive,
                        disabled && styles.exportModeButtonTextDisabled,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.exportBtn, loading && { opacity: 0.7 }]}
        onPress={handleExport}
        disabled={loading}
        activeOpacity={0.85}
      >
        <Icon name="cloud-download-outline" size={20} color="#fff" />
        <Text style={styles.exportText}>{loading ? STRINGS.exportInProgress : STRINGS.exportToExcel}</Text>
      </TouchableOpacity>
    </SafeScreen>
  );
};

const Row = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 120,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#e3f2fd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  backButtonText: {
    marginLeft: 6,
    color: '#1565c0',
    fontWeight: '700',
    fontSize: 14,
  },
  sectionTitle: {
    marginTop: 12,
    marginBottom: 6,
    color: '#1f2937',
    fontWeight: '700',
    fontSize: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  text: { fontSize: 15, color: '#333' },
  row: {
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  rowLabel: { fontSize: 13, color: '#6b7280' },
  rowValue: { fontSize: 15, color: '#111827' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  lineTitle: { fontSize: 15, color: '#111827', fontWeight: '600' },
  lineBody: { marginTop: 4, fontSize: 14, color: '#374151' },
  emptyText: { fontSize: 14, color: '#6b7280' },
  exportModeContainer: {
    marginTop: 4,
  },
  exportModeButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginBottom: 8,
    backgroundColor: '#f8fafc',
  },
  exportModeButtonActive: {
    borderColor: '#1d4ed8',
    backgroundColor: '#dbeafe',
  },
  exportModeButtonDisabled: {
    opacity: 0.6,
  },
  exportModeButtonText: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '600',
  },
  exportModeButtonTextActive: {
    color: '#1d4ed8',
  },
  exportModeButtonTextDisabled: {
    color: '#94a3b8',
  },
  exportBtn: {
    margin: 16,
    backgroundColor: '#1976d2',
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    elevation: 2,
  },
  exportText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  headerAction: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: '#e53935',
  },
});

export default OrderSummaryScreen;













