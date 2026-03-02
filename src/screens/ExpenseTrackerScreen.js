import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import SafeScreen from '../components/SafeScreen';
import ExpenseDetailModal from '../components/ExpenseDetailModal';
import { useExpense } from '../context/ExpenseContext';
import { isExpenseApproverRole } from '../constants/roles';
import { EXPENSE_GROUPS, EXPENSE_STATUS, getAllCategoryGroups, getCategoriesByGroup, getCategoryLabel, formatDateDDMMYYYY, getWeekId, getMondayFromWeekId, getWeekStartEnd } from '../constants/expenseConstants';
import colors from '../theme/colors';
import CurvedBottomBar from '../components/CurvedBottomBar';

const BOTTOM_BAR_HEIGHT = 140;

const STRINGS = {
  title: 'Εξοδολόγιο',
  newExpense: 'Νέο Έξοδο',
  expenseReports: 'Αναφορές Εξόδων',
  weeklyTracking: 'Εβδομαδιαία Καταγραφή',
  weeklyReport: 'Εβδομαδιαίο Εξοδολόγιο',
  managerReports: 'Αναφορές Ομάδας',
  inbox: 'Inbox',
  backToHome: 'Επιστροφή στην κεντρική',
};

const ICONS = {
  newExpense: 'add',
  expenseReports: 'document-text-outline',
  weeklyTracking: 'calendar-outline',
  weeklyReport: 'file-tray-full-outline',
  managerReports: 'people-outline',
  inbox: 'mail-unread-outline',
  back: 'arrow-back-circle-outline',
};

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

