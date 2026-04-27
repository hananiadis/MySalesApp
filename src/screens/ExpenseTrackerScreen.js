import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import ExpenseDetailModal from '../components/ExpenseDetailModal';
import { useExpense } from '../context/ExpenseContext';
import {
  EXPENSE_GROUPS,
  EXPENSE_STATUS,
  getAllCategoryGroups,
  getCategoriesByGroup,
  getCategoryLabel,
  formatDateDDMMYYYY,
  getWeekId,
  getMondayFromWeekId,
  getWeekStartEnd,
} from '../constants/expenseConstants';
import { useAuth } from '../context/AuthProvider';
import { getModuleAccess } from '../utils/moduleAccess';

const TOKENS = {
  primaryBlue: '#185FA5',
  lightBlueBg: '#E6F1FB',
  lightBlueText: '#E6F1FB',
  amber: '#EF9F27',
  amberDark: '#BA7517',
  amberBg: '#FAEEDA',
  amberText: '#854F0B',
  amberBorder: '#FAC775',
  green: '#639922',
  greenBg: '#EAF3DE',
  greenText: '#3B6D11',
  greenBorder: '#C0DD97',
  redDark: '#A32D2D',
  redBg: '#FCEBEB',
  redBorder: '#F7C1C1',
  pageBackground: '#f7f5f0',
  summaryBar: '#ece9e3',
  surface: '#fff',
  border: '#e0ddd6',
  borderSoft: '#e8e5de',
  textPrimary: '#1a1a1a',
  textSecondary: '#888',
  textTertiary: '#aaa',
  pillNeutral: '#f0ede8',
  progressTrack: '#f0ede8',
  headerPillBorder: '#d8d5ce',
};

const BOTTOM_NAV_HEIGHT = 104;
const MONTH_NAMES = [
  'Ιανουάριος',
  'Φεβρουάριος',
  'Μάρτιος',
  'Απρίλιος',
  'Μάιος',
  'Ιούνιος',
  'Ιούλιος',
  'Αύγουστος',
  'Σεπτέμβριος',
  'Οκτώβριος',
  'Νοέμβριος',
  'Δεκέμβριος',
];

const STRINGS = {
  title: 'Εξοδολόγιο',
  back: '← Επιστροφή',
  newExpense: 'Νέο Έξοδο',
  expenseReports: 'Αναφορές Εξόδων',
  weeklyTracking: 'Εβδομαδιαία Καταγραφή',
  weeklyReport: 'Εβδομαδιαίο Εξοδολόγιο',
  managerReports: 'Αναφορές Ομάδας',
  inbox: 'Εισερχόμενα',
  backToHome: 'Επιστροφή στην κεντρική',
  monthTotal: 'Σύνολο Μήνα',
  expenses: 'Έξοδα',
  drafts: 'Πρόχειρα',
  all: 'Όλες',
  draftsPlural: 'Πρόχειρες',
  submittedPlural: 'Υποβληθείσες',
  approvedPlural: 'Εγκεκριμένες',
  sectionTitle: 'ΠΡΟΣΦΑΤΕΣ ΕΒΔΟΜΑΔΙΑΙΕΣ ΑΝΑΦΟΡΕΣ',
  distributionSuffix: 'κατανομή εξόδων',
  fuel: 'Καύσιμα',
  accommodation: 'Διαμονή',
  submit: 'Υποβολή →',
  notSubmitted: 'Δεν έχει υποβληθεί',
  noReports: 'Δεν υπάρχουν εβδομαδιαίες αναφορές',
  noReportsSubtitle: 'Πατήστε το + για να προσθέσετε έξοδο.',
  selectCategory: 'Επιλέξτε Κατηγορία',
  selectGroupHint: 'Επιλέξτε ομάδα εξόδων για γρήγορη καταχώρηση.',
  selectCategoryHint: 'Επιλέξτε κατηγορία για νέο έξοδο.',
};

