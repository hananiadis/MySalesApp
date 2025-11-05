// src/screens/OrderCustomerSelectScreen.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  Alert,
  Modal,
  ScrollView,
  Switch,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';

import { useOrder } from '../context/OrderContext';
import { useAuth, ROLES } from '../context/AuthProvider';
import { normalizeBrandKey, AVAILABLE_BRANDS, BRAND_LABEL } from '../constants/brands';
import { getCustomersFromLocal, saveCustomersToLocal } from '../utils/localData';
import { filterCustomersBySalesman } from '../utils/customerFiltering';

const MANAGEMENT_ROLES = [ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER];

const STRINGS = {
  title: 'Επιλογή πελάτη',
  searchPlaceholder: 'Αναζήτηση με όνομα, ΑΦΜ ή κωδικό',
  backLabel: 'Πίσω',
  listEmpty: 'Δεν βρέθηκαν πελάτες.',
  addButtonLabel: 'Νέος πελάτης',
  addCustomer: {
    title: 'Νέος πελάτης',
    subtitle: 'Συμπληρώστε τα στοιχεία για να αποθηκευτούν στο Firestore.',
    brandsHeading: 'Μάρκες',
    salesmenHeading: 'Ανάθεση πωλητών',
    salesmenEmpty: 'Δεν βρέθηκαν διαθέσιμοι πωλητές για τις επιλεγμένες μάρκες.',
    fields: {
      code: 'Κωδικός',
      name: 'Επωνυμία',
      vat: 'Α.Φ.Μ.',
      taxOffice: 'Δ.Ο.Υ.',
      profession: 'Επάγγελμα',
      street: 'Διεύθυνση',
      postalCode: 'Τ.Κ.',
      city: 'Πόλη',
      phone1: 'Τηλ. 1',
      phone2: 'Τηλ. 2',
      fax: 'Fax',
      email: 'Email',
      salesmanName: 'Πωλητής',
      turnover2022: 'Τζίρος Χρήση 2022',
      turnover2023: 'Τζίρος Χρήση 2023',
      turnover2024: 'Τζίρος Χρήση 2024',
      turnover2025: 'Τζίρος Χρήση 2025',
      balance: 'Υπόλοιπο',
      channel: 'Κανάλι',
    },
    activeLabel: 'Ενεργός πελάτης',
    cancel: 'Άκυρο',
    save: 'Αποθήκευση',
    errors: {
      name: 'Συμπληρώστε επωνυμία.',
      vat: 'Συμπληρώστε Α.Φ.Μ.',
      brands: 'Επιλέξτε τουλάχιστον μία μάρκα.',
    },
    successTitle: 'Ο πελάτης δημιουργήθηκε',
    successMessage: 'Ο νέος πελάτης είναι διαθέσιμος.',
    warningTitle: 'Μη έγκυρο Α.Φ.Μ.',
    warningMessage: 'Το Α.Φ.Μ. φαίνεται μη έγκυρο. Ελέγξτε πριν την αποθήκευση.',
    inlineVatWarning: 'Το Α.Φ.Μ. φαίνεται μη έγκυρο. Παρακαλώ ελέγξτε.',
    errorTitle: 'Ελλιπή στοιχεία',
    submitErrorTitle: 'Αποτυχία αποθήκευσης',
  },
  alerts: {
    missingTitle: 'Ελλιπή στοιχεία',
    missingMessage: 'Συμπληρώστε τα απαραίτητα πεδία για να συνεχίσετε.',
    errorTitle: 'Σφάλμα',
    errorMessage: 'Κάτι πήγε στραβά. Προσπαθήστε ξανά.',
  },
  row: {
    codeFallback: '--',
    nameFallback: 'Χωρίς όνομα',
    vatLabel: 'Α.Φ.Μ.',
    vatFallback: '-',
  },
};

const normalizeGreekVAT = (vat) => {
  if (!vat) return '';
  let normalized = vat.toString().trim().toUpperCase().replace(/\s+/g, '');
  if (normalized.startsWith('EL') || normalized.startsWith('GR')) {
    normalized = normalized.slice(2);
  }
  return normalized;
};

const isValidGreekVAT = (vat) => {
  if (!vat) return false;
  if (!/^\d{9}$/.test(vat)) return false;

  const digits = vat.split('').map(Number);
  const checkDigit = digits[8];
  const sum = digits
    .slice(0, 8)
    .reduce((acc, d, index) => acc + d * Math.pow(2, 8 - index), 0);

  const remainder = sum % 11;
  const expected = remainder === 10 ? 0 : remainder;

  return checkDigit === expected;
};

