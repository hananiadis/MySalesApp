import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const CustomerSalesSummary = ({ navigation }) => {
  // TODO: fetch and display summary stats for the customer
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Σύνοψη Πωλήσεων Πελάτη</Text>
      <Text style={styles.placeholder}>[Προσεχώς: γράφημα 2ετίας ή πίνακας σύνοψης]</Text>

      <TouchableOpacity
        style={styles.salesButton}
        onPress={() => navigation.navigate('CustomerSalesDetail')}
      >
        <Text style={styles.salesButtonText}>Αναλυτικά στοιχεία πωλήσεων</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff', alignItems: 'center' },
  header: { fontSize: 22, fontWeight: 'bold', color: '#007AFF', marginBottom: 22 },
  placeholder: { fontSize: 16, color: '#777', marginBottom: 32 },
  salesButton: {
    marginTop: 10,
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  salesButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 17 },
});

export default CustomerSalesSummary;
