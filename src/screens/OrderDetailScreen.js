import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Alert
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { exportOrderAsXLSX, exportOrderAsPDF } from '../utils/exportOrderUtils';
import { getOrders } from '../utils/localOrders';
import OrderLineItem from '../components/OrderLineItem';

export default function OrderDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { orderId } = route.params || {};
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOrder() {
      setLoading(true);
      try {
        const all = await getOrders();
        const found = all.find(o => o.id === orderId);
        setOrder(found || null);
      } catch {
        setOrder(null);
      }
      setLoading(false);
    }
    loadOrder();
  }, [orderId]);

  const handleExport = async (format = 'xlsx') => {
    try {
      if (!order) return;
      if (format === 'xlsx') {
        await exportOrderAsXLSX(order);
      } else if (format === 'pdf') {
        await exportOrderAsPDF(order);
      }
    } catch (err) {
      Alert.alert('Σφάλμα', err.message || 'Αποτυχία εξαγωγής.');
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }
  if (!order) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: '#888', fontSize: 18 }}>Η παραγγελία δεν βρέθηκε.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
          <Text style={{ color: '#007AFF', fontWeight: 'bold' }}>Επιστροφή</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const customer = order.customer || {};

  return (
    <ScrollView style={styles.safeArea} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={26} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.header}>Λεπτομέρειες Παραγγελίας</Text>
      </View>

      {/* Customer Info */}
      <View style={styles.section}>
        <Text style={styles.custName}>{customer.name} ({customer.customerCode || ''})</Text>
        <Text style={styles.custField}>
          ΑΦΜ: {customer.vatno || customer.vatInfo?.registrationNo || ''}    ΔΟΥ: {customer.vatInfo?.office || ''}
        </Text>
        <Text style={styles.custField}>
          {customer.address?.street || ''}, {customer.address?.postalCode || ''} {customer.address?.city || ''}
        </Text>
        <Text style={styles.custField}>
          Τηλ: {customer.telephone || customer.contact?.telephone1 || ''}
        </Text>
      </View>

      {/* Order Lines */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Προϊόντα</Text>
        {order.lines && order.lines.length ? (
          order.lines.map(line => (
            <OrderLineItem
              key={line.productCode}
              line={line}
              editable={false}
            />
          ))
        ) : (
          <Text style={{ color: '#888' }}>Δεν υπάρχουν προϊόντα στην παραγγελία.</Text>
        )}
      </View>

      {/* Cost breakdown */}
      <View style={styles.section}>
        <Text style={styles.totalText}>Καθαρή αξία: <Text style={styles.totalValue}>€{(order.netValue || 0).toFixed(2)}</Text></Text>
        <Text style={styles.totalText}>Έκπτωση: <Text style={styles.totalValue}>€{(order.discount || 0).toFixed(2)}</Text></Text>
        <Text style={styles.totalText}>ΦΠΑ 24%: <Text style={styles.totalValue}>€{(order.vat || 0).toFixed(2)}</Text></Text>
        <Text style={styles.finalText}>Τελική αξία: <Text style={styles.finalValue}>€{(order.finalValue || 0).toFixed(2)}</Text></Text>
      </View>

      {/* Payment and Notes */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Τρόπος Πληρωμής</Text>
        <Text style={styles.custField}>{order.paymentMethodLabel}</Text>
      </View>
      {order.notes ? (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Σημειώσεις</Text>
          <Text style={styles.custField}>{order.notes}</Text>
        </View>
      ) : null}

      {/* Export Buttons */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Εξαγωγή παραγγελίας</Text>
        <TouchableOpacity
          style={styles.exportBtn}
          onPress={() => handleExport('xlsx')}
        >
          <Ionicons name="document-outline" size={20} color="#fff" />
          <Text style={styles.exportBtnText}>Εξαγωγή σε XLSX</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.exportBtn}
          onPress={() => handleExport('pdf')}
        >
          <Ionicons name="document-outline" size={20} color="#fff" />
          <Text style={styles.exportBtnText}>Εξαγωγή σε PDF</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fafdff', padding: 16, paddingTop: 34 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fafdff' },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  backBtn: { padding: 5, marginRight: 8 },
  header: { fontSize: 22, fontWeight: 'bold', color: '#007AFF', flex: 1, textAlign: 'center' },
  section: { marginBottom: 18, paddingHorizontal: 2 },
  custName: { fontSize: 18, fontWeight: 'bold', color: '#00599d' },
  custField: { fontSize: 15, color: '#444', marginTop: 2 },
  sectionHeader: { fontSize: 16, fontWeight: 'bold', marginBottom: 6, color: '#007AFF' },
  totalText: { fontSize: 15, fontWeight: 'bold', color: '#212121', marginTop: 2 },
  totalValue: { fontSize: 15, color: '#00ADEF' },
  finalText: { fontSize: 17, fontWeight: 'bold', color: '#00ADEF', marginTop: 5 },
  finalValue: { fontSize: 17, fontWeight: 'bold', color: '#00ADEF' },
  exportBtn: {
    backgroundColor: '#007AFF', padding: 14, borderRadius: 8, marginBottom: 10,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center'
  },
  exportBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold', marginLeft: 7 },
});
