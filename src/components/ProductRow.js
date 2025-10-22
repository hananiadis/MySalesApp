// src/components/ProductRow.js
import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useLocalOrRemoteImage } from '../utils/imageHelpers';
import { normalizeBrandKey } from '../constants/brands';

const PRODUCT_PLACEHOLDERS = {
  playmobil: require('../../assets/playmobil_product_placeholder.png'),
  kivos: require('../../assets/Kivos_placeholder.png'),
  john: require('../../assets/john_hellas_logo.png'),
};

const getStockColor = (stock) => {
  const s = Number(stock);
  if (s === 0) return '#FF3333';
  if (s > 0 && s <= 10) return '#FFA500';
  if (s > 10) return '#222';
  return '#222';
};

const ProductRow = ({ item, onPress, onQuickAdd, brand = 'playmobil' }) => {
  const imgUri = useLocalOrRemoteImage(item.productCode, item.frontCover);
  const resolvedBrand = normalizeBrandKey(item?.brand || brand);
  const placeholderSource = PRODUCT_PLACEHOLDERS[resolvedBrand] || PRODUCT_PLACEHOLDERS.playmobil;

  const stock = item.availableStock ?? '—';
  const numericStock = Number(stock);
  const isOutOfStock = !Number.isNaN(numericStock) && numericStock === 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.productTouchable}
    >
      <View style={styles.itemContainer}>
        <Image
          source={
            imgUri
              ? { uri: imgUri }
              : placeholderSource
          }
          style={styles.productImage}
          resizeMode="cover"
        />
        <View style={styles.productInfo}>
          <View style={styles.codeDescRow}>
            <Text style={styles.productCode}>{item.productCode}</Text>
            <Text style={styles.desc}>{item.description}</Text>
          </View>
          <View style={styles.infoRow}>
            {isOutOfStock
              ? (
                <View style={styles.stockPill}>
                  <Text style={[styles.stockPillText, { fontSize: 12 }]}>Stock: 0</Text>
                </View>
              )
              : (
                <Text style={styles.stock}>
                  Stock: {stock}
                </Text>
              )}
            <Text style={styles.price}>
              Χ.Τ.: <Text style={styles.priceValue}>
                {item.wholesalePrice !== undefined ? `€${Number(item.wholesalePrice).toFixed(2)}` : '—'}
              </Text>
            </Text>
            <Text style={styles.price}>
              Π.Λ.Τ.: <Text style={styles.priceValue}>
                {item.srp !== undefined ? `€${Number(item.srp).toFixed(2)}` : '—'}
              </Text>
            </Text>
            <TouchableOpacity
              style={styles.quickAddBtn}
              onPress={onQuickAdd}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPressIn={ev => ev.stopPropagation && ev.stopPropagation()}
            >
              <Ionicons name="cart-outline" size={18} color="#00ADEF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // ... (copy the relevant style rules from ProductsScreen.js)
  // Or you can import styles if you have a shared style file.
  productTouchable: { marginBottom: 2 },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F4F6FA',
    marginVertical: 3,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    elevation: 1,
    minHeight: 85,
  },
  productImage: {
    width: 48,
    height: 48,
    borderRadius: 7,
    backgroundColor: '#e0e0e0',
    marginRight: 12,
    alignSelf: 'flex-start',
  },
  productInfo: { flex: 1, justifyContent: 'center' },
  codeDescRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 3,
    flexWrap: 'wrap',
    gap: 8,
  },
  productCode: { fontSize: 17, fontWeight: 'bold', color: '#007AFF', marginRight: 7 },
  desc: { fontSize: 17, fontWeight: 'bold', color: '#212121', flexShrink: 1 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 2,
    marginBottom: 3,
  },
  stock: {
    fontSize: 13,
    fontWeight: 'bold',
    minWidth: 20,
    marginRight: 8,
  },
  price: {
    fontSize: 12,
    color: '#444',
    marginRight: 4,
  },
  priceValue: {
    fontWeight: 'bold',
    color: '#007AFF',
    fontSize: 12,
  },
  quickAddBtn: {
    marginLeft: 'auto',
    padding: 4,
    backgroundColor: '#e6f6fa',
    borderRadius: 14,
    alignSelf: 'center',
  },
  stockPill: {
    backgroundColor: '#FF3333',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 1,
    marginRight: 7,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
  },
  stockPillText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});

export default ProductRow;
