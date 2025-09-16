import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const CustomerSalesDetail = () => (
  <View style={styles.container}>
    <Text style={styles.header}>Αναλυτικά Στοιχεία Πωλήσεων</Text>
    <Text style={styles.placeholder}>[Προσεχώς: φίλτρα έτους, γραφήματα, πίνακες]</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff', alignItems: 'center' },
  header: { fontSize: 22, fontWeight: 'bold', color: '#007AFF', marginBottom: 22 },
  placeholder: { fontSize: 16, color: '#777', marginBottom: 32 },
});

export default CustomerSalesDetail;
