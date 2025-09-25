// src/screens/OrderDetailScreen.js
import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import SafeScreen from '../components/SafeScreen';
import { useOrder } from '../context/OrderContext';

export default function OrderDetailScreen({ navigation }) {
  const { orderLines, setOrderLines, customer } = useOrder();

  const lines = useMemo(
    () => (Array.isArray(orderLines) ? orderLines.filter(Boolean) : []),
    [orderLines]
  );

  const adjustQty = (code, delta) => {
    setOrderLines((prev) =>
      (Array.isArray(prev) ? prev : []).map((l) =>
        l.productCode === code
          ? { ...l, quantity: Math.max(1, Number(l.quantity || 1) + delta) }
          : l
      )
    );
  };

  const handleQtyChange = (code, val) => {
    const parsed = Math.max(
      1,
      parseInt(String(val).replace(/[^0-9]/g, ''), 10) || 1
    );
    setOrderLines((prev) =>
      (Array.isArray(prev) ? prev : []).map((l) =>
        l.productCode === code ? { ...l, quantity: parsed } : l
      )
    );
  };

  const removeLine = (code) => {
    setOrderLines((prev) =>
      (Array.isArray(prev) ? prev : []).filter((l) => l.productCode !== code)
    );
  };

  const headerRight = (
    <TouchableOpacity onPress={() => navigation.navigate('OrderReviewScreen')}>
      <Icon name="checkmark-done-outline" size={22} color="#1976d2" />
    </TouchableOpacity>
  );

  return (
    <SafeScreen title="Καλάθι" headerRight={headerRight}>
      {customer ? (
        <View style={styles.customerBar}>
          <Icon name="person-circle-outline" size={18} color="#1976d2" />
          <Text style={styles.customerName} numberOfLines={1}>
            {customer?.name || customer?.displayName || '—'}
          </Text>
        </View>
      ) : null}

      {lines.length === 0 ? (
        <View style={{ marginTop: 20 }}>
          <Text style={{ textAlign: 'center', color: '#6b7280' }}>
            Δεν υπάρχουν προϊόντα στο καλάθι.
          </Text>
          <TouchableOpacity
            style={[styles.bottomPrimary, { marginTop: 14, position: 'relative' }]}
            onPress={() => navigation.goBack()}
          >
            <Icon name="add-outline" size={18} color="#fff" />
            <Text style={styles.bottomPrimaryText}>Προσθήκη προϊόντων</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={lines}
            keyExtractor={(item) => String(item.productCode)}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.code}>{item.productCode}</Text>
                  <Text style={styles.title} numberOfLines={1}>
                    {item.description}
                  </Text>
                  <Text style={styles.sub}>
                    Χονδρική: €{Number(item.wholesalePrice || 0).toFixed(2)} ·
                    Λιανική: €{Number(item.srp || 0).toFixed(2)}
                  </Text>
                </View>

                <View style={styles.qtyBoxRow}>
                  <TouchableOpacity
                    onPress={() => adjustQty(item.productCode, -1)}
                    style={styles.qtyTouch}
                  >
                    <Text style={styles.qtyBtn}>-</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.qtyInput}
                    keyboardType="numeric"
                    value={String(item.quantity)}
                    onChangeText={(val) => handleQtyChange(item.productCode, val)}
                    maxLength={4}
                    returnKeyType="done"
                    blurOnSubmit
                  />
                  <TouchableOpacity
                    onPress={() => adjustQty(item.productCode, +1)}
                    style={styles.qtyTouch}
                  >
                    <Text style={styles.qtyBtn}>+</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={() => removeLine(item.productCode)}>
                  <Icon name="trash-outline" size={20} color="#b91c1c" />
                </TouchableOpacity>
              </View>
            )}
          />

          <TouchableOpacity
            style={styles.bottomPrimary}
            onPress={() => navigation.navigate('OrderReviewScreen')}
          >
            <Icon name="checkmark-done-outline" size={18} color="#fff" />
            <Text style={styles.bottomPrimaryText}>Συνέχεια</Text>
          </TouchableOpacity>
        </>
      )}
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  customerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e9f3ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 6,
  },
  customerName: {
    marginLeft: 6,
    fontSize: 13,
    color: '#1f2937',
    fontWeight: '600',
  },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: '#e5e7eb' },
  row: {
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  code: { color: '#1565c0', fontWeight: '700' },
  title: { color: '#111827', fontSize: 15, fontWeight: '600', marginTop: 2 },
  sub: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  qtyBoxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    minHeight: 36,
    minWidth: 96,
    paddingHorizontal: 4,
    borderWidth: 1.2,
    borderColor: '#1976d2',
    borderRadius: 8,
  },
  qtyTouch: { paddingHorizontal: 6, paddingVertical: 4 },
  qtyBtn: { fontSize: 22, color: '#1976d2', fontWeight: 'bold' },
  qtyInput: {
    width: 42,
    height: 32,
    textAlign: 'center',
    fontSize: 16,
    color: '#111',
    marginHorizontal: 3,
    backgroundColor: '#f5fafd',
    borderRadius: 5,
    fontWeight: 'bold',
    paddingVertical: 0,
  },
  bottomPrimary: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 16,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#1976d2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 3,
  },
  bottomPrimaryText: { color: '#fff', fontWeight: 'bold' },
});