const STATUS_LABELS = {
  [EXPENSE_STATUS.DRAFT]: 'Πρόχειρο',
  [EXPENSE_STATUS.SUBMITTED]: 'Υποβληθέν',
  [EXPENSE_STATUS.APPROVED]: 'Εγκεκριμένο',
};

const STATUS_META = {
  [EXPENSE_STATUS.DRAFT]: {
    borderColor: TOKENS.amber,
    badgeBackground: TOKENS.amberBg,
    badgeText: TOKENS.amberText,
    iconBackground: TOKENS.lightBlueBg,
    opacity: 1,
  },
  [EXPENSE_STATUS.SUBMITTED]: {
    borderColor: TOKENS.primaryBlue,
    badgeBackground: TOKENS.lightBlueBg,
    badgeText: TOKENS.primaryBlue,
    iconBackground: TOKENS.lightBlueBg,
    opacity: 0.75,
  },
  [EXPENSE_STATUS.APPROVED]: {
    borderColor: TOKENS.green,
    badgeBackground: TOKENS.greenBg,
    badgeText: TOKENS.greenText,
    iconBackground: TOKENS.greenBg,
    opacity: 0.65,
  },
};

const FILTERS = [
  { key: 'all', label: STRINGS.all, variant: 'all' },
  { key: EXPENSE_STATUS.DRAFT, label: STRINGS.draftsPlural, variant: 'default' },
  { key: EXPENSE_STATUS.SUBMITTED, label: STRINGS.submittedPlural, variant: 'default' },
  { key: EXPENSE_STATUS.APPROVED, label: STRINGS.approvedPlural, variant: 'green' },
];

const FUEL_CATEGORY_IDS = new Set(['fuel']);
const ACCOMMODATION_CATEGORY_IDS = new Set(['hotel', 'personal_meal', 'third_party_meal']);

