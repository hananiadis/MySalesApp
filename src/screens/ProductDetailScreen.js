import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useLocalOrRemoteImage } from '../utils/imageHelpers';
import { getImmediateStockValue } from '../utils/stockAvailability';
import { normalizeBrandKey } from '../constants/brands';

const PRODUCT_PLACEHOLDERS = {
  playmobil: require('../../assets/playmobil_product_placeholder.png'),
  kivos: require('../../assets/Kivos_placeholder.png'),
  john: require('../../assets/john_hellas_logo.png'),
};

const getStockColor = (stock) => {
  const s = Number(stock);
  if (!Number.isFinite(s)) {
    return '#1a1f36';
  }
  if (s === 0) return '#d93025';
  if (s > 0 && s <= 10) return '#fb8c00';
  if (s > 10) return '#1a1f36';
  return '#1a1f36';
};

const formatGender = (gender) => {
  if (gender === 'B') return 'Αγόρι';
  if (gender === 'G') return 'Κορίτσι';
  if (gender === 'U') return 'Unisex';
  return '—';
};

const formatDate = (date) => {
  if (!date) return '—';
  try {
    let value = date;
    if (value?.seconds) {
      value = new Date(value.seconds * 1000);
    } else if (typeof value === 'string' || typeof value === 'number') {
      value = new Date(value);
    }
    if (Number.isNaN(value.getTime())) {
      return '—';
    }
    return value.toLocaleDateString('el-GR');
  } catch (error) {
    return '—';
  }
};

const formatCurrency = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return String(value);
  }
  return `${numeric.toFixed(2).replace('.', ',')} €`;
};

const formatDiscount = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return String(value);
  }
  const base = numeric > 1 ? numeric : numeric * 100;
  return `${base.toFixed(1).replace('.', ',')}%`;
};

const isEmpty = (value) => {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim() === '';
  }
  return false;
};

const ensureLabel = (label) => {
  if (!label) return '';
  return label.trim().endsWith(':') ? label.trim() : `${label.trim()}:`;
};

const DetailRow = ({ label, value, isLink = false, onPress }) => {
  if (isEmpty(value)) {
    return null;
  }

  const content = (
    <Text
      style={[styles.value, isLink && styles.linkValue]}
      numberOfLines={isLink ? 1 : undefined}
    >
      {value}
    </Text>
  );

  if (isLink && typeof onPress === 'function') {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <View style={styles.row}>
          <Text style={styles.label}>{ensureLabel(label)}</Text>
          {content}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{ensureLabel(label)}</Text>
      {content}
    </View>
  );
};

const Section = ({ title, children }) => {
  const content = React.Children.toArray(children).filter(Boolean);
  if (!content.length) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {content}
    </View>
  );
};

const openExternalLink = async (url) => {
  if (!url) {
    return;
  }
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    }
  } catch {
    // Ignore failures silently
  }
};

