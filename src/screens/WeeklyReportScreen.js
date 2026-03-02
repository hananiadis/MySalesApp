import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, FlatList, TextInput } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useExpense } from '../context/ExpenseContext';
import { getWeekId, getWeekStartEnd, getCategoryLabel, EXPENSE_GROUPS, getMondayFromWeekId, formatDateDDMMYYYY, EXPENSE_STATUS } from '../constants/expenseConstants';
import { approveWeeklyReportSubmission, getWeeklyReport, requestWeeklyReportReview } from '../services/expenseService';
import SafeScreen from '../components/SafeScreen';
import { Ionicons } from '@expo/vector-icons';

import BackToExpensesButton from '../components/BackToExpensesButton';
import { generateWeeklyReportPdf } from '../utils/weeklyReportPdf';

const groupOrder = [EXPENSE_GROUPS.TRAVEL, EXPENSE_GROUPS.ACCOMMODATION_FOOD, EXPENSE_GROUPS.MISCELLANEOUS];

const WeeklyReportScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { currentUserId } = useExpense();

  const managerMode = !!route.params?.managerMode;

  const initialWeekId = route.params?.weekId || getWeekId(new Date());
  const [weekId, setWeekId] = useState(initialWeekId);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [requestingReview, setRequestingReview] = useState(false);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState(() => new Set());
  const [reviewNote, setReviewNote] = useState('');
  const [weekPickerOpen, setWeekPickerOpen] = useState(false);
  const [printing, setPrinting] = useState(false);

  const targetUserId = route.params?.userId || currentUserId;

  useEffect(() => {
    if (route.params?.weekId && route.params.weekId !== weekId) {
      setWeekId(route.params.weekId);
    }
  }, [route.params?.weekId]);

  const weekStartDate = getMondayFromWeekId(weekId);
  const { start, end } = getWeekStartEnd(weekStartDate);
  const weekRange = `${formatDateDDMMYYYY(start)} - ${formatDateDDMMYYYY(end)}`;

  useEffect(() => {
    console.log('[WeeklyReportScreen] mounted');
    return () => console.log('[WeeklyReportScreen] unmounted');
  }, []);

  useEffect(() => {
    const loadReport = async () => {
      if (!targetUserId) return;
      try {
        setLoading(true);
        console.log('[WeeklyReportScreen] Loading report:', { targetUserId, weekId });
        const data = await getWeeklyReport(targetUserId, weekStartDate);
        setReport(data);
        console.log('[WeeklyReportScreen] Report loaded');
      } catch (error) {
        console.error('Error loading weekly report:', error);
        Alert.alert('Σφάλμα', 'Αποτυχία φόρτωσης αναφοράς');
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, [targetUserId, weekId]);

  const status = report?.tracking?.status || EXPENSE_STATUS.DRAFT;
  const statusMeta = useMemo(() => {
    if (status === EXPENSE_STATUS.SUBMITTED) return { label: 'Υποβληθέν', bg: '#FEF3C7', fg: '#92400E' };
    if (status === EXPENSE_STATUS.APPROVED) return { label: 'Εγκεκριμένο', bg: '#DCFCE7', fg: '#166534' };
    return { label: 'Πρόχειρο', bg: '#E5E7EB', fg: '#111827' };
  }, [status]);

  const handlePrint = useCallback(async () => {
    if (!report) return;
    try {
      setPrinting(true);

      await generateWeeklyReportPdf({
        salesmanId: targetUserId,
        weekId,
        report,
        viewerManagerId: managerMode ? currentUserId : null,
        forceShare: true,
      });
    } catch (e) {
      console.error('[WeeklyReportScreen] Print failed:', e);
      Alert.alert('Σφάλμα', e?.message || 'Αποτυχία δημιουργίας PDF.');
    } finally {
      setPrinting(false);
    }
  }, [report, targetUserId, weekId, managerMode, currentUserId]);

  const toggleExpense = useCallback(
    (expenseId) => {
      setSelectedExpenseIds((prev) => {
        const next = new Set(prev);
        if (next.has(expenseId)) next.delete(expenseId);
        else next.add(expenseId);
        return next;
      });
    },
    [setSelectedExpenseIds]
  );

  const handleRequestReview = useCallback(() => {
    if (!managerMode) return;

    const expenseIds = Array.from(selectedExpenseIds);
    const trimmedNote = (reviewNote || '').trim();

    if (!currentUserId) {
      Alert.alert('Σφάλμα', 'Λείπει ο χρήστης (manager).');
      return;
    }
    if (!targetUserId) {
      Alert.alert('Σφάλμα', 'Λείπει ο χρήστης (πωλητής).');
      return;
    }
    if (expenseIds.length === 0) {
      Alert.alert('Επιλογή εξόδων', 'Επίλεξε τουλάχιστον 1 έξοδο για έλεγχο.');
      return;
    }
    if (!trimmedNote) {
      Alert.alert('Σημείωση', 'Γράψε μια σύντομη σημείωση για το τι χρειάζεται διόρθωση.');
      return;
    }

    Alert.alert('Αποστολή για έλεγχο', 'Θα επιστρέψει η αναφορά σε πρόχειρο με σημείωση.', [
      { text: 'Άκυρο', style: 'cancel' },
      {
        text: 'Αποστολή',
        style: 'default',
        onPress: async () => {
          try {
            setRequestingReview(true);
            await requestWeeklyReportReview({
              managerId: currentUserId,
              salesmanId: targetUserId,
              weekId,
              expenseIds,
              note: trimmedNote,
            });

            setSelectedExpenseIds(new Set());
            setReviewNote('');

            Alert.alert('Εστάλη', 'Η αναφορά επέστρεψε σε πρόχειρο για διόρθωση.', [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
          } catch (e) {
            Alert.alert('Σφάλμα', e?.message || 'Αποτυχία αποστολής για έλεγχο.');
          } finally {
            setRequestingReview(false);
          }
        },
      },
    ]);
  }, [managerMode, selectedExpenseIds, reviewNote, currentUserId, targetUserId, weekId, navigation]);

  const handleApprove = useCallback(() => {
    if (!managerMode) return;
    if (!currentUserId) {
      Alert.alert('Σφάλμα', 'Λείπει ο χρήστης (manager).');
      return;
    }
    if (!targetUserId) {
      Alert.alert('Σφάλμα', 'Λείπει ο χρήστης (πωλητής).');
      return;
    }
    if (status !== EXPENSE_STATUS.SUBMITTED) {
      Alert.alert('Κατάσταση', 'Η αναφορά δεν είναι σε κατάσταση Υποβληθέν.');
      return;
    }

    Alert.alert('Έγκριση Αναφοράς', `Να εγκριθεί η αναφορά για την εβδομάδα ${weekId};`, [
      { text: 'Άκυρο', style: 'cancel' },
      {
        text: 'Έγκριση',
        style: 'default',
        onPress: async () => {
          try {
            setLoading(true);
            await approveWeeklyReportSubmission({
              managerId: currentUserId,
              salesmanId: targetUserId,
              weekId,
            });
            Alert.alert('Επιτυχία', 'Η αναφορά εγκρίθηκε.', [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
          } catch (e) {
            Alert.alert('Σφάλμα', e?.message || 'Αποτυχία έγκρισης.');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  }, [managerMode, currentUserId, targetUserId, weekId, status, navigation]);

  const handlePrevWeek = () => {
    console.log('[WeeklyReportScreen] Prev week requested:', { weekId });
    const monday = getMondayFromWeekId(weekId);
    const prev = new Date(monday);
    prev.setDate(prev.getDate() - 7);
    setWeekId(getWeekId(prev));
  };

  const handleNextWeek = () => {
    console.log('[WeeklyReportScreen] Next week requested:', { weekId });
    const monday = getMondayFromWeekId(weekId);
    const next = new Date(monday);
    next.setDate(next.getDate() + 7);
    setWeekId(getWeekId(next));
  };

  const handleGoToCurrentWeek = useCallback(() => {
    setWeekId(getWeekId(new Date()));
  }, []);

  if (loading) {
    return (
      <SafeScreen
        title="Εβδομαδιαίο Εξοδολόγιο"
        headerLeft={<BackToExpensesButton />}
        style={{ backgroundColor: '#F7F9FC' }}
      >
        <View style={[styles.centerFill]}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeScreen>
    );
  }

  if (!report) {
    return (
      <SafeScreen
        title="Εβδομαδιαίο Εξοδολόγιο"
        headerLeft={<BackToExpensesButton />}
        style={{ backgroundColor: '#F7F9FC' }}
      >
        <View style={[styles.centerFill]}>
          <Text style={styles.emptyText}>Δεν υπάρχουν δεδομένα για αυτή την εβδομάδα</Text>
        </View>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen
      title="Εβδομαδιαίο Εξοδολόγιο"
      headerLeft={<BackToExpensesButton />}
      headerRight={
        <TouchableOpacity
          onPress={handlePrint}
          disabled={printing}
          style={[styles.headerIconBtn, printing ? { opacity: 0.6 } : null]}
          activeOpacity={0.85}
        >
          <Ionicons name="print-outline" size={18} color="#1D4ED8" />
          <Text style={styles.headerIconBtnText}>{printing ? 'PDF...' : 'PDF'}</Text>
        </TouchableOpacity>
      }
      scroll
      style={{ backgroundColor: '#F7F9FC' }}
    >
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40, paddingTop: 10 }}>
        <View style={styles.weekCard}>
          <TouchableOpacity onPress={() => setWeekPickerOpen(true)} style={styles.weekInfoBtn} activeOpacity={0.85}>
            <Text style={styles.weekTitle}>Εβδομάδα {weekId}</Text>
            <Text style={styles.weekRange}>{weekRange}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setWeekPickerOpen(true)} style={styles.weekPrimaryBtn}>
            <Ionicons name="calendar-outline" size={16} color="#FFFFFF" />
            <Text style={styles.weekPrimaryBtnText}>Επιλογή</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.weekActionsRow}>
          <TouchableOpacity onPress={handlePrevWeek} style={styles.weekActionBtn}>
            <Ionicons name="arrow-back" size={16} color="#1D4ED8" />
            <Text style={styles.weekActionText}>Προηγούμενη εβδομάδα</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleGoToCurrentWeek} style={styles.weekActionBtn}>
            <Ionicons name="today-outline" size={16} color="#1D4ED8" />
            <Text style={styles.weekActionText}>Τρέχουσα εβδομάδα</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleNextWeek} style={styles.weekActionBtn}>
            <Ionicons name="arrow-forward" size={16} color="#1D4ED8" />
            <Text style={styles.weekActionText}>Επόμενη εβδομάδα</Text>
          </TouchableOpacity>
        </View>

      <View style={styles.statusRow}>
        <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}>
          <Text style={[styles.statusBadgeText, { color: statusMeta.fg }]}>{statusMeta.label}</Text>
        </View>
        {managerMode && status === EXPENSE_STATUS.SUBMITTED ? (
          <TouchableOpacity onPress={handleApprove} style={styles.approveTopBtn}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.approveTopBtnText}>Έγκριση</Text>
          </TouchableOpacity>
        ) : managerMode ? (
          <Text style={styles.managerModeText}>Λειτουργία manager</Text>
        ) : null}
      </View>

      {report?.tracking?.review?.note ? (
        <View style={styles.reviewBanner}>
          <Text style={styles.reviewBannerTitle}>Σημείωση ελέγχου</Text>
          <Text style={styles.reviewBannerText}>{String(report.tracking.review.note)}</Text>
        </View>
      ) : null}

      {/* SUMMARY CARD */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Σύνολο εξόδων</Text>
          <Text style={styles.summaryValue}>€{report.totalAmount.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Αριθμός εξόδων</Text>
          <Text style={styles.summaryValue}>{report.expenseCount}</Text>
        </View>
        {report.tracking && (
          <>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Επαγγελματικά km</Text>
              <Text style={styles.summaryValue}>{report.tracking.mileage?.businessKm?.toFixed(1)} km</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Ταμείο υπόλοιπο</Text>
              <Text style={styles.summaryValue}>€{report.tracking.pettyCash?.remaining?.toFixed(2)}</Text>
            </View>
          </>
        )}
      </View>

      {/* EXPENSES BY GROUP */}
      {groupOrder.map((group) => {
        const expenses = report.expensesByGroup[group] || [];
        if (expenses.length === 0) return null;

        return (
          <View key={group} style={styles.groupCard}>
            <Text style={styles.groupTitle}>{group}</Text>

            {expenses.map((exp) => {
              const selected = selectedExpenseIds.has(exp.id);
              const needsReview = !!exp?.review?.required;
              const RowComponent = managerMode ? TouchableOpacity : View;
              return (
                <RowComponent
                  key={exp.id}
                  style={[
                    styles.expenseItem,
                    needsReview ? styles.expenseNeedsReview : null,
                    managerMode && selected ? styles.expenseSelected : null,
                  ]}
                  onPress={managerMode ? () => toggleExpense(exp.id) : undefined}
                  activeOpacity={managerMode ? 0.75 : undefined}
                >
                  {managerMode ? (
                    <View style={[styles.checkbox, selected ? styles.checkboxChecked : null]}>
                      <Text style={[styles.checkboxText, selected ? styles.checkboxTextChecked : null]}>{selected ? '✓' : ''}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.expenseDate}>{formatDateDDMMYYYY(new Date(exp.date))}</Text>
                  <Text style={styles.expenseLabel}>{getCategoryLabel(exp.category)}</Text>
                  <Text style={styles.expenseAmount}>€{exp.amount.toFixed(2)}</Text>
                </RowComponent>
              );
            })}

            <View style={styles.groupTotal}>
              <Text style={styles.groupTotalLabel}>Σύνολο {group}</Text>
              <Text style={styles.groupTotalValue}>
                €{expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}
              </Text>
            </View>
          </View>
        );
      })}

      {/* DAILY BREAKDOWN */}
      {Object.keys(report.expensesByDay).length > 0 && (
        <View style={styles.dailyCard}>
          <Text style={styles.dailyTitle}>Ημερήσια Ανάλυση</Text>
          {Object.entries(report.expensesByDay)
            .sort((a, b) => new Date(b[0]) - new Date(a[0]))
            .map(([dateKey, dayExpenses]) => (
              <View key={dateKey} style={styles.dayRow}>
                <Text style={styles.dayLabel}>{formatDateDDMMYYYY(new Date(dateKey))}</Text>
                <Text style={styles.dayTotal}>€{dayExpenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}</Text>
              </View>
            ))}
        </View>
      )}

      <TouchableOpacity
        style={[styles.printButton, printing ? { opacity: 0.7 } : null]}
        onPress={handlePrint}
        disabled={printing}
      >
        <Text style={styles.printButtonText}>{printing ? 'Δημιουργία PDF...' : '🖨 PDF / Εκτύπωση'}</Text>
      </TouchableOpacity>

      {managerMode ? (
        <View style={styles.reviewActionCard}>
          <Text style={styles.reviewActionTitle}>Αποστολή για έλεγχο</Text>
          <Text style={styles.reviewActionSub}>
            Επίλεξε έξοδα από τη λίστα και γράψε σημείωση.
          </Text>

          <TextInput
            value={reviewNote}
            onChangeText={setReviewNote}
            placeholder="Π.χ. Λείπουν αποδείξεις / λάθος κατηγορία / λάθος ημερομηνία"
            style={styles.reviewInput}
            multiline
          />

          <TouchableOpacity
            style={[styles.reviewSubmitBtn, requestingReview ? { opacity: 0.6 } : null]}
            onPress={handleRequestReview}
            disabled={requestingReview}
          >
            <Text style={styles.reviewSubmitBtnText}>{requestingReview ? 'Αποστολή...' : 'Αποστολή για έλεγχο'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      </ScrollView>

      <Modal visible={weekPickerOpen} transparent animationType="slide" onRequestClose={() => setWeekPickerOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.weekPickerCard}>
            <View style={styles.weekPickerHeader}>
              <Text style={styles.weekPickerTitle}>Επιλογή εβδομάδας</Text>
              <TouchableOpacity onPress={() => setWeekPickerOpen(false)}>
                <Ionicons name="close" size={22} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={(() => {
                const base = getMondayFromWeekId(getWeekId(new Date()));
                const weeks = [];
                for (let i = -16; i <= 4; i += 1) {
                  const d = new Date(base);
                  d.setDate(d.getDate() + i * 7);
                  const id = getWeekId(d);
                  const { start: ws, end: we } = getWeekStartEnd(getMondayFromWeekId(id));
                  weeks.push({
                    id,
                    range: `${formatDateDDMMYYYY(ws)} - ${formatDateDDMMYYYY(we)}`
                  });
                }
                const seen = new Set();
                return weeks.filter((w) => {
                  if (seen.has(w.id)) return false;
                  seen.add(w.id);
                  return true;
                });
              })()}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.weekPickerRow, item.id === weekId && styles.weekPickerRowActive]}
                  onPress={() => {
                    setWeekId(item.id);
                    setWeekPickerOpen(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.weekPickerRowTitle}>{item.id}</Text>
                    <Text style={styles.weekPickerRowSub}>{item.range}</Text>
                  </View>
                  {item.id === weekId ? <Ionicons name="checkmark-circle" size={20} color="#2563EB" /> : null}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F9FC', padding: 16 },
  centerFill: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  headerIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  headerIconBtnText: { color: '#1D4ED8', fontWeight: '900', fontSize: 12 },

  weekCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 10, marginTop: 6 },
  weekInfoBtn: { flex: 1, alignItems: 'flex-start', paddingRight: 10 },
  weekTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  weekRange: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  weekPrimaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#2563EB', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  weekPrimaryBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  weekActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  weekActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E0E7FF', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  weekActionText: { color: '#1D4ED8', fontWeight: '800', fontSize: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  statusBadge: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999 },
  statusBadgeText: { fontWeight: '800', fontSize: 12 },
  managerModeText: { color: '#6B7280', fontSize: 12, fontWeight: '700' },
  approveTopBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#10B981', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  approveTopBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  reviewBanner: { backgroundColor: '#FEF3C7', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FDE68A' },
  reviewBannerTitle: { fontWeight: '800', color: '#92400E', marginBottom: 4 },
  reviewBannerText: { color: '#92400E' },
  summaryCard: { backgroundColor: '#FFF', padding: 14, borderRadius: 12, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  summaryLabel: { color: '#6B7280', fontSize: 13 },
  summaryValue: { color: '#111827', fontWeight: '700', fontSize: 13 },
  groupCard: { backgroundColor: '#FFF', padding: 12, borderRadius: 12, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  groupTitle: { fontSize: 15, fontWeight: '700', color: '#1D4ED8', marginBottom: 10 },
  expenseItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  expenseNeedsReview: { backgroundColor: '#FFF7ED' },
  expenseSelected: { backgroundColor: '#EFF6FF' },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: '#9CA3AF', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  checkboxChecked: { borderColor: '#2563EB', backgroundColor: '#2563EB' },
  checkboxText: { fontSize: 12, fontWeight: '900', color: 'transparent', lineHeight: 14 },
  checkboxTextChecked: { color: '#FFFFFF' },
  expenseDate: { color: '#6B7280', fontSize: 12, minWidth: 80 },
  expenseLabel: { color: '#111827', fontSize: 13, flex: 1, marginLeft: 8 },
  expenseAmount: { color: '#111827', fontWeight: '700', minWidth: 70, textAlign: 'right' },
  groupTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, marginTop: 10, borderTopWidth: 2, borderTopColor: '#E0E7FF' },
  groupTotalLabel: { fontWeight: '700', color: '#1D4ED8' },
  groupTotalValue: { fontWeight: '700', color: '#1D4ED8' },
  dailyCard: { backgroundColor: '#FFF', padding: 12, borderRadius: 12, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  dailyTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 10 },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  dayLabel: { color: '#111827', fontSize: 13 },
  dayTotal: { color: '#111827', fontWeight: '700' },
  printButton: { backgroundColor: '#10B981', paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
  printButtonText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  emptyText: { color: '#6B7280', fontSize: 16 },
  reviewActionCard: { backgroundColor: '#FFF', padding: 14, borderRadius: 12, marginTop: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  reviewActionTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  reviewActionSub: { marginTop: 6, color: '#6B7280', fontSize: 12 },
  reviewInput: { marginTop: 10, minHeight: 90, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, backgroundColor: '#F9FAFB', textAlignVertical: 'top' },
  reviewSubmitBtn: { marginTop: 10, backgroundColor: '#F59E0B', paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
  reviewSubmitBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  weekPickerCard: { backgroundColor: '#FFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '80%', paddingBottom: 12 },
  weekPickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  weekPickerTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  weekPickerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  weekPickerRowActive: { backgroundColor: '#EFF6FF' },
  weekPickerRowTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  weekPickerRowSub: { marginTop: 2, fontSize: 12, color: '#64748B' },
});

export default WeeklyReportScreen;