const formatWholeEuro = (value) => `€${Math.round(Number(value || 0)).toLocaleString('el-GR')}`;
const formatCurrency = (value) =>
  `€${Number(value || 0).toLocaleString('el-GR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const getProfileInitials = (profile) => {
  const source = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim()
    || profile?.name
    || profile?.displayName
    || profile?.email
    || 'ΧΑ';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return parts
    .slice(0, 2)
    .map((part) => (part[0] || '').toUpperCase())
    .join('');
};

const ExpenseTrackerScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const moduleAccess = getModuleAccess(profile);
  const {
    expenses,
    loading,
    userRole,
    fetchWeeklyTracking,
    deleteExistingExpense,
  } = useExpense();

  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [expenseModalVisible, setExpenseModalVisible] = useState(false);
  const [selectedExpenseId, setSelectedExpenseId] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [weekStatusById, setWeekStatusById] = useState({});
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    if (route?.params?.openAddMenu) {
      setMenuVisible(true);
      navigation.setParams({ openAddMenu: false });
    }
  }, [navigation, route?.params?.openAddMenu]);

  const salespersonInitials = useMemo(() => getProfileInitials(profile), [profile]);

  const categoriesByGroup = useMemo(
    () => getAllCategoryGroups().map((group) => ({ group, categories: getCategoriesByGroup(group) })),
    []
  );

  const groupedReports = useMemo(() => {
    const byWeek = new Map();

    (expenses || []).forEach((expense) => {
      const expenseDate = new Date(expense.date);
      const weekId = getWeekId(expenseDate);
      const current = byWeek.get(weekId) || {
        weekId,
        totalAmount: 0,
        expenseCount: 0,
        latestDate: expenseDate,
        baseStatus: EXPENSE_STATUS.DRAFT,
        categoryTotals: {},
        expenseIds: [],
      };

      current.totalAmount += Number(expense.amount || 0);
      current.expenseCount += 1;
      current.categoryTotals[expense.category] = (current.categoryTotals[expense.category] || 0) + Number(expense.amount || 0);
      current.expenseIds.push(expense.id);

      if (expenseDate > current.latestDate) {
        current.latestDate = expenseDate;
      }

      if (expense.status === EXPENSE_STATUS.APPROVED) {
        current.baseStatus = EXPENSE_STATUS.APPROVED;
      } else if (
        expense.status === EXPENSE_STATUS.SUBMITTED
        && current.baseStatus !== EXPENSE_STATUS.APPROVED
      ) {
        current.baseStatus = EXPENSE_STATUS.SUBMITTED;
      }

      byWeek.set(weekId, current);
    });

    return Array.from(byWeek.values()).sort((left, right) => new Date(right.latestDate) - new Date(left.latestDate));
  }, [expenses]);

  useEffect(() => {
    let cancelled = false;

    const loadWeekStatuses = async () => {
      if (!fetchWeeklyTracking || groupedReports.length === 0) {
        return;
      }

      try {
        const results = await Promise.all(
          groupedReports.map(async (report) => {
            try {
              const tracking = await fetchWeeklyTracking(report.weekId);
              return { weekId: report.weekId, status: tracking?.status || null };
            } catch {
              return { weekId: report.weekId, status: null };
            }
          })
        );

        if (cancelled) {
          return;
        }

        const nextStatuses = {};
        results.forEach((result) => {
          if (result.weekId && result.status) {
            nextStatuses[result.weekId] = result.status;
          }
        });
        setWeekStatusById(nextStatuses);
      } catch (error) {
        console.warn('[ExpenseTrackerScreen] loadWeekStatuses failed:', error?.message);
      }
    };

    loadWeekStatuses();
    return () => {
      cancelled = true;
    };
  }, [fetchWeeklyTracking, groupedReports]);

  const reports = useMemo(
    () => groupedReports.map((report) => ({
      ...report,
      status: weekStatusById[report.weekId] || report.baseStatus || EXPENSE_STATUS.DRAFT,
    })),
    [groupedReports, weekStatusById]
  );

  const filteredReports = useMemo(() => {
    if (activeFilter === 'all') {
      return reports;
    }
    return reports.filter((report) => report.status === activeFilter);
  }, [activeFilter, reports]);

  const currentMonthSummary = useMemo(() => {
    const now = new Date();
    const monthExpenses = (expenses || []).filter((expense) => {
      const date = new Date(expense.date);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    });

    const fuelAmount = monthExpenses.reduce(
      (sum, expense) => sum + (FUEL_CATEGORY_IDS.has(expense.category) ? Number(expense.amount || 0) : 0),
      0
    );
    const accommodationAmount = monthExpenses.reduce(
      (sum, expense) => sum + (ACCOMMODATION_CATEGORY_IDS.has(expense.category) ? Number(expense.amount || 0) : 0),
      0
    );
    const breakdownTotal = fuelAmount + accommodationAmount;

    return {
      monthLabel: `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()} — ${STRINGS.distributionSuffix}`,
      totalAmount: monthExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
      expenseCount: monthExpenses.length,
      draftCount: reports.filter((report) => report.status === EXPENSE_STATUS.DRAFT).length,
      fuelAmount,
      accommodationAmount,
      fuelProgress: breakdownTotal > 0 ? fuelAmount / breakdownTotal : 0,
      accommodationProgress: breakdownTotal > 0 ? accommodationAmount / breakdownTotal : 0,
    };
  }, [expenses, reports]);

  const handleGroupSelect = useCallback((group) => {
    setSelectedGroup(group);
  }, []);

  const handleCategorySelect = useCallback((categoryId) => {
    setMenuVisible(false);
    setSelectedGroup(null);
    setSelectedCategoryId(categoryId);
    setSelectedExpenseId(null);
    setExpenseModalVisible(true);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setMenuVisible(false);
    setSelectedGroup(null);
  }, []);

  const handleCloseExpenseModal = useCallback(() => {
    setExpenseModalVisible(false);
    setSelectedExpenseId(null);
    setSelectedCategoryId(null);
  }, []);

  const openWeek = useCallback((weekId) => {
    navigation.navigate('WeeklyTracking', { weekId });
  }, [navigation]);

  const getWeeklyTags = useCallback((report) => {
    const fuelTotal = Object.entries(report.categoryTotals || {}).reduce(
      (sum, [categoryId, amount]) => sum + (FUEL_CATEGORY_IDS.has(categoryId) ? Number(amount || 0) : 0),
      0
    );
    const accommodationTotal = Object.entries(report.categoryTotals || {}).reduce(
      (sum, [categoryId, amount]) => sum + (ACCOMMODATION_CATEGORY_IDS.has(categoryId) ? Number(amount || 0) : 0),
      0
    );

    const tags = [];
    if (fuelTotal > 0) {
      tags.push({ key: 'fuel', label: `${STRINGS.fuel} ${formatWholeEuro(fuelTotal)}`, tone: 'blue' });
    }
    if (accommodationTotal > 0) {
      tags.push({ key: 'accommodation', label: `${STRINGS.accommodation} ${formatWholeEuro(accommodationTotal)}`, tone: 'amber' });
    }

    if (tags.length > 0) {
      return tags;
    }

    return Object.entries(report.categoryTotals || {})
      .sort((left, right) => Number(right[1] || 0) - Number(left[1] || 0))
      .slice(0, 2)
      .map(([categoryId, amount], index) => ({
        key: `${categoryId}-${index}`,
        label: `${getCategoryLabel(categoryId)} ${formatWholeEuro(amount)}`,
        tone: index === 0 ? 'blue' : 'amber',
      }));
  }, []);

  const getGroupIconName = useCallback((group) => {
    switch (group) {
      case EXPENSE_GROUPS.TRAVEL:
        return 'car-sport-outline';
      case EXPENSE_GROUPS.ACCOMMODATION_FOOD:
        return 'bed-outline';
      case EXPENSE_GROUPS.MISCELLANEOUS:
        return 'receipt-outline';
      default:
        return 'pricetag-outline';
    }
  }, []);

  const getCategoryIconName = useCallback((categoryId) => {
    switch (categoryId) {
      case 'fuel':
      case 'adblue':
        return 'car-outline';
      case 'tickets':
        return 'ticket-outline';
      case 'taxi':
        return 'car-outline';
      case 'hotel':
        return 'business-outline';
      case 'personal_meal':
      case 'third_party_meal':
        return 'restaurant-outline';
      case 'car_service':
        return 'build-outline';
      case 'parking':
        return 'car-outline';
      case 'tolls':
        return 'trail-sign-outline';
      case 'office_supplies':
        return 'document-text-outline';
      case 'representation':
        return 'people-outline';
      default:
        return 'pricetag-outline';
    }
  }, []);

  const getGroupColor = useCallback((group) => {
    switch (group) {
      case EXPENSE_GROUPS.TRAVEL:
        return TOKENS.primaryBlue;
      case EXPENSE_GROUPS.ACCOMMODATION_FOOD:
        return TOKENS.amber;
      case EXPENSE_GROUPS.MISCELLANEOUS:
        return TOKENS.green;
      default:
        return TOKENS.textSecondary;
    }
  }, []);

  const getGroupIconColor = useCallback((group) => {
    if (group === EXPENSE_GROUPS.TRAVEL) {
      return TOKENS.surface;
    }
    return TOKENS.textPrimary;
  }, []);

  const getCategoryIconColor = useCallback((group) => {
    if (group === EXPENSE_GROUPS.TRAVEL) {
      return TOKENS.surface;
    }
    return TOKENS.textPrimary;
  }, []);

  const renderBreakdownRow = useCallback((label, amount, progress, fillColor) => (
    <View style={styles.breakdownRow} key={label}>
      <Text style={styles.breakdownLabel}>{label}</Text>
      <View style={styles.breakdownTrack}>
        <View
          style={[
            styles.breakdownFill,
            {
              width: `${Math.max(progress * 100, amount > 0 ? 6 : 0)}%`,
              backgroundColor: fillColor,
            },
          ]}
        />
      </View>
      <Text style={styles.breakdownAmount}>{formatWholeEuro(amount)}</Text>
    </View>
  ), []);

  const renderReportCard = useCallback((report) => {
    const monday = getMondayFromWeekId(report.weekId);
    const { start, end } = getWeekStartEnd(monday);
    const statusMeta = STATUS_META[report.status] || STATUS_META[EXPENSE_STATUS.DRAFT];
    const tags = getWeeklyTags(report);
    const showDraftDetails = report.status === EXPENSE_STATUS.DRAFT;

    return (
      <TouchableOpacity
        key={report.weekId}
        style={[
          styles.reportCard,
          {
            borderLeftColor: statusMeta.borderColor,
            opacity: statusMeta.opacity,
          },
        ]}
        activeOpacity={0.9}
        onPress={() => openWeek(report.weekId)}
      >
        <View style={styles.reportTopRow}>
          <View style={styles.reportHeaderBlock}>
            <View style={[styles.reportIconSquare, { backgroundColor: statusMeta.iconBackground }]}>
              <Text style={styles.reportIconEmoji}>📅</Text>
            </View>

            <View style={styles.reportHeaderTextBlock}>
              <View style={styles.reportTitleRow}>
                <Text style={styles.reportWeekTitle}>{report.weekId}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusMeta.badgeBackground }]}>
                  <Text style={[styles.statusBadgeText, { color: statusMeta.badgeText }]}>
                    {STATUS_LABELS[report.status]}
                  </Text>
                </View>
              </View>
              <Text style={styles.reportDateRange}>
                {formatDateDDMMYYYY(start)} – {formatDateDDMMYYYY(end)}
              </Text>
            </View>
          </View>

          <Text style={styles.reportAmount}>{formatCurrency(report.totalAmount)}</Text>
        </View>

        {showDraftDetails && tags.length > 0 ? (
          <View style={styles.reportTagsRow}>
            {tags.map((tag) => (
              <View
                key={tag.key}
                style={[
                  styles.expenseTag,
                  tag.tone === 'amber' ? styles.expenseTagAmber : styles.expenseTagBlue,
                ]}
              >
                <Text
                  style={[
                    styles.expenseTagText,
                    tag.tone === 'amber' ? styles.expenseTagTextAmber : styles.expenseTagTextBlue,
                  ]}
                >
                  {tag.label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {showDraftDetails ? (
          <View style={styles.reportFooterRow}>
            <Text style={styles.reportFooterText}>
              {report.expenseCount} έξοδα · {STRINGS.notSubmitted}
            </Text>

            <View style={styles.reportFooterActions}>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={() => openWeek(report.weekId)}
                activeOpacity={0.88}
              >
                <Text style={styles.submitButtonText}>{STRINGS.submit}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  }, [getWeeklyTags, openWeek]);

  if (!moduleAccess.expenseTrackerEnabled) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" backgroundColor={TOKENS.surface} />
        <View style={styles.disabledState}>
          <Ionicons name="lock-closed-outline" size={56} color="#94a3b8" />
          <Text style={styles.disabledTitle}>Μη διαθέσιμη ενότητα</Text>
          <Text style={styles.disabledSubtitle}>
            Η ενότητα Εξοδολόγιο είναι απενεργοποιημένη για τον λογαριασμό σας.
          </Text>
          <TouchableOpacity style={styles.disabledBackButton} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Text style={styles.disabledBackButtonText}>{STRINGS.backToHome}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={TOKENS.surface} />

      <View style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBackButton} onPress={() => navigation.navigate('MainHome')} activeOpacity={0.8}>
            <Text style={styles.headerBackText}>{STRINGS.back}</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>{STRINGS.title}</Text>

          <TouchableOpacity style={styles.headerSalespersonPill} activeOpacity={0.85}>
            <Text style={styles.headerSalespersonPillText}>{salespersonInitials} ▾</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryBar}>
          <View style={styles.summaryColumn}>
            <Text style={styles.summaryLabel}>{STRINGS.monthTotal}</Text>
            <Text style={styles.summaryValue}>{formatWholeEuro(currentMonthSummary.totalAmount)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryColumn}>
            <Text style={styles.summaryLabel}>{STRINGS.expenses}</Text>
            <Text style={styles.summaryValue}>{currentMonthSummary.expenseCount}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryColumn}>
            <Text style={styles.summaryLabel}>{STRINGS.drafts}</Text>
            <Text style={[styles.summaryValue, styles.summaryValueAmber]}>{currentMonthSummary.draftCount}</Text>
          </View>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: BOTTOM_NAV_HEIGHT + Math.max(insets.bottom, 14) }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.breakdownSection}>
            <Text style={styles.breakdownSectionLabel}>{currentMonthSummary.monthLabel}</Text>
            {renderBreakdownRow(
              STRINGS.fuel,
              currentMonthSummary.fuelAmount,
              currentMonthSummary.fuelProgress,
              TOKENS.primaryBlue
            )}
            {renderBreakdownRow(
              STRINGS.accommodation,
              currentMonthSummary.accommodationAmount,
              currentMonthSummary.accommodationProgress,
              TOKENS.amber
            )}
          </View>

          <View style={styles.filtersSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersRow}
            >
              {FILTERS.map((filter) => {
                const isActive = activeFilter === filter.key;
                return (
                  <TouchableOpacity
                    key={filter.key}
                    style={[
                      styles.filterPill,
                      isActive && filter.variant !== 'green' && styles.filterPillActive,
                      filter.variant === 'green' && styles.filterPillGreen,
                      isActive && filter.variant === 'green' && styles.filterPillGreenActive,
                    ]}
                    onPress={() => setActiveFilter(filter.key)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        isActive && filter.variant !== 'green' && styles.filterPillTextActive,
                        filter.variant === 'green' && styles.filterPillTextGreen,
                      ]}
                    >
                      {filter.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderText}>{STRINGS.sectionTitle}</Text>
          </View>

          {loading ? (
            <View style={styles.loadingBlock}>
              <ActivityIndicator size="large" color={TOKENS.primaryBlue} />
            </View>
          ) : filteredReports.length > 0 ? (
            <View style={styles.reportsList}>{filteredReports.map(renderReportCard)}</View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{STRINGS.noReports}</Text>
              <Text style={styles.emptySubtitle}>{STRINGS.noReportsSubtitle}</Text>
            </View>
          )}

          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: TOKENS.amber }]} />
              <Text style={styles.legendText}>{STATUS_LABELS[EXPENSE_STATUS.DRAFT]}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: TOKENS.primaryBlue }]} />
              <Text style={styles.legendText}>{STATUS_LABELS[EXPENSE_STATUS.SUBMITTED]}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: TOKENS.green }]} />
              <Text style={styles.legendText}>{STATUS_LABELS[EXPENSE_STATUS.APPROVED]}</Text>
            </View>
          </View>
        </ScrollView>

      </View>

      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={handleCloseMenu}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={handleCloseMenu}>
          <View style={[styles.menuContainer, { paddingBottom: Math.max(insets.bottom, 16) + 10 }]}>
            <View style={styles.menuHandle} />

            {!selectedGroup ? (
              <>
                <View style={styles.menuHeader}>
                  <Text style={styles.menuTitle}>{STRINGS.selectCategory}</Text>
                  <Text style={styles.menuSubtitle}>{STRINGS.selectGroupHint}</Text>
                </View>

                <View style={styles.menuCard}>
                  {categoriesByGroup.map((groupItem) => (
                    <TouchableOpacity
                      key={groupItem.group}
                      style={styles.menuItem}
                      onPress={() => handleGroupSelect(groupItem.group)}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.menuIcon, { backgroundColor: getGroupColor(groupItem.group) }]}>
                        <Ionicons name={getGroupIconName(groupItem.group)} size={18} color={getGroupIconColor(groupItem.group)} />
                      </View>
                      <Text style={styles.menuItemText}>{groupItem.group}</Text>
                      <Ionicons name="chevron-forward" size={16} color={TOKENS.textSecondary} />
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : (
              <>
                <View style={styles.menuHeader}>
                  <TouchableOpacity style={styles.menuBackButton} onPress={() => setSelectedGroup(null)} activeOpacity={0.8}>
                    <Ionicons name="arrow-back" size={15} color={TOKENS.primaryBlue} />
                    <Text style={styles.menuBackButtonText}>Πίσω</Text>
                  </TouchableOpacity>
                  <Text style={styles.menuTitle}>{selectedGroup}</Text>
                  <Text style={styles.menuSubtitle}>{STRINGS.selectCategoryHint}</Text>
                </View>

                <View style={styles.menuCard}>
                  {categoriesByGroup
                    .find((groupItem) => groupItem.group === selectedGroup)
                    ?.categories.map((category) => (
                      <TouchableOpacity
                        key={category.id}
                        style={styles.menuItem}
                        onPress={() => handleCategorySelect(category.id)}
                        activeOpacity={0.85}
                      >
                        <View style={[styles.menuIcon, { backgroundColor: getGroupColor(selectedGroup) }]}>
                          <Ionicons name={getCategoryIconName(category.id)} size={18} color={getCategoryIconColor(selectedGroup)} />
                        </View>
                        <Text style={styles.menuItemText}>{category.label}</Text>
                        <Ionicons name="chevron-forward" size={16} color={TOKENS.textSecondary} />
                      </TouchableOpacity>
                    ))}
                </View>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <ExpenseDetailModal
        visible={expenseModalVisible}
        expenseId={selectedExpenseId}
        categoryId={selectedCategoryId}
        onClose={handleCloseExpenseModal}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: TOKENS.surface,
  },
  screen: {
    flex: 1,
    backgroundColor: TOKENS.pageBackground,
  },
  disabledState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: TOKENS.pageBackground,
  },
  disabledTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '700',
    color: TOKENS.textPrimary,
    textAlign: 'center',
  },
  disabledSubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  disabledBackButton: {
    marginTop: 20,
    backgroundColor: TOKENS.primaryBlue,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  disabledBackButtonText: {
    color: TOKENS.surface,
    fontSize: 14,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: TOKENS.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: TOKENS.border,
  },
  headerBackButton: {
    minWidth: 84,
  },
  headerBackText: {
    fontSize: 13,
    color: TOKENS.primaryBlue,
    fontWeight: '400',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: TOKENS.textPrimary,
    letterSpacing: 0.1,
  },
  headerSalespersonPill: {
    minWidth: 58,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: TOKENS.pillNeutral,
    borderWidth: 0.5,
    borderColor: TOKENS.headerPillBorder,
    alignItems: 'center',
  },
  headerSalespersonPillText: {
    fontSize: 13,
    color: TOKENS.textPrimary,
    fontWeight: '500',
  },
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: TOKENS.summaryBar,
    paddingVertical: 10,
  },
  summaryColumn: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 0.5,
    backgroundColor: '#ccc9c0',
    marginVertical: 4,
  },
  summaryLabel: {
    fontSize: 11,
    color: TOKENS.textSecondary,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '500',
    color: TOKENS.textPrimary,
    letterSpacing: -0.2,
  },
  summaryValueAmber: {
    color: TOKENS.amberDark,
  },
  content: {
    flex: 1,
  },
  breakdownSection: {
    backgroundColor: TOKENS.surface,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: TOKENS.border,
  },
  breakdownSectionLabel: {
    fontSize: 12,
    color: TOKENS.textSecondary,
    marginBottom: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  breakdownLabel: {
    width: 75,
    fontSize: 12,
    color: '#555',
  },
  breakdownTrack: {
    flex: 1,
    height: 7,
    borderRadius: 4,
    backgroundColor: TOKENS.progressTrack,
    overflow: 'hidden',
  },
  breakdownFill: {
    height: '100%',
    borderRadius: 4,
  },
  breakdownAmount: {
    width: 42,
    marginLeft: 12,
    fontSize: 12,
    fontWeight: '700',
    color: TOKENS.textPrimary,
    textAlign: 'right',
  },
  filtersSection: {
    backgroundColor: TOKENS.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: TOKENS.borderSoft,
  },
  filtersRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    alignItems: 'center',
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: TOKENS.pageBackground,
    borderWidth: 1,
    borderColor: '#dedad3',
  },
  filterPillActive: {
    backgroundColor: TOKENS.primaryBlue,
    borderColor: TOKENS.primaryBlue,
  },
  filterPillGreen: {
    backgroundColor: TOKENS.greenBg,
    borderColor: TOKENS.greenBorder,
  },
  filterPillGreenActive: {
    backgroundColor: TOKENS.greenBg,
    borderColor: TOKENS.greenBorder,
  },
  filterPillText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: TOKENS.lightBlueText,
  },
  filterPillTextGreen: {
    color: TOKENS.greenText,
  },
  sectionHeaderRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: TOKENS.pageBackground,
    borderBottomWidth: 0.5,
    borderBottomColor: TOKENS.borderSoft,
  },
  sectionHeaderText: {
    fontSize: 11,
    color: TOKENS.textTertiary,
    letterSpacing: 0.5,
  },
  loadingBlock: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  reportsList: {
    backgroundColor: TOKENS.surface,
  },
  reportCard: {
    backgroundColor: TOKENS.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: TOKENS.border,
    borderLeftWidth: 3,
    paddingLeft: 12,
    paddingRight: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  reportTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  reportHeaderBlock: {
    flexDirection: 'row',
    flex: 1,
    marginRight: 10,
  },
  reportIconSquare: {
    width: 30,
    height: 30,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  reportIconEmoji: {
    fontSize: 16,
  },
  reportHeaderTextBlock: {
    flex: 1,
    marginLeft: 9,
  },
  reportTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  reportWeekTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: TOKENS.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  reportAmount: {
    fontSize: 16,
    fontWeight: '500',
    color: TOKENS.textPrimary,
  },
  reportDateRange: {
    fontSize: 12,
    color: '#999',
  },
  reportTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginLeft: 39,
    marginTop: 8,
  },
  expenseTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  expenseTagBlue: {
    backgroundColor: TOKENS.lightBlueBg,
  },
  expenseTagAmber: {
    backgroundColor: TOKENS.amberBg,
  },
  expenseTagText: {
    fontSize: 11,
    fontWeight: '500',
  },
  expenseTagTextBlue: {
    color: TOKENS.primaryBlue,
  },
  expenseTagTextAmber: {
    color: TOKENS.amberText,
  },
  reportFooterRow: {
    marginLeft: 39,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reportFooterText: {
    flex: 1,
    fontSize: 12,
    color: TOKENS.textSecondary,
    marginRight: 10,
  },
  reportFooterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitButton: {
    backgroundColor: TOKENS.primaryBlue,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 8,
  },
  submitButtonText: {
    fontSize: 12,
    color: TOKENS.surface,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 44,
    paddingHorizontal: 24,
    backgroundColor: TOKENS.surface,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: TOKENS.textPrimary,
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: TOKENS.textSecondary,
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: TOKENS.pageBackground,
    borderTopWidth: 0.5,
    borderTopColor: TOKENS.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: TOKENS.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: TOKENS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: '80%',
    borderTopWidth: 1,
    borderColor: TOKENS.borderSoft,
  },
  menuHandle: {
    alignSelf: 'center',
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#d6d2ca',
    marginBottom: 14,
  },
  menuHeader: {
    marginBottom: 10,
  },
  menuTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: TOKENS.textPrimary,
  },
  menuSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: TOKENS.textSecondary,
  },
  menuCard: {
    backgroundColor: TOKENS.surface,
    borderWidth: 1,
    borderColor: TOKENS.borderSoft,
    borderRadius: 14,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
  },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuItemText: {
    flex: 1,
    fontSize: 14,
    color: TOKENS.textPrimary,
  },
  menuBackButton: {
    marginBottom: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: TOKENS.lightBlueBg,
  },
  menuBackButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: TOKENS.primaryBlue,
  },
});

export default ExpenseTrackerScreen;
