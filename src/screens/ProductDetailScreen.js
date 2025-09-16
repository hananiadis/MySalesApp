import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalOrRemoteImage } from '../utils/imageHelpers';
import { getImmediateStockValue } from '../utils/stockAvailability';

const getStockColor = (stock) => {
  const s = Number(stock);
  if (s === 0) return '#FF3333'; // Red
  if (s > 0 && s <= 10) return '#FFA500'; // Orange
  if (s > 10) return '#222'; // Black
  return '#222';
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
    if (date.seconds) date = new Date(date.seconds * 1000);
    else if (typeof date === 'string' || typeof date === 'number') date = new Date(date);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('el-GR');
  } catch {
    return '—';
  }
};

const ProductDetailScreen = ({ route, navigation }) => {
  const { product } = route.params;
  const imgUri = useLocalOrRemoteImage(product.productCode, product.frontCover);
  const [immediateStock, setImmediateStock] = useState(product?.availableStock ?? null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const value = await getImmediateStockValue(product?.productCode);
        if (!cancelled) {
          if (value != null && value !== '') setImmediateStock(value);
          else setImmediateStock('n/a');
        }
      } catch {
        if (!cancelled && (immediateStock == null || immediateStock === '')) setImmediateStock('n/a');
      }
    })();
    return () => { cancelled = true; };
  }, [product?.productCode]);

  const displayStockRaw = immediateStock;
  const displayStock = displayStockRaw != null && displayStockRaw !== '' ? String(displayStockRaw) : 'n/a';
  const isStockNA = displayStock === 'n/a';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Image, code, description */}
      {imgUri ? (
        <Image source={{ uri: imgUri }} style={styles.productImage} resizeMode="contain" />
      ) : (
        <View style={styles.placeholderImage} />
      )}
      <Text style={styles.code}>{product.productCode}</Text>
      <Text style={styles.desc}>{product.description}</Text>

      <DetailRow label="Barcode" value={product.barcode} />
      <DetailRow label="Θέμα" value={product.playingTheme} />
      <DetailRow label="Χονδρική Τιμή" value={product.wholesalePrice !== undefined ? `€${Number(product.wholesalePrice).toFixed(2)}` : '—'} />
      <DetailRow label="Π.Λ.Τ." value={product.srp !== undefined ? `€${Number(product.srp).toFixed(2)}` : '—'} />
      <DetailRow label="Συσκευασία" value={product.package} />
      <DetailRow label="Σελίδα Καταλόγου" value={product.cataloguePage} />
      <DetailRow label="Ηλικία" value={product.suggestedAge} />
      <DetailRow label="Φύλο" value={formatGender(product.gender)} />
      <DetailRow label="Ενεργό" value={product.isActive ? 'Ναι' : 'Όχι'} />
      <DetailRow label="Μήνας Λανσαρίσματος" value={product.launchDate ?? '—'} />

      <View style={styles.stockRow}>
        <Text style={styles.label}>Stock: </Text>
        <Text style={[
          styles.value,
          { color: getStockColor(displayStock) }
        ]}>
          {displayStock}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.stockDetailsButton}
        onPress={() => navigation.navigate('StockDetails', { product })}
      >
        <Text style={styles.buttonText}>Αναλυτικά Αποθέματα</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const DetailRow = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}: </Text>
    <Text style={styles.value}>{value ?? '—'}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { padding: 18, backgroundColor: '#fff', alignItems: 'center' },
  productImage: {
    width: 200, height: 200, borderRadius: 15, backgroundColor: '#F4F6FA', marginBottom: 15,
  },
  placeholderImage: {
    width: 200, height: 200, borderRadius: 15, backgroundColor: '#eee', marginBottom: 15,
  },
  code: { fontSize: 22, fontWeight: 'bold', color: '#007AFF', marginBottom: 7 },
  desc: { fontSize: 19, fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 16 },
  row: { flexDirection: 'row', marginBottom: 6, alignSelf: 'flex-start' },
  stockRow: { flexDirection: 'row', marginTop: 12, marginBottom: 16, alignSelf: 'flex-start' },
  label: { fontWeight: '600', color: '#777', width: 150 },
  value: { fontWeight: 'bold', color: '#222' },
  stockNAValue: { color: '#d32f2f', fontWeight: 'bold' },
  stockDetailsButton: {
    marginTop: 24,
    backgroundColor: '#007AFF',
    paddingVertical: 13,
    paddingHorizontal: 26,
    borderRadius: 10,
  },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16, textAlign: 'center' },
});

export default ProductDetailScreen;