const ProductDetailScreen = ({ route, navigation }) => {
  const productParam = route?.params?.product || {};
  const routeBrand = route?.params?.brand;
  const brand = useMemo(
    () => normalizeBrandKey(routeBrand || productParam.brand || 'playmobil'),
    [routeBrand, productParam.brand]
  );
  const product = useMemo(() => ({ ...productParam, brand }), [productParam, brand]);

  const placeholderSource =
    PRODUCT_PLACEHOLDERS[brand] || PRODUCT_PLACEHOLDERS.playmobil;
  const imgUri = useLocalOrRemoteImage(product.productCode, product.frontCover);

  const [immediateStock, setImmediateStock] = useState(() => {
    const raw = product?.availableStock;
    if (raw === null || raw === undefined || raw === '') {
      return 'n/a';
    }
    return String(raw);
  });

  useEffect(() => {
    if (brand !== 'playmobil') {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const value = await getImmediateStockValue(product?.productCode);
        if (cancelled) {
          return;
        }
        if (value !== null && value !== undefined && value !== '') {
          setImmediateStock(String(value));
        } else {
          setImmediateStock('n/a');
        }
      } catch {
        if (!cancelled) {
          setImmediateStock((prev) =>
            prev !== null && prev !== undefined && prev !== '' ? prev : 'n/a'
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [brand, product?.productCode]);

  const displayStock =
    immediateStock !== null && immediateStock !== undefined && immediateStock !== ''
      ? String(immediateStock)
      : 'n/a';
  const showStockButton = brand === 'playmobil';

  const handleOpenProductUrl = useCallback(() => {
    if (product?.productUrl) {
      openExternalLink(product.productUrl);
    }
  }, [product?.productUrl]);

  const renderPlaymobilDetails = () => (
    <>
      <Section title="Πληροφορίες Προϊόντος">
        <DetailRow label="Barcode" value={product.barcode} />
        <DetailRow label="Θεματική" value={product.playingTheme} />
        <DetailRow label="Συσκευασία" value={product.package} />
        <DetailRow label="Χονδρική Τιμή" value={formatCurrency(product.wholesalePrice)} />
        <DetailRow label="Λιανική Τιμή" value={formatCurrency(product.srp)} />
      </Section>
      <Section title="Κατάλογος & Διαθεσιμότητα">
        <DetailRow label="Σελίδα Καταλόγου" value={product.cataloguePage} />
        <DetailRow label="Προτεινόμενη Ηλικία" value={product.suggestedAge} />
        <DetailRow label="Φύλο" value={formatGender(product.gender)} />
        <DetailRow label="Ενεργό" value={product.isActive ? 'Ναι' : 'Όχι'} />
        <DetailRow label="Ημερομηνία Κυκλοφορίας" value={formatDate(product.launchDate)} />
      </Section>
    </>
  );

  const renderKivosDetails = () => (
    <>
      <Section title="Βασικά Στοιχεία">
        <DetailRow label="Περιγραφή" value={product.description} />
        <DetailRow label="Αναλυτική Περιγραφή" value={product.descriptionFull} />
        <DetailRow label="Brand Προμηθευτή" value={product.supplierBrand} />
        <DetailRow label="Κατηγορία" value={product.category} />
        <DetailRow label="MM" value={product.mm} />
      </Section>
      <Section title="Συσκευασία">
        <DetailRow label="Τύπος Συσκευασίας" value={product.packaging} />
        <DetailRow label="Τεμάχια ανά Συσκευασία" value={product.piecesPerPack} />
        <DetailRow label="Τεμάχια ανά Κιβώτιο" value={product.piecesPerBox} />
        <DetailRow label="Τεμάχια ανά Χαρτοκιβώτιο" value={product.piecesPerCarton} />
      </Section>
      <Section title="Τιμές & Προσφορές">
        <DetailRow label="Χονδρική Τιμή" value={formatCurrency(product.wholesalePrice)} />
        <DetailRow label="Τιμή Προσφοράς" value={formatCurrency(product.offerPrice)} />
        <DetailRow label="Έκπτωση" value={formatDiscount(product.discount)} />
        <DetailRow label="Λήξη Έκπτωσης" value={product.discountEndsAt} />
      </Section>
      <Section title="Barcodes">
        <DetailRow label="Unit" value={product.barcodeUnit} />
        <DetailRow label="Κιβώτιο" value={product.barcodeBox} />
        <DetailRow label="Χαρτοκιβώτιο" value={product.barcodeCarton} />
      </Section>
      <Section title="Σύνδεσμος">
        <DetailRow
          label="Product URL"
          value={product.productUrl}
          isLink
          onPress={handleOpenProductUrl}
        />
      </Section>
    </>
  );

  const renderJohnDetails = () => (
    <>
      <Section title="Βασικά Στοιχεία">
        <DetailRow label="Περιγραφή" value={product.description} />
        <DetailRow label="Κύρια Κατηγορία" value={product.generalCategory} />
        <DetailRow label="Υποκατηγορία" value={product.subCategory} />
        <DetailRow label="Φύλλο Σχήματος" value={product.sheetCategory} />
      </Section>
      <Section title="Τιμοκατάλογος">
        <DetailRow label="Price List" value={formatCurrency(product.priceList)} />
        <DetailRow label="Χονδρική Τιμή" value={formatCurrency(product.wholesalePrice)} />
        <DetailRow label="Λιανική Τιμή" value={formatCurrency(product.srp)} />
      </Section>
      <Section title="Συσκευασία & Διαστάσεις">
        <DetailRow label="Συσκευασία" value={product.packaging} />
        <DetailRow label="Διαστάσεις Προϊόντος" value={product.productDimensions} />
        <DetailRow label="Διαστάσεις Συσκευασίας" value={product.packageDimensions} />
      </Section>
      <Section title="Barcode">
        <DetailRow label="Barcode" value={product.barcode} />
      </Section>
      {Array.isArray(product.activeSupermarketListings) && product.activeSupermarketListings.length > 0 ? (
        <Section title="SuperMarket Listings">
          {product.activeSupermarketListings.map((entry, index) => {
            const storeLabel = entry?.storeName || entry?.storeCode || '\u0386\u03b3\u03bd\u03c9\u03c3\u03c4\u03bf';
            const categoryLabel = entry?.category || '\u039a\u03b1\u03c4\u03b7\u03b3\u03bf\u03c1\u03af\u03b1';
            const displayValue = `${storeLabel}${categoryLabel ? ' \u2022 ' + categoryLabel : ''}`;
            return (
              <DetailRow
                key={`${entry?.storeCode || 'store'}-${entry?.category || 'category'}-${index}`}
                label="\u039a\u03b1\u03c4\u03ac\u03c3\u03c4\u03b7\u03bc\u03b1"
                value={displayValue}
              />
            );
          })}
        </Section>
      ) : null}
    </>
  );

  const renderBrandSections = () => {
    if (brand === 'kivos') {
      return renderKivosDetails();
    }
    if (brand === 'john') {
      return renderJohnDetails();
    }
    return renderPlaymobilDetails();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.imageWrapper}>
        {imgUri ? (
          <Image source={{ uri: imgUri }} style={styles.productImage} resizeMode="contain" />
        ) : (
          <Image source={placeholderSource} style={styles.productImage} resizeMode="contain" />
        )}
      </View>

      <Text style={styles.code}>{product.productCode || '—'}</Text>
      <Text style={styles.description}>{product.description || '—'}</Text>

      <View style={styles.stockRow}>
        <Text style={styles.stockLabel}>Διαθεσιμότητα:</Text>
        <Text style={[styles.stockValue, { color: getStockColor(displayStock) }]}>
          {displayStock}
        </Text>
      </View>

      {renderBrandSections()}

      {showStockButton ? (
        <TouchableOpacity
          style={styles.stockDetailsButton}
          onPress={() => navigation.navigate('StockDetails', { product })}
          activeOpacity={0.8}
        >
          <Text style={styles.stockDetailsText}>Αναλυτικά στοιχεία αποθέματος</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 36,
    backgroundColor: '#ffffff',
  },
  imageWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
  productImage: {
    width: 220,
    height: 220,
    borderRadius: 16,
    backgroundColor: '#f0f4ff',
  },
  code: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f4f8f',
    textAlign: 'center',
    marginBottom: 4,
  },
  description: {
    fontSize: 18,
    fontWeight: '600',
    color: '#102a43',
    textAlign: 'center',
    marginBottom: 14,
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  stockLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#52606d',
    marginRight: 8,
  },
  stockValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1f36',
  },
  section: {
    backgroundColor: '#f6f9ff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7e3ff',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f4f8f',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  label: {
    width: 150,
    maxWidth: 180,
    fontSize: 14,
    fontWeight: '600',
    color: '#415a77',
  },
  value: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1f36',
  },
  linkValue: {
    color: '#1976d2',
    textDecorationLine: 'underline',
  },
  stockDetailsButton: {
    marginTop: 6,
    alignSelf: 'center',
    backgroundColor: '#1f4f8f',
    paddingVertical: 14,
    paddingHorizontal: 26,
    borderRadius: 12,
  },
  stockDetailsText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
});

export default ProductDetailScreen;
