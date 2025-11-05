import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Image,
} from 'react-native';
import Share from 'react-native-share';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOrder } from '../context/OrderContext';
import { exportOrderAsXLSX } from '../utils/exportOrderUtils';
import { computeOrderTotals } from '../utils/orderTotals';
import { exportSupermarketXLSX } from '../utils/exportSupermarketXLSX';
import { canonicalCode } from '../utils/codeNormalization';

const STRINGS = {
  screenTitle: 'Σύνοψη Παραγγελίας SuperMarket',
  storeInfo: 'Στοιχεία καταστήματος',
  orderInfo: 'Στοιχεία παραγγελίας',
  productsInfo: 'Πληροφορίες προϊόντων',
  totalsInfo: 'Σύνολα',
  exportOptions: 'Επιλογές εξαγωγής',
  exportOrderOnly: 'Εξαγωγή μόνο παραγγελίας',
  exportFullListing: 'Εξαγωγή πλήρους listing',
  exportOrderOnlyDesc: 'Δημιουργεί αρχείο μόνο με τα προϊόντα της παραγγελίας.',
  exportFullListingDesc: 'Δημιουργεί αρχείο με όλη τη λίστα προϊόντων και τα στοιχεία αποθέματος.',
  includeImages: 'Συμπερίληψη εικόνων',
  includeImagesDesc: 'Προσθέτει εικόνες προϊόντων στο αρχείο (αυξάνει το μέγεθος)',
  netValue: 'Καθαρή αξία',
  vat: 'ΦΠΑ 24%',
  totalValue: 'Συνολική αξία',
  confirmOrder: 'Οριστικοποίηση παραγγελίας',
  exportOrder: 'Εξαγωγή παραγγελίας',
  cancelOrder: 'Ακύρωση',
  error: 'Σφάλμα',
  exportFailed: 'Η εξαγωγή απέτυχε. Προσπαθήστε ξανά.',
  confirmCancel: 'Επιβεβαίωση ακύρωσης',
  cancelMessage: 'Θέλετε σίγουρα να ακυρώσετε την παραγγελία;',
  noProductsError: 'Δεν υπάρχουν προϊόντα για εξαγωγή.',
  cancelFailed: 'Η ακύρωση δεν ολοκληρώθηκε. Προσπαθήστε ξανά.',
  yes: 'Ναι',
  no: 'Όχι',
  orderNumber: 'Αριθμός παραγγελίας',
  createdAt: 'Ημερομηνία δημιουργίας',
  storeName: 'Όνομα καταστήματος',
  storeCode: 'Κωδικός καταστήματος',
  storeCategory: 'Κατηγορία καταστήματος',
  companyName: 'Επωνυμία',
  totalProducts: 'Σύνολο προϊόντων',
  totalQuantity: 'Συνολική ποσότητα',
  notes: 'Σημειώσεις',
  noNotes: 'Δεν υπάρχουν σημειώσεις.',
  packagingLabel: 'Συσκευασία',
  unitsSuffix: ' τεμ.',
  newBadge: 'ΝΕΟ',
  srpInfo: 'Λιανική τιμή',
  stockInfo: 'Απόθεμα',
  suggestedInfo: 'Προτεινόμενη',
  quantityLabel: 'Ποσότητα:',
  wholesaleLabel: 'Χονδρική:',
  postExportTitle: 'Η εξαγωγή ολοκληρώθηκε',
  postExportMessage: 'Τι θέλετε να κάνετε στη συνέχεια;',
  newOrderOption: 'Νέα παραγγελία SuperMarket',
  backToJohnOption: 'Επιστροφή στην οθόνη John',
  cancelOption: 'Ακύρωση',
  productCountSuffix: ' προϊόντα',
  exporting: 'Γίνεται εξαγωγή...',
  reviewShortcut: 'Επιστροφή στην ανασκόπηση',
};

const SYMBOLS = {
  euro: '€',
};

const formatEuro = (value) => `${SYMBOLS.euro}${Number(value || 0).toFixed(2)}`;

const SuperMarketOrderSummaryScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const { order, cancelOrder, markOrderSent } = useOrder();

  const isSuperMarket = order?.orderType === 'supermarket';
  const [loading, setLoading] = useState(false);
  const [showProducts, setShowProducts] = useState(true);
  const [exportMode, setExportMode] = useState('order'); // 'order' or 'listing'
  const [includeImages, setIncludeImages] = useState(true); // NEW: default to TRUE for images

  const linesData = Array.isArray(order?.lines) ? order.lines : [];
  const hasProducts = linesData.length > 0;
  const allListings = useMemo(() => {
    if (Array.isArray(order?.supermarketListings) && order.supermarketListings.length) {
      return order.supermarketListings;
    }
    if (Array.isArray(order?.listings) && order.listings.length) {
      return order.listings;
    }
    return [];
  }, [order?.supermarketListings, order?.listings]);

  const customer = order?.customer || {};
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

  const totalQuantity = useMemo(() => {
    return linesData.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
  }, [linesData]);

  const totals = useMemo(
    () =>
      computeOrderTotals({
        lines: linesData,
        brand: order?.brand,
        paymentMethod: order?.paymentMethod,
        customer,
      }),
    [linesData, order?.brand, order?.paymentMethod, customer]
  );
  const netValue = Number.isFinite(totals.net) ? totals.net : 0;
  const vatValue = Number.isFinite(totals.vat) ? totals.vat : 0;
  const totalValue = Number.isFinite(totals.total) ? totals.total : netValue + vatValue;

  const showPostExportDialog = useCallback(() => {
    Alert.alert(
      STRINGS.postExportTitle,
      STRINGS.postExportMessage,
      [
        {
          text: STRINGS.backToJohnOption,
          onPress: () => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'John' }],
            });
          },
        },
        {
          text: STRINGS.newOrderOption,
          onPress: () => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'SuperMarketOrderFlow' }],
            });
          },
        },
        { text: STRINGS.cancelOption, style: 'cancel' },
      ],
      { cancelable: true }
    );
  }, [navigation]);

  const goToReview = useCallback(() => {
    navigation.navigate('SuperMarketOrderReview', {
      store: route?.params?.store,
      orderId: route?.params?.orderId,
      brand: route?.params?.brand,
      fromSummary: true,
    });
  }, [navigation, route?.params?.brand, route?.params?.orderId, route?.params?.store]);

  const createExportPayload = useCallback(async () => {
    const sentOrder = await markOrderSent();
    const exportPayload =
      sentOrder || {
        ...order,
        status: 'sent',
        sent: true,
        exported: true,
        exportedAt: new Date().toISOString(),
      };
    exportPayload.netValue = netValue;
    exportPayload.vatValue = vatValue;
    exportPayload.totalValue = totalValue;
    return exportPayload;
  }, [markOrderSent, order, netValue, vatValue, totalValue]);

  const runSupermarketExport = useCallback(
    async (fullList) => {
      const baseProducts = fullList
        ? (allListings.length ? allListings : linesData)
        : linesData.filter((line) => Number(line.quantity || line.qty || 0) > 0);

      if (!baseProducts.length) {
        Alert.alert(STRINGS.error, STRINGS.noProductsError);
        return;
      }

      const quantityMap = new Map();
      linesData.forEach((line = {}) => {
        const key = canonicalCode(line.productCode || line.code || line.masterCode);
        if (!key) return;
        quantityMap.set(key, Number(line.quantity ?? line.qty ?? 0));
      });

      if (isMounted.current) setLoading(true);
      try {
        const exportPayload = await createExportPayload();
        const normalizedProducts = baseProducts.map((item = {}) => {
          const key = canonicalCode(item.productCode || item.code || item.masterCode);
          const mappedQuantity = quantityMap.has(key) ? quantityMap.get(key) : item.quantity;
          return {
            ...item,
            quantity: Number(mappedQuantity ?? 0),
          };
        });

        // Pass includeImages as 4th parameter
        await exportSupermarketXLSX(normalizedProducts, exportPayload, fullList, includeImages);
        setTimeout(() => {
          if (isMounted.current) showPostExportDialog();
        }, 200);
      } catch (error) {
        console.error('[SuperMarket] XLSX export failed:', error);
        Alert.alert(STRINGS.error, STRINGS.exportFailed);
      } finally {
        if (isMounted.current) setLoading(false);
      }
    },
    [allListings, linesData, includeImages, createExportPayload, showPostExportDialog]
  );

  const handleExport = useCallback(async () => {
    const allowEmptyExport = isSuperMarket && exportMode === 'listing';

    if (!allowEmptyExport && !hasProducts) {
      Alert.alert(STRINGS.error, STRINGS.noProductsError);
      return;
    }

    if (isSuperMarket) {
      await runSupermarketExport(exportMode === 'listing');
      return;
    }

    if (isMounted.current) setLoading(true);
    try {
      const exportPayload = await createExportPayload();
      const exportConfig = { mode: 'order', includeImages: false };
      const { uri, fileName, mime } = await exportOrderAsXLSX(exportPayload, exportConfig);

      await Share.open({
        url: uri,
        type: mime,
        failOnCancel: false,
        filename: fileName,
      });
      setTimeout(() => {
        if (isMounted.current) showPostExportDialog();
      }, 200);
    } catch (err) {
      Alert.alert(STRINGS.error, String(err?.message || STRINGS.exportFailed));
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [
    isSuperMarket,
    hasProducts,
    exportMode,
    createExportPayload,
    showPostExportDialog,
    runSupermarketExport,
  ]);

  const handleCancel = useCallback(() => {
    Alert.alert(
      STRINGS.confirmCancel,
      STRINGS.cancelMessage,
      [
        { text: STRINGS.no, style: 'cancel' },
        {
          text: STRINGS.yes,
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelOrder();
              navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
              });
            } catch (error) {
              Alert.alert(STRINGS.error, STRINGS.cancelFailed);
            }
          },
        },
      ]
    );
  }, [cancelOrder, navigation]);

  const renderProductRow = ({ item: line, index }) => {
    const stockLevel = Number(line.currentStock || 0);
    const stockColor = stockLevel > 10 ? '#10b981' : stockLevel > 0 ? '#f59e0b' : '#ef4444';
    const displayCode = line.displayProductCode || line.productCode;
    const packagingLabel = line.packaging || '-';
    const wholesaleValue = Number(line.wholesalePrice ?? line.price ?? 0);
    const formattedWholesale = formatEuro(wholesaleValue);
    const srpValue = Number(line.srp ?? 0);
    const formattedSrp = Number.isFinite(srpValue) && srpValue > 0 ? formatEuro(srpValue) : null;
    
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
          <Text style={styles.productCode}>{displayCode}</Text>
          <Text style={styles.productDescription} numberOfLines={2}>
            {line.description}
          </Text>
          
          <View style={styles.productDetails}>
            <View style={styles.stockContainer}>
              <View style={[styles.stockIndicator, { backgroundColor: stockColor }]} />
              <Text style={styles.stockText}>
                {STRINGS.stockInfo}: {stockLevel}{STRINGS.unitsSuffix}
              </Text>
            </View>
            <Text style={styles.stockText}>{STRINGS.packagingLabel}: {packagingLabel}</Text>
            
            {line.suggestedQty > 0 && (
              <Text style={styles.suggestedText}>
                {STRINGS.suggestedInfo}: {line.suggestedQty}{STRINGS.unitsSuffix}
              </Text>
            )}
            
            {line.isNew && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>{STRINGS.newBadge}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.priceRow}>
            <Text style={styles.priceText}>
              {STRINGS.wholesaleLabel} {formattedWholesale}
            </Text>
            {formattedSrp && (
              <Text style={styles.srpText}>
                {STRINGS.srpInfo}: {formattedSrp}
              </Text>
            )}
          </View>
        </View>
        
        <View style={styles.quantityInfo}>
          <Text style={styles.quantityLabel}>{STRINGS.quantityLabel}</Text>
          <Text style={styles.quantityValue}>{line.quantity}{STRINGS.unitsSuffix}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.quickNavRow}>
          <TouchableOpacity
            style={styles.quickNavButton}
            onPress={goToReview}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={16} color="#1f4f8f" />
            <Text style={styles.quickNavText}>{STRINGS.reviewShortcut}</Text>
          </TouchableOpacity>
        </View>

        {/* Store Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{STRINGS.storeInfo}</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{STRINGS.storeName}:</Text>
              <Text style={styles.infoValue}>{order?.storeName || customer?.name || '-'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{STRINGS.storeCode}:</Text>
              <Text style={styles.infoValue}>{order?.storeCode || customer?.customerCode || '-'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{STRINGS.storeCategory}:</Text>
              <Text style={styles.infoValue}>{storeCategoryLabel || '-'}</Text>
            </View>
            {companyName && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{STRINGS.companyName}:</Text>
                <Text style={styles.infoValue}>{companyName}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Order Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{STRINGS.orderInfo}</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{STRINGS.orderNumber}:</Text>
              <Text style={styles.infoValue}>{order?.number || order?.id || '-'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{STRINGS.createdAt}:</Text>
              <Text style={styles.infoValue}>
                {order?.createdAt ? new Date(order.createdAt).toLocaleString() : '-'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{STRINGS.totalProducts}:</Text>
              <Text style={styles.infoValue}>{linesData.length}{STRINGS.productCountSuffix}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{STRINGS.totalQuantity}:</Text>
              <Text style={styles.infoValue}>{totalQuantity}{STRINGS.unitsSuffix}</Text>
            </View>
          </View>
        </View>

        {/* Products Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setShowProducts(!showProducts)}
            activeOpacity={0.7}
          >
            <Text style={styles.sectionTitle}>{STRINGS.productsInfo}</Text>
            <Ionicons
              name={showProducts ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#6b7280"
            />
          </TouchableOpacity>

          {showProducts && (
            <View style={styles.productsCard}>
              {linesData.length === 0 ? (
                <Text style={styles.emptyText}>{STRINGS.noProductsError}</Text>
              ) : (
                linesData.map((line, index) => (
                  <View key={`${line.productCode}-${index}`}>
                    {renderProductRow({ item: line, index })}
                    {index < linesData.length - 1 && <View style={styles.productSeparator} />}
                  </View>
                ))
              )}
            </View>
          )}
        </View>

        {/* Totals Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{STRINGS.totalsInfo}</Text>
          <View style={styles.totalsCard}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{STRINGS.netValue}</Text>
              <Text style={styles.totalValue}>{formatEuro(netValue)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{STRINGS.vat}</Text>
              <Text style={styles.totalValue}>{formatEuro(vatValue)}</Text>
            </View>
            <View style={[styles.totalRow, styles.finalTotalRow]}>
              <Text style={styles.finalTotalLabel}>{STRINGS.totalValue}</Text>
              <Text style={styles.finalTotalValue}>{formatEuro(totalValue)}</Text>
            </View>
          </View>
        </View>

        {/* Notes Section */}
        {order?.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{STRINGS.notes}</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{order.notes}</Text>
            </View>
          </View>
        )}

        {/* Export Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{STRINGS.exportOptions}</Text>
          
          <TouchableOpacity
            style={[styles.exportOption, exportMode === 'order' && styles.exportOptionSelected]}
            onPress={() => setExportMode('order')}
            activeOpacity={0.7}
          >
            <View style={styles.exportOptionHeader}>
              <Ionicons 
                name={exportMode === 'order' ? 'radio-button-on' : 'radio-button-off'} 
                size={20} 
                color={exportMode === 'order' ? '#1976d2' : '#9ca3af'} 
              />
              <Text style={[styles.exportOptionTitle, exportMode === 'order' && styles.exportOptionTitleSelected]}>
                {STRINGS.exportOrderOnly}
              </Text>
            </View>
            <Text style={styles.exportOptionDesc}>{STRINGS.exportOrderOnlyDesc}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.exportOption, exportMode === 'listing' && styles.exportOptionSelected]}
            onPress={() => setExportMode('listing')}
            activeOpacity={0.7}
          >
            <View style={styles.exportOptionHeader}>
              <Ionicons 
                name={exportMode === 'listing' ? 'radio-button-on' : 'radio-button-off'} 
                size={20} 
                color={exportMode === 'listing' ? '#1976d2' : '#9ca3af'} 
              />
              <Text style={[styles.exportOptionTitle, exportMode === 'listing' && styles.exportOptionTitleSelected]}>
                {STRINGS.exportFullListing}
              </Text>
            </View>
            <Text style={styles.exportOptionDesc}>{STRINGS.exportFullListingDesc}</Text>
          </TouchableOpacity>

          {/* Image inclusion option */}
          <TouchableOpacity
            style={[styles.exportOption, includeImages && styles.exportOptionSelected]}
            onPress={() => setIncludeImages(!includeImages)}
            activeOpacity={0.7}
          >
            <View style={styles.exportOptionHeader}>
              <Ionicons 
                name={includeImages ? 'checkbox' : 'square-outline'} 
                size={20} 
                color={includeImages ? '#1976d2' : '#9ca3af'} 
              />
              <Text style={[styles.exportOptionTitle, includeImages && styles.exportOptionTitleSelected]}>
                {STRINGS.includeImages}
              </Text>
            </View>
            <Text style={styles.exportOptionDesc}>{STRINGS.includeImagesDesc}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.actionButtons, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          disabled={loading}
        >
          <Text style={styles.cancelButtonText}>{STRINGS.cancelOrder}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.exportButton, loading && styles.exportButtonDisabled]}
          onPress={handleExport}
          disabled={loading}
        >
          {loading ? (
            <View style={styles.loadingContent}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.exportButtonText}>{STRINGS.exporting}</Text>
            </View>
          ) : (
            <>
              <Ionicons name="download-outline" size={20} color="#fff" />
              <Text style={styles.exportButtonText}>{STRINGS.exportOrder}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#1f2937',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    flex: 1,
    textAlign: 'right',
  },
  productsCard: {
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
  quantityInfo: {
    alignItems: 'center',
  },
  quantityLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  quantityValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1976d2',
  },
  productSeparator: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginHorizontal: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 14,
    padding: 20,
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
  notesCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#1f2937',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  notesText: {
    fontSize: 14,
    color: '#0f172a',
    lineHeight: 20,
  },
  exportOption: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    shadowColor: '#1f2937',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  exportOptionSelected: {
    borderColor: '#1976d2',
    backgroundColor: '#f8fafc',
  },
  exportOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  exportOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginLeft: 12,
  },
  exportOptionTitleSelected: {
    color: '#1976d2',
  },
  exportOptionDesc: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  exportButton: {
    flex: 2,
    backgroundColor: '#1976d2',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginLeft: 8,
    shadowColor: '#1f2937',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  exportButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginLeft: 8,
  },
  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SuperMarketOrderSummaryScreen;
