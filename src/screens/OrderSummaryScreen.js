// src/screens/OrderSummaryScreen.js
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

import { useOrder } from '../context/OrderContext';
import { exportOrderAsXLSX } from '../utils/exportOrderUtils';
import Share from 'react-native-share';
import { saveOrder } from '../utils/localOrders';
import { updateOrder as upsertOrderFirestore } from '../utils/firestoreOrders';

const OrderSummaryScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const isMounted = useRef(true);
  useEffect(() => () => { isMounted.current = false; }, []);

  const { order, cancelOrder } = useOrder();

  const [loading, setLoading] = useState(false);
  const [showProducts, setShowProducts] = useState(true);

  const EXTRA_BOTTOM_SPACE = 96;

  const lines = Array.isArray(order?.lines) ? order.lines : [];
  const hasProducts = lines.length > 0;

  const customer = order?.customer || {};
  const getVat = () =>
    customer?.vatno || customer?.vat || customer?.vatNumber || customer?.vatInfo?.registrationNo || '';
  const getPhone = () =>
    customer?.telephone || customer?.phone || customer?.contact?.telephone1 || customer?.contact?.mobile || '';

  const netValue = Number(order?.netValue || 0);
  const discount = Number(order?.discount || 0);
  const vat = Number(order?.vat || 0);
  const finalValue = Number(order?.finalValue || 0);

  const paymentLabels = {
    prepaid_cash: 'Μετρητά (έκπτωση 3%)',
    free_shipping: 'Ελεύθερα',
    premium_invoicing: 'Προνομιακή Πιστωτική Πολιτική',
    bank_cheque: 'Επιταγή Ροής',
  };
  const paymentMethodLabel = paymentLabels[order?.paymentMethod] || order?.paymentMethod || '';

  const showPostExportDialog = () => {
    Alert.alert(
      'Η παραγγελία ετοιμάστηκε',
      'Νέα παραγγελία;',
      [
        {
          text: 'Playmobil',
          onPress: () => {
            try { cancelOrder?.(); } catch {}
            navigation.reset({ index: 0, routes: [{ name: 'Playmobil' }] });
          },
        },
        {
          text: 'Νέα παραγγελία',
          onPress: () => {
            try { cancelOrder?.(); } catch {}
            navigation.reset({ index: 0, routes: [{ name: 'OrderCustomerSelectScreen' }] });
          },
        },
        { text: 'Άκυρο', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const handleExport = async () => {
    if (!hasProducts) {
      Alert.alert('Ελλιπή στοιχεία', 'Δεν υπάρχουν προϊόντα σε αυτή την παραγγελία.');
      return;
    }
    if (isMounted.current) setLoading(true);
    try {
      const orderToSave = {
        ...order,
        status: 'sent',
        sent: true,
        updatedAt: new Date().toISOString(),
      };

      await saveOrder(orderToSave, 'sent');

      try {
        await upsertOrderFirestore(order.id, orderToSave);
      } catch (e) {
        console.warn('Firestore upsert failed during export', e);
      }

      const { uri, mime, fileName } = await exportOrderAsXLSX(orderToSave);
      await Share.open({ url: uri, type: mime, failOnCancel: false, filename: fileName });

      setTimeout(() => { if (isMounted.current) showPostExportDialog(); }, 200);
    } catch (err) {
      try {
        if (order?.id) {
          const revert = { ...order, status: 'draft', sent: false, updatedAt: new Date().toISOString() };
          await saveOrder(revert, 'draft');
        }
      } catch {}
      Alert.alert('Σφάλμα', String(err?.message || 'Αποτυχία εξαγωγής και κοινοποίησης.'));
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={styles.header}>Σύνοψη Παραγγελίας</Text>
        <TouchableOpacity
          onPress={() =>
            Alert.alert('Καθαρισμός', 'Θέλεις να ακυρώσεις αυτή την παραγγελία;', [
              { text: 'Όχι', style: 'cancel' },
              {
                text: 'Ναι',
                style: 'destructive',
                onPress: () => {
                  try { cancelOrder?.(); } catch {}
                  navigation.popToTop();
                },
              },
            ])
          }
        >
          <Icon name="trash-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingBottom: EXTRA_BOTTOM_SPACE + insets.bottom,
        }}
      >
        <Text style={styles.sectionTitle}>Πελάτης</Text>
        <Row label="Επωνυμία" value={customer?.name || customer?.displayName || ''} />
        <Row label="ΑΦΜ" value={getVat()} />
        <Row label="Τηλέφωνο" value={getPhone()} />
        <Row label="Διεύθυνση" value={customer?.address?.street ?? customer?.address ?? ''} />
        <Row label="Πόλη" value={customer?.address?.city ?? ''} />
        <Row label="Κωδικός Πελάτη" value={customer?.customerCode ?? customer?.code ?? ''} />

        <TouchableOpacity
          style={[styles.sectionHeader, { marginTop: 12 }]}
          onPress={() => setShowProducts((s) => !s)}
          activeOpacity={0.8}
        >
          <Text style={styles.sectionTitle}>Προϊόντα</Text>
          <Text style={{ color: '#1976d2', fontWeight: '700' }}>
            {showProducts ? '−' : '+'}
          </Text>
        </TouchableOpacity>

        {showProducts && (
          lines.length
            ? lines.map((line, idx) => (
                <View key={`${line?.productCode || idx}-${idx}`} style={styles.card}>
                  <Text style={styles.lineTitle}>
                    {line?.productCode || ''} · {line?.description || ''}
                  </Text>
                  <Text style={styles.lineBody}>
                    Ποσότητα: {Number(line?.quantity || 0)} · Τιμή: €{Number(line?.wholesalePrice || 0).toFixed(2)} · Αξία: €{(Number(line?.quantity || 0) * Number(line?.wholesalePrice || 0)).toFixed(2)}
                  </Text>
                </View>
              ))
            : <Text style={styles.emptyText}>Δεν υπάρχουν προϊόντα.</Text>
        )}

        <Text style={styles.sectionTitle}>Σύνολα</Text>
        <Row label="Καθαρή Αξία" value={`€${netValue.toFixed(2)}`} />
        <Row label="Έκπτωση" value={`€${discount.toFixed(2)}`} />
        <Row label="ΦΠΑ 24%" value={`€${vat.toFixed(2)}`} />
        <Row label="Τελική Αξία" value={`€${finalValue.toFixed(2)}`} />

        <Text style={styles.sectionTitle}>Τρόπος Πληρωμής</Text>
        <Text style={styles.text}>{paymentMethodLabel}</Text>

        <Text style={styles.sectionTitle}>Σημειώσεις</Text>
        <Text style={[styles.text, { marginBottom: 8 }]}>{order?.notes || ''}</Text>
      </ScrollView>

      <TouchableOpacity
        style={[styles.exportBtn, loading && { opacity: 0.7 }]}
        onPress={handleExport}
        disabled={loading}
        activeOpacity={0.85}
      >
        <Icon name="cloud-download-outline" size={22} color="#fff" />
        <Text style={styles.exportText}>
          {loading ? 'Εξαγωγή…' : 'Εξαγωγή σε Excel'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const Row = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f8fa' },
  headerRow: {
    height: 56,
    backgroundColor: '#1976d2',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
  },
  header: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  scroll: { flex: 1, paddingHorizontal: 14, paddingTop: 12 },

  sectionTitle: {
    marginTop: 12,
    marginBottom: 6,
    color: '#1976d2',
    fontWeight: '700',
    fontSize: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    marginVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  lineTitle: { fontSize: 15, color: '#111827', fontWeight: '600' },
  lineBody: { marginTop: 4, fontSize: 14, color: '#374151' },

  emptyText: { fontSize: 14, color: '#6b7280' },

  exportBtn: {
    margin: 16,
    backgroundColor: '#1976d2',
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    elevation: 2,
  },
  exportText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

export default OrderSummaryScreen;

