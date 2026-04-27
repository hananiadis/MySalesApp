import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, FlatList, Modal, SafeAreaView, Image } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useExpense } from '../context/ExpenseContext';
import SafeScreen from '../components/SafeScreen';
import { Ionicons } from '@expo/vector-icons';
import { SvgUri } from 'react-native-svg';
import { getWeekId, WEEKDAYS, validateWeeklyTracking, formatDateDDMMYYYY, getMondayFromWeekId, getCategoryLabel, INVOICE_TYPE_LABELS, PAYMENT_METHODS, INVOICE_TYPES, EXPENSE_STATUS, getAllCategoryGroups, getCategoriesByGroup, EXPENSE_GROUPS } from '../constants/expenseConstants';
import ExpenseDetailModal from '../components/ExpenseDetailModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import debounce from 'lodash.debounce';
import { getAllCars, getCachedCars } from '../services/carsService';
import { getCarBrands } from '../services/carBrandsService';
import BackToExpensesButton from '../components/BackToExpensesButton';

const GREEK_DAYS = {
  0: 'Κυριακή',
  1: 'Δευτέρα',
  2: 'Τρίτη',
  3: 'Τετάρτη',
  4: 'Πέμπτη',
  5: 'Παρασκευή',
  6: 'Σάββατο'
};

const MONTHS = [
  'Ιανουαρίου',
  'Φεβρουαρίου',
  'Μαρτίου',
  'Απριλίου',
  'Μαΐου',
  'Ιουνίου',
  'Ιουλίου',
  'Αυγούστου',
  'Σεπτεμβρίου',
  'Οκτωβρίου',
  'Νοεμβρίου',
  'Δεκεμβρίου'
];

const TOKENS = {
  primaryBlue: '#185FA5',
  surface: '#fff',
  border: '#e0ddd6',
  borderSoft: '#e8e5de',
  textPrimary: '#1a1a1a',
  textSecondary: '#888',
  pageBackground: '#f7f5f0',
  lightBlueBg: '#E6F1FB',
};

const WeeklyTrackingScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { currentUserId, fetchWeeklyTracking, saveTracking, submitWeeklyReportToManager, expenses, deleteExistingExpense } = useExpense();

  // Params & State
  const initialWeekId = route.params?.weekId || getWeekId(new Date());
  const [weekId, setWeekId] = useState(initialWeekId);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [weekStatus, setWeekStatus] = useState(EXPENSE_STATUS.DRAFT);
  const [reviewNote, setReviewNote] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [categoryMenuVisible, setCategoryMenuVisible] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedExpenseId, setSelectedExpenseId] = useState(null);
  const hydratingRef = useRef(false);

  useEffect(() => {
    if (route.params?.weekId && route.params.weekId !== weekId) {
      setWeekId(route.params.weekId);
    }
  }, [route.params?.weekId]);

  // Inputs
  const [startKm, setStartKm] = useState('');
  const [endKm, setEndKm] = useState('');
  const [privateKm, setPrivateKm] = useState('');
  const [selectedCarId, setSelectedCarId] = useState(null);
  const [lastCarId, setLastCarId] = useState(null);
  const [cars, setCars] = useState([]);
  const [carBrandsByName, setCarBrandsByName] = useState({});
  const [carsModalVisible, setCarsModalVisible] = useState(false);
  const [givenCash, setGivenCash] = useState('');
  const [locations, setLocations] = useState({});
  const [previousCashBalance, setPreviousCashBalance] = useState(0);

  const categoriesByGroup = useMemo(
    () => getAllCategoryGroups().map((group) => ({ group, categories: getCategoriesByGroup(group) })),
    []
  );

  const lastCarKey = useMemo(() => {
    if (!currentUserId) return null;
    return `weeklyTrackingLastCar:${currentUserId}`;
  }, [currentUserId]);

  const draftKey = useMemo(() => {
    if (!currentUserId) return null;
    return `weeklyTrackingDraft:${currentUserId}:${weekId}`;
  }, [currentUserId, weekId]);

  // Computed
  const totalKm = (parseFloat(endKm) || 0) - (parseFloat(startKm) || 0);
  const businessKm = Math.max(0, totalKm - (parseFloat(privateKm) || 0));
  
  // Identify days of this week
  const weekDays = useMemo(() => {
    try {
      const start = getMondayFromWeekId(weekId);
      return WEEKDAYS.map((d, index) => {
        const date = new Date(start);
        date.setDate(start.getDate() + index);
        const dayName = GREEK_DAYS[date.getDay()];
        const monthName = MONTHS[date.getMonth()];
        const label = `${dayName} ${date.getDate()} ${monthName} ${date.getFullYear()}`;
        return { ...d, date, label };
      });
    } catch (e) {
      return WEEKDAYS;
    }
  }, [weekId]);

  // Load Data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      hydratingRef.current = true;
      try {
        const [data, draftJson, lastCarJson] = await Promise.all([
          fetchWeeklyTracking(weekId),
          draftKey ? AsyncStorage.getItem(draftKey) : Promise.resolve(null),
          lastCarKey ? AsyncStorage.getItem(lastCarKey) : Promise.resolve(null),
        ]);

        const lastCarFromStorage = lastCarJson || null;
        setLastCarId(lastCarFromStorage);

        // Always prefer server-driven state for status/review
        const serverStatus = data?.status || EXPENSE_STATUS.DRAFT;
        setWeekStatus(serverStatus);
        setReviewNote(String(data?.review?.note || ''));

        // If server says the week is submitted/approved, ignore any local draft (can exist on another device)
        if (serverStatus !== EXPENSE_STATUS.DRAFT && draftKey && draftJson) {
          try {
            await AsyncStorage.removeItem(draftKey);
          } catch {
            // ignore
          }
        }

        if (serverStatus === EXPENSE_STATUS.DRAFT && draftJson) {
          try {
            const draft = JSON.parse(draftJson);
            setStartKm(draft.startKm ?? '');
            setEndKm(draft.endKm ?? '');
            setPrivateKm(draft.privateKm ?? '');
            setSelectedCarId(draft.carId ?? lastCarFromStorage ?? null);
            setGivenCash(draft.givenCash ?? '');
            setLocations(draft.locations || {});
            return;
          } catch {
            // fall back to server data
          }
        }

        if (data) {
          setStartKm(data.mileage?.startKm?.toString() || '');
          setEndKm(data.mileage?.endKm?.toString() || '');
          setPrivateKm(data.mileage?.privateKm?.toString() || '');
          setSelectedCarId(data.mileage?.carId || lastCarFromStorage || null);
          setGivenCash(data.pettyCash?.given?.toString() || '');
          setLocations(data.locations || {});

          // Backfill last-used car from server data if needed
          if (lastCarKey && data.mileage?.carId && !lastCarFromStorage) {
            try {
              await AsyncStorage.setItem(lastCarKey, data.mileage.carId);
              setLastCarId(data.mileage.carId);
            } catch {
              // ignore
            }
          }
        } else {
          setWeekStatus(EXPENSE_STATUS.DRAFT);
          setReviewNote('');
          setStartKm('');
          setEndKm('');
          setPrivateKm('');
          setSelectedCarId(lastCarFromStorage || null);
          setGivenCash('');
          setLocations({});
        }
      } catch (e) {
        console.error(e);
      } finally {
        hydratingRef.current = false;
        setLoading(false);
      }
    };
    loadData();
  }, [weekId, fetchWeeklyTracking, draftKey, lastCarKey]);

  useEffect(() => {
    const loadCars = async () => {
      try {
        const cachedCars = await getCachedCars();
        if (Array.isArray(cachedCars) && cachedCars.length > 0) {
          setCars(cachedCars);
        }
      } catch {
        // ignore
      }

      try {
        const freshCars = await getAllCars();
        if (Array.isArray(freshCars)) {
          setCars(freshCars);
        }
      } catch (e) {
        console.error('❌ [WeeklyTrackingScreen] Error loading cars:', e);
      }
    };

    loadCars();
  }, []);

  useEffect(() => {
    const loadBrands = async () => {
      try {
        const brands = await getCarBrands();
        setCarBrandsByName(brands || {});
      } catch (e) {
        console.error('❌ [WeeklyTrackingScreen] Error loading car brands:', e);
        setCarBrandsByName({});
      }
    };
    loadBrands();
  }, []);

  const CarBrandLogo = useCallback(({ logoUrl, size = 18 }) => {
    const uri = typeof logoUrl === 'string' ? logoUrl.trim() : '';
    if (!uri) {
      return <View style={[styles.brandLogoFallback, { width: size, height: size, borderRadius: size / 4 }]} />;
    }

    const isSvg = uri.toLowerCase().includes('.svg');
    if (isSvg) {
      return (
        <View style={{ width: size, height: size }}>
          <SvgUri width={size} height={size} uri={uri} />
        </View>
      );
    }

    return <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="contain" />;
  }, []);

  const persistDraftDebounced = useMemo(
    () =>
      debounce(async (key, draft) => {
        if (!key) return;
        await AsyncStorage.setItem(key, JSON.stringify(draft));
      }, 300),
    []
  );

  useEffect(() => {
    if (hydratingRef.current) return;
    if (!draftKey) return;

    const draft = {
      weekId,
      startKm,
      endKm,
      privateKm,
      carId: selectedCarId,
      givenCash,
      locations,
      updatedAt: Date.now(),
    };

    persistDraftDebounced(draftKey, draft);
  }, [weekId, startKm, endKm, privateKm, selectedCarId, givenCash, locations, draftKey, persistDraftDebounced]);

  useEffect(() => {
    return () => {
      persistDraftDebounced.cancel();
    };
  }, [persistDraftDebounced]);

  // Save Handler
  const handleSave = async () => {
    const trackingData = {
      weekStartDate: getMondayFromWeekId(weekId),
      mileage: {
        startKm: parseFloat(startKm) || 0,
        endKm: parseFloat(endKm) || 0,
        privateKm: parseFloat(privateKm) || 0,
        carId: selectedCarId || null
      },
      pettyCash: {
        previousBalance: Number(previousCashBalance) || 0,
        given: pettyCashGiven,
        spentCash: cashExpensesTotal,
        invoiceTotal: invoiceSum,
        receiptTotal: receiptSum
      },
      locations
    };

    const validationErrors = validateWeeklyTracking(trackingData);
    if (validationErrors?.length) {
      Alert.alert('Έλεγχος', validationErrors.join('\n'));
      return;
    }

    try {
      setSaving(true);

      // Keep last used car across weeks/devices
      if (lastCarKey && selectedCarId) {
        try {
          await AsyncStorage.setItem(lastCarKey, selectedCarId);
          setLastCarId(selectedCarId);
        } catch {
          // ignore
        }
      }

      await saveTracking(trackingData);
      if (draftKey) await AsyncStorage.removeItem(draftKey);
      Alert.alert('Επιτυχία', 'Η εβδομαδιαία καταγραφή αποθηκεύτηκε.');
    } catch (error) {
      Alert.alert('Σφάλμα', error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitReport = () => {
    Alert.alert(
      'Υποβολή Εξοδολογίου',
      'Θέλετε να υποβάλετε το εβδομαδιαίο εξοδολόγιο στον/στην υπεύθυνο; Αυτό θα κλειδώσει την εβδομάδα ως "υποβληθείσα".',
      [
        { text: 'Άκυρο', style: 'cancel' },
        {
          text: 'Υποβολή',
          style: 'default',
          onPress: async () => {
            const trackingData = {
              weekStartDate: getMondayFromWeekId(weekId),
              mileage: {
                startKm: parseFloat(startKm) || 0,
                endKm: parseFloat(endKm) || 0,
                privateKm: parseFloat(privateKm) || 0,
                carId: selectedCarId || null
              },
              pettyCash: {
                previousBalance: Number(previousCashBalance) || 0,
                given: pettyCashGiven,
                spentCash: cashExpensesTotal,
                invoiceTotal: invoiceSum,
                receiptTotal: receiptSum
              },
              locations
            };

            const validationErrors = validateWeeklyTracking(trackingData);
            if (validationErrors?.length) {
              Alert.alert('Έλεγχος', validationErrors.join('\n'));
              return;
            }

            try {
              setSubmitting(true);

              // Keep last used car across weeks/devices
              if (lastCarKey && selectedCarId) {
                try {
                  await AsyncStorage.setItem(lastCarKey, selectedCarId);
                  setLastCarId(selectedCarId);
                } catch {
                  // ignore
                }
              }

              // Ensure tracking is saved before submitting
              await saveTracking(trackingData);
              const submission = await submitWeeklyReportToManager(weekId);
              if (draftKey) await AsyncStorage.removeItem(draftKey);

              // Update UI immediately (server will also reflect it)
              setWeekStatus(EXPENSE_STATUS.SUBMITTED);
              setReviewNote('');

              const hasManagers = Array.isArray(submission?.managerIds) && submission.managerIds.length > 0;
              Alert.alert(
                'Επιτυχία',
                hasManagers
                  ? 'Η αναφορά υποβλήθηκε και στάλθηκε στον/στην υπεύθυνο.'
                  : 'Η αναφορά υποβλήθηκε, αλλά δεν βρέθηκε υπεύθυνος στον λογαριασμό σας.'
              );
            } catch (e) {
              Alert.alert('Σφάλμα', e?.message || 'Αποτυχία υποβολής αναφοράς.');
            } finally {
              setSubmitting(false);
            }
          }
        }
      ]
    );
  };

  const handleEditExpense = (id) => {
    setSelectedCategoryId(null);
    setSelectedExpenseId(id);
    setModalVisible(true);
  };

  const handleDeleteExpense = (id) => {
    Alert.alert('Διαγραφή', 'Είστε σίγουρος/η;', [
      { text: 'Άκυρο', style: 'cancel' },
      { text: 'Διαγραφή', style: 'destructive', onPress: () => deleteExistingExpense(id) }
    ]);
  };

  const handleAddExpense = () => {
    setSelectedExpenseId(null);
    setSelectedCategoryId(null);
    setSelectedGroup(null);
    setCategoryMenuVisible(true);
  };

  const handleGroupSelect = useCallback((group) => {
    setSelectedGroup(group);
  }, []);

  const handleCategorySelect = useCallback((categoryId) => {
    setCategoryMenuVisible(false);
    setSelectedGroup(null);
    setSelectedCategoryId(categoryId);
    setSelectedExpenseId(null);
    setModalVisible(true);
  }, []);

  const handleCloseCategoryMenu = useCallback(() => {
    setCategoryMenuVisible(false);
    setSelectedGroup(null);
  }, []);

  const getGroupColor = useCallback((group) => {
    switch (group) {
      case EXPENSE_GROUPS.TRANSPORT:
        return TOKENS.primaryBlue;
      case EXPENSE_GROUPS.ACCOMMODATION:
        return '#FCEFDA';
      case EXPENSE_GROUPS.MEALS:
        return '#FDECE2';
      case EXPENSE_GROUPS.REPRESENTATION:
        return '#EDE9FE';
      case EXPENSE_GROUPS.OTHER:
      default:
        return '#E9EDF2';
    }
  }, []);

  const getGroupIconColor = useCallback((group) => {
    if (group === EXPENSE_GROUPS.TRANSPORT) {
      return TOKENS.surface;
    }
    return TOKENS.textPrimary;
  }, []);

  const getCategoryIconColor = useCallback((group) => {
    if (group === EXPENSE_GROUPS.TRANSPORT) {
      return TOKENS.surface;
    }
    return TOKENS.textPrimary;
  }, []);

  const getGroupIconName = useCallback((group) => {
    switch (group) {
      case EXPENSE_GROUPS.TRANSPORT:
        return 'car-sport-outline';
      case EXPENSE_GROUPS.ACCOMMODATION:
        return 'bed-outline';
      case EXPENSE_GROUPS.MEALS:
        return 'restaurant-outline';
      case EXPENSE_GROUPS.REPRESENTATION:
        return 'people-outline';
      case EXPENSE_GROUPS.OTHER:
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

  const handleClear = useCallback(() => {
    Alert.alert('Καθαρισμός', 'Να καθαριστούν όλα τα πεδία αυτής της εβδομάδας; (Δεν επηρεάζει ό,τι έχει αποθηκευτεί στο Firestore μέχρι να πατήσεις Αποθήκευση)', [
      { text: 'Άκυρο', style: 'cancel' },
      {
        text: 'Καθαρισμός',
        style: 'destructive',
        onPress: async () => {
          setStartKm('');
          setEndKm('');
          setPrivateKm('');
          setSelectedCarId(lastCarId || null);
          setGivenCash('');
          setLocations({});
          if (draftKey) await AsyncStorage.removeItem(draftKey);
        },
      },
    ]);
  }, [draftKey, lastCarId]);

  const getSelectedCarLabel = useCallback(() => {
    if (!selectedCarId) return 'Επιλέξτε Αυτοκίνητο';
    const car = cars.find((c) => c.id === selectedCarId);
    return car ? `${car.color} ${car.make} ${car.model} (${car.licensePlate})` : 'Επιλέξτε Αυτοκίνητο';
  }, [cars, selectedCarId]);

  const selectedCar = useMemo(() => {
    if (!selectedCarId) return null;
    return cars.find((c) => c.id === selectedCarId) || null;
  }, [cars, selectedCarId]);

  const selectedCarBrand = useMemo(() => {
    const make = (selectedCar?.make || '').toString().trim().toLowerCase();
    if (!make) return null;
    return carBrandsByName?.[make] || null;
  }, [selectedCar, carBrandsByName]);

  const handlePrevWeek = () => {
    const monday = getMondayFromWeekId(weekId);
    const prev = new Date(monday);
    prev.setDate(prev.getDate() - 7);
    const newWeekId = getWeekId(prev);
    navigation.setParams({ weekId: newWeekId });
    setWeekId(newWeekId);
  };

  const handleNextWeek = () => {
    const monday = getMondayFromWeekId(weekId);
    const next = new Date(monday);
    next.setDate(next.getDate() + 7);
    const newWeekId = getWeekId(next);
    navigation.setParams({ weekId: newWeekId });
    setWeekId(newWeekId);
  };

  // Filter Expenses for this week
  const weeklyExpenses = useMemo(() => {
    return expenses.filter(e => getWeekId(new Date(e.date)) === weekId).sort((a,b) => new Date(b.date) - new Date(a.date));
  }, [expenses, weekId]);

  const cashExpenses = useMemo(() => {
    return weeklyExpenses.filter((e) => (e.paymentMethod || PAYMENT_METHODS.CASH) === PAYMENT_METHODS.CASH);
  }, [weeklyExpenses]);

  const cashExpensesTotal = useMemo(() => {
    return cashExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [cashExpenses]);

  const invoiceExpenses = useMemo(() => {
    return weeklyExpenses.filter((e) => (e.invoiceType || INVOICE_TYPES.RECEIPT) === INVOICE_TYPES.INVOICE);
  }, [weeklyExpenses]);

  const receiptExpenses = useMemo(() => {
    return weeklyExpenses.filter((e) => (e.invoiceType || INVOICE_TYPES.RECEIPT) === INVOICE_TYPES.RECEIPT);
  }, [weeklyExpenses]);

  const invoiceSum = useMemo(() => {
    return invoiceExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [invoiceExpenses]);

  const receiptSum = useMemo(() => {
    return receiptExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [receiptExpenses]);

  const pettyCashGiven = useMemo(() => parseFloat(givenCash) || 0, [givenCash]);
  const pettyCashFund = useMemo(() => (Number(previousCashBalance) || 0) + pettyCashGiven, [previousCashBalance, pettyCashGiven]);
  const pettyCashRemaining = useMemo(() => Math.max(0, pettyCashFund - cashExpensesTotal), [pettyCashFund, cashExpensesTotal]);

  useEffect(() => {
    const loadPrevious = async () => {
      try {
        const monday = getMondayFromWeekId(weekId);
        const prev = new Date(monday);
        prev.setDate(prev.getDate() - 7);
        const prevWeekId = getWeekId(prev);

        const prevTracking = await fetchWeeklyTracking(prevWeekId);
        setPreviousCashBalance(Number(prevTracking?.pettyCash?.remaining) || 0);
      } catch {
        setPreviousCashBalance(0);
      }
    };

    loadPrevious();
  }, [weekId, fetchWeeklyTracking]);

  const effectiveWeekStatus = useMemo(() => {
    // Prefer tracking status; fallback to expense statuses if missing
    if (weekStatus) return weekStatus;
    const week = weeklyExpenses || [];
    if (week.some((e) => e.status === EXPENSE_STATUS.APPROVED)) return EXPENSE_STATUS.APPROVED;
    if (week.some((e) => e.status === EXPENSE_STATUS.SUBMITTED)) return EXPENSE_STATUS.SUBMITTED;
    return EXPENSE_STATUS.DRAFT;
  }, [weekStatus, weeklyExpenses]);

  const statusLabel = useMemo(() => {
    if (effectiveWeekStatus === EXPENSE_STATUS.SUBMITTED) return 'Υποβληθέν';
    if (effectiveWeekStatus === EXPENSE_STATUS.APPROVED) return 'Εγκεκριμένο';
    return 'Πρόχειρο';
  }, [effectiveWeekStatus]);

  const statusMeta = useMemo(() => {
    if (effectiveWeekStatus === EXPENSE_STATUS.APPROVED) return { bg: '#DCFCE7', fg: '#166534' };
    if (effectiveWeekStatus === EXPENSE_STATUS.SUBMITTED) return { bg: '#FEF3C7', fg: '#92400E' };
    return { bg: TOKENS.lightBlueBg, fg: TOKENS.primaryBlue };
  }, [effectiveWeekStatus]);

  // Render Expense Item
  const renderExpenseItem = ({ item }) => {
    const needsReview = Boolean(item?.review?.required);
    return (
      <TouchableOpacity
        style={[styles.expenseItem, needsReview && styles.expenseItemNeedsReview]}
        onPress={() => handleEditExpense(item.id)}
      >
      <View style={styles.expenseLeft}>
        <Text style={styles.expenseDate}>{formatDateDDMMYYYY(new Date(item.date))}</Text>
        <Text style={styles.expenseCategory}>{getCategoryLabel(item.category)}</Text>
        {needsReview && <Text style={styles.reviewPillText}>Χρειάζεται έλεγχο</Text>}
        <Text style={styles.expenseDesc} numberOfLines={1}>{item.description}</Text>
      </View>
      <View style={styles.expenseRight}>
        <Text style={styles.expenseAmount}>{item.amount.toFixed(2)}</Text>
        <TouchableOpacity onPress={() => handleDeleteExpense(item.id)} style={styles.deleteBtn}>
           <Ionicons name='trash-outline' size={18} color='#EF4444' />
        </TouchableOpacity>
      </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeScreen title="Καταγραφή Εβδομάδας" headerLeft={<BackToExpensesButton />}>
        <ActivityIndicator size='large' color={TOKENS.primaryBlue} style={{ marginTop: 50 }} />
      </SafeScreen>
    );
  }

  return (
    <SafeScreen
      title="Καταγραφή Εβδομάδας"
      headerLeft={<BackToExpensesButton />}
      headerRight={
        <TouchableOpacity onPress={handleSave} disabled={saving || submitting} style={[styles.saveBtn, (saving || submitting) && { opacity: 0.7 }]}>
          <Text style={styles.saveBtnText}>{saving ? '...' : 'Αποθήκευση'}</Text>
        </TouchableOpacity>
      }
    >
      <View style={styles.container}>
        <View style={styles.weekNavRow}>
          <TouchableOpacity onPress={handlePrevWeek} style={styles.weekNavBtn}>
            <Ionicons name='chevron-back' size={18} color={TOKENS.textPrimary} />
            <Text style={styles.weekNavText}>Προηγούμενη</Text>
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.subTitle}>{weekId}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}>
              <Text style={[styles.statusBadgeText, { color: statusMeta.fg }]}>{statusLabel}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleNextWeek} style={styles.weekNavBtn}>
            <Text style={styles.weekNavText}>Επόμενη</Text>
            <Ionicons name='chevron-forward' size={18} color={TOKENS.textPrimary} />
          </TouchableOpacity>
        </View>

        {reviewNote ? (
          <View style={styles.reviewBanner}>
            <Ionicons name='alert-circle-outline' size={18} color='#92400E' />
            <Text style={styles.reviewBannerText}>{reviewNote}</Text>
          </View>
        ) : null}

        <View style={styles.actionsRow}>
          <TouchableOpacity
            onPress={handleSubmitReport}
            disabled={submitting || saving}
            style={[styles.submitBtn, (submitting || saving) && { opacity: 0.7 }]}
          >
            <Ionicons name='send-outline' size={18} color='white' />
            <Text style={styles.submitBtnText}>{submitting ? 'Υποβολή...' : 'Υποβολή Εξοδολογίου'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleClear}
            disabled={submitting || saving}
            style={[styles.clearBtn, (submitting || saving) && { opacity: 0.7 }]}
          >
            <Ionicons name='trash-bin-outline' size={18} color='white' />
            <Text style={styles.clearBtnText}>Καθαρισμός</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollContent}>
          {/* TOP SECTION Split */}
          <View style={styles.splitRow}>
            {/* LEFT: Mileage & Cash */}
            <View style={styles.leftCol}>
              <Text style={styles.sectionTitle}>Χιλιομετρητής</Text>

              <Text style={styles.inputLabel}>Όχημα</Text>
              <TouchableOpacity style={styles.input} onPress={() => setCarsModalVisible(true)}>
                <View style={styles.carSelectRow}>
                  {selectedCarId ? (
                    <CarBrandLogo logoUrl={selectedCarBrand?.logoUrl} size={18} />
                  ) : (
                    <Ionicons name="car-outline" size={18} color={TOKENS.textSecondary} />
                  )}
                  <Text style={[styles.carSelectText, { color: selectedCarId ? TOKENS.textPrimary : TOKENS.textSecondary }]} numberOfLines={1}>
                    {getSelectedCarLabel()}
                  </Text>
                </View>
              </TouchableOpacity>
              
              <Text style={styles.inputLabel}>Έναρξη</Text>
              <TextInput style={styles.input} value={startKm} onChangeText={setStartKm} keyboardType='numeric' placeholder='0.0' />
              
              <Text style={styles.inputLabel}>Λήξη</Text>
              <TextInput style={styles.input} value={endKm} onChangeText={setEndKm} keyboardType='numeric' placeholder='0.0' />
              
              <Text style={styles.infoText}>Σύνολο: {totalKm.toFixed(1)} km</Text>
              
              <Text style={styles.inputLabel}>Ιδιωτικά</Text>
              <TextInput style={styles.input} value={privateKm} onChangeText={setPrivateKm} keyboardType='numeric' placeholder='0.0' />
              
              <Text style={styles.infoTextBusiness}>Επαγγελματικά: {businessKm.toFixed(1)} km</Text>

              <View style={styles.divider} />

              <Text style={styles.sectionTitle}>Ταμείο</Text>

              <Text style={styles.inputLabel}>Προηγούμενο υπόλοιπο (από την προηγούμενη εβδομάδα)</Text>
              <TextInput
                style={[styles.input, styles.readonlyInput]}
                value={(Number(previousCashBalance) || 0).toFixed(2)}
                editable={false}
              />

              <Text style={styles.inputLabel}>Δόθηκαν</Text>
              <TextInput
                style={styles.input}
                value={givenCash}
                onChangeText={setGivenCash}
                keyboardType='numeric'
                placeholder='0.00'
              />

              <View style={styles.moneyRow}>
                <Text style={styles.moneyLabel}>Σύνολο Ταμείου</Text>
                <Text style={styles.moneyValue}>€{pettyCashFund.toFixed(2)}</Text>
              </View>
              <View style={styles.moneyRow}>
                <Text style={styles.moneyLabel}>Έξοδα σε Μετρητά</Text>
                <Text style={styles.moneyValue}>€{cashExpensesTotal.toFixed(2)} ({cashExpenses.length})</Text>
              </View>
              <View style={styles.moneyRow}>
                <Text style={styles.moneyLabel}>Έξοδα σε Τιμολόγια</Text>
                <Text style={styles.moneyValue}>€{invoiceSum.toFixed(2)} ({invoiceExpenses.length})</Text>
              </View>

              <View style={styles.moneyRowStrong}>
                <Text style={styles.moneyLabelStrong}>Υπόλοιπο Ταμείου (μεταφέρεται)</Text>
                <Text style={styles.moneyValueStrong}>€{pettyCashRemaining.toFixed(2)}</Text>
              </View>

              <View style={styles.divider} />

              <Text style={styles.sectionTitle}>Παραστατικά (Πληροφοριακά)</Text>
              <View style={styles.moneyRow}>
                <Text style={styles.moneyLabel}>{INVOICE_TYPE_LABELS[INVOICE_TYPES.RECEIPT] || 'Αποδείξεις'}</Text>
                <Text style={styles.moneyValue}>€{receiptSum.toFixed(2)} ({receiptExpenses.length})</Text>
              </View>
              <View style={styles.moneyRow}>
                <Text style={styles.moneyLabel}>{INVOICE_TYPE_LABELS[INVOICE_TYPES.INVOICE] || 'Τιμολόγια'}</Text>
                <Text style={styles.moneyValue}>€{invoiceSum.toFixed(2)} ({invoiceExpenses.length})</Text>
              </View>
            </View>

            {/* RIGHT: Locations */}
            <View style={styles.rightCol}>
              <Text style={styles.sectionTitle}>Τοποθεσίες</Text>
              {weekDays.map((day) => (
                <View key={day.id} style={styles.dayRow}>
                  <Text style={styles.dayLabel}>{day.label}</Text>
                  <TextInput 
                    style={styles.locationInput}
                    value={locations[day.id] || ''}
                    onChangeText={(val) => setLocations(prev => ({ ...prev, [day.id]: val }))}
                    placeholder='Τοποθεσία...'
                  />
                </View>
              ))}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Expenses List */}
          <View style={styles.expensesHeader}>
            <Text style={styles.sectionTitle}>Έξοδα εβδομάδας ({weeklyExpenses.length})</Text>
            <TouchableOpacity onPress={handleAddExpense} style={styles.addBtn}>
              <Ionicons name='add' size={20} color='white' />
              <Text style={styles.addBtnText}>Προσθήκη</Text>
            </TouchableOpacity>
          </View>

          {weeklyExpenses.map(item => (
             <View key={item.id}>{renderExpenseItem({ item })}</View>
          ))}
          {weeklyExpenses.length === 0 && <Text style={styles.noExpenses}>Δεν υπάρχουν έξοδα</Text>}
          
          <View style={{ height: 40 }} />
        </ScrollView>

        <ExpenseDetailModal 
          visible={modalVisible} 
          expenseId={selectedExpenseId} 
          categoryId={selectedCategoryId}
          onClose={() => setModalVisible(false)} 
        />

        <Modal visible={categoryMenuVisible} transparent animationType='fade' onRequestClose={handleCloseCategoryMenu}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={handleCloseCategoryMenu}>
            <View style={[styles.menuContainer, { paddingBottom: Math.max(insets.bottom, 16) + 10 }]}>
              <View style={styles.menuHandle} />

              {!selectedGroup ? (
                <>
                  <View style={styles.menuHeader}>
                    <Text style={styles.menuTitle}>Επιλέξτε Κατηγορία</Text>
                    <Text style={styles.menuSubtitle}>Επιλέξτε ομάδα εξόδων για γρήγορη καταχώρηση.</Text>
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
                        <Ionicons name='chevron-forward' size={16} color={TOKENS.textSecondary} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.menuHeader}>
                    <TouchableOpacity style={styles.menuBackButton} onPress={() => setSelectedGroup(null)} activeOpacity={0.8}>
                      <Ionicons name='arrow-back' size={15} color={TOKENS.primaryBlue} />
                      <Text style={styles.menuBackButtonText}>Πίσω</Text>
                    </TouchableOpacity>
                    <Text style={styles.menuTitle}>{selectedGroup}</Text>
                    <Text style={styles.menuSubtitle}>Επιλέξτε κατηγορία για νέο έξοδο.</Text>
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
                          <Ionicons name='chevron-forward' size={16} color={TOKENS.textSecondary} />
                        </TouchableOpacity>
                      ))}
                  </View>
                </>
              )}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* CARS SELECTION MODAL */}
        <Modal
          visible={carsModalVisible}
          transparent
          animationType='slide'
          onRequestClose={() => setCarsModalVisible(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Επιλέξτε Αυτοκίνητο</Text>
              <TouchableOpacity onPress={() => setCarsModalVisible(false)}>
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>

            {cars.length === 0 ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                <Text style={{ fontSize: 16, color: TOKENS.textSecondary, textAlign: 'center' }}>
                  Δεν υπάρχουν διαθέσιμα αυτοκίνητα
                </Text>
              </View>
            ) : (
              <FlatList
                data={cars}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.carItem, selectedCarId === item.id && styles.carItemSelected]}
                    onPress={async () => {
                      setSelectedCarId(item.id);
                      if (lastCarKey) {
                        try {
                          await AsyncStorage.setItem(lastCarKey, item.id);
                          setLastCarId(item.id);
                        } catch {
                          // ignore
                        }
                      }
                      setCarsModalVisible(false);
                    }}
                  >
                    <View style={styles.carItemRow}>
                      <CarBrandLogo
                        logoUrl={carBrandsByName?.[(item.make || '').toString().trim().toLowerCase()]?.logoUrl}
                        size={26}
                      />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.carItemText}>{item.make} {item.model}</Text>
                        <Text style={styles.carItemLicense}>{item.color} • {item.licensePlate}</Text>
                      </View>
                      {selectedCarId === item.id ? (
                        <Ionicons name="checkmark-circle" size={22} color={TOKENS.primaryBlue} />
                      ) : (
                        <Ionicons name="chevron-forward" size={18} color={TOKENS.textSecondary} />
                      )}
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </SafeAreaView>
        </Modal>
      </View>
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: TOKENS.pageBackground },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: TOKENS.surface, borderBottomColor: TOKENS.border, borderBottomWidth: 1 },
  title: { fontSize: 18, fontWeight: '700', color: TOKENS.textPrimary },
  weekNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  weekNavBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: TOKENS.surface, borderWidth: 1, borderColor: TOKENS.border, borderRadius: 999 },
  weekNavText: { fontSize: 12, fontWeight: '700', color: TOKENS.textPrimary },
  subTitle: { fontSize: 12, color: TOKENS.textSecondary, textAlign: 'center' },
  statusBadge: { marginTop: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusBadgeText: { fontSize: 11, fontWeight: '900' },
  reviewBanner: { marginHorizontal: 16, marginTop: 10, flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', padding: 10, borderRadius: 10 },
  reviewBannerText: { flex: 1, color: '#92400E', fontWeight: '700', fontSize: 12, lineHeight: 16 },
  saveBtn: { backgroundColor: TOKENS.primaryBlue, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  saveBtnText: { color: 'white', fontWeight: '600', fontSize: 13 },
  actionsRow: { paddingHorizontal: 16, paddingTop: 10, flexDirection: 'row', gap: 10 },
  submitBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: TOKENS.primaryBlue, paddingVertical: 10, borderRadius: 10 },
  submitBtnText: { color: 'white', fontWeight: '800', fontSize: 13 },
  clearBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EF4444', paddingVertical: 10, borderRadius: 10 },
  clearBtnText: { color: 'white', fontWeight: '800', fontSize: 13 },
  scrollContent: { padding: 16 },
  splitRow: { flexDirection: 'row', gap: 16 },
  leftCol: { flex: 1, backgroundColor: TOKENS.surface, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: TOKENS.border },
  rightCol: { flex: 1.5, backgroundColor: TOKENS.surface, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: TOKENS.border  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: TOKENS.textPrimary, marginBottom: 8 },
  inputLabel: { fontSize: 11, color: TOKENS.textSecondary, marginBottom: 2 },
  input: { backgroundColor: TOKENS.surface, borderWidth: 1, borderColor: TOKENS.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 7, fontSize: 13, marginBottom: 8 },
  carSelectRow: { flexDirection: 'row', alignItems: 'center' },
  carSelectText: { marginLeft: 8, fontSize: 13, flex: 1 },
  brandLogoFallback: { backgroundColor: TOKENS.borderSoft, borderWidth: 1, borderColor: TOKENS.border },
  readonlyInput: { backgroundColor: TOKENS.pageBackground, color: TOKENS.textPrimary },
  infoText: { fontSize: 12, color: TOKENS.textSecondary, marginBottom: 4 },
  infoTextBusiness: { fontSize: 12, color: '#059669', fontWeight: '700', marginBottom: 8 },
  divider: { height: 1, backgroundColor: TOKENS.borderSoft, marginVertical: 12 },
  moneyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  moneyLabel: { fontSize: 12, color: TOKENS.textSecondary, fontWeight: '700', flex: 1, paddingRight: 10 },
  moneyValue: { fontSize: 12, color: TOKENS.textPrimary, fontWeight: '800' },
  moneyRowStrong: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, marginTop: 4, borderTopWidth: 1, borderTopColor: TOKENS.border },
  moneyLabelStrong: { fontSize: 12, color: TOKENS.textPrimary, fontWeight: '900', flex: 1, paddingRight: 10 },
  moneyValueStrong: { fontSize: 13, color: TOKENS.textPrimary, fontWeight: '900' },
  dayRow: { marginBottom: 12 },
  dayLabel: { fontSize: 11, color: TOKENS.textSecondary, fontWeight: '600', marginBottom: 4 },
  locationInput: { backgroundColor: TOKENS.surface, borderWidth: 1, borderColor: TOKENS.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 7, fontSize: 12 },
  expensesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: TOKENS.primaryBlue, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  addBtnText: { color: 'white', fontSize: 12, fontWeight: '600', marginLeft: 4 },
  expenseItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: TOKENS.surface, padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: TOKENS.border },
  expenseItemNeedsReview: { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' },
  expenseLeft: { flex: 1 },
  expenseDate: { fontSize: 10, color: TOKENS.textSecondary },
  expenseCategory: { fontSize: 13, fontWeight: '600', color: TOKENS.textPrimary },
  expenseDesc: { fontSize: 12, color: TOKENS.textSecondary },
  reviewPillText: { marginTop: 4, fontSize: 11, fontWeight: '900', color: '#92400E' },
  expenseRight: { alignItems: 'flex-end', justifyContent: 'space-between' },
  expenseAmount: { fontSize: 14, fontWeight: '700', color: TOKENS.textPrimary, marginBottom: 4 },
  deleteBtn: { padding: 4 },
  noExpenses: { textAlign: 'center', color: TOKENS.textSecondary, marginVertical: 20 },

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

  modalContainer: { flex: 1, backgroundColor: TOKENS.pageBackground },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: TOKENS.surface, borderBottomWidth: 1, borderBottomColor: TOKENS.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: TOKENS.textPrimary },
  modalCloseButton: { fontSize: 24, color: TOKENS.textSecondary },
  carItem: { backgroundColor: TOKENS.surface, padding: 14, borderBottomWidth: 1, borderBottomColor: TOKENS.border },
  carItemSelected: { backgroundColor: TOKENS.lightBlueBg },
  carItemRow: { flexDirection: 'row', alignItems: 'center' },
  carItemText: { fontSize: 14, fontWeight: '600', color: TOKENS.textPrimary },
  carItemLicense: { fontSize: 13, color: TOKENS.textSecondary, marginTop: 2 },
});

export default WeeklyTrackingScreen;
