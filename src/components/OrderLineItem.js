// src/components/OrderLineItem.js
import React from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

export default function OrderLineItem({ 
  line, 
  editable = false, 
  onQtyChange, 
  onRemove 
}) {
  return (
    <View style={styles.lineRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.lineCode}>{line.productCode}</Text>
        <Text style={styles.lineDesc}>{line.description}</Text>
      </View>
      <View style={styles.qtyBlock}>
        {editable ? (
          <>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => onQtyChange(line.productCode, Math.max((parseInt(line.quantity) || 0) - 1, 0))}
            >
              <Ionicons name="remove-circle-outline" size={20} color="#007AFF" />
            </TouchableOpacity>
            <TextInput
              style={styles.qtyInput}
              keyboardType="numeric"
              value={String(line.quantity)}
              onChangeText={val => onQtyChange(line.productCode, val.replace(/[^0-9]/g, ''))}
              maxLength={4}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => onQtyChange(line.productCode, (parseInt(line.quantity) + 1).toString())}
            >
              <Ionicons name="add-circle-outline" size={20} color="#007AFF" />
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.lineQty}>x{line.quantity}</Text>
        )}
      </View>
      <Text style={styles.linePrice}>€{Number(line.wholesalePrice).toFixed(2)}</Text>
      {editable && (
        <TouchableOpacity onPress={() => onRemove(line.productCode)}>
          <Ionicons name="close-outline" size={20} color="#e53935" style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  lineRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 10, marginVertical: 3, padding: 10, elevation: 1,
  },
  lineCode: { fontWeight: 'bold', color: '#007AFF', fontSize: 15 },
  lineDesc: { color: '#222', fontSize: 15 },
  qtyBlock: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12 },
  qtyBtn: { paddingHorizontal: 3 },
  qtyInput: {
    width: 34, textAlign: 'center', fontSize: 16, fontWeight: 'bold',
    color: '#222', backgroundColor: '#f4f4f4', borderRadius: 6, marginHorizontal: 3
  },
  linePrice: { minWidth: 64, textAlign: 'right', color: '#333', fontWeight: 'bold' },
  lineQty: { fontWeight: 'bold', fontSize: 16, color: '#00599d', marginLeft: 4 },
});
