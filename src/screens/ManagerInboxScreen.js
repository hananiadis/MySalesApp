import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

import SafeScreen from '../components/SafeScreen';
import BackToExpensesButton from '../components/BackToExpensesButton';
import colors from '../theme/colors';
import { EXPENSE_STATUS, formatDateDDMMYYYY, getMondayFromWeekId, getWeekStartEnd } from '../constants/expenseConstants';
import { useExpense } from '../context/ExpenseContext';
import { isExpenseApproverRole } from '../constants/roles';
import { approveWeeklyReportSubmission, getManagerWeeklyReportSubmissions } from '../services/expenseService';
import { generateWeeklyReportPdf } from '../utils/weeklyReportPdf';

const STATUS_LABELS = {
  [EXPENSE_STATUS.DRAFT]: 'Πρόχειρο',
  [EXPENSE_STATUS.SUBMITTED]: 'Υποβληθέν',
  [EXPENSE_STATUS.APPROVED]: 'Εγκεκριμένο',
};

const STATUS_COLORS = {
  [EXPENSE_STATUS.DRAFT]: { bg: '#E5E7EB', fg: '#111827' },
  [EXPENSE_STATUS.SUBMITTED]: { bg: '#FEF3C7', fg: '#92400E' },
  [EXPENSE_STATUS.APPROVED]: { bg: '#DCFCE7', fg: '#166534' },
};

