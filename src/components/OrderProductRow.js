import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useLocalOrRemoteImage } from '../utils/imageHelpers';
import { normalizeBrandKey } from '../constants/brands';

const PLACEHOLDERS = {
  playmobil: require('../../assets/playmobil_product_placeholder.png'),
  kivos: require('../../assets/Kivos_placeholder.png'),
  john: require('../../assets/john_hellas_logo.png'),
};

export default function OrderProductRow({
  item,
  onInfoPress,
  brand = 'playmobil',
}) {
  const resolvedBrand = normalizeBrandKey(item?.brand || brand);
  const placeholderSource = PLACEHOLDERS[resolvedBrand] || PLACEHOLDERS.playmobil;
  const imgUri = useLocalOrRemoteImage(item.productCode, item.frontCover, false);

  return (
    <View style={styles.row}>
      <Image
        source={imgUri ? { uri: imgUri } : placeholderSource}
        style={styles.image}
        resizeMode="contain"
      />
      <View style={styles.infoCol}>
        {/* Code and description together as trigger for modal/info */}
        <TouchableOpacity
          onPress={() => onInfoPress(item)}
          style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}
          activeOpacity={0.7}
        >
          <Text style={styles.code}>
            {String(item.productCode ?? '')}
          </Text>
          <Text style={styles.desc}>
            {'  '}
            {typeof item.description === 'string'
              ? item.description
              : JSON.stringify(item.description)}
          </Text>
        </TouchableOpacity>
        {/* Below: availability and price info */}
        <View style={styles.subRow}>
          <Text style={styles.sublabel}>
            Stock: {String(item.availableStock ?? '-')}
          </Text>
          <Text style={styles.sublabel}>
            Χονδ.: €{String(item.wholesalePrice ?? '')}
          </Text>
          <Text style={styles.sublabel}>
            Λιαν.: €{String(item.srp ?? '')}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    marginVertical: 5,
    padding: 10,
    elevation: 1,
    shadowColor: '#007AFF',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  image: { width: 54, height: 54, borderRadius: 10, backgroundColor: '#e6e6e6', marginRight: 13 },
  infoCol: { flex: 1, minWidth: 120 },
  code: { fontWeight: 'bold', color: '#007AFF', fontSize: 15, marginBottom: 0 },
  desc: { fontWeight: 'bold', color: '#212121', fontSize: 15 },
  subRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 7,
    marginLeft: 3,
  },
  sublabel: { color: '#555', fontSize: 13, marginRight: 13 },
});
