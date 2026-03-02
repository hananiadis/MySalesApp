import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useExpense } from '../context/ExpenseContext';
import SafeScreen from '../components/SafeScreen';
import { Ionicons } from '@expo/vector-icons';
import { getWeekId, getMondayFromWeekId, formatDateDDMMYYYY } from '../constants/expenseConstants';
import BackToExpensesButton from '../components/BackToExpensesButton';

const ExpenseReportsScreen = () => {
  const navigation = useNavigation();
  const { expenses } = useExpense();

  // Helper to format date range using the existing constants
  const getFormattedWeekRange = (weekId) => {
    try {
      const start = getMondayFromWeekId(weekId);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${formatDateDDMMYYYY(start)} - ${formatDateDDMMYYYY(end)}`;
    } catch (e) {
      return weekId;
    }
  };

  // Group expenses by week
  const weeksData = useMemo(() => {
    const groups = {};
    
    // Group all expenses
    expenses.forEach(expense => {
      const wId = getWeekId(new Date(expense.date));
      if (!groups[wId]) {
        groups[wId] = {
          weekId: wId,
          totalAmount: 0,
          count: 0,
          date: new Date(expense.date) // Keep one date for sorting
        };
      }
      groups[wId].totalAmount += expense.amount;
      groups[wId].count += 1;
    });

    // Ensure current week is in the list even if no expenses
    const currentWeekId = getWeekId(new Date());
    if (!groups[currentWeekId]) {
      groups[currentWeekId] = {
        weekId: currentWeekId,
        totalAmount: 0,
        count: 0,
        date: new Date()
      };
    }

    // Convert to array and sort descending by week (newest first)
    return Object.values(groups).sort((a, b) => b.weekId.localeCompare(a.weekId));
  }, [expenses]);

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => navigation.navigate('WeeklyTracking', { weekId: item.weekId })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.iconContainer}>
          <Ionicons name='calendar-outline' size={24} color='#007AFF' />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.weekTitle}>{getFormattedWeekRange(item.weekId)}</Text>
          <Text style={styles.weekId}>{item.weekId}</Text>
        </View>
        <Ionicons name='chevron-forward' size={20} color='#C7C7CC' />
      </View>
      
      <View style={styles.divider} />
      
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Έξοδα</Text>
          <Text style={styles.statValue}>{item.count}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Σύνολο</Text>
          <Text style={styles.statValue}>{item.totalAmount.toFixed(2)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeScreen title="Εβδομαδιαίες Αναφορές" headerLeft={<BackToExpensesButton />} style={{ backgroundColor: '#F7F9FC' }}>
      <View style={styles.container}>
        <FlatList
          data={weeksData}
          renderItem={renderItem}
          keyExtractor={item => item.weekId}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Δεν υπάρχουν δεδομένα</Text>
            </View>
          }
        />
      </View>
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  weekTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  weekId: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flexDirection: 'column',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 16,
  },
});

export default ExpenseReportsScreen;
