import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Modal, FlatList, Switch, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
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
  parseDateDDMMYYYY
} from '../constants/expenseConstants';
import { useExpense } from '../context/ExpenseContext';
import { isExpenseApproverRole } from '../constants/roles';
import { getAllCars, getCachedCars } from '../services/carsService';

const TOKENS = {
  primaryBlue: '#185FA5',
  lightBlueBg: '#E6F1FB',
  pageBackground: '#f7f5f0',
  surface: '#fff',
  border: '#e0ddd6',
  borderSoft: '#e8e5de',
  textPrimary: '#1a1a1a',
  textSecondary: '#888',
};

const statusOptions = [
  { id: EXPENSE_STATUS.DRAFT, label: 'Πρόχειρο' },
  { id: EXPENSE_STATUS.SUBMITTED, label: 'Υποβληθέν' },
  { id: EXPENSE_STATUS.APPROVED, label: 'Εγκεκριμένο' }
];

const ExpenseDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { expenseId, categoryId } = route.params || {};
  const { expenses, addNewExpense, updateExistingExpense, currentUserId, userRole, availableSalesmen } = useExpense();

  const existingExpense = useMemo(() => expenses.find((e) => e.id === expenseId), [expenses, expenseId]);

  // Basic fields
  const [category, setCategory] = useState(existingExpense?.category || categoryId || getAllCategories()[0]?.id || '');
  const [amount, setAmount] = useState(existingExpense ? String(existingExpense.amount) : '');
  const [date, setDate] = useState(existingExpense ? formatDateDDMMYYYY(new Date(existingExpense.date)) : formatDateDDMMYYYY(new Date()));
  const [description, setDescription] = useState(existingExpense?.description || '');
  const [status, setStatus] = useState(existingExpense?.status || EXPENSE_STATUS.DRAFT);
  const [paymentMethod, setPaymentMethod] = useState(existingExpense?.paymentMethod || PAYMENT_METHODS.CASH);
  const [selectedSalesman, setSelectedSalesman] = useState(existingExpense?.salesmanId || currentUserId || '');

  // Dynamic fields
  const [selectedCar, setSelectedCar] = useState(existingExpense?.carId || null);
  const [fuelType, setFuelType] = useState(existingExpense?.fuelType || FUEL_TYPES.UNLEADED);
  const [mileage, setMileage] = useState(existingExpense?.mileage?.toString() || '');
  const [vatNumber, setVatNumber] = useState(existingExpense?.vatNumber || '');
  const [costPerLiter, setCostPerLiter] = useState(existingExpense?.costPerLiter?.toString() || '');
  const [totalCost, setTotalCost] = useState(existingExpense?.totalCost?.toString() || '');
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
        // Fallback to cached cars
        const cachedCars = await getCachedCars();
        console.log('📦 [ExpenseDetail] Using cached cars:', cachedCars);
        setCars(cachedCars);
      } finally {
        setLoading(false);
      }
    };
    loadCars();
  }, []);

  // Calculate litres and cost/km when values change
  const litresFilled = useMemo(() => {
    if (!costPerLiter || !totalCost) return null;
    return parseFloat(totalCost) / parseFloat(costPerLiter);
  }, [costPerLiter, totalCost]);

  const costPerKm = useMemo(() => {
    if (!fullTank || !litresFilled || !mileage) return null;
    const kmSinceLast = parseFloat(mileage);
    if (kmSinceLast === 0) return null;
    return litresFilled / kmSinceLast;
  }, [fullTank, litresFilled, mileage]);

  const handleSave = async () => {
    const expenseData = {
      category,
      amount: parseFloat(amount),
      date: parseDateDDMMYYYY(date).toISOString(),
      description,
      status,
      paymentMethod,
      salesmanId: selectedSalesman,
      // Dynamic fields
      ...(EXPENSE_FIELDS[category] && {
        carId: selectedCar || null,
        fuelType: category === 'fuel' ? fuelType : undefined,
        mileage: mileage ? parseFloat(mileage) : undefined,
        vatNumber: vatNumber || undefined,
        costPerLiter: costPerLiter ? parseFloat(costPerLiter) : undefined,
        totalCost: totalCost ? parseFloat(totalCost) : undefined,
        costPerKm: costPerKm || undefined,
        serviceNotes: category === 'car_service' ? serviceNotes : undefined,
        hotelName: category === 'hotel' ? hotelName : undefined,
        nights: category === 'hotel' && nights ? parseInt(nights, 10) : undefined,
        departure: (category === 'tickets' || category === 'taxi') ? departure : undefined,
        destination: (category === 'tickets' || category === 'taxi') ? destination : undefined,
        tripDate: category === 'tickets' ? tripDate : undefined,
        previousRefuelLogged: (category === 'fuel' || category === 'adblue') ? previousRefuelLogged : undefined,
        fullTank: category === 'fuel' ? fullTank : undefined
      })
    };

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
      navigation.goBack();
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

  const goToExpenses = () => {
    try {
      navigation.navigate('ExpenseTracker');
    } catch (e) {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: TOKENS.pageBackground }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView 
          style={styles.container} 
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
        <TouchableOpacity onPress={goToExpenses} style={styles.backPill} activeOpacity={0.85}>
          <Ionicons name="chevron-back" size={18} color={TOKENS.primaryBlue} />
          <Text style={styles.backPillText}>Έξοδα</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{existingExpense ? 'Επεξεργασία Εξόδου' : 'Νέο Έξοδο'}</Text>

        {/* CATEGORY SELECTION */}
        <Text style={styles.label}>Κατηγορία</Text>
        {groupedCategories.map((group) => (
          <View key={group.group} style={styles.groupBlock}>
            <Text style={styles.groupTitle}>{group.group}</Text>
            <View style={styles.chipRow}>
              {group.categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.chip, category === cat.id && styles.chipSelected]}
                  onPress={() => setCategory(cat.id)}
                >
                  <Text style={[styles.chipText, category === cat.id && styles.chipTextSelected]}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

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

        {/* PAYMENT METHOD */}
        <Text style={styles.label}>Τρόπος Πληρωμής</Text>
        <View style={styles.paymentMethodRow}>
          {Object.entries(PAYMENT_METHOD_LABELS).map(([methodId, label]) => (
            <TouchableOpacity
              key={methodId}
              style={[styles.statusChip, paymentMethod === methodId && styles.statusChipSelected]}
              onPress={() => setPaymentMethod(methodId)}
            >
              <Text style={[styles.statusText, paymentMethod === methodId && styles.statusTextSelected]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* BASIC FIELDS */}
        <Text style={styles.label}>Ημερομηνία</Text>
        <TextInput
          style={styles.input}
          placeholder="DD/MM/YYYY"
          value={date}
          onChangeText={setDate}
          placeholderTextColor="#CBD5E1"
        />

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

        {/* DYNAMIC FIELDS - FUEL */}
        {category === 'fuel' && (
          <>
            <Text style={styles.sectionAccentTitle}>⛽ Καύσιμα</Text>

            <Text style={styles.label}>Αυτοκίνητο</Text>
            <TouchableOpacity style={styles.input} onPress={() => setCarsModalVisible(true)}>
              <Text style={[styles.selectInputText, !selectedCar && styles.selectInputPlaceholder]}>
                {getSelectedCarLabel()}
              </Text>
            </TouchableOpacity>

            <Text style={styles.label}>Τύπος Καυσίμου</Text>
            <View style={styles.paymentMethodRow}>
              {Object.entries(FUEL_TYPE_LABELS).map(([typeId, label]) => (
                <TouchableOpacity
                  key={typeId}
                  style={[styles.statusChip, fuelType === typeId && styles.statusChipSelected]}
                  onPress={() => setFuelType(typeId)}
                >
                  <Text style={[styles.statusText, fuelType === typeId && styles.statusTextSelected]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Χιλιόμετρα (κατά την ανεφοδίαση)</Text>
            <TextInput
              style={styles.input}
              placeholder="Χιλιόμετρα"
              value={mileage}
              onChangeText={setMileage}
              keyboardType="number-pad"
              placeholderTextColor="#CBD5E1"
            />

            <Text style={styles.label}>Βενζινάδικο</Text>
            <TextInput
              style={styles.input}
              placeholder="ΦΠΑ αριθμός"
              value={vatNumber}
              onChangeText={setVatNumber}
              placeholderTextColor="#CBD5E1"
            />

            <Text style={styles.label}>Κόστος ανά Λίτρο (€)</Text>
            <TextInput
              style={styles.input}
              placeholder="€/L"
              value={costPerLiter}
              onChangeText={setCostPerLiter}
              keyboardType="decimal-pad"
              placeholderTextColor="#CBD5E1"
            />

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

            {/* TOTAL FUEL COST SECTION */}
            <Text style={styles.sectionAccentTitleLarge}>💰 Συνολικό Κόστος Ανεφοδίασης</Text>
            <TextInput
              style={[styles.input, styles.emphasisInput]}
              placeholder="Σύνολο"
              value={totalCost}
              onChangeText={setTotalCost}
              keyboardType="decimal-pad"
              placeholderTextColor="#A5B4FC"
            />

            {litresFilled !== null && (
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>Λίτρα που εγχύθησαν</Text>
                <Text style={styles.infoValue}>{litresFilled.toFixed(2)} L</Text>
              </View>
            )}

            {costPerKm && (
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>Κόστος ανά χλμ</Text>
                <Text style={styles.infoValue}>€{costPerKm.toFixed(3)}/km</Text>
              </View>
            )}
          </>
        )}

        {/* DYNAMIC FIELDS - CAR SERVICE */}
        {category === 'car_service' && (
          <>
            <Text style={styles.sectionAccentTitle}>🔧 Service</Text>

            <Text style={styles.label}>Αυτοκίνητο</Text>
            <TouchableOpacity style={styles.input} onPress={() => setCarsModalVisible(true)}>
              <Text style={[styles.selectInputText, !selectedCar && styles.selectInputPlaceholder]}>
                {getSelectedCarLabel()}
              </Text>
            </TouchableOpacity>

            <Text style={styles.label}>Περιγραφή Service</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Τι περιλαμβάνει το service (π.χ. λάδι, φίλτρα, κ.α.)"
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
            <Text style={styles.sectionAccentTitle}>🏨 Ξενοδοχείο</Text>

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
            <Text style={styles.sectionAccentTitle}>🎫 Εισιτήριο</Text>

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
            <Text style={styles.sectionAccentTitle}>🚕 Ταξί</Text>

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

        {/* STATUS */}
        <Text style={styles.label}>Κατάσταση</Text>
        <View style={styles.statusRow}>
          {statusOptions.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={[styles.statusChip, status === opt.id && styles.statusChipSelected]}
              onPress={() => setStatus(opt.id)}
            >
              <Text style={[styles.statusText, status === opt.id && styles.statusTextSelected]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* SAVE BUTTON */}
        <TouchableOpacity style={[styles.primaryButton, saving && styles.buttonDisabled]} onPress={handleSave} disabled={saving}>
          <Text style={styles.primaryButtonText}>{saving ? 'Αποθήκευση...' : 'Αποθήκευση'}</Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* CARS SELECTION MODAL */}
      <Modal visible={carsModalVisible} transparent animationType="slide" onRequestClose={() => setCarsModalVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Επιλέξτε Αυτοκίνητο</Text>
            <TouchableOpacity onPress={() => setCarsModalVisible(false)}>
              <Text style={styles.modalCloseButton}>✕</Text>
            </TouchableOpacity>
          </View>
          {cars.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
              <Text style={{ fontSize: 16, color: '#6B7280', textAlign: 'center' }}>
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
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: TOKENS.pageBackground, padding: 16 },
  backPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: TOKENS.lightBlueBg,
    borderWidth: 1,
    borderColor: TOKENS.borderSoft,
    marginBottom: 12,
  },
  backPillText: { color: TOKENS.primaryBlue, fontWeight: '800', fontSize: 12 },
  title: { fontSize: 22, fontWeight: '700', color: TOKENS.textPrimary, marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '600', color: TOKENS.textPrimary, marginTop: 14, marginBottom: 6 },
  groupBlock: { marginBottom: 10 },
  groupTitle: { fontSize: 12, fontWeight: '600', color: TOKENS.textSecondary, marginBottom: 8 },
  sectionAccentTitle: { marginTop: 16, fontWeight: '700', color: TOKENS.primaryBlue, fontSize: 14 },
  sectionAccentTitleLarge: { marginTop: 20, fontWeight: '700', fontSize: 15, color: TOKENS.primaryBlue },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: TOKENS.pageBackground, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: TOKENS.border },
  chipSelected: { backgroundColor: TOKENS.primaryBlue, borderColor: TOKENS.primaryBlue },
  chipText: { color: TOKENS.textPrimary, fontSize: 13 },
  chipTextSelected: { color: '#FFF' },
  input: { backgroundColor: TOKENS.surface, borderWidth: 1, borderColor: TOKENS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  emphasisInput: { backgroundColor: TOKENS.lightBlueBg, fontWeight: '600', fontSize: 15 },
  selectInputText: { color: TOKENS.textPrimary },
  selectInputPlaceholder: { color: '#CBD5E1' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  paymentMethodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  statusChip: { borderWidth: 1, borderColor: TOKENS.border, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: TOKENS.surface },
  statusChipSelected: { backgroundColor: TOKENS.lightBlueBg, borderColor: TOKENS.primaryBlue },
  statusText: { color: TOKENS.textPrimary, fontSize: 13 },
  statusTextSelected: { color: TOKENS.primaryBlue, fontWeight: '700' },
  infoBox: { backgroundColor: TOKENS.lightBlueBg, padding: 12, borderRadius: 10, marginTop: 12, marginBottom: 12 },
  infoLabel: { fontSize: 12, color: TOKENS.primaryBlue, marginBottom: 4 },
  infoValue: { fontSize: 18, fontWeight: '700', color: TOKENS.primaryBlue },
  checkboxRow: { marginTop: 12, marginBottom: 12 },
  checkboxItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  checkboxLabel: { marginLeft: 12, color: TOKENS.textPrimary, fontSize: 14 },
  primaryButton: { backgroundColor: TOKENS.primaryBlue, paddingVertical: 14, alignItems: 'center', borderRadius: 12, marginTop: 20 },
  primaryButtonText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  buttonDisabled: { opacity: 0.7 },
  modalContainer: { flex: 1, backgroundColor: TOKENS.pageBackground },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: TOKENS.surface, borderBottomWidth: 1, borderBottomColor: TOKENS.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: TOKENS.textPrimary },
  modalCloseButton: { fontSize: 24, color: TOKENS.textSecondary },
  carItem: { backgroundColor: TOKENS.surface, padding: 14, borderBottomWidth: 1, borderBottomColor: TOKENS.border },
  carItemSelected: { backgroundColor: TOKENS.lightBlueBg },
  carItemText: { fontSize: 14, fontWeight: '600', color: TOKENS.textPrimary },
  carItemLicense: { fontSize: 13, color: TOKENS.textSecondary, marginTop: 4 }
});

export default ExpenseDetailScreen;
