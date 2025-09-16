// src/screens/OrderReviewScreen.js
import React, { useRef, useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Alert, KeyboardAvoidingView, ScrollView, Platform, Keyboard } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrder } from '../context/OrderContext';

const paymentOptions = [
  { key: 'prepaid_cash', label: 'Μετρητά (έκπτωση 3%)' },
  { key: 'free_shipping', label: 'Ελεύθερα' },
  { key: 'premium_invoicing', label: 'Προνομιακή Πιστωτική Πολιτική' },
  { key: 'bank_cheque', label: 'Επιταγή Ροής' },
];

function calcSummary(lines, paymentMethod) {
  const net = lines.reduce((sum, l) => sum + (Number(l.quantity || 0) * Number(l.wholesalePrice || 0)), 0);
  const discount = paymentMethod === 'prepaid_cash' ? net * 0.03 : 0;
  const vat = (net - discount) * 0.24;
  const total = net - discount + vat;
  return { net, discount, vat, total };
}

export default function OrderReviewScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);

  const { orderLines, setOrderLines, notes, setNotes, paymentMethod, setPaymentMethod, updateCurrentOrder } = useOrder();

  const [collapsed, setCollapsed] = useState(false);
  const [kbPad, setKbPad] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => {
      setKbPad(e?.endCoordinates?.height ? e.endCoordinates.height : 260);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbPad(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const lines = Array.isArray(orderLines) ? orderLines : [];
  const filteredOrderLines = lines.filter(l => l && l.productCode);
  const summary = calcSummary(filteredOrderLines, paymentMethod);

  const handleConfirm = () => {
    if (!filteredOrderLines.length) {
      Alert.alert('Ελλιπή στοιχεία', 'Δεν υπάρχουν προϊόντα στη λίστα.');
      return;
    }
    updateCurrentOrder({
      paymentMethod,
      paymentMethodLabel: paymentOptions.find(opt => opt.key === paymentMethod)?.label || '',
      notes,
      netValue: summary.net,
      discount: summary.discount,
      vat: summary.vat,
      finalValue: summary.total,
    });
    navigation.navigate('OrderSummaryScreen');
  };

  const adjustQty = (productCode, diff) => {
    setOrderLines(prev =>
      (Array.isArray(prev) ? prev : []).map(l =>
        l.productCode === productCode ? { ...l, quantity: Math.max(1, Number(l.quantity || 1) + diff) } : l
      )
    );
  };

  const handleQtyChange = (productCode, val) => {
    const parsed = Math.max(1, parseInt(String(val).replace(/[^0-9]/g, ''), 10) || 1);
    setOrderLines(prev =>
      (Array.isArray(prev) ? prev : []).map(l =>
        l.productCode === productCode ? { ...l, quantity: parsed } : l
      )
    );
  };

  const removeLine = (productCode) => {
    setOrderLines(prev => (Array.isArray(prev) ? prev : []).filter(l => l && l.productCode !== productCode));
  };

  const renderLine = ({ item }) => {
    if (!item || !item.productCode) return null;
    return (
      <View style={styles.card}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', minWidth: 0 }}>
            <Text style={styles.productCode}>{item.productCode}</Text>
            <Text style={styles.productTitle} numberOfLines={1} ellipsizeMode="tail"> {' '} {item.description}</Text>
          </View>
          <View style={{ flexDirection: 'row', marginTop: 4 }}>
            <Text style={styles.subInfo}>Χονδρική: <Text style={{ fontWeight: 'bold' }}>€{Number(item.wholesalePrice || 0).toFixed(2)}</Text></Text>
            <Text style={styles.subInfo}> {' '}| Λιανική: <Text style={{ fontWeight: 'bold' }}>€{Number(item.srp || 0).toFixed(2)}</Text></Text>
          </View>
          <View style={styles.qtyBoxRow}>
            <TouchableOpacity onPress={() => adjustQty(item.productCode, -1)} style={styles.qtyTouch}>
              <Text style={styles.qtyBtn}>-</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.qtyInput}
              keyboardType="numeric"
              value={String(item.quantity)}
              onChangeText={val => handleQtyChange(item.productCode, val)}
              maxLength={4}
              placeholder="0"
              placeholderTextColor="#bbb"
              returnKeyType="done"
              blurOnSubmit={true}
            />
            <TouchableOpacity onPress={() => adjustQty(item.productCode, +1)} style={styles.qtyTouch}>
              <Text style={styles.qtyBtn}>+</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => removeLine(item.productCode)} style={{ marginLeft: 8 }}>
              <Text style={{ color: '#c00', fontSize: 22 }}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fafdff' }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#fafdff',
        borderBottomWidth: 1, borderColor: '#e3f2fd', paddingVertical: 8, paddingHorizontal: 8,
        justifyContent: 'space-between', zIndex: 2,
      }}>
        <Text style={styles.title}>Ανασκόπηση Παραγγελίας</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 100 + kbPad, paddingHorizontal: 8 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <TouchableOpacity style={styles.collapseHeader} onPress={() => setCollapsed(c => !c)} activeOpacity={0.7}>
            <Text style={styles.collapseTitle}>{collapsed ? 'Προβολή' : 'Απόκρυψη'} προϊόντων ({filteredOrderLines.length})</Text>
            <Text style={{ fontSize: 18, marginLeft: 6 }}>{collapsed ? '+' : '−'}</Text>
          </TouchableOpacity>

          {!collapsed && (
            <FlatList
              data={filteredOrderLines}
              keyExtractor={item => item.productCode}
              renderItem={renderLine}
              ListEmptyComponent={<Text style={{ textAlign: 'center', margin: 16 }}>Δεν υπάρχουν προϊόντα στη λίστα.</Text>}
              scrollEnabled={false}
            />
          )}

          <View style={styles.section}>
            <Text style={styles.label}>Τρόπος Πληρωμής</Text>
            <View style={styles.dropdown}>
              {paymentOptions.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => setPaymentMethod(opt.key)}
                  style={[styles.paymentBtn, paymentMethod === opt.key && styles.selectedPayment]}
                >
                  <Text style={{ color: paymentMethod === opt.key ? '#1976d2' : '#222', fontWeight: paymentMethod === opt.key ? 'bold' : 'normal' }}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text>Καθαρή Αξία: €{summary.net.toFixed(2)}</Text>
            <Text>Έκπτωση: €{summary.discount.toFixed(2)}</Text>
            <Text>ΦΠΑ (24%): €{summary.vat.toFixed(2)}</Text>
            <Text style={{ fontWeight: 'bold', fontSize: 17 }}>Τελική Αξία: €{summary.total.toFixed(2)}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Σημειώσεις</Text>
            <TextInput
              style={styles.notes}
              multiline
              value={notes}
              onChangeText={setNotes}
              placeholder="Σχόλια, οδηγίες, παρατηρήσεις"
              textAlignVertical="top"
              blurOnSubmit={false}
              returnKeyType="done"
              selectTextOnFocus={true}
              onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50)}
              onContentSizeChange={() => { if (kbPad > 0) requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true })); }}
            />
          </View>
        </ScrollView>

        <TouchableOpacity style={[styles.fab, { bottom: 18 + insets.bottom + kbPad }]} onPress={handleConfirm}>
          <Text style={styles.fabIcon}>✓</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 21, fontWeight: 'bold', color: '#1976d2' },
  collapseHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e3f2fd', padding: 10, borderRadius: 8, marginBottom: 6, marginTop: 10 },
  collapseTitle: { fontWeight: 'bold', color: '#1976d2', fontSize: 15 },
  card: { backgroundColor: '#fafdff', borderRadius: 12, padding: 10, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 2, shadowColor: '#1976d2', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, minHeight: 74 },
  productCode: { color: '#1565c0', fontWeight: 'bold', fontSize: 15, flexShrink: 0 },
  productTitle: { color: '#1976d2', fontSize: 14, fontWeight: '600', flexShrink: 1 },
  subInfo: { color: '#555', fontSize: 13, marginRight: 6 },
  qtyBoxRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: '#fff', borderRadius: 8, minHeight: 36, minWidth: 96, paddingHorizontal: 4, borderWidth: 1.3, borderColor: '#1976d2', shadowColor: '#1976d2', shadowOpacity: 0.07, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, alignSelf: 'flex-start' },
  qtyTouch: { paddingHorizontal: 6, paddingVertical: 4 },
  qtyBtn: { fontSize: 22, color: '#1976d2', fontWeight: 'bold' },
  qtyInput: { width: 40, height: 32, textAlign: 'center', fontSize: 17, color: '#111', marginHorizontal: 3, backgroundColor: '#f5fafd', borderRadius: 5, fontWeight: 'bold', paddingVertical: 0, paddingHorizontal: 0 },
  section: { marginTop: 18, marginBottom: 6 },
  label: { fontWeight: 'bold', fontSize: 15, color: '#1976d2', marginBottom: 6 },
  dropdown: { flexDirection: 'column', gap: 5 },
  paymentBtn: { padding: 7, borderRadius: 8, borderWidth: 1, borderColor: '#d1d7e2', marginBottom: 4, backgroundColor: '#f6fafd' },
  selectedPayment: { borderColor: '#1976d2', backgroundColor: '#e3f2fd' },
  notes: { borderWidth: 1, borderColor: '#d1d7e2', borderRadius: 8, padding: 8, minHeight: 100, backgroundColor: '#fff', color: '#222', fontSize: 15, marginBottom: 12 },
  fab: { position: 'absolute', right: 28, backgroundColor: '#1976d2', borderRadius: 28, width: 56, height: 56, justifyContent: 'center', alignItems: 'center', elevation: 7, shadowColor: '#1976d2', shadowOpacity: 0.21, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  fabIcon: { color: '#fff', fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 2 },
});

