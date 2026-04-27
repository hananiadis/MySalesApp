import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Modal, FlatList, Switch, KeyboardAvoidingView, Platform } from 'react-native';
import {
  getAllCategories,
  getCategoriesGrouped,
  getCategoryLabel,
  EXPENSE_STATUS,
  validateExpense,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  FUEL_TYPES,
  FUEL_TYPE_LABELS,
  EXPENSE_FIELDS,
  formatDateDDMMYYYY,
  parseDateDDMMYYYY,
  INVOICE_TYPES,
  INVOICE_TYPE_LABELS,
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS
} from '../constants/expenseConstants';
import { isExpenseApproverRole } from '../constants/roles';
import { useExpense } from '../context/ExpenseContext';
import { getAllCars, getCachedCars } from '../services/carsService';

const TOKENS = {
  primaryBlue: '#185FA5',
  lightBlueBg: '#E6F1FB',
  lightBlueText: '#E6F1FB',
  pageBackground: '#f7f5f0',
  surface: '#fff',
  border: '#e0ddd6',
  borderSoft: '#e8e5de',
  textPrimary: '#1a1a1a',
  textSecondary: '#888',
  textTertiary: '#aaa',
};

const ExpenseDetailModal = ({ visible, expenseId, categoryId, onClose }) => {
  const { expenses, addNewExpense, updateExistingExpense, currentUserId, userRole, availableSalesmen } = useExpense();

  const existingExpense = useMemo(() => expenses.find((e) => e.id === expenseId), [expenses, expenseId]);
  const now = useMemo(() => new Date(), []);

  // Basic fields
  const [category, setCategory] = useState(existingExpense?.category || categoryId || getAllCategories()[0]?.id || '');
  const [amount, setAmount] = useState(existingExpense ? String(existingExpense.amount) : '');
  const [date, setDate] = useState(existingExpense ? formatDateDDMMYYYY(new Date(existingExpense.date)) : formatDateDDMMYYYY(now));
  const [time, setTime] = useState(existingExpense ? new Date(existingExpense.date).toTimeString().slice(0, 5) : now.toTimeString().slice(0, 5));
  const [description, setDescription] = useState(existingExpense?.description || '');
  const [paymentMethod, setPaymentMethod] = useState(existingExpense?.paymentMethod || PAYMENT_METHODS.CASH);
  const [invoiceType, setInvoiceType] = useState(existingExpense?.invoiceType || INVOICE_TYPES.RECEIPT);
  const [selectedSalesman, setSelectedSalesman] = useState(existingExpense?.salesmanId || currentUserId || '');

  // Dynamic fields
  const [selectedCar, setSelectedCar] = useState(existingExpense?.carId || null);
  const [fuelType, setFuelType] = useState(existingExpense?.fuelType || FUEL_TYPES.UNLEADED);
  const [mileage, setMileage] = useState(existingExpense?.mileage?.toString() || '');
  const [stationName, setStationName] = useState(existingExpense?.stationName || '');
  const [vatNumber, setVatNumber] = useState(existingExpense?.vatNumber || '');
  const [costPerLiter, setCostPerLiter] = useState(existingExpense?.costPerLiter?.toString() || '');
  const [liters, setLiters] = useState(existingExpense?.liters?.toString() || '');
  const [totalCost, setTotalCost] = useState(existingExpense?.totalCost?.toString() || '');
  const [selectedServiceTypes, setSelectedServiceTypes] = useState(existingExpense?.serviceTypes || []);
  const [serviceNotes, setServiceNotes] = useState(existingExpense?.serviceNotes || '');
  const [hotelName, setHotelName] = useState(existingExpense?.hotelName || '');
  const [nights, setNights] = useState(existingExpense?.nights?.toString() || '');
  const [departure, setDeparture] = useState(existingExpense?.departure || '');
  const [destination, setDestination] = useState(existingExpense?.destination || '');
  const [tripDate, setTripDate] = useState(existingExpense?.tripDate ? new Date(existingExpense.tripDate).toISOString().slice(0, 10) : '');
  const [previousRefuelLogged, setPreviousRefuelLogged] = useState(existingExpense?.previousRefuelLogged ?? false);
  const [fullTank, setFullTank] = useState(existingExpense?.fullTank ?? true);

  // UI state
  const [saving, setSaving] = useState(false);
  const [carsModalVisible, setCarsModalVisible] = useState(false);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);

  const groupedCategories = useMemo(() => getCategoriesGrouped(), []);
  const lastEditedRef = useRef(null); // tracks which field drove fuel math updates
  const stationUpdateRef = useRef(null); // avoids ping-pong between station name/AFM

  const fuelHistory = useMemo(() => {
    return expenses
      .filter((e) => e.category === 'fuel' && (e.salesmanId ? e.salesmanId === currentUserId : true))
      .map((e) => ({
        carId: e.carId,
        mileage: e.mileage,
        stationName: e.stationName,
        vatNumber: e.vatNumber,
        date: e.date,
        id: e.id,
      }));
  }, [expenses, currentUserId]);

  const lastOdometer = useMemo(() => {
    if (!selectedCar) return null;
    const currentId = expenseId;
    const lastFuel = fuelHistory
      .filter((f) => f.carId === selectedCar && typeof f.mileage === 'number' && (!currentId || f.id !== currentId))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .find(Boolean);
    return lastFuel?.mileage ?? null;
  }, [fuelHistory, selectedCar, expenseId]);

  const stationIndex = useMemo(() => {
    const byName = {};
    const byVat = {};
    fuelHistory.forEach((f) => {
      if (f.stationName) byName[f.stationName.toLowerCase()] = f.vatNumber || '';
      if (f.vatNumber) byVat[f.vatNumber] = f.stationName || '';
    });
    return { byName, byVat };
  }, [fuelHistory]);

  // Reset fields when modal opens with new data
  useEffect(() => {
    if (visible) {
      if (existingExpense) {
        setCategory(existingExpense.category);
        setAmount(String(existingExpense.amount));
        setDate(formatDateDDMMYYYY(new Date(existingExpense.date)));
        setTime(new Date(existingExpense.date).toTimeString().slice(0, 5));
        setDescription(existingExpense.description || '');
        setPaymentMethod(existingExpense.paymentMethod || PAYMENT_METHODS.CASH);
        setInvoiceType(existingExpense.invoiceType || INVOICE_TYPES.RECEIPT);
        setSelectedSalesman(existingExpense.salesmanId || currentUserId || '');
        setSelectedCar(existingExpense.carId || null);
        setFuelType(existingExpense.fuelType || FUEL_TYPES.UNLEADED);
        setMileage(existingExpense.mileage?.toString() || '');
        setStationName(existingExpense.stationName || '');
        setVatNumber(existingExpense.vatNumber || '');
        setCostPerLiter(existingExpense.costPerLiter?.toString() || '');
        setLiters(existingExpense.liters?.toString() || '');
        setTotalCost(existingExpense.totalCost?.toString() || '');
        setSelectedServiceTypes(existingExpense.serviceTypes || []);
        setServiceNotes(existingExpense.serviceNotes || '');
        setHotelName(existingExpense.hotelName || '');
        setNights(existingExpense.nights?.toString() || '');
        setDeparture(existingExpense.departure || '');
        setDestination(existingExpense.destination || '');
        setTripDate(existingExpense.tripDate ? new Date(existingExpense.tripDate).toISOString().slice(0, 10) : '');
        setPreviousRefuelLogged(existingExpense.previousRefuelLogged ?? false);
        setFullTank(existingExpense.fullTank ?? true);
      } else if (categoryId) {
        setCategory(categoryId);
        setAmount('');
        const freshNow = new Date();
        setDate(formatDateDDMMYYYY(freshNow));
        setTime(freshNow.toTimeString().slice(0, 5));
        setDescription('');
        setPaymentMethod(PAYMENT_METHODS.CASH);
        setInvoiceType(INVOICE_TYPES.RECEIPT);
        setSelectedSalesman(currentUserId || '');
        if (categoryId === 'fuel') {
          const lastFuel = fuelHistory
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .find((f) => f.carId);
          setSelectedCar(lastFuel?.carId || null);
        } else {
          setSelectedCar(null);
        }
        setFuelType(FUEL_TYPES.UNLEADED);
        setMileage('');
        setStationName('');
        setVatNumber('');
        setCostPerLiter('');
        setLiters('');
        setTotalCost('');
        setSelectedServiceTypes([]);
        setServiceNotes('');
        setHotelName('');
        setNights('');
        setDeparture('');
        setDestination('');
        setTripDate('');
        setPreviousRefuelLogged(false);
        setFullTank(true);
      }
    }
  }, [visible, expenseId, categoryId, existingExpense, currentUserId, fuelHistory]);

  // Load cars on mount
  useEffect(() => {
    const loadCars = async () => {
      try {
        setLoading(true);
        const carsList = await getAllCars();
        console.log('🚗 [ExpenseDetail] Loaded cars:', carsList);
        setCars(carsList);
      } catch (error) {
        console.error('❌ Error loading cars:', error);
        const cachedCars = await getCachedCars();
        console.log('📦 [ExpenseDetail] Using cached cars:', cachedCars);
        setCars(cachedCars);
      } finally {
        setLoading(false);
      }
    };
    if (visible) {
      loadCars();
    }
  }, [visible]);

  // Calculate litres and cost/km when values change
  const litresFilled = useMemo(() => {
    const litresValue = parseFloat(liters);
    if (!Number.isNaN(litresValue)) return litresValue;
    if (!costPerLiter || !totalCost) return null;
    return parseFloat(totalCost) / parseFloat(costPerLiter);
  }, [liters, costPerLiter, totalCost]);

  const costPerKm = useMemo(() => {
    if (!fullTank || !litresFilled || !mileage) return null;
    const kmSinceLast = parseFloat(mileage);
    if (kmSinceLast === 0) return null;
    return litresFilled / kmSinceLast;
  }, [fullTank, litresFilled, mileage]);

  // Fuel math helpers
  const handleLitersChange = (value) => {
    lastEditedRef.current = 'liters';
    setLiters(value);
    const litersNum = parseFloat(value);
    const cplNum = parseFloat(costPerLiter);
    if (!Number.isNaN(litersNum) && !Number.isNaN(cplNum)) {
      setTotalCost((litersNum * cplNum).toFixed(2));
    }
  };

  const handleTotalCostChange = (value) => {
    lastEditedRef.current = 'total';
    setTotalCost(value);
    const totalNum = parseFloat(value);
    const cplNum = parseFloat(costPerLiter);
    if (!Number.isNaN(totalNum) && !Number.isNaN(cplNum) && cplNum !== 0) {
      setLiters((totalNum / cplNum).toFixed(2));
    }
  };

  const handleCostPerLiterChange = (value) => {
    setCostPerLiter(value);
    const cplNum = parseFloat(value);
    if (Number.isNaN(cplNum) || cplNum === 0) return;
    if (lastEditedRef.current === 'liters') {
      const litersNum = parseFloat(liters);
      if (!Number.isNaN(litersNum)) {
        setTotalCost((litersNum * cplNum).toFixed(2));
      }
    } else if (lastEditedRef.current === 'total') {
      const totalNum = parseFloat(totalCost);
      if (!Number.isNaN(totalNum)) {
        setLiters((totalNum / cplNum).toFixed(2));
      }
    }
  };

  // Station autofill from history
  useEffect(() => {
    if (!stationName) return;
    const vat = stationIndex.byName[stationName.trim().toLowerCase()];
    if (vat && stationUpdateRef.current !== 'vat') {
      stationUpdateRef.current = 'name';
      setVatNumber((prev) => (prev === vat ? prev : vat));
    }
    stationUpdateRef.current = null;
  }, [stationName, stationIndex]);

  useEffect(() => {
    if (!vatNumber) return;
    const name = stationIndex.byVat[vatNumber.trim()];
    if (name && stationUpdateRef.current !== 'name') {
      stationUpdateRef.current = 'vat';
      setStationName((prev) => (prev === name ? prev : name));
    }
    stationUpdateRef.current = null;
  }, [vatNumber, stationIndex]);

  const handleSave = async () => {
    const baseDate = parseDateDDMMYYYY(date);
    let isoDate = baseDate ? new Date(baseDate) : new Date();
    if (time && time.includes(':')) {
      const [h, m] = time.split(':').map((x) => parseInt(x, 10));
      isoDate.setHours(h || 0, m || 0, 0, 0);
    }
    // For fuel/adblue, use totalCost as amount; for others, use the amount field
    const expenseAmount = (category === 'fuel' || category === 'adblue') && totalCost ? parseFloat(totalCost) : parseFloat(amount);
    
    // Build expense data with all fields (avoid undefined to ensure Firestore persists them)
    const expenseData = {
      category,
      amount: expenseAmount,
      date: isoDate.toISOString(),
      description: description || '',
      status: EXPENSE_STATUS.DRAFT, // Always draft until weekly report submission
      paymentMethod: paymentMethod || 'cash',
      salesmanId: selectedSalesman,
      invoiceType: invoiceType || 'receipt',
    };

    // Add category-specific fields
    if (category === 'fuel' || category === 'adblue') {
      expenseData.carId = selectedCar || '';
      expenseData.fuelType = fuelType || '';
      expenseData.mileage = mileage ? parseFloat(mileage) : 0;
      expenseData.stationName = stationName || '';
      expenseData.vatNumber = vatNumber || '';
      expenseData.costPerLiter = costPerLiter ? parseFloat(costPerLiter) : 0;
      expenseData.liters = liters ? parseFloat(liters) : 0;
      expenseData.totalCost = totalCost ? parseFloat(totalCost) : 0;
      expenseData.previousRefuelLogged = previousRefuelLogged;
      expenseData.fullTank = category === 'fuel' ? fullTank : false;
      // Only include costPerKm if previousRefuelLogged is false (not marked as missed)
      if (!previousRefuelLogged && costPerKm) {
        expenseData.costPerKm = parseFloat(costPerKm);
      }
    } else if (category === 'car_service') {
      expenseData.carId = selectedCar || '';
      expenseData.serviceTypes = selectedServiceTypes || [];
      expenseData.serviceNotes = serviceNotes || '';
    } else if (category === 'hotel') {
      expenseData.hotelName = hotelName || '';
      expenseData.nights = nights ? parseInt(nights, 10) : 0;
    } else if (category === 'tickets' || category === 'taxi') {
      expenseData.departure = departure || '';
      expenseData.destination = destination || '';
      if (category === 'tickets') {
        expenseData.tripDate = tripDate || '';
      }
    }

    const { valid, errors } = validateExpense(expenseData);
    if (!valid) {
      Alert.alert('Σφάλμα', errors.join('\n'));
      return;
    }

    try {
      setSaving(true);
      if (existingExpense) {
        await updateExistingExpense(expenseId, expenseData);
      } else {
        await addNewExpense(expenseData);
      }
      onClose();
    } catch (error) {
      Alert.alert('Σφάλμα', 'Αποτυχία αποθήκευσης εξόδου: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const getSelectedCarLabel = () => {
    if (!selectedCar) return 'Επιλέξτε Αυτοκίνητο';
    const car = cars.find(c => c.id === selectedCar);
    return car ? `${car.color} ${car.make} ${car.model} (${car.licensePlate})` : 'Επιλέξτε Αυτοκίνητο';
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: TOKENS.pageBackground }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{existingExpense ? 'Επεξεργασία Εξόδου' : 'Νέο Έξοδο'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView 
          style={styles.container} 
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
        {/* CATEGORY SELECTION - HIDDEN, passed via props */}

        {/* SALESMAN SELECTION - ONLY FOR MANAGERS */}
        {isExpenseApproverRole(userRole) && availableSalesmen && availableSalesmen.length > 0 && (
          <>
            <Text style={styles.label}>Πωλητής</Text>
            <View style={styles.paymentMethodRow}>
              {availableSalesmen.map((salesman) => (
                <TouchableOpacity
                  key={salesman.id}
                  style={[styles.statusChip, selectedSalesman === salesman.id && styles.statusChipSelected]}
                  onPress={() => setSelectedSalesman(salesman.id)}
                >
                  <Text style={[styles.statusText, selectedSalesman === salesman.id && styles.statusTextSelected]}>
                    {salesman.name || salesman.email}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* PAYMENT METHOD - DROPDOWN */}
        <Text style={styles.label}>Τρόπος Πληρωμής</Text>
        <TouchableOpacity
          style={styles.dropdown}
          onPress={() => {
            Alert.alert('Τρόπος Πληρωμής', '', [
              ...Object.entries(PAYMENT_METHOD_LABELS).map(([methodId, label]) => ({
                text: label,
                onPress: () => setPaymentMethod(methodId),
              })),
            ]);
          }}
        >
          <Text style={{ color: paymentMethod ? TOKENS.textPrimary : '#CBD5E1', fontSize: 14 }}>
            {PAYMENT_METHOD_LABELS[paymentMethod] || 'Επιλέξτε'}
          </Text>
        </TouchableOpacity>

        {/* Invoice vs Receipt */}
        <Text style={styles.label}>Παραστατικό</Text>
        <View style={styles.paymentMethodRow}>
          {Object.entries(INVOICE_TYPE_LABELS).map(([typeId, label]) => (
            <TouchableOpacity
              key={typeId}
              style={[styles.statusChip, invoiceType === typeId && styles.statusChipSelected]}
              onPress={() => setInvoiceType(typeId)}
            >
              <Text style={[styles.statusText, invoiceType === typeId && styles.statusTextSelected]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* DATE AND TIME IN ONE ROW */}
        <View style={styles.rowContainer}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.label}>Ημερομηνία</Text>
            <TextInput
              style={styles.input}
              placeholder="DD/MM/YYYY"
              value={date}
              onChangeText={setDate}
              placeholderTextColor="#CBD5E1"
            />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.label}>Ώρα</Text>
            <TextInput
              style={styles.input}
              placeholder="HH:MM"
              value={time}
              onChangeText={setTime}
              placeholderTextColor="#CBD5E1"
            />
          </View>
        </View>

        {/* BASIC FIELDS - shown only if not fuel */}
        {category !== 'fuel' && (
          <>
            <Text style={styles.label}>Ποσό (€)</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholderTextColor="#CBD5E1"
            />

            <Text style={styles.label}>Περιγραφή</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Σημειώσεις (προαιρετικό)"
              value={description}
              onChangeText={setDescription}
              multiline
              placeholderTextColor="#CBD5E1"
            />
          </>
        )}

        {/* DYNAMIC FIELDS - FUEL */}
        {category === 'fuel' && (
          <>
            <Text style={styles.categoryHeading}>⛽ Καύσιμα</Text>

            {/* Car & Fuel Type Selection */}
            <Text style={styles.label}>Αυτοκίνητο</Text>
            <TouchableOpacity style={styles.input} onPress={() => setCarsModalVisible(true)}>
              <Text style={{ color: selectedCar ? TOKENS.textPrimary : '#CBD5E1' }}>
                {getSelectedCarLabel()}
              </Text>
            </TouchableOpacity>

            {/* Odometer with last value hint */}
            <Text style={styles.label}>Οδόμετρο</Text>
            <TextInput
              style={styles.input}
              placeholder="Χιλιόμετρα"
              value={mileage}
              onChangeText={setMileage}
              keyboardType="number-pad"
              placeholderTextColor="#CBD5E1"
            />
            {lastOdometer !== null && (
              <Text style={styles.helperText}>
                Τελευταία: {lastOdometer} km
              </Text>
            )}

            {/* Fuel Type Dropdown */}
            <Text style={styles.label}>Τύπος Καυσίμου</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => {
                Alert.alert('Τύπος Καυσίμου', '', [
                  ...Object.entries(FUEL_TYPE_LABELS).map(([typeId, label]) => ({
                    text: label,
                    onPress: () => setFuelType(typeId),
                  })),
                ]);
              }}
            >
              <Text style={{ color: fuelType ? TOKENS.textPrimary : '#CBD5E1', fontSize: 14 }}>
                {FUEL_TYPE_LABELS[fuelType] || 'Επιλέξτε'}
              </Text>
            </TouchableOpacity>

            {/* Price/L, Total Cost, Liters in one row */}
            <View style={styles.rowContainer}>
              <View style={{ flex: 1, marginRight: 6 }}>
                <Text style={[styles.label, { fontSize: 12 }]}>€/L</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  value={costPerLiter}
                  onChangeText={handleCostPerLiterChange}
                  keyboardType="decimal-pad"
                  placeholderTextColor="#CBD5E1"
                />
              </View>
              <View style={{ flex: 1, marginHorizontal: 6 }}>
                <Text style={[styles.label, { fontSize: 12 }]}>Σύνολο (€)</Text>
                <TextInput
                  style={[styles.input, styles.computedInput]}
                  placeholder="0.00"
                  value={totalCost}
                  onChangeText={handleTotalCostChange}
                  keyboardType="decimal-pad"
                  placeholderTextColor="#A5B4FC"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 6 }}>
                <Text style={[styles.label, { fontSize: 12 }]}>L</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  value={liters}
                  onChangeText={handleLitersChange}
                  keyboardType="decimal-pad"
                  placeholderTextColor="#CBD5E1"
                />
              </View>
            </View>

            {/* Toggles: Filled Tank (Yes default), Missed Refuel (No default) */}
            <View style={styles.checkboxRow}>
              <View style={styles.checkboxItem}>
                <Switch value={fullTank} onValueChange={setFullTank} />
                <Text style={styles.checkboxLabel}>Γεμίσατε τη δεξαμενή;</Text>
              </View>
            </View>

            <View style={styles.checkboxRow}>
              <View style={styles.checkboxItem}>
                <Switch value={previousRefuelLogged} onValueChange={setPreviousRefuelLogged} />
                <Text style={styles.checkboxLabel}>Απώλεια προηγούμενου</Text>
              </View>
            </View>

            {/* Station Name & VAT in one row */}
            <View style={styles.rowContainer}>
              <View style={{ flex: 1.2, marginRight: 8 }}>
                <Text style={[styles.label, { fontSize: 12 }]}>Όνομα Πρατηρίου</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Όνομα"
                  value={stationName}
                  onChangeText={setStationName}
                  placeholderTextColor="#CBD5E1"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={[styles.label, { fontSize: 12 }]}>ΑΦΜ</Text>
                <TextInput
                  style={styles.input}
                  placeholder="ΑΦΜ"
                  value={vatNumber}
                  onChangeText={setVatNumber}
                  placeholderTextColor="#CBD5E1"
                  keyboardType="number-pad"
                />
              </View>
            </View>

            {/* Info cards */}
            {litresFilled !== null && (
              <View style={[styles.infoBox, { marginTop: 8 }]}>
                <Text style={styles.infoLabel}>Λίτρα που εγχύθησαν</Text>
                <Text style={styles.infoValue}>{litresFilled.toFixed(2)} L</Text>
              </View>
            )}

            {costPerKm && (
              <View style={[styles.infoBox, { marginTop: 6 }]}>
                <Text style={styles.infoLabel}>Κόστος ανά χλμ</Text>
                <Text style={styles.infoValue}>€{costPerKm.toFixed(3)}/km</Text>
              </View>
            )}
          </>
        )}

        {/* DYNAMIC FIELDS - CAR SERVICE */}
        {category === 'car_service' && (
          <>
            <Text style={styles.categoryHeading}>🔧 Service</Text>

            <Text style={styles.label}>Αυτοκίνητο</Text>
            <TouchableOpacity style={styles.input} onPress={() => setCarsModalVisible(true)}>
              <Text style={{ color: selectedCar ? TOKENS.textPrimary : '#CBD5E1' }}>
                {getSelectedCarLabel()}
              </Text>
            </TouchableOpacity>

            <Text style={styles.label}>Τύπος Service</Text>
            <ScrollView style={{ maxHeight: 200, marginBottom: 10 }} nestedScrollEnabled>
              {Object.entries(SERVICE_TYPE_LABELS).map(([typeId, label]) => (
                <TouchableOpacity
                  key={typeId}
                  style={styles.checkboxItem}
                  onPress={() => {
                    setSelectedServiceTypes((prev) =>
                      prev.includes(typeId) ? prev.filter((t) => t !== typeId) : [...prev, typeId]
                    );
                  }}
                >
                  <View style={[styles.checkbox, selectedServiceTypes.includes(typeId) && styles.checkboxChecked]}>
                    {selectedServiceTypes.includes(typeId) && <Text style={styles.checkboxCheck}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxLabel}>{label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Σημειώσεις Service (προαιρετικό)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Επιπλέον σημειώσεις"
              value={serviceNotes}
              onChangeText={setServiceNotes}
              multiline
              placeholderTextColor="#CBD5E1"
            />
          </>
        )}

        {/* DYNAMIC FIELDS - HOTEL */}
        {category === 'hotel' && (
          <>
            <Text style={styles.categoryHeading}>🏨 Ξενοδοχείο</Text>

            <Text style={styles.label}>Όνομα Ξενοδοχείου</Text>
            <TextInput
              style={styles.input}
              placeholder="Όνομα ξενοδοχείου"
              value={hotelName}
              onChangeText={setHotelName}
              placeholderTextColor="#CBD5E1"
            />

            <Text style={styles.label}>Αριθμός Νυχτών</Text>
            <TextInput
              style={styles.input}
              placeholder="Νύχτες"
              value={nights}
              onChangeText={setNights}
              keyboardType="number-pad"
              placeholderTextColor="#CBD5E1"
            />
          </>
        )}

        {/* DYNAMIC FIELDS - TICKETS */}
        {category === 'tickets' && (
          <>
            <Text style={styles.categoryHeading}>🎫 Εισιτήριο</Text>

            <Text style={styles.label}>Αναχώρηση</Text>
            <TextInput
              style={styles.input}
              placeholder="Πόλη/Αερολιμένας αναχώρησης"
              value={departure}
              onChangeText={setDeparture}
              placeholderTextColor="#CBD5E1"
            />

            <Text style={styles.label}>Προορισμός</Text>
            <TextInput
              style={styles.input}
              placeholder="Πόλη/Αερολιμένας προορισμού"
              value={destination}
              onChangeText={setDestination}
              placeholderTextColor="#CBD5E1"
            />

            <Text style={styles.label}>Ημερομηνία Ταξιδιού</Text>
            <TextInput
              style={styles.input}
              placeholder="DD/MM/YYYY"
              value={tripDate}
              onChangeText={setTripDate}
              placeholderTextColor="#CBD5E1"
            />
          </>
        )}

        {/* DYNAMIC FIELDS - TAXI */}
        {category === 'taxi' && (
          <>
            <Text style={styles.categoryHeading}>🚕 Ταξί</Text>

            <Text style={styles.label}>Αναχώρηση</Text>
            <TextInput
              style={styles.input}
              placeholder="Σημείο αναχώρησης"
              value={departure}
              onChangeText={setDeparture}
              placeholderTextColor="#CBD5E1"
            />

            <Text style={styles.label}>Προορισμός</Text>
            <TextInput
              style={styles.input}
              placeholder="Σημείο προορισμού"
              value={destination}
              onChangeText={setDestination}
              placeholderTextColor="#CBD5E1"
            />
          </>
        )}

        {/* SAVE BUTTON */}
        <TouchableOpacity style={[styles.primaryButton, saving && styles.buttonDisabled]} onPress={handleSave} disabled={saving}>
          <Text style={styles.primaryButtonText}>{saving ? 'Αποθήκευση...' : 'Αποθήκευση'}</Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* CARS SELECTION MODAL */}
      <Modal visible={carsModalVisible} transparent animationType="slide" onRequestClose={() => setCarsModalVisible(false)}>
        <View style={styles.modalContainer}>
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
                  style={[styles.carItem, selectedCar === item.id && styles.carItemSelected]}
                  onPress={() => {
                    setSelectedCar(item.id);
                    setCarsModalVisible(false);
                  }}
                >
                  <Text style={styles.carItemText}>{item.color}</Text>
                  <Text style={styles.carItemText}>{item.make} {item.model}</Text>
                  <Text style={styles.carItemLicense}>{item.licensePlate}</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingVertical: 12,
    backgroundColor: TOKENS.surface,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.borderSoft
  },
  closeButton: { 
    width: 40, 
    height: 40, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  closeButtonText: { 
    fontSize: 24, 
    color: TOKENS.textSecondary 
  },
  headerTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: TOKENS.textPrimary 
  },
  container: { flex: 1, backgroundColor: TOKENS.pageBackground, padding: 12 },
  label: { fontSize: 13, fontWeight: '600', color: TOKENS.textPrimary, marginTop: 10, marginBottom: 4 },
  categoryHeading: {
    marginTop: 16,
    marginBottom: 6,
    fontSize: 14,
    fontWeight: '700',
    color: TOKENS.primaryBlue,
  },
  helperText: {
    marginTop: 4,
    color: TOKENS.textSecondary,
    fontSize: 12,
  },
  groupBlock: { marginBottom: 10 },
  groupTitle: { fontSize: 12, fontWeight: '600', color: TOKENS.textSecondary, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: TOKENS.surface, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: TOKENS.borderSoft },
  chipSelected: { backgroundColor: TOKENS.primaryBlue, borderColor: TOKENS.primaryBlue },
  chipText: { color: TOKENS.textPrimary, fontSize: 13 },
  chipTextSelected: { color: TOKENS.lightBlueText },
  dropdown: { backgroundColor: TOKENS.surface, borderWidth: 1, borderColor: TOKENS.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center', minHeight: 40 },
  rowContainer: { flexDirection: 'row', marginTop: 10, marginBottom: 6 },
  input: { backgroundColor: TOKENS.surface, borderWidth: 1, borderColor: TOKENS.border, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: TOKENS.textPrimary },
  computedInput: { backgroundColor: TOKENS.lightBlueBg, borderColor: '#c9ddf2' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  paymentMethodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  statusChip: { borderWidth: 1, borderColor: TOKENS.border, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: TOKENS.surface },
  statusChipSelected: { backgroundColor: TOKENS.lightBlueBg, borderColor: '#c9ddf2' },
  statusText: { color: TOKENS.textPrimary, fontSize: 13 },
  statusTextSelected: { color: TOKENS.primaryBlue, fontWeight: '700' },
  infoBox: { backgroundColor: TOKENS.lightBlueBg, padding: 12, borderRadius: 10, marginTop: 12, marginBottom: 12, borderWidth: 1, borderColor: '#c9ddf2' },
  infoLabel: { fontSize: 12, color: TOKENS.primaryBlue, marginBottom: 4 },
  infoValue: { fontSize: 18, fontWeight: '700', color: TOKENS.primaryBlue },
  checkboxRow: { marginTop: 12, marginBottom: 12 },
  checkboxItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, backgroundColor: TOKENS.surface, borderRadius: 12, paddingHorizontal: 10, borderWidth: 1, borderColor: TOKENS.borderSoft },
  checkboxLabel: { marginLeft: 12, color: TOKENS.textPrimary, fontSize: 14 },
  checkbox: { width: 20, height: 20, borderWidth: 2, borderColor: TOKENS.border, borderRadius: 4, justifyContent: 'center', alignItems: 'center', backgroundColor: TOKENS.surface },
  checkboxChecked: { backgroundColor: TOKENS.primaryBlue, borderColor: TOKENS.primaryBlue },
  checkboxCheck: { color: TOKENS.surface, fontSize: 14, fontWeight: '700' },
  primaryButton: { backgroundColor: TOKENS.primaryBlue, paddingVertical: 14, alignItems: 'center', borderRadius: 12, marginTop: 20 },
  primaryButtonText: { color: TOKENS.surface, fontWeight: '700', fontSize: 15 },
  buttonDisabled: { opacity: 0.7 },
  modalContainer: { flex: 1, backgroundColor: TOKENS.pageBackground, marginTop: 60 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: TOKENS.surface, borderBottomWidth: 1, borderBottomColor: TOKENS.borderSoft },
  modalTitle: { fontSize: 18, fontWeight: '700', color: TOKENS.textPrimary },
  modalCloseButton: { fontSize: 24, color: TOKENS.textSecondary },
  carItem: { backgroundColor: TOKENS.surface, padding: 14, borderBottomWidth: 1, borderBottomColor: TOKENS.borderSoft },
  carItemSelected: { backgroundColor: TOKENS.lightBlueBg },
  carItemText: { fontSize: 14, fontWeight: '600', color: TOKENS.textPrimary },
  carItemLicense: { fontSize: 13, color: TOKENS.textSecondary, marginTop: 4 }
});

export default ExpenseDetailModal;
