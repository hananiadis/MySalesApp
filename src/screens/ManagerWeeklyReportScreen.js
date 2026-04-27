import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Modal, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

import SafeScreen from '../components/SafeScreen';
import BackToExpensesButton from '../components/BackToExpensesButton';
import { useExpense } from '../context/ExpenseContext';
import { EXPENSE_STATUS, formatDateDDMMYYYY, getMondayFromWeekId, getWeekId, getWeekStartEnd } from '../constants/expenseConstants';
import { ROLES, isExpenseApproverRole } from '../constants/roles';
import { getManagerWeeklyReportSubmissions, getWeeklyReportSubmissionsByWeekId } from '../services/expenseService';
import { generateWeeklyReportPdf } from '../utils/weeklyReportPdf';

const TOKENS = {
  primaryBlue: '#185FA5',
  lightBlueBg: '#E6F1FB',
  pageBackground: '#f7f5f0',
  surface: '#fff',
  border: '#e0ddd6',
  borderSoft: '#e8e5de',
  textPrimary: '#1a1a1a',
  textSecondary: '#888',
  amberBg: '#FAEEDA',
  amberText: '#854F0B',
};

export default function ManagerWeeklyReportScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { currentUserId, userRole } = useExpense();

  const isManagerRole = isExpenseApproverRole(userRole);
  const isPrivilegedApprover = userRole === ROLES.OWNER || userRole === ROLES.ADMIN || userRole === ROLES.DEVELOPER;

  const [weekId, setWeekId] = useState(getWeekId(new Date()));
  const [weekPickerOpen, setWeekPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [usersById, setUsersById] = useState(() => ({}));
  const [printing, setPrinting] = useState(false);

  const DEBUG_FIRESTORE = __DEV__;

  const weekStartDate = getMondayFromWeekId(weekId);
  const { start, end } = getWeekStartEnd(weekStartDate);
  const weekRange = `${formatDateDDMMYYYY(start)} - ${formatDateDDMMYYYY(end)}`;

  const handlePrevWeek = useCallback(() => {
    const monday = getMondayFromWeekId(weekId);
    const prev = new Date(monday);
    prev.setDate(prev.getDate() - 7);
    setWeekId(getWeekId(prev));
  }, [weekId]);

  const handleNextWeek = useCallback(() => {
    const monday = getMondayFromWeekId(weekId);
    const next = new Date(monday);
    next.setDate(next.getDate() + 7);
    setWeekId(getWeekId(next));
  }, [weekId]);

  const handleGoToCurrentWeek = useCallback(() => {
    setWeekId(getWeekId(new Date()));
  }, []);

  const loadUsersByIds = useCallback(async (ids) => {
    const unique = Array.from(new Set((Array.isArray(ids) ? ids : []).filter(Boolean)));
    const missing = unique.filter((id) => !usersById[id]);
    if (missing.length === 0) return;

    try {
      if (DEBUG_FIRESTORE) {
        console.log('[ManagerWeeklyReportScreen] loadUsersByIds:start', {
          unique: unique.length,
          missing: missing.length,
          sampleMissing: missing.slice(0, 3),
        });
      }
      const chunks = [];
      for (let i = 0; i < missing.length; i += 10) chunks.push(missing.slice(i, i + 10));

      const nextMap = {};
      // eslint-disable-next-line no-restricted-syntax
      for (const chunk of chunks) {
        // Use per-doc reads to avoid query permission issues on /users list rules.
        // eslint-disable-next-line no-await-in-loop
        const snaps = await Promise.all(
          chunk.map((userId) => firestore().collection('users').doc(userId).get())
        );

        snaps.forEach((docSnap) => {
          if (!docSnap?.exists) return;
          nextMap[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
        });
      }

      setUsersById((prev) => ({ ...prev, ...nextMap }));
      if (DEBUG_FIRESTORE) {
        console.log('[ManagerWeeklyReportScreen] loadUsersByIds:success', {
          loaded: Object.keys(nextMap).length,
        });
      }
    } catch (e) {
      if (DEBUG_FIRESTORE) {
        console.warn('[ManagerWeeklyReportScreen] loadUsersByIds:error', {
          code: e?.code,
          message: e?.message,
          missingCount: missing.length,
          sampleMissing: missing.slice(0, 3),
        });
      }
      console.warn('[ManagerWeeklyReportScreen] loadUsersByIds failed:', e);
    }
  }, [usersById]);

  const loadWeekSubmissions = useCallback(async () => {
    if (!currentUserId) return;
    if (!isManagerRole) return;

    try {
      if (DEBUG_FIRESTORE) {
        console.log('[ManagerWeeklyReportScreen] loadWeekSubmissions:start', {
          currentUserId,
          userRole,
          authUid: auth()?.currentUser?.uid || null,
          authEmail: auth()?.currentUser?.email || null,
          currentUserIdMatchesAuthUid: Boolean(auth()?.currentUser?.uid && currentUserId && auth().currentUser.uid === currentUserId),
          weekId,
          isPrivilegedApprover,
        });
      }
      setLoading(true);
      const all = isPrivilegedApprover
        ? await getWeeklyReportSubmissionsByWeekId(weekId)
        : await getManagerWeeklyReportSubmissions(currentUserId);

      const filtered = (Array.isArray(all) ? all : []).filter(
        (s) => s && s.weekId === weekId && (s.status || EXPENSE_STATUS.SUBMITTED) === EXPENSE_STATUS.SUBMITTED
      );
      setSubmissions(filtered);
      await loadUsersByIds(filtered.map((s) => s.salesmanId));
      if (DEBUG_FIRESTORE) {
        console.log('[ManagerWeeklyReportScreen] loadWeekSubmissions:success', {
          allCount: Array.isArray(all) ? all.length : 0,
          filteredCount: filtered.length,
        });
      }
    } catch (error) {
      if (error?.code === 'firestore/permission-denied') {
        console.error('[ManagerWeeklyReportScreen] loadWeekSubmissions:PERMISSION_DENIED', {
          currentUserId,
          userRole,
          authUid: auth()?.currentUser?.uid || null,
          authEmail: auth()?.currentUser?.email || null,
          weekId,
          isPrivilegedApprover,
          message: error?.message,
        });
      } else if (DEBUG_FIRESTORE) {
        console.warn('[ManagerWeeklyReportScreen] loadWeekSubmissions:error', {
          code: error?.code,
          message: error?.message,
          currentUserId,
          userRole,
          weekId,
          isPrivilegedApprover,
        });
      }
      console.error('Error loading weekly submissions:', error);
      Alert.alert('Σφάλμα', error?.message || 'Αποτυχία φόρτωσης αναφορών');
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, weekId, loadUsersByIds, isPrivilegedApprover, isManagerRole]);

  useEffect(() => {
    if (!isManagerRole) return;
    loadWeekSubmissions();
  }, [loadWeekSubmissions]);

  const getUserLabel = useCallback((userId) => {
    const u = usersById?.[userId];
    const name = u?.name || `${u?.firstName || ''} ${u?.lastName || ''}`.trim();
    return name || u?.email || userId;
  }, [usersById]);

  const handlePrint = useCallback(
    async (item) => {
      try {
        setPrinting(true);
        await generateWeeklyReportPdf({
          salesmanId: item.salesmanId,
          weekId: item.weekId,
          viewerManagerId: currentUserId,
          forceShare: true,
        });
      } catch (e) {
        Alert.alert('Σφάλμα', e?.message || 'Αποτυχία δημιουργίας PDF.');
      } finally {
        setPrinting(false);
      }
    },
    [currentUserId]
  );

  const renderSubmissionRow = useCallback(
    ({ item }) => {
      const totalAmount = item?.summary?.totalAmount ?? 0;
      const expenseCount = item?.summary?.expenseCount ?? 0;
      const userLabel = getUserLabel(item.salesmanId);

      const invoiceTotal = item?.summary?.invoiceTotal;
      const receiptTotal = item?.summary?.receiptTotal;
      const invoiceCount = item?.summary?.invoiceCount;
      const receiptCount = item?.summary?.receiptCount;
      const hasBreakdown =
        invoiceTotal != null || receiptTotal != null || invoiceCount != null || receiptCount != null;
      const breakdownText = hasBreakdown
        ? `Τιμολόγια: €${Number(invoiceTotal || 0).toFixed(2)} (${Number(invoiceCount || 0)}) • Αποδείξεις: €${Number(receiptTotal || 0).toFixed(2)} (${Number(receiptCount || 0)})`
        : null;

      return (
        <TouchableOpacity
          style={styles.submissionRow}
          onPress={() =>
            navigation.navigate('WeeklyReport', {
              userId: item.salesmanId,
              weekId: item.weekId,
              managerMode: true,
            })
          }
          activeOpacity={0.85}
        >
          <View style={styles.submissionRowTop}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.submissionUser} numberOfLines={1}>{userLabel}</Text>
              <Text style={styles.submissionMeta}>{expenseCount} έξοδα</Text>
              {breakdownText ? (
                <Text style={styles.submissionBreakdown} numberOfLines={2}>{breakdownText}</Text>
              ) : null}
            </View>
            <Text style={styles.submissionAmount}>€{Number(totalAmount).toFixed(2)}</Text>
          </View>

          <View style={styles.submissionRowBottom}>
            <View style={styles.submittedBadge}>
              <Text style={styles.submittedBadgeText}>Υποβληθέν</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity
                style={[styles.pdfIconBtn, printing && { opacity: 0.7 }]}
                onPress={() => handlePrint(item)}
                disabled={printing}
              >
                <Ionicons name="print-outline" size={18} color={TOKENS.primaryBlue} />
              </TouchableOpacity>
              <Ionicons name="chevron-forward" size={18} color={TOKENS.textSecondary} />
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [navigation, getUserLabel, handlePrint, printing]
  );

  const header = useMemo(
    () => (
      <>
        <View style={styles.weekCard}>
          <TouchableOpacity onPress={() => setWeekPickerOpen(true)} style={styles.weekInfoBtn} activeOpacity={0.85}>
            <Text style={styles.weekTitle}>Εβδομάδα {weekId}</Text>
            <Text style={styles.weekRange}>{weekRange}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setWeekPickerOpen(true)} style={styles.weekPrimaryBtn}>
            <Ionicons name="calendar-outline" size={16} color={TOKENS.surface} />
            <Text style={styles.weekPrimaryBtnText}>Επιλογή</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.weekActionsRow}>
          <TouchableOpacity onPress={handlePrevWeek} style={styles.weekActionBtn}>
            <Ionicons name="arrow-back" size={16} color={TOKENS.primaryBlue} />
            <Text style={styles.weekActionText}>Προηγούμενη</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleGoToCurrentWeek} style={styles.weekActionBtn}>
            <Ionicons name="today-outline" size={16} color={TOKENS.primaryBlue} />
            <Text style={styles.weekActionText}>Τρέχουσα</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleNextWeek} style={styles.weekActionBtn}>
            <Ionicons name="arrow-forward" size={16} color={TOKENS.primaryBlue} />
            <Text style={styles.weekActionText}>Επόμενη</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Υποβληθέντα για έγκριση</Text>
          <TouchableOpacity onPress={loadWeekSubmissions} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={16} color={TOKENS.primaryBlue} />
            <Text style={styles.refreshBtnText}>Ανανέωση</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        ) : null}

        {!loading && submissions.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyStateText}>Δεν υπάρχουν υποβληθέντα εξοδολόγια για αυτή την εβδομάδα.</Text>
          </View>
        ) : null}
      </>
    ),
    [weekId, weekRange, handlePrevWeek, handleGoToCurrentWeek, handleNextWeek, loadWeekSubmissions, loading, submissions.length]
  );

  if (!isManagerRole) {
    return (
      <SafeScreen title="Εβδομαδιαία Εξοδολόγια" headerLeft={<BackToExpensesButton />} scroll>
        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
          <Text style={styles.errorText}>Αυτή η λειτουργία είναι διαθέσιμη μόνο για διαχειριστές.</Text>
        </View>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen title="Εβδομαδιαία Εξοδολόγια" headerLeft={<BackToExpensesButton />} style={{ backgroundColor: TOKENS.pageBackground }}>
      <View style={{ flex: 1 }}>
        <FlashList
          data={!loading ? submissions : []}
          keyExtractor={(item) => item.id}
          renderItem={renderSubmissionRow}
          estimatedItemSize={86}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingTop: 14, paddingBottom: 20 }}
        />

        <Modal visible={weekPickerOpen} transparent animationType="slide" onRequestClose={() => setWeekPickerOpen(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.weekPickerCard, { paddingBottom: Math.max(insets.bottom, 12) + 6 }]}>
              <View style={styles.weekPickerHandle} />
              <View style={styles.weekPickerHeader}>
                <Text style={styles.weekPickerTitle}>Επιλογή εβδομάδας</Text>
                <TouchableOpacity onPress={() => setWeekPickerOpen(false)}>
                  <Ionicons name="close" size={22} color={TOKENS.textPrimary} />
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
                    {item.id === weekId ? <Ionicons name="checkmark-circle" size={20} color={TOKENS.primaryBlue} /> : null}
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  errorText: { color: '#EF4444', fontSize: 16, fontWeight: '700' },

  weekCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: TOKENS.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: TOKENS.border, marginTop: 6 },
  weekInfoBtn: { flex: 1, alignItems: 'flex-start', paddingRight: 10 },
  weekTitle: { fontSize: 16, fontWeight: '800', color: TOKENS.textPrimary },
  weekRange: { fontSize: 12, color: TOKENS.textSecondary, marginTop: 2 },
  weekPrimaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: TOKENS.primaryBlue, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  weekPrimaryBtnText: { color: TOKENS.surface, fontWeight: '900', fontSize: 12 },

  weekActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10, marginBottom: 14 },
  weekActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: TOKENS.lightBlueBg, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  weekActionText: { color: TOKENS.primaryBlue, fontWeight: '800', fontSize: 12 },

  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: TOKENS.textPrimary },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: TOKENS.lightBlueBg, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  refreshBtnText: { color: TOKENS.primaryBlue, fontWeight: '900', fontSize: 12 },

  loader: { justifyContent: 'center', alignItems: 'center', minHeight: 120 },
  emptyStateContainer: { alignItems: 'center', paddingVertical: 22 },
  emptyStateText: { color: TOKENS.textSecondary, fontSize: 14, fontWeight: '700', textAlign: 'center' },

  submissionRow: { backgroundColor: TOKENS.surface, padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: TOKENS.border },
  submissionRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  submissionUser: { fontSize: 14, fontWeight: '900', color: TOKENS.textPrimary },
  submissionMeta: { marginTop: 4, fontSize: 12, fontWeight: '700', color: TOKENS.textSecondary },
  submissionBreakdown: { marginTop: 4, fontSize: 12, color: TOKENS.textSecondary },
  submissionAmount: { fontSize: 14, fontWeight: '900', color: TOKENS.primaryBlue },
  submissionRowBottom: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  submittedBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: TOKENS.amberBg },
  submittedBadgeText: { fontSize: 11, fontWeight: '900', color: TOKENS.amberText },
  pdfIconBtn: { padding: 6, borderRadius: 10, backgroundColor: TOKENS.lightBlueBg, borderWidth: 1, borderColor: TOKENS.borderSoft },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  weekPickerCard: { backgroundColor: TOKENS.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '80%', paddingBottom: 12, borderTopWidth: 1, borderColor: TOKENS.borderSoft },
  weekPickerHandle: { alignSelf: 'center', width: 46, height: 5, borderRadius: 999, backgroundColor: '#d6d2ca', marginTop: 8, marginBottom: 10 },
  weekPickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: TOKENS.border },
  weekPickerTitle: { fontSize: 16, fontWeight: '800', color: TOKENS.textPrimary },
  weekPickerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: TOKENS.borderSoft },
  weekPickerRowActive: { backgroundColor: TOKENS.lightBlueBg },
  weekPickerRowTitle: { fontSize: 14, fontWeight: '800', color: TOKENS.textPrimary },
  weekPickerRowSub: { marginTop: 2, fontSize: 12, color: TOKENS.textSecondary },
});