const ExpenseTrackerScreen = () => {
  const navigation = useNavigation();
  const {
    expenses,
    filteredExpenses,
    summary,
    loading,
    userRole,
    fetchWeeklyTracking,
    deleteExistingExpense
  } = useExpense();

  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [expenseModalVisible, setExpenseModalVisible] = useState(false);
  const [selectedExpenseId, setSelectedExpenseId] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);

  const [weekStatusById, setWeekStatusById] = useState({});

  const categoriesByGroup = useMemo(() => {
    return getAllCategoryGroups().map((group) => ({
      group,
      categories: getCategoriesByGroup(group)
    }));
  }, []);

  useEffect(() => {
    console.log('[ExpenseTrackerScreen] mounted');
    return () => console.log('[ExpenseTrackerScreen] unmounted');
  }, []);

  // Custom layout strategy to show all tabs (no matter how many)
  const layoutStrategy = useMemo(() => {
    return (routes) => {
      const splitIndex = Math.ceil(routes.length / 2);
      return {
        leftRoutes: routes.slice(0, splitIndex),
        rightRoutes: routes.slice(splitIndex),
      };
    };
  }, []);

  const bottomTabs = useMemo(() => {
    const isManagerRole = isExpenseApproverRole(userRole);
    const tabs = [
      {
        key: 'expense-reports',
        name: 'ExpenseReports',
        label: STRINGS.expenseReports,
        icon: ICONS.expenseReports,
      },
      {
        key: 'weekly-tracking',
        name: 'WeeklyTracking',
        label: STRINGS.weeklyTracking,
        icon: ICONS.weeklyTracking,
      },
      {
        key: 'weekly-report',
        name: 'WeeklyReport',
        label: STRINGS.weeklyReport,
        icon: ICONS.weeklyReport,
      },
    ];

    if (isManagerRole) {
      tabs.push({
        key: 'inbox',
        name: 'ManagerInbox',
        label: STRINGS.inbox,
        icon: ICONS.inbox,
      });
      tabs.push({
        key: 'manager-reports',
        name: 'ManagerWeeklyReport',
        label: STRINGS.managerReports,
        icon: ICONS.managerReports,
      });
    }

    return tabs;
  }, [userRole]);

  const bottomState = useMemo(() => ({
    index: -1,
    routes: bottomTabs.map((tab) => ({
      key: tab.key,
      name: tab.key,
      params: undefined,
    })),
  }), [bottomTabs]);

  const bottomDescriptors = useMemo(() => {
    return bottomTabs.reduce((acc, tab) => {
      acc[tab.key] = {
        options: {
          tabBarVisible: true,
          tabBarLabel: tab.label,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={tab.icon} size={size} color={color} />
          ),
        },
      };
      return acc;
    }, {});
  }, [bottomTabs]);

  // Custom navigation wrapper that intercepts tab presses and navigates correctly
  const customBottomNavigation = useMemo(() => ({
    ...navigation,
    navigate: (routeName, params) => {
      const tab = bottomTabs.find((t) => t.key === routeName);
      console.log('[ExpenseTrackerScreen] BottomBar navigate:', { routeName, params, tab });
      if (tab && tab.name) {
        try {
          navigation.navigate(tab.name, params);
        } catch (error) {
          console.warn(`Navigation failed for ${tab.name}:`, error.message);
        }
      } else {
        console.warn('[ExpenseTrackerScreen] BottomBar route not found:', { routeName });
      }
    },
    emit: ({ type, target }) => {
      console.log('[ExpenseTrackerScreen] BottomBar emit:', { type, target });
      return { defaultPrevented: false };
    },
  }), [navigation, bottomTabs]);

  const handleGroupSelect = (group) => {
    setSelectedGroup(group);
  };

  const handleCategorySelect = (categoryId) => {
    setMenuVisible(false);
    setSelectedGroup(null);
    setSelectedCategoryId(categoryId);
    setSelectedExpenseId(null);
    setExpenseModalVisible(true);
  };

  const handleCloseMenu = () => {
    setMenuVisible(false);
    setSelectedGroup(null);
  };

  const handleExpensePress = (expenseId) => {
    setSelectedExpenseId(expenseId);
    setSelectedCategoryId(null);
    setExpenseModalVisible(true);
  };

  const handleDeleteExpense = (expenseId) => {
    console.log('[ExpenseTrackerScreen] Delete requested:', { expenseId });
    Alert.alert(
      'Διαγραφή Εξόδου',
      'Είστε σίγουρος ότι θέλετε να διαγράψετε αυτό το έξοδο;',
      [
        {
          text: 'Ακύρωση',
          onPress: () => {},
          style: 'cancel',
        },
        {
          text: 'Διαγραφή',
          onPress: async () => {
            try {
              console.log('[ExpenseTrackerScreen] Deleting expense:', { expenseId });
              await deleteExistingExpense(expenseId);
              console.log('[ExpenseTrackerScreen] Deleted expense:', { expenseId });
            } catch (error) {
              Alert.alert('Σφάλμα', 'Αποτυχία διαγραφής εξόδου: ' + error.message);
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleCloseExpenseModal = () => {
    setExpenseModalVisible(false);
    setSelectedExpenseId(null);
    setSelectedCategoryId(null);
  };

  const getGroupIcon = (group) => {
    switch (group) {
      case EXPENSE_GROUPS.TRAVEL:
        return '🚗';
      case EXPENSE_GROUPS.ACCOMMODATION_FOOD:
        return '🏨';
      case EXPENSE_GROUPS.MISCELLANEOUS:
        return '📋';
      default:
        return '📝';
    }
  };

  const getGroupColor = (group) => {
    switch (group) {
      case EXPENSE_GROUPS.TRAVEL:
        return '#0891B2'; // Cyan
      case EXPENSE_GROUPS.ACCOMMODATION_FOOD:
        return '#10B981'; // Green
      case EXPENSE_GROUPS.MISCELLANEOUS:
        return '#F59E0B'; // Amber
      default:
        return '#6B7280';
    }
  };

  const renderExpense = ({ item }) => (
    <View style={styles.expenseItemContainer}>
      <TouchableOpacity
        style={styles.expenseItem}
        onPress={() => handleExpensePress(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.expenseRow}>
          <Text style={styles.expenseDate}>{formatDateDDMMYYYY(new Date(item.date))}</Text>
          <Text style={styles.expenseAmount}>€{item.amount.toFixed(2)}</Text>
        </View>
        <View style={styles.expenseRow}>
          <Text style={styles.expenseCategory}>{getCategoryLabel(item.category)}</Text>
          <Text style={styles.expenseStatus}>{item.status}</Text>
        </View>
        {!!item.description && <Text style={styles.expenseDescription}>{item.description}</Text>}
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteExpense(item.id)}
        activeOpacity={0.8}
      >
        <Ionicons name="trash-outline" size={20} color={colors.white} />
      </TouchableOpacity>
    </View>
  );

  const recentWeeklyReports = useMemo(() => {
    const byWeek = new Map();

    (expenses || []).forEach((exp) => {
      const expDate = new Date(exp.date);
      const weekId = getWeekId(expDate);
      const current = byWeek.get(weekId) || {
        weekId,
        totalAmount: 0,
        expenseCount: 0,
        latestDate: expDate,
        baseStatus: EXPENSE_STATUS.DRAFT,
      };

      current.totalAmount += Number(exp.amount || 0);
      current.expenseCount += 1;
      if (expDate > current.latestDate) current.latestDate = expDate;

      if (exp.status === EXPENSE_STATUS.APPROVED) current.baseStatus = EXPENSE_STATUS.APPROVED;
      else if (exp.status === EXPENSE_STATUS.SUBMITTED && current.baseStatus !== EXPENSE_STATUS.APPROVED) {
        current.baseStatus = EXPENSE_STATUS.SUBMITTED;
      }

      byWeek.set(weekId, current);
    });

    return Array.from(byWeek.values())
      .sort((a, b) => new Date(b.latestDate) - new Date(a.latestDate))
      .slice(0, 6);
  }, [expenses]);

  useEffect(() => {
    let cancelled = false;

    const loadWeekStatuses = async () => {
      if (!fetchWeeklyTracking) return;
      if (!recentWeeklyReports.length) return;
      try {
        const results = await Promise.all(
          recentWeeklyReports.map(async (w) => {
            try {
              const tracking = await fetchWeeklyTracking(w.weekId);
              return { weekId: w.weekId, status: tracking?.status };
            } catch {
              return { weekId: w.weekId, status: null };
            }
          })
        );

        if (cancelled) return;
        setWeekStatusById((prev) => {
          const next = { ...prev };
          results.forEach((r) => {
            if (r?.weekId && r.status) next[r.weekId] = r.status;
          });
          return next;
        });
      } catch (e) {
        console.warn('[ExpenseTrackerScreen] Failed loading week statuses:', e?.message);
      }
    };

    loadWeekStatuses();
    return () => {
      cancelled = true;
    };
  }, [fetchWeeklyTracking, recentWeeklyReports]);

  const openWeek = useCallback(
    (weekId) => {
      navigation.navigate('WeeklyTracking', { weekId });
    },
    [navigation]
  );

  const renderWeeklyReportCard = useCallback(
    ({ item }) => {
      const monday = getMondayFromWeekId(item.weekId);
      const { start, end } = getWeekStartEnd(monday);
      const weekRange = `${formatDateDDMMYYYY(start)} - ${formatDateDDMMYYYY(end)}`;
      const status = weekStatusById[item.weekId] || item.baseStatus || EXPENSE_STATUS.DRAFT;
      const statusMeta = STATUS_COLORS[status] || STATUS_COLORS[EXPENSE_STATUS.DRAFT];

      return (
        <TouchableOpacity style={styles.weekCard} onPress={() => openWeek(item.weekId)} activeOpacity={0.8}>
          <View style={styles.weekCardHeader}>
            <View style={styles.weekCardHeaderLeft}>
              <Ionicons name="calendar-outline" size={22} color={colors.primary} />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.weekCardTitle}>{item.weekId}</Text>
                <Text style={styles.weekCardSubtitle}>{weekRange}</Text>
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}>
              <Text style={[styles.statusBadgeText, { color: statusMeta.fg }]}>{STATUS_LABELS[status] || status}</Text>
            </View>
          </View>

          <View style={styles.weekCardStats}>
            <Text style={styles.weekCardStat}>{item.expenseCount} έξοδα</Text>
            <Text style={styles.weekCardStat}>€{Number(item.totalAmount).toFixed(2)}</Text>
          </View>
        </TouchableOpacity>
      );
    },
    [openWeek, weekStatusById]
  );

  const emptyList = (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>Δεν υπάρχουν εβδομαδιαίες αναφορές</Text>
      <Text style={styles.emptySubtitle}>Πατήστε το κουμπί + για να προσθέσετε έξοδο.</Text>
    </View>
  );

  return (
    <SafeScreen
      title={STRINGS.title}
      style={styles.screen}
      bodyStyle={styles.body}
      headerLeft={(
        <TouchableOpacity
          style={styles.headerBack}
          onPress={() => navigation.navigate('MainHome')}
          accessibilityRole="button"
        >
          <Ionicons name={ICONS.back} size={22} color={colors.primary} />
          <Text style={styles.headerBackText}>{STRINGS.backToHome}</Text>
        </TouchableOpacity>
      )}
    >
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: BOTTOM_BAR_HEIGHT },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Ionicons name="wallet-outline" size={28} color={colors.primary} />
              <View style={styles.summaryInfo}>
                <Text style={styles.summaryLabel}>Σύνολο Εξόδων</Text>
                <Text style={styles.summaryValue}>€{summary.grandTotal.toFixed(2)}</Text>
                <Text style={styles.summarySub}>{summary.expenseCount} έξοδα</Text>
              </View>
            </View>
          </View>

          {/* Expenses List */}
          <View style={styles.expensesSection}>
            <Text style={styles.expensesTitle}>Πρόσφατες Εβδομαδιαίες Αναφορές</Text>
            {loading ? (
              <View style={styles.loader}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <FlatList
                data={recentWeeklyReports}
                keyExtractor={(item) => item.weekId}
                renderItem={renderWeeklyReportCard}
                ListEmptyComponent={emptyList}
                contentContainerStyle={styles.listContent}
                scrollEnabled={false}
              />
            )}
          </View>
        </ScrollView>

        {/* Bottom Navigation Bar (matches brand tabs) */}
        <View style={styles.bottomBar}>
          <CurvedBottomBar
            state={bottomState}
            descriptors={bottomDescriptors}
            navigation={customBottomNavigation}
            layoutStrategy={layoutStrategy}
            fab={{
              icon: ICONS.newExpense,
              onPress: () => setMenuVisible(true),
              accessibilityLabel: STRINGS.newExpense,
              testID: 'expense-tracker-fab',
            }}
            testIDPrefix="expense"
          />
        </View>
      </View>

      {/* POPUP MENU MODAL */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseMenu}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleCloseMenu}
        >
          <View style={styles.menuContainer}>
            {!selectedGroup ? (
              <>
                <Text style={styles.menuTitle}>Επιλέξτε Κατηγορία</Text>
                {categoriesByGroup.map((groupItem) => (
                  <TouchableOpacity
                    key={groupItem.group}
                    style={styles.menuItem}
                    onPress={() => handleGroupSelect(groupItem.group)}
                  >
                    <View style={[styles.menuIcon, { backgroundColor: getGroupColor(groupItem.group) }]}>
                      <Text style={styles.menuIconText}>{getGroupIcon(groupItem.group)}</Text>
                    </View>
                    <Text style={styles.menuItemText}>{groupItem.group}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.menuCloseButton} onPress={handleCloseMenu}>
                  <View style={styles.menuIcon}>
                    <Text style={styles.menuIconText}>✕</Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.backButton} onPress={() => setSelectedGroup(null)}>
                  <Text style={styles.backButtonText}>← Πίσω</Text>
                </TouchableOpacity>
                <Text style={styles.menuTitle}>{selectedGroup}</Text>
                {categoriesByGroup
                  .find((g) => g.group === selectedGroup)
                  ?.categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={styles.menuItem}
                      onPress={() => handleCategorySelect(cat.id)}
                    >
                      <View style={[styles.menuIcon, { backgroundColor: getGroupColor(selectedGroup) }]}>
                        <Text style={styles.menuIconText}>📝</Text>
                      </View>
                      <Text style={styles.menuItemText}>{cat.label}</Text>
                    </TouchableOpacity>
                  ))}
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* EXPENSE DETAIL MODAL */}
      <ExpenseDetailModal
        visible={expenseModalVisible}
        expenseId={selectedExpenseId}
        categoryId={selectedCategoryId}
        onClose={handleCloseExpenseModal}
      />
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  body: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  headerBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerBackText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  
  // Summary Card (similar to brand header card)
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryInfo: {
    marginLeft: 16,
    flex: 1,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  summarySub: {
    fontSize: 13,
    color: colors.textSecondary,
  },

  // New Expense Button (centered like brand home)
  newExpenseSection: {
    marginBottom: 24,
    alignItems: 'center',
  },
  newExpenseButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  newExpenseIconWrap: {
    marginRight: 12,
  },
  newExpenseText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },

  // Actions Grid (like brand home)
  actionsSection: {
    marginBottom: 24,
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '48%',
    backgroundColor: colors.white,
    borderRadius: 18,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    paddingHorizontal: 12,
  },
  actionIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#e2efff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionLabel: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  // Filters
  filtersSection: {
    marginBottom: 20,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  filterRow: {
    marginBottom: 8,
  },
  filterChip: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
  },
  filterText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
  },

  // Categories
  categoriesSection: {
    marginBottom: 20,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  categoriesContainer: {
    maxHeight: 200,
  },
  groupSection: {
    marginBottom: 16,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 6,
    marginBottom: 6,
  },
  categoryChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    color: '#0F172A',
    fontSize: 13,
  },
  categoryChipTextSelected: {
    color: colors.white,
  },

  // Expenses List
  expensesSection: {
    marginBottom: 20,
  },
  expensesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  weekCard: {
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
  weekCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  weekCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  weekCardSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  weekCardStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  weekCardStat: {
    color: '#111827',
    fontWeight: '700',
  },
  expenseItemContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 10,
    alignItems: 'center',
  },
  expenseItem: {
    flex: 1,
    backgroundColor: colors.white,
    padding: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  deleteButton: {
    backgroundColor: '#EF4444',
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expenseDate: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  expenseAmount: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  expenseCategory: {
    color: colors.textPrimary,
    fontSize: 14,
    marginTop: 4,
  },
  expenseStatus: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  expenseDescription: {
    color: '#4B5563',
    marginTop: 6,
    fontSize: 13,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    marginTop: 6,
  },
  listContent: {
    paddingBottom: 20,
  },
  loader: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    width: '85%',
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuIconText: {
    fontSize: 24,
  },
  menuItemText: {
    fontSize: 16,
    color: '#111827',
    flex: 1,
  },
  menuCloseButton: {
    marginTop: 16,
    alignSelf: 'center',
  },
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#0891B2',
    fontWeight: '600',
  },
});

export default ExpenseTrackerScreen;