export default function ManagerInboxScreen() {
  const navigation = useNavigation();
  const { currentUserId, userRole } = useExpense();

  const isManagerRole = isExpenseApproverRole(userRole);

  const DEBUG_FIRESTORE = __DEV__;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [printing, setPrinting] = useState(false);
  const [usersById, setUsersById] = useState(() => ({}));

  const loadUsersByIds = useCallback(async (ids) => {
    const unique = Array.from(new Set((Array.isArray(ids) ? ids : []).filter(Boolean)));
    const missing = unique.filter((id) => !usersById[id]);
    if (missing.length === 0) return;

    try {
      const chunks = [];
      for (let i = 0; i < missing.length; i += 10) chunks.push(missing.slice(i, i + 10));

      const nextMap = {};
      // eslint-disable-next-line no-restricted-syntax
      for (const chunk of chunks) {
        // eslint-disable-next-line no-await-in-loop
        const snaps = await Promise.all(chunk.map((userId) => firestore().collection('users').doc(userId).get()));
        snaps.forEach((docSnap) => {
          if (!docSnap?.exists) return;
          nextMap[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
        });
      }

      setUsersById((prev) => ({ ...prev, ...nextMap }));
    } catch (e) {
      if (DEBUG_FIRESTORE) {
        console.warn('[ManagerInboxScreen] loadUsersByIds:error', { code: e?.code, message: e?.message });
      }
    }
  }, [usersById, DEBUG_FIRESTORE]);

  const loadInbox = useCallback(async () => {
    if (!currentUserId) return;
    if (!isManagerRole) return;
    try {
      if (DEBUG_FIRESTORE) {
        console.log('[ManagerInboxScreen] loadInbox:start', {
          currentUserId,
          userRole,
          authUid: auth()?.currentUser?.uid || null,
          authEmail: auth()?.currentUser?.email || null,
          currentUserIdMatchesAuthUid: Boolean(auth()?.currentUser?.uid && currentUserId && auth().currentUser.uid === currentUserId),
        });
      }
      setLoading(true);
      const data = await getManagerWeeklyReportSubmissions(currentUserId);
      await loadUsersByIds((Array.isArray(data) ? data : []).map((s) => s?.salesmanId).filter(Boolean));
      if (DEBUG_FIRESTORE) {
        console.log('[ManagerInboxScreen] loadInbox:success', {
          count: Array.isArray(data) ? data.length : 0,
        });
      }
      setSubmissions(Array.isArray(data) ? data : []);
    } catch (e) {
      if (e?.code === 'firestore/permission-denied') {
        console.error('[ManagerInboxScreen] loadInbox:PERMISSION_DENIED', {
          currentUserId,
          userRole,
          authUid: auth()?.currentUser?.uid || null,
          authEmail: auth()?.currentUser?.email || null,
          message: e?.message,
        });
      } else if (DEBUG_FIRESTORE) {
        console.warn('[ManagerInboxScreen] loadInbox:error', {
          code: e?.code,
          message: e?.message,
          currentUserId,
          userRole,
        });
      }
      Alert.alert('Σφάλμα', e?.message || 'Αποτυχία φόρτωσης εισερχομένων.');
    } finally {
      setLoading(false);
    }
  }, [currentUserId, isManagerRole]);

  useEffect(() => {
    if (!isManagerRole) return;
    loadInbox();
  }, [loadInbox]);

  useFocusEffect(
    useCallback(() => {
      if (!isManagerRole) return;
      loadInbox();
    }, [loadInbox])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadInbox();
    } finally {
      setRefreshing(false);
    }
  }, [loadInbox]);

  const handleOpen = useCallback(
    (item) => {
      navigation.navigate('WeeklyReport', {
        userId: item.salesmanId,
        weekId: item.weekId,
      });
    },
    [navigation]
  );

  const handleReview = useCallback(
    (item) => {
      navigation.navigate('WeeklyReport', {
        userId: item.salesmanId,
        weekId: item.weekId,
        managerMode: true,
      });
    },
    [navigation]
  );

  const handleApprove = useCallback(
    (item) => {
      Alert.alert(
        'Έγκριση Αναφοράς',
        `Να εγκριθεί η αναφορά για την εβδομάδα ${item.weekId};`,
        [
          { text: 'Άκυρο', style: 'cancel' },
          {
            text: 'Έγκριση',
            style: 'default',
            onPress: async () => {
              try {
                setLoading(true);
                await approveWeeklyReportSubmission({
                  managerId: currentUserId,
                  salesmanId: item.salesmanId,
                  weekId: item.weekId,
                });
                await loadInbox();
                Alert.alert('Επιτυχία', 'Η αναφορά εγκρίθηκε.');
              } catch (e) {
                Alert.alert('Σφάλμα', e?.message || 'Αποτυχία έγκρισης.');
              } finally {
                setLoading(false);
              }
            },
          },
        ]
      );
    },
    [currentUserId, loadInbox]
  );

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

  const renderItem = useCallback(
    ({ item }) => {
      const status = item.status || EXPENSE_STATUS.SUBMITTED;
      const statusMeta = STATUS_COLORS[status] || STATUS_COLORS[EXPENSE_STATUS.SUBMITTED];

      const weekStart = getMondayFromWeekId(item.weekId);
      const { start, end } = getWeekStartEnd(weekStart);
      const weekRange = `${formatDateDDMMYYYY(start)} - ${formatDateDDMMYYYY(end)}`;

      const totalAmount = item.summary?.totalAmount ?? 0;
      const expenseCount = item.summary?.expenseCount ?? 0;

      const invoiceTotal = item?.summary?.invoiceTotal;
      const receiptTotal = item?.summary?.receiptTotal;
      const invoiceCount = item?.summary?.invoiceCount;
      const receiptCount = item?.summary?.receiptCount;

      const u = usersById?.[item?.salesmanId];
      const name = u?.name || `${u?.firstName || ''} ${u?.lastName || ''}`.trim();
      const userLabel = name || u?.email || item?.salesmanId;

      const hasBreakdown =
        invoiceTotal != null || receiptTotal != null || invoiceCount != null || receiptCount != null;
      const breakdownText = hasBreakdown
        ? `Τιμολόγια: €${Number(invoiceTotal || 0).toFixed(2)} (${Number(invoiceCount || 0)}) • Αποδείξεις: €${Number(receiptTotal || 0).toFixed(2)} (${Number(receiptCount || 0)})`
        : null;

      return (
        <TouchableOpacity style={styles.card} onPress={() => handleOpen(item)} activeOpacity={0.8}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Ionicons name="mail-unread-outline" size={22} color={colors.primary} />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.weekId}>{item.weekId}</Text>
                <Text style={styles.weekRange}>{weekRange}</Text>
                <Text style={styles.submittedBy} numberOfLines={1}>{userLabel}</Text>
              </View>
            </View>
            <View style={[styles.badge, { backgroundColor: statusMeta.bg }]}
            >
              <Text style={[styles.badgeText, { color: statusMeta.fg }]}>{STATUS_LABELS[status] || status}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <Text style={styles.statText}>{expenseCount} έξοδα</Text>
            <Text style={styles.statText}>€{Number(totalAmount).toFixed(2)}</Text>
          </View>

          {breakdownText ? (
            <Text style={styles.breakdownText} numberOfLines={2}>{breakdownText}</Text>
          ) : null}

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.openBtn} onPress={() => handleOpen(item)}>
              <Ionicons name="eye-outline" size={18} color={colors.white} />
              <Text style={styles.openBtnText}>Άνοιγμα</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.pdfBtn, printing && { opacity: 0.7 }]}
              onPress={() => handlePrint(item)}
              disabled={printing}
            >
              <Ionicons name="print-outline" size={18} color={colors.white} />
              <Text style={styles.pdfBtnText}>{printing ? 'PDF...' : 'PDF'}</Text>
            </TouchableOpacity>

            {status === EXPENSE_STATUS.SUBMITTED ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity style={styles.reviewBtn} onPress={() => handleReview(item)}>
                  <Ionicons name="alert-circle-outline" size={18} color={colors.white} />
                  <Text style={styles.reviewBtnText}>Έλεγχος</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item)}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />
                  <Text style={styles.approveBtnText}>Έγκριση</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.approvedPill}>
                <Ionicons name="checkmark" size={16} color="#166534" />
                <Text style={styles.approvedPillText}>OK</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [handleApprove, handleOpen, handleReview, handlePrint, printing, usersById]
  );

  const emptyComponent = useMemo(
    () => (
      <View style={styles.emptyWrap}>
        <Ionicons name="inbox-outline" size={40} color={colors.textSecondary} />
        <Text style={styles.emptyTitle}>Δεν υπάρχουν αναφορές</Text>
        <Text style={styles.emptySub}>Θα εμφανιστούν εδώ όταν οι πωλητές υποβάλουν εβδομαδιαίο εξοδολόγιο.</Text>
      </View>
    ),
    []
  );

  if (!isManagerRole) {
    return (
      <SafeScreen title="Inbox" headerLeft={<BackToExpensesButton />} style={{ flex: 1, backgroundColor: '#F7F9FC' }}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Αυτή η λειτουργία είναι διαθέσιμη μόνο για managers.</Text>
        </View>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen title="Inbox" headerLeft={<BackToExpensesButton />} style={{ flex: 1, backgroundColor: '#F7F9FC' }}>
      <View style={styles.container}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={submissions}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 16, paddingBottom: 40, flexGrow: 1 }}
            ListEmptyComponent={emptyComponent}
            onRefresh={onRefresh}
            refreshing={refreshing}
          />
        )}
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F9FC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  errorText: { color: '#EF4444', fontWeight: '700', textAlign: 'center' },

  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  weekId: { fontSize: 15, fontWeight: '800', color: '#111827' },
  weekRange: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  submittedBy: { fontSize: 13, color: '#111827', marginTop: 3, fontWeight: '800' },

  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '800' },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  statText: { color: '#111827', fontWeight: '700' },
  breakdownText: { marginTop: 6, fontSize: 12, color: '#6B7280' },

  actionsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  openBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  openBtnText: { color: colors.white, fontWeight: '800', fontSize: 12 },
  pdfBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#334155', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  pdfBtnText: { color: colors.white, fontWeight: '800', fontSize: 12 },
  approveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#10B981', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  approveBtnText: { color: colors.white, fontWeight: '800', fontSize: 12 },
  reviewBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F59E0B', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  reviewBtnText: { color: colors.white, fontWeight: '800', fontSize: 12 },
  approvedPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#DCFCE7', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  approvedPillText: { color: '#166534', fontWeight: '900', fontSize: 12 },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { marginTop: 10, fontSize: 16, fontWeight: '800', color: '#111827' },
  emptySub: { marginTop: 6, fontSize: 12, color: '#6B7280', textAlign: 'center', maxWidth: 320 },
});
