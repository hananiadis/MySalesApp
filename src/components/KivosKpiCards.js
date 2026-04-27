import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import colors from '../theme/colors';

const formatCurrency = (value) =>
  Number(value ?? 0).toLocaleString('el-GR', { style: 'currency', currency: 'EUR' });

const formatPercent = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--';
  }
  const rounded = Math.round(value * 10) / 10;
  const signed = rounded > 0 ? `+${rounded}` : `${rounded}`;
  return `${signed}%`;
};

/**
 * KivosKpiCards
 * Displays KPI metrics for Kivos brand with multi-year data (2026/2025/2024/2023)
 */
const KivosKpiCards = ({ kpis, referenceMoment, selectedDate, onDateChange, onCardPress }) => {
  const insets = useSafeAreaInsets();
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [dateInput, setDateInput] = useState('');
  const [pickerMode, setPickerMode] = useState('calendar');
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());

  if (!kpis) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>Δεν υπάρχουν διαθέσιμα δεδομένα KPI</Text>
      </View>
    );
  }

  const { sales } = kpis;
  if (!sales) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>Δεν υπάρχουν δεδομένα πωλήσεων</Text>
      </View>
    );
  }

  const effectiveSelectedDate = selectedDate instanceof Date && !Number.isNaN(selectedDate.getTime())
    ? selectedDate
    : (referenceMoment instanceof Date && !Number.isNaN(referenceMoment.getTime()) ? referenceMoment : new Date());
  const refMoment = effectiveSelectedDate;
  const monthName = refMoment.toLocaleString('el-GR', { month: 'long' });
  const day = refMoment.getDate();

  const handleDatePress = () => {
    setViewYear(effectiveSelectedDate.getFullYear());
    setViewMonth(effectiveSelectedDate.getMonth());
    setPickerMode('calendar');
    setDateInput(effectiveSelectedDate.toLocaleDateString('el-GR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }));
    setDatePickerVisible(true);
  };

  const parseDateInput = (value) => {
    if (!value) return null;
    const parts = value.trim().split('/');
    if (parts.length !== 3) return null;
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const y = parseInt(parts[2], 10);
    const date = new Date(y, m, d);
    if (Number.isNaN(date.getTime())) return null;
    if (date.getDate() !== d || date.getMonth() !== m || date.getFullYear() !== y) return null;
    return date;
  };

  const handleDateSubmit = () => {
    const parsed = parseDateInput(dateInput);
    if (!parsed) {
      Alert.alert('Μη έγκυρη ημερομηνία', 'Χρησιμοποιήστε μορφή DD/MM/YYYY.');
      return;
    }
    onDateChange?.(parsed);
    setDatePickerVisible(false);
  };

  const handleCalendarPick = (dayValue) => {
    const picked = new Date(viewYear, viewMonth, dayValue);
    onDateChange?.(picked);
    setDateInput(picked.toLocaleDateString('el-GR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }));
    setDatePickerVisible(false);
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const dateDisplay = effectiveSelectedDate.toLocaleDateString('el-GR', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const monthNames = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];
  const dayNames = ['Κυ', 'Δε', 'Τρ', 'Τε', 'Πε', 'Πα', 'Σα'];
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const dayCells = [];
  for (let i = 0; i < firstDow; i++) dayCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) dayCells.push(d);

  const isSelectedDay = (dayValue) => {
    if (!dayValue) return false;
    const d = new Date(viewYear, viewMonth, dayValue);
    return (
      d.getDate() === effectiveSelectedDate.getDate() &&
      d.getMonth() === effectiveSelectedDate.getMonth() &&
      d.getFullYear() === effectiveSelectedDate.getFullYear()
    );
  };

  // YTD Cards
  const renderYtdCard = () => {
    const ytd2026 = sales.year2026?.ytd;
    const ytd2025 = sales.year2025?.ytd;
    const ytd2024 = sales.year2024?.ytd;
    const ytd2023 = sales.year2023?.ytd;
    const ytd2022 = sales.year2022?.ytd;

    if (!ytd2026) return null;

    const diff2026vs2025 = ytd2026.diff?.percent ?? null;
    const accentColor = diff2026vs2025 > 0 ? '#66bb6a' : diff2026vs2025 < 0 ? '#ef5350' : '#90a4ae';
    const arrowIcon = diff2026vs2025 > 0 ? 'arrow-up-outline' : diff2026vs2025 < 0 ? 'arrow-down-outline' : 'remove-outline';

    return (
      <TouchableOpacity
        style={[styles.metricCard, { borderColor: accentColor }]}
        onPress={() => onCardPress?.('sales', 'ytd', 'amount')}
        activeOpacity={0.9}
      >
        <View style={styles.metricCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.metricTitle}>Πωλήσεις YTD (1 Ιαν - {day} {monthName})</Text>
          </View>
          <Ionicons name="trending-up-outline" size={28} color="#4b5563" />
        </View>

        {/* Current Year (2026) - Prominent */}
        <View style={styles.metricPrimaryRow}>
          <Text style={styles.metricPrimaryValue}>{formatCurrency(ytd2026.amount)}</Text>
          <Text style={styles.metricYearLabel}>2026</Text>
        </View>
        
        {ytd2026.customers > 0 && (
          <Text style={styles.customersText}>{ytd2026.customers} πελάτες</Text>
        )}

        <View style={styles.comparisonRow}>
          <View style={[styles.diffBadge, { backgroundColor: accentColor }]}>
            <Ionicons name={arrowIcon} size={16} color="#fff" />
            <Text style={styles.diffText}>{formatPercent(diff2026vs2025)}</Text>
          </View>
          <Text style={styles.comparisonText}>vs 2025: {formatCurrency(ytd2025?.amount || 0)}</Text>
        </View>

        {/* Divider */}
        <View style={styles.metricDivider} />

        {/* Historical Years */}
        <Text style={styles.pastYearsTitle}>Ιστορικό</Text>
        <View style={styles.historicalRow}>
          <View style={styles.historicalItem}>
            <Text style={styles.historicalYear}>2025</Text>
            <Text style={styles.historicalValue}>{formatCurrency(ytd2025?.amount || 0)}</Text>
            {ytd2025?.customers > 0 && (
              <Text style={styles.historicalCustomers}>{ytd2025.customers} πελάτες</Text>
            )}
          </View>
          <View style={styles.historicalItem}>
            <Text style={styles.historicalYear}>2024</Text>
            <Text style={styles.historicalValue}>{formatCurrency(ytd2024?.amount || 0)}</Text>
            {ytd2024?.customers > 0 && (
              <Text style={styles.historicalCustomers}>{ytd2024.customers} πελάτες</Text>
            )}
          </View>
          <View style={styles.historicalItem}>
            <Text style={styles.historicalYear}>2023</Text>
            <Text style={styles.historicalValue}>{formatCurrency(ytd2023?.amount || 0)}</Text>
            {ytd2023?.customers > 0 && (
              <Text style={styles.historicalCustomers}>{ytd2023.customers} πελάτες</Text>
            )}
          </View>
          <View style={styles.historicalItem}>
            <Text style={styles.historicalYear}>2022</Text>
            <Text style={styles.historicalValue}>{formatCurrency(ytd2022?.amount || 0)}</Text>
            {ytd2022?.customers > 0 && (
              <Text style={styles.historicalCustomers}>{ytd2022.customers} πελάτες</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // MTD Cards
  const renderMtdCard = () => {
    const mtd2026 = sales.year2026?.mtd;
    const mtd2025 = sales.year2025?.mtd;
    const mtd2024 = sales.year2024?.mtd;
    const mtd2023 = sales.year2023?.mtd;
    const mtd2022 = sales.year2022?.mtd;

    if (!mtd2026) return null;

    const diff2026vs2025 = mtd2026.diff?.percent ?? null;
    const accentColor = diff2026vs2025 > 0 ? '#66bb6a' : diff2026vs2025 < 0 ? '#ef5350' : '#90a4ae';
    const arrowIcon = diff2026vs2025 > 0 ? 'arrow-up-outline' : diff2026vs2025 < 0 ? 'arrow-down-outline' : 'remove-outline';

    return (
      <TouchableOpacity
        style={[styles.metricCard, { borderColor: accentColor }]}
        onPress={() => onCardPress?.('sales', 'mtd', 'amount')}
        activeOpacity={0.9}
      >
        <View style={styles.metricCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.metricTitle}>{monthName} MTD (1-{day})</Text>
          </View>
          <Ionicons name="calendar-outline" size={28} color="#4b5563" />
        </View>

        {/* Current Year (2026) - Prominent */}
        <View style={styles.metricPrimaryRow}>
          <Text style={styles.metricPrimaryValue}>{formatCurrency(mtd2026.amount)}</Text>
          <Text style={styles.metricYearLabel}>2026</Text>
        </View>
        
        {mtd2026.customers > 0 && (
          <Text style={styles.customersText}>{mtd2026.customers} πελάτες</Text>
        )}

        <View style={styles.comparisonRow}>
          <View style={[styles.diffBadge, { backgroundColor: accentColor }]}>
            <Ionicons name={arrowIcon} size={16} color="#fff" />
            <Text style={styles.diffText}>{formatPercent(diff2026vs2025)}</Text>
          </View>
          <Text style={styles.comparisonText}>vs 2025: {formatCurrency(mtd2025?.amount || 0)}</Text>
        </View>

        {/* Divider */}
        <View style={styles.metricDivider} />

        {/* Historical Years */}
        <Text style={styles.pastYearsTitle}>Ιστορικό</Text>
        <View style={styles.historicalRow}>
          <View style={styles.historicalItem}>
            <Text style={styles.historicalYear}>2025</Text>
            <Text style={styles.historicalValue}>{formatCurrency(mtd2025?.amount || 0)}</Text>
            {mtd2025?.customers > 0 && (
              <Text style={styles.historicalCustomers}>{mtd2025.customers} πελάτες</Text>
            )}
          </View>
          <View style={styles.historicalItem}>
            <Text style={styles.historicalYear}>2024</Text>
            <Text style={styles.historicalValue}>{formatCurrency(mtd2024?.amount || 0)}</Text>
            {mtd2024?.customers > 0 && (
              <Text style={styles.historicalCustomers}>{mtd2024.customers} πελάτες</Text>
            )}
          </View>
          <View style={styles.historicalItem}>
            <Text style={styles.historicalYear}>2023</Text>
            <Text style={styles.historicalValue}>{formatCurrency(mtd2023?.amount || 0)}</Text>
            {mtd2023?.customers > 0 && (
              <Text style={styles.historicalCustomers}>{mtd2023.customers} πελάτες</Text>
            )}
          </View>
          <View style={styles.historicalItem}>
            <Text style={styles.historicalYear}>2022</Text>
            <Text style={styles.historicalValue}>{formatCurrency(mtd2022?.amount || 0)}</Text>
            {mtd2022?.customers > 0 && (
              <Text style={styles.historicalCustomers}>{mtd2022.customers} πελάτες</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Yearly Cards
  const renderYearlyCard = () => {
    const yearly2026 = sales.year2026?.yearly;
    const yearly2025 = sales.year2025?.yearly;
    const yearly2024 = sales.year2024?.yearly;
    const yearly2023 = sales.year2023?.yearly;
    const yearly2022 = sales.year2022?.yearly;

    if (!yearly2026) return null;

    const diff2026vs2025 = yearly2026.diff?.percent ?? null;
    const accentColor = diff2026vs2025 > 0 ? '#66bb6a' : diff2026vs2025 < 0 ? '#ef5350' : '#90a4ae';
    const arrowIcon = diff2026vs2025 > 0 ? 'arrow-up-outline' : diff2026vs2025 < 0 ? 'arrow-down-outline' : 'remove-outline';

    return (
      <TouchableOpacity
        style={[styles.metricCard, { borderColor: accentColor }]}
        onPress={() => onCardPress?.('sales', 'yearly', 'amount')}
        activeOpacity={0.9}
      >
        <View style={styles.metricCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.metricTitle}>Ολόκληρο Έτος</Text>
          </View>
          <Ionicons name="stats-chart-outline" size={28} color="#4b5563" />
        </View>

        {/* Current Year (2026) - Prominent */}
        <View style={styles.metricPrimaryRow}>
          <Text style={styles.metricPrimaryValue}>{formatCurrency(yearly2026.amount)}</Text>
          <Text style={styles.metricYearLabel}>2026</Text>
        </View>
        
        {yearly2026.customers > 0 && (
          <Text style={styles.customersText}>{yearly2026.customers} πελάτες</Text>
        )}

        <View style={styles.comparisonRow}>
          <View style={[styles.diffBadge, { backgroundColor: accentColor }]}>
            <Ionicons name={arrowIcon} size={16} color="#fff" />
            <Text style={styles.diffText}>{formatPercent(diff2026vs2025)}</Text>
          </View>
          <Text style={styles.comparisonText}>vs 2025: {formatCurrency(yearly2025?.amount || 0)}</Text>
        </View>

        {/* Divider */}
        <View style={styles.metricDivider} />

        {/* Historical Years */}
        <Text style={styles.pastYearsTitle}>Ιστορικό</Text>
        <View style={styles.historicalRow}>
          <View style={styles.historicalItem}>
            <Text style={styles.historicalYear}>2025</Text>
            <Text style={styles.historicalValue}>{formatCurrency(yearly2025?.amount || 0)}</Text>
            {yearly2025?.customers > 0 && (
              <Text style={styles.historicalCustomers}>{yearly2025.customers} πελάτες</Text>
            )}
          </View>
          <View style={styles.historicalItem}>
            <Text style={styles.historicalYear}>2024</Text>
            <Text style={styles.historicalValue}>{formatCurrency(yearly2024?.amount || 0)}</Text>
            {yearly2024?.customers > 0 && (
              <Text style={styles.historicalCustomers}>{yearly2024.customers} πελάτες</Text>
            )}
          </View>
          <View style={styles.historicalItem}>
            <Text style={styles.historicalYear}>2023</Text>
            <Text style={styles.historicalValue}>{formatCurrency(yearly2023?.amount || 0)}</Text>
            {yearly2023?.customers > 0 && (
              <Text style={styles.historicalCustomers}>{yearly2023.customers} πελάτες</Text>
            )}
          </View>
          <View style={styles.historicalItem}>
            <Text style={styles.historicalYear}>2022</Text>
            <Text style={styles.historicalValue}>{formatCurrency(yearly2022?.amount || 0)}</Text>
            {yearly2022?.customers > 0 && (
              <Text style={styles.historicalCustomers}>{yearly2022.customers} πελάτες</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {onDateChange && (
        <View style={styles.datePickerContainer}>
          <TouchableOpacity
            style={styles.datePickerButton}
            onPress={handleDatePress}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            <Text style={styles.datePickerButtonText}>{dateDisplay}</Text>
          </TouchableOpacity>
        </View>
      )}

      {renderMtdCard()}
      {renderYtdCard()}
      {renderYearlyCard()}

      <Modal
        visible={datePickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDatePickerVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setDatePickerVisible(false)}
          >
            <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 12) }]} onStartShouldSetResponder={() => true}>
              <Text style={styles.modalTitle}>Επιλογή Ημερομηνίας</Text>

              <View style={styles.pickerModeRow}>
                <TouchableOpacity
                  style={[styles.pickerModeChip, pickerMode === 'calendar' && styles.pickerModeChipActive]}
                  onPress={() => setPickerMode('calendar')}
                >
                  <Text style={[styles.pickerModeText, pickerMode === 'calendar' && styles.pickerModeTextActive]}>Ημερολόγιο</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pickerModeChip, pickerMode === 'manual' && styles.pickerModeChipActive]}
                  onPress={() => setPickerMode('manual')}
                >
                  <Text style={[styles.pickerModeText, pickerMode === 'manual' && styles.pickerModeTextActive]}>Πληκτρολόγηση</Text>
                </TouchableOpacity>
              </View>

              {pickerMode === 'calendar' ? (
                <>
                  <View style={styles.calendarNavRow}>
                    <TouchableOpacity onPress={prevMonth} style={styles.calendarNavBtn}>
                      <Ionicons name="chevron-back" size={20} color={colors.primary || '#1d4ed8'} />
                    </TouchableOpacity>
                    <Text style={styles.calendarMonthLabel}>{monthNames[viewMonth]} {viewYear}</Text>
                    <TouchableOpacity onPress={nextMonth} style={styles.calendarNavBtn}>
                      <Ionicons name="chevron-forward" size={20} color={colors.primary || '#1d4ed8'} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.calendarHeaders}>
                    {dayNames.map((dn) => (
                      <Text key={dn} style={styles.calendarHeaderText}>{dn}</Text>
                    ))}
                  </View>

                  <View style={styles.calendarGrid}>
                    {dayCells.map((dayValue, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.calendarCell,
                          !dayValue && styles.calendarCellEmpty,
                          isSelectedDay(dayValue) && styles.calendarCellSelected,
                        ]}
                        onPress={() => dayValue && handleCalendarPick(dayValue)}
                        disabled={!dayValue}
                      >
                        <Text style={[
                          styles.calendarCellText,
                          isSelectedDay(dayValue) && styles.calendarCellTextSelected,
                        ]}>
                          {dayValue || ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.modalHint}>DD/MM/YYYY</Text>
                  <TextInput
                    style={styles.dateInput}
                    value={dateInput}
                    onChangeText={setDateInput}
                    placeholder="DD/MM/YYYY"
                    keyboardType="number-pad"
                    autoFocus
                  />
                </>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setDatePickerVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Άκυρο</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.submitButton]}
                  onPress={pickerMode === 'calendar' ? () => setDatePickerVisible(false) : handleDateSubmit}
                >
                  <Text style={styles.submitButtonText}>{pickerMode === 'calendar' ? 'OK' : 'Εφαρμογή'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    marginBottom: 20,
  },
  datePickerContainer: {
    marginBottom: 14,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: colors.primary || '#1d4ed8',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    gap: 8,
  },
  datePickerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary || '#1d4ed8',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    marginVertical: 20,
  },
  emptyText: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
  },
  metricCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  metricCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  metricTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    flexWrap: 'wrap',
  },
  metricPrimaryRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  metricPrimaryValue: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1f2937',
    marginRight: 10,
  },
  metricYearLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e88e5',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  customersText: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 8,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  diffBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 10,
  },
  diffText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginLeft: 4,
  },
  comparisonText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  historicalRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
    marginTop: 4,
  },
  historicalItem: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    paddingHorizontal: 4,
  },
  historicalYear: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
  },
  historicalValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
  },
  historicalCustomers: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  metricDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalHint: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
    textAlign: 'center',
  },
  dateInput: {
    borderWidth: 2,
    borderColor: colors.primary || '#1d4ed8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    backgroundColor: colors.white,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  submitButton: {
    backgroundColor: colors.primary || '#1d4ed8',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  pickerModeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  pickerModeChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  pickerModeChipActive: {
    backgroundColor: '#e8f1ff',
    borderColor: colors.primary || '#1d4ed8',
  },
  pickerModeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  pickerModeTextActive: {
    color: colors.primary || '#1d4ed8',
  },
  calendarNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  calendarNavBtn: {
    padding: 6,
  },
  calendarMonthLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  calendarHeaders: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  calendarHeaderText: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '700',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  calendarCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  calendarCellEmpty: {
    opacity: 0,
  },
  calendarCellSelected: {
    backgroundColor: colors.primary || '#1d4ed8',
  },
  calendarCellText: {
    fontSize: 14,
    color: '#1f2937',
  },
  calendarCellTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  pastYearsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default KivosKpiCards;
