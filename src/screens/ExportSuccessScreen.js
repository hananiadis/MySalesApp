import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

export default function ExportSuccessScreen() {
  const navigation = useNavigation();

  // If you want to view the last order, pass orderId/order data via navigation params
  const handleViewOrder = () => {
    navigation.navigate('OrdersManagement'); // Or another screen if you want more detail
  };

  return (
    <View style={styles.safeArea}>
      <View style={styles.successBox}>
        <Ionicons name="checkmark-circle-outline" size={74} color="#00C851" />
        <Text style={styles.successText}>
          Η παραγγελία εξήχθη και συγχρονίστηκε με επιτυχία!
        </Text>
      </View>
      <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Playmobil')}>
        <Ionicons name="home-outline" size={22} color="#fff" />
        <Text style={styles.actionBtnText}>Αρχική Οθόνη</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.actionBtnOutline} onPress={handleViewOrder}>
        <Ionicons name="receipt-outline" size={22} color="#007AFF" />
        <Text style={styles.actionBtnTextBlue}>Προβολή Παραγγελίας</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fafdff', padding: 20, justifyContent: 'center' },
  successBox: { alignItems: 'center', justifyContent: 'center', marginTop: 24, marginBottom: 32 },
  successText: {
    fontSize: 19, fontWeight: 'bold', color: '#00C851',
    marginTop: 20, textAlign: 'center', lineHeight: 27
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#007AFF', padding: 16, borderRadius: 13, marginBottom: 18,
    marginHorizontal: 6
  },
  actionBtnOutline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#007AFF', padding: 16, borderRadius: 13,
    marginHorizontal: 6
  },
  actionBtnText: { color: '#fff', fontSize: 17, fontWeight: 'bold', marginLeft: 9 },
  actionBtnTextBlue: { color: '#007AFF', fontSize: 17, fontWeight: 'bold', marginLeft: 9 },
});