export default function OrderCustomerSelectScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const brand = useMemo(() => normalizeBrandKey(route?.params?.brand), [route?.params?.brand]);

  const { profile, hasRole } = useAuth();
  const profileUid = profile?.uid || null;
  const canManageAll = hasRole(MANAGEMENT_ROLES);
  const userMerchIds = profile?.merchIds || [];

  const { startOrder, setCurrentCustomer } = useOrder();
  const cleanupRef = useRef(null);

  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [salesmenOptions, setSalesmenOptions] = useState([]);
  const [selectedSalesmen, setSelectedSalesmen] = useState([]);
  const [selectedBrands, setSelectedBrands] = useState(() => {
    const initial = brand ? new Set([brand]) : new Set();
    return initial;
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [newCustomerFields, setNewCustomerFields] = useState({
    code: '',
    name: '',
    vat: '',
    taxOffice: '',
    profession: '',
    street: '',
    postalCode: '',
    city: '',
    phone1: '',
    phone2: '',
    fax: '',
    email: '',
    salesmanName: '',
    turnover2022: '',
    turnover2023: '',
    turnover2024: '',
    turnover2025: '',
    balance: '',
    channel: '',
    active: true,
  });
  const [showVatWarning, setShowVatWarning] = useState(false);

  const brandCustomers = useMemo(() => {
    return customers.filter((customer) => normalizeBrandKey(customer?.brand || 'playmobil') === brand);
  }, [customers, brand]);

  const accessibleCustomers = useMemo(() => {
    if (canManageAll) {
      return brandCustomers;
    }
    
    if (!userMerchIds.length) {
      return [];
    }
    
    return filterCustomersBySalesman(brandCustomers, userMerchIds, null);
  }, [brandCustomers, userMerchIds, canManageAll]);

  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        setLoading(true);
        const data = await getCustomersFromLocal(brand);
        if (!aborted) {
          setCustomers(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.log('getCustomersFromLocal error:', error);
        if (!aborted) {
          setCustomers([]);
        }
      } finally {
        if (!aborted) {
          setLoading(false);
        }
      }
    })();
    return () => { aborted = true; };
  }, [brand]);

  useEffect(() => {
    if (route.params?.prefillCustomer) {
      selectCustomerAndGo(route.params.prefillCustomer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.prefillCustomer]);

  useEffect(() => {
    if (!brand) return;
    setSelectedBrands((prev) => {
      if (prev.has(brand)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(brand);
      return next;
    });
  }, [brand]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const snapshot = await firestore().collection('salesmen').get();
        if (!active) return;
        const next = snapshot.docs
          .map((doc) => {
            const data = doc.data() || {};
            return {
              id: doc.id,
              name: data.name || '',
              brand: normalizeBrandKey(data.brand || 'playmobil'),
            };
          })
          .filter((item) => item.name);
        setSalesmenOptions(next);
      } catch (error) {
        console.log('loadSalesmen error:', error);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return accessibleCustomers;
    }
    return accessibleCustomers.filter((customer) => {
      const name = (customer.name || '').toLowerCase();
      const vat = (customer.vatInfo?.registrationNo || customer.vatno || '').toLowerCase();
      const code = (customer.customerCode || '').toLowerCase();
      return name.includes(q) || vat.includes(q) || code.includes(q);
    });
  }, [accessibleCustomers, search]);

  const availableSalesmen = useMemo(() => {
    if (!salesmenOptions.length) return [];
    if (!selectedBrands || selectedBrands.size === 0) {
      return salesmenOptions;
    }
    return salesmenOptions.filter((item) => selectedBrands.has(item.brand));
  }, [salesmenOptions, selectedBrands]);

  const resetCustomerForm = useCallback(() => {
    setNewCustomerFields({
      code: '',
      name: '',
      vat: '',
      taxOffice: '',
      profession: '',
      street: '',
      postalCode: '',
      city: '',
      phone1: '',
      phone2: '',
      fax: '',
      email: '',
      salesmanName: '',
      turnover2022: '',
      turnover2023: '',
      turnover2024: '',
      turnover2025: '',
      balance: '',
      channel: '',
      active: true,
    });
    setSelectedSalesmen([]);
    setSelectedBrands(() => {
      const initial = new Set();
      if (brand) {
        initial.add(brand);
      }
      return initial;
    });
    setShowVatWarning(false);
  }, [brand]);

  const openAddCustomerModal = useCallback(() => {
    resetCustomerForm();
    setShowAddModal(true);
  }, [resetCustomerForm]);

  const closeAddCustomerModal = useCallback(() => {
    setShowAddModal(false);
    resetCustomerForm();
  }, [resetCustomerForm]);

  const updateCustomerField = useCallback((key, value) => {
    if (key === 'vat') {
      const normalized = normalizeGreekVAT(value);
      const shouldWarn = normalized.length === 9 && !isValidGreekVAT(normalized);
      setShowVatWarning(shouldWarn);
    }
    setNewCustomerFields((prev) => ({ ...prev, [key]: value }));
  }, []);

  const parseCurrencyInput = useCallback((value) => {
    if (value === null || value === undefined) return null;
    const normalized = value.toString().trim();
    if (!normalized) return null;
    const sanitized = normalized.replace(/\./g, '').replace(/\s+/g, '').replace(',', '.');
    const parsed = parseFloat(sanitized);
    if (!Number.isFinite(parsed)) return null;
    return Math.round(parsed * 100) / 100;
  }, []);

  const toggleBrandSelection = useCallback((brandKey) => {
    setSelectedBrands((prev) => {
      const next = new Set(prev);
      if (next.has(brandKey)) {
        next.delete(brandKey);
      } else {
        next.add(brandKey);
      }
      return next;
    });
  }, []);

  const toggleSalesmanSelection = useCallback((salesmanName) => {
    setSelectedSalesmen((prev) => {
      if (prev.includes(salesmanName)) {
        return prev.filter((name) => name !== salesmanName);
      }
      return [...prev, salesmanName];
    });
  }, []);

  const selectCustomerAndGo = useCallback(
    async (customerObj) => {
      try {
        Keyboard.dismiss();
        const payload = { ...customerObj, brand };
        setCurrentCustomer?.(payload);

        const orderId = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

        if (!startOrder) {
          throw new Error('startOrder is undefined from OrderContext');
        }

        const result = await startOrder(orderId, payload, brand);
        if (result && typeof result.cleanup === 'function') {
          cleanupRef.current = result.cleanup;
        }

        navigation.navigate('OrderProductSelectionScreen', {
          brand,
          fromCustomerSelect: true,
        });
      } catch (error) {
        console.log('startOrder/select crash:', error);
        Alert.alert(STRINGS.alerts.errorTitle, STRINGS.alerts.errorMessage);
      }
    },
    [brand, navigation, setCurrentCustomer, startOrder]
  );

  const handleGoBack = useCallback(() => {
    navigation.navigate('BrandHome', { brand });
  }, [brand, navigation]);

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = navigation.addListener('beforeRemove', (event) => {
        if (event.data.action?.type === 'GO_BACK') {
          event.preventDefault();
          handleGoBack();
        }
      });
      return () => unsubscribe();
    }, [handleGoBack, navigation])
  );

  const handleSaveCustomer = useCallback(async () => {
    const trimmedName = newCustomerFields.name.trim();
    const trimmedVat = newCustomerFields.vat.trim();
    if (!trimmedName) {
      Alert.alert(STRINGS.addCustomer.errorTitle, STRINGS.addCustomer.errors.name);
      return;
    }
    if (!trimmedVat) {
      Alert.alert(STRINGS.addCustomer.errorTitle, STRINGS.addCustomer.errors.vat);
      return;
    }
    const brandsArray = Array.from(selectedBrands);
    if (brandsArray.length === 0) {
      Alert.alert(STRINGS.addCustomer.errorTitle, STRINGS.addCustomer.errors.brands);
      return;
    }

    const docId = newCustomerFields.code.trim() || `manual_${Date.now()}`;
    const normalizedVat = normalizeGreekVAT(trimmedVat);
    const vatIsValid = isValidGreekVAT(normalizedVat);
    const vatValue = normalizedVat || trimmedVat;
    setShowVatWarning(normalizedVat.length > 0 && !vatIsValid);
    const merchValue =
      selectedSalesmen.length === 0
        ? null
        : selectedSalesmen.length === 1
        ? selectedSalesmen[0]
        : selectedSalesmen;

    const address = {
      street: newCustomerFields.street.trim() || null,
      postalCode: newCustomerFields.postalCode.trim() || null,
      city: newCustomerFields.city.trim() || null,
    };

    const contact = {
      telephone1: newCustomerFields.phone1.trim() || null,
      telephone2: newCustomerFields.phone2.trim() || null,
      fax: newCustomerFields.fax.trim() || null,
      email: newCustomerFields.email.trim() || null,
    };

    const profession = newCustomerFields.profession.trim() || null;
    const taxOffice = newCustomerFields.taxOffice.trim() || null;
    const salesmanName = newCustomerFields.salesmanName.trim() || null;
    const turnoverEntries = Object.entries({
      '2022': parseCurrencyInput(newCustomerFields.turnover2022),
      '2023': parseCurrencyInput(newCustomerFields.turnover2023),
      '2024': parseCurrencyInput(newCustomerFields.turnover2024),
      '2025': parseCurrencyInput(newCustomerFields.turnover2025),
    }).filter(([, value]) => value !== null);
    const turnover = turnoverEntries.length ? Object.fromEntries(turnoverEntries) : null;
    const balanceValue = parseCurrencyInput(newCustomerFields.balance);
    const channelRaw = newCustomerFields.channel.trim();
    const channelValue = channelRaw || null;

    setSavingCustomer(true);
    try {
      const createdEntries = [];
      await Promise.all(
        brandsArray.map(async (brandKey) => {
          const normalizedBrand = normalizeBrandKey(brandKey);
          const collectionName = normalizedBrand === 'playmobil' ? 'customers' : `customers_${normalizedBrand}`;
          const payload = {
            customerCode: docId,
            name: trimmedName,
            address,
            contact,
            vatInfo: {
              registrationNo: vatValue,
              office: taxOffice,
            },
            merch: merchValue,
            brand: normalizedBrand,
            profession,
            taxOffice,
            salesmanName,
            turnover,
            balance: balanceValue,
            channel: channelValue,
            isActive: newCustomerFields.active,
            createdAt: firestore.FieldValue.serverTimestamp(),
            updatedAt: firestore.FieldValue.serverTimestamp(),
            createdBy: profileUid,
            createdVia: 'app_manual',
          };

          await firestore().collection(collectionName).doc(docId).set(payload, { merge: true });
          createdEntries.push({
            id: docId,
            customerCode: docId,
            name: trimmedName,
            address,
            contact,
            vatInfo: payload.vatInfo,
            vatno: vatValue,
            merch: merchValue,
            brand: normalizedBrand,
            profession,
            taxOffice,
            salesmanName,
            turnover,
            balance: balanceValue,
            channel: channelValue,
            isActive: newCustomerFields.active,
          });
        })
      );

      setCustomers((prev) => {
        const filteredPrev = prev.filter((existing) => {
          return !createdEntries.some(
            (created) =>
              normalizeBrandKey(existing?.brand || 'playmobil') === created.brand &&
              (
                existing.customerCode === created.customerCode ||
                existing.id === created.customerCode ||
                existing.id === created.id
              )
          );
        });
        return [...createdEntries, ...filteredPrev];
      });

      const entriesByBrand = createdEntries.reduce((acc, entry) => {
        if (!acc.has(entry.brand)) {
          acc.set(entry.brand, []);
        }
        acc.get(entry.brand).push(entry);
        return acc;
      }, new Map());

      for (const [brandKey, entries] of entriesByBrand.entries()) {
        try {
          const existing = await getCustomersFromLocal(brandKey);
          const existingList = Array.isArray(existing) ? existing : [];
          const filteredExisting = existingList.filter((existingCustomer) => {
            return !entries.some(
              (created) =>
                normalizeBrandKey(existingCustomer?.brand || 'playmobil') === created.brand &&
                (
                  existingCustomer.customerCode === created.customerCode ||
                  existingCustomer.id === created.customerCode ||
                  existingCustomer.id === created.id
                )
            );
          });
          await saveCustomersToLocal([...entries, ...filteredExisting], brandKey);
        } catch (storageError) {
          console.log('persisting customers locally failed:', storageError);
        }
      }

      setShowAddModal(false);
      resetCustomerForm();

      const createdForCurrentBrand = createdEntries.find((entry) => entry.brand === brand);
      if (createdForCurrentBrand) {
        selectCustomerAndGo(createdForCurrentBrand);
      } else {
        Alert.alert(STRINGS.addCustomer.successTitle, STRINGS.addCustomer.successMessage);
      }
    } catch (error) {
      console.log('handleSaveCustomer error:', error);
      Alert.alert(STRINGS.addCustomer.submitErrorTitle, STRINGS.alerts.errorMessage);
    } finally {
      setSavingCustomer(false);
    }
  }, [
    newCustomerFields,
    selectedBrands,
    selectedSalesmen,
    profileUid,
    resetCustomerForm,
    brand,
    selectCustomerAndGo,
    parseCurrencyInput,
  ]);

  const renderCustomer = useCallback(
    ({ item }) => (
      <TouchableOpacity style={styles.customerRow} activeOpacity={0.85} onPress={() => selectCustomerAndGo(item)}>
        <View>
          <Text style={styles.customerMain}>
            {item.customerCode || STRINGS.row.codeFallback} - {item.name || STRINGS.row.nameFallback}
          </Text>
          <Text style={styles.customerSub}>
            {STRINGS.row.vatLabel}: {item.vatInfo?.registrationNo || item.vatno || STRINGS.row.vatFallback}
          </Text>
        </View>
      </TouchableOpacity>
    ),
    [selectCustomerAndGo]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fafdff' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top + 30}
      >
        <View style={{ flex: 1, padding: 16, paddingBottom: insets.bottom + 8 }}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backButton}
              activeOpacity={0.8}
              onPress={handleGoBack}
              accessibilityRole="button"
              accessibilityLabel={STRINGS.backLabel}
            >
              <Ionicons name="arrow-back" size={22} color="#1565c0" />
            </TouchableOpacity>
            <Text style={styles.title}>{STRINGS.title}</Text>
          </View>

          <TextInput
            style={styles.searchBox}
            placeholder={STRINGS.searchPlaceholder}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="none"
            placeholderTextColor="#90caf9"
            returnKeyType="search"
          />

          {loading ? (
            <ActivityIndicator size="large" color="#1976d2" style={{ marginTop: 30 }} />
          ) : (
            <FlatList
              data={search ? filtered : accessibleCustomers}
              keyExtractor={(item) => item.id || item.customerCode || item.name}
              keyboardShouldPersistTaps="handled"
              style={{ marginVertical: 5 }}
              renderItem={renderCustomer}
              ListEmptyComponent={
                <Text style={{ color: '#888', textAlign: 'center', marginVertical: 24 }}>
                  {STRINGS.listEmpty}
                </Text>
              }
            />
          )}
        </View>
        <TouchableOpacity
          style={[styles.fab, { bottom: Math.max(insets.bottom + 20, 24) }]}
          onPress={openAddCustomerModal}
          activeOpacity={0.85}
        >
          <Ionicons name="person-add-outline" size={20} color="#fff" />
          <Text style={styles.fabLabel}>{STRINGS.addButtonLabel}</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={closeAddCustomerModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{STRINGS.addCustomer.title}</Text>
            <Text style={styles.modalSubtitle}>{STRINGS.addCustomer.subtitle}</Text>
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Text style={styles.modalHeading}>{STRINGS.addCustomer.brandsHeading}</Text>
              <View style={styles.chipRow}>
                {AVAILABLE_BRANDS.map((brandKey) => {
                  const active = selectedBrands.has(brandKey);
                  return (
                    <TouchableOpacity
                      key={brandKey}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => toggleBrandSelection(brandKey)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {BRAND_LABEL[brandKey] || brandKey}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TextInput
                style={[styles.modalInput, styles.modalField]}
                placeholder={STRINGS.addCustomer.fields.code}
                value={newCustomerFields.code}
                onChangeText={(value) => updateCustomerField('code', value)}
                autoCapitalize="characters"
                placeholderTextColor="#9ca3af"
              />

              <TextInput
                style={[styles.modalInput, styles.modalField]}
                placeholder={STRINGS.addCustomer.fields.name}
                value={newCustomerFields.name}
                onChangeText={(value) => updateCustomerField('name', value)}
                placeholderTextColor="#9ca3af"
              />

              <TextInput
                style={[styles.modalInput, styles.modalField]}
                placeholder={STRINGS.addCustomer.fields.vat}
                value={newCustomerFields.vat}
                onChangeText={(value) => updateCustomerField('vat', value)}
                keyboardType="default"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={11}
                placeholderTextColor="#9ca3af"
              />
              {showVatWarning ? (
                <Text style={styles.warningText}>{STRINGS.addCustomer.inlineVatWarning}</Text>
              ) : null}

              <TextInput
                style={[styles.modalInput, styles.modalField]}
                placeholder={STRINGS.addCustomer.fields.taxOffice}
                value={newCustomerFields.taxOffice}
                onChangeText={(value) => updateCustomerField('taxOffice', value)}
                autoCapitalize="characters"
                placeholderTextColor="#9ca3af"
              />

              <TextInput
                style={[styles.modalInput, styles.modalField]}
                placeholder={STRINGS.addCustomer.fields.profession}
                value={newCustomerFields.profession}
                onChangeText={(value) => updateCustomerField('profession', value)}
                placeholderTextColor="#9ca3af"
              />

              <TextInput
                style={[styles.modalInput, styles.modalField]}
                placeholder={STRINGS.addCustomer.fields.street}
                value={newCustomerFields.street}
                onChangeText={(value) => updateCustomerField('street', value)}
                placeholderTextColor="#9ca3af"
              />

              <View style={styles.rowInputs}>
                <TextInput
                  style={[styles.modalInput, styles.rowInput, { marginRight: 10 }]}
                  placeholder={STRINGS.addCustomer.fields.postalCode}
                  value={newCustomerFields.postalCode}
                  onChangeText={(value) => updateCustomerField('postalCode', value)}
                  keyboardType="number-pad"
                  placeholderTextColor="#9ca3af"
                />
                <TextInput
                  style={[styles.modalInput, styles.rowInput]}
                  placeholder={STRINGS.addCustomer.fields.city}
                  value={newCustomerFields.city}
                  onChangeText={(value) => updateCustomerField('city', value)}
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.rowInputs}>
                <TextInput
                  style={[styles.modalInput, styles.rowInput, { marginRight: 10 }]}
                  placeholder={STRINGS.addCustomer.fields.phone1}
                  value={newCustomerFields.phone1}
                  onChangeText={(value) => updateCustomerField('phone1', value)}
                  keyboardType="phone-pad"
                  placeholderTextColor="#9ca3af"
                />
                <TextInput
                  style={[styles.modalInput, styles.rowInput]}
                  placeholder={STRINGS.addCustomer.fields.phone2}
                  value={newCustomerFields.phone2}
                  onChangeText={(value) => updateCustomerField('phone2', value)}
                  keyboardType="phone-pad"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <TextInput
                style={[styles.modalInput, styles.modalField]}
                placeholder={STRINGS.addCustomer.fields.fax}
                value={newCustomerFields.fax}
                onChangeText={(value) => updateCustomerField('fax', value)}
                keyboardType="phone-pad"
                placeholderTextColor="#9ca3af"
              />

              <TextInput
                style={[styles.modalInput, styles.modalField]}
                placeholder={STRINGS.addCustomer.fields.email}
                value={newCustomerFields.email}
                onChangeText={(value) => updateCustomerField('email', value)}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#9ca3af"
              />

              <TextInput
                style={[styles.modalInput, styles.modalField]}
                placeholder={STRINGS.addCustomer.fields.salesmanName}
                value={newCustomerFields.salesmanName}
                onChangeText={(value) => updateCustomerField('salesmanName', value)}
                placeholderTextColor="#9ca3af"
              />

              <View style={styles.rowInputs}>
                <TextInput
                  style={[styles.modalInput, styles.rowInput, { marginRight: 10 }]}
                  placeholder={STRINGS.addCustomer.fields.turnover2022}
                  value={newCustomerFields.turnover2022}
                  onChangeText={(value) => updateCustomerField('turnover2022', value)}
                  keyboardType="decimal-pad"
                  placeholderTextColor="#9ca3af"
                />
                <TextInput
                  style={[styles.modalInput, styles.rowInput]}
                  placeholder={STRINGS.addCustomer.fields.turnover2023}
                  value={newCustomerFields.turnover2023}
                  onChangeText={(value) => updateCustomerField('turnover2023', value)}
                  keyboardType="decimal-pad"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.rowInputs}>
                <TextInput
                  style={[styles.modalInput, styles.rowInput, { marginRight: 10 }]}
                  placeholder={STRINGS.addCustomer.fields.turnover2024}
                  value={newCustomerFields.turnover2024}
                  onChangeText={(value) => updateCustomerField('turnover2024', value)}
                  keyboardType="decimal-pad"
                  placeholderTextColor="#9ca3af"
                />
                <TextInput
                  style={[styles.modalInput, styles.rowInput]}
                  placeholder={STRINGS.addCustomer.fields.turnover2025}
                  value={newCustomerFields.turnover2025}
                  onChangeText={(value) => updateCustomerField('turnover2025', value)}
                  keyboardType="decimal-pad"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.rowInputs}>
                <TextInput
                  style={[styles.modalInput, styles.rowInput, { marginRight: 10 }]}
                  placeholder={STRINGS.addCustomer.fields.balance}
                  value={newCustomerFields.balance}
                  onChangeText={(value) => updateCustomerField('balance', value)}
                  keyboardType="decimal-pad"
                  placeholderTextColor="#9ca3af"
                />
                <TextInput
                  style={[styles.modalInput, styles.rowInput]}
                  placeholder={STRINGS.addCustomer.fields.channel}
                  value={newCustomerFields.channel}
                  onChangeText={(value) => updateCustomerField('channel', value)}
                  keyboardType="number-pad"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>{STRINGS.addCustomer.activeLabel}</Text>
                <Switch
                  value={newCustomerFields.active}
                  onValueChange={(value) => setNewCustomerFields((prev) => ({ ...prev, active: value }))}
                  trackColor={{ false: '#cbd5f5', true: '#81d4fa' }}
                  thumbColor={newCustomerFields.active ? '#0d47a1' : '#f4f3f4'}
                />
              </View>

              <Text style={styles.modalHeading}>{STRINGS.addCustomer.salesmenHeading}</Text>
              <View style={styles.chipRow}>
                {availableSalesmen.length ? (
                  availableSalesmen.map((item) => {
                    const active = selectedSalesmen.includes(item.name);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => toggleSalesmanSelection(item.name)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {item.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <Text style={styles.emptyHint}>{STRINGS.addCustomer.salesmenEmpty}</Text>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonGhost]}
                onPress={closeAddCustomerModal}
                disabled={savingCustomer}
              >
                <Text style={styles.modalButtonGhostText}>{STRINGS.addCustomer.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalButtonPrimary,
                  savingCustomer && styles.modalButtonDisabled,
                ]}
                onPress={handleSaveCustomer}
                disabled={savingCustomer}
              >
                {savingCustomer ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>{STRINGS.addCustomer.save}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: {
    flex: 1,
    fontSize: 23,
    fontWeight: '700',
    color: '#1565c0',
    textAlign: 'center',
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: '#1565c0',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  searchBox: {
    backgroundColor: '#fff',
    borderRadius: 9,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: 1.2,
    borderColor: '#90caf9',
    fontSize: 16,
    color: '#102027',
    marginBottom: 10,
    elevation: 1,
  },
  customerRow: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    padding: 13,
    marginVertical: 3,
    borderColor: '#bbdefb',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  customerMain: {
    fontWeight: '700',
    color: '#1565c0',
    fontSize: 15.5,
  },
  customerSub: {
    color: '#444',
    fontSize: 13,
    marginTop: 2,
  },
  fab: {
    position: 'absolute',
    right: 20,
    borderRadius: 26,
    backgroundColor: '#1565c0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
  },
  fabLabel: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
    marginLeft: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    maxHeight: '92%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#475569',
    marginTop: 4,
    marginBottom: 16,
  },
  modalScroll: {
    paddingBottom: 12,
  },
  modalHeading: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#94a3b8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#1d4ed8',
  },
  chipText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#1d4ed8',
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#cbd5f5',
    color: '#0f172a',
  },
  modalField: {
    marginTop: 10,
  },
  rowInputs: {
    flexDirection: 'row',
    marginTop: 10,
  },
  rowInput: {
    flex: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1f2937',
  },
  emptyHint: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 6,
  },
  warningText: {
    fontSize: 13,
    color: '#b91c1c',
    marginTop: 6,
    marginBottom: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  modalButton: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonGhost: {
    backgroundColor: '#e2e8f0',
  },
  modalButtonGhostText: {
    color: '#0f172a',
    fontWeight: '600',
  },
  modalButtonPrimary: {
    backgroundColor: '#1565c0',
    marginLeft: 12,
  },
  modalButtonPrimaryText: {
    color: '#fff',
    fontWeight: '700',
  },
  modalButtonDisabled: {
    opacity: 0.7,
  },
});