import React, { useCallback } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

export default function BackToExpensesButton({ label = 'Έξοδα' }) {
  const navigation = useNavigation();

  const goToExpenses = useCallback(() => {
    try {
      navigation.navigate('ExpenseTracker');
    } catch (e) {
      // Fallback: at least try to go back
      navigation.goBack();
    }
  }, [navigation]);

  return (
    <TouchableOpacity onPress={goToExpenses} style={styles.btn} activeOpacity={0.85}>
      <Ionicons name="chevron-back" size={18} color="#1D4ED8" />
      <Text style={styles.text} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  text: {
    color: '#1D4ED8',
    fontWeight: '800',
    fontSize: 12,
    maxWidth: 120,
  },
});
