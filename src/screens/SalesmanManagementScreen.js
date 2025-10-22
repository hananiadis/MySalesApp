import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';

import SafeScreen from '../components/SafeScreen';
import { useAuth, ROLES } from '../context/AuthProvider';

const MANAGEMENT_ROLES = [ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER];
const AVAILABLE_BRANDS = ['playmobil', 'john', 'kivos'];
const BRAND_LABEL = {
  playmobil: 'Playmobil',
  john: 'John',
  kivos: 'Kivos',
};

const SalesmanManagementScreen = ({ navigation, route }) => {
  const { hasRole, profile } = useAuth();
  const { userId, userName, currentMerchIds = [] } = route.params || {};
  
  const canManageUsers = hasRole(MANAGEMENT_ROLES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draftMerchIds, setDraftMerchIds] = useState([]);
  const [allSalesmen, setAllSalesmen] = useState([]);
  const [salesmanSearch, setSalesmanSearch] = useState('');
  const [loadingSalesmen, setLoadingSalesmen] = useState(false);

  const adminBrands = useMemo(
    () => (Array.isArray(profile?.brands) ? profile.brands.filter(Boolean) : []),
    [profile?.brands]
  );
  const adminBrandSet = useMemo(() => new Set(adminBrands), [adminBrands]);
  const hasGlobalAccess = hasRole([ROLES.OWNER, ROLES.DEVELOPER]) || adminBrandSet.size === 0;
  const manageableBrands = useMemo(
    () => (hasGlobalAccess ? AVAILABLE_BRANDS : adminBrands),
    [hasGlobalAccess, adminBrands]
  );

  // Initialize draft with current merchIds
  useEffect(() => {
    setDraftMerchIds([...currentMerchIds]);
  }, [currentMerchIds]);

  // Load salesmen from Firestore
  const loadSalesmen = useCallback(async () => {
    if (!canManageUsers) return;
    
    setLoadingSalesmen(true);
    try {
      console.log('Loading salesmen for brands:', manageableBrands);
      
      let query = firestore().collection('salesmen');
      
      // Filter by manageable brands if not global access
      if (!hasGlobalAccess && manageableBrands.length > 0) {
        query = query.where('brand', 'in', manageableBrands);
      }
      
      const snapshot = await query.get();
      const salesmen = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        brand: doc.data().brand,
        merch: doc.data().merch,
        normalized: doc.data().normalized,
      }));
      
      console.log('Loaded salesmen:', salesmen.length);
      setAllSalesmen(salesmen);
    } catch (error) {
      console.error('Error loading salesmen:', error);
      Alert.alert('Σφάλμα', 'Σφάλμα προέκυψε πρόβλημα κατα την φόρτωση πωλητών. ελέγξτε αν υπάρχει η συλλογή salesmen στη βαση δεδομένων.');
    } finally {
      setLoadingSalesmen(false);
      setLoading(false);
    }
  }, [canManageUsers, manageableBrands, hasGlobalAccess]);

  useEffect(() => {
    loadSalesmen();
  }, [loadSalesmen]);

  const toggleSalesman = useCallback((salesmanId) => {
    setDraftMerchIds(prev => {
      if (prev.includes(salesmanId)) {
        return prev.filter(id => id !== salesmanId);
      } else {
        return [...prev, salesmanId];
      }
    });
  }, []);

  const saveChanges = useCallback(async () => {
    if (!userId || !canManageUsers) return;
    
    setSaving(true);
    try {
      await firestore().collection('users').doc(userId).update({
        merchIds: draftMerchIds,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      
      Alert.alert('Επιτυχία', 'Οι αλλαγές αποθηκεύτηκαν επιτυχώς!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error saving salesman changes:', error);
      Alert.alert('Σφάλμα', 'Παρουσιάστηκε σφάλμα κατά την αποθήκευση των αλλαγών.');
    } finally {
      setSaving(false);
    }
  }, [userId, draftMerchIds, canManageUsers, navigation]);

  const filteredSalesmen = useMemo(() => {
    if (!salesmanSearch.trim()) return allSalesmen;
    
    const searchLower = salesmanSearch.toLowerCase();
    return allSalesmen.filter(salesman => 
      salesman.name.toLowerCase().includes(searchLower) ||
      (BRAND_LABEL[salesman.brand] || salesman.brand).toLowerCase().includes(searchLower)
    );
  }, [allSalesmen, salesmanSearch]);

  if (!canManageUsers) {
    return (
      <SafeScreen>
        <View style={styles.errorContainer}>
          <Ionicons name="lock-closed-outline" size={48} color="#ef4444" />
          <Text style={styles.errorText}>Δεν έχετε δικαίωμα πρόσβασης σε αυτή τη σελίδα</Text>
        </View>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Επιστροφή"
          >
            <Ionicons name="arrow-back" size={24} color="#1f4f8f" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Σύνδεση με Πωλητές</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* User Info */}
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{userName || 'Άγνωστος Χρήστης'}</Text>
          <Text style={styles.userSubtitle}>
            Επιλέξτε τους πωλητές που θέλετε να συνδέσετε με αυτόν τον χρήστη
          </Text>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Αναζήτηση πωλητών..."
            value={salesmanSearch}
            onChangeText={setSalesmanSearch}
            placeholderTextColor="#94a3b8"
          />
        </View>

        {/* Salesmen List */}
        <ScrollView style={styles.salesmenContainer} showsVerticalScrollIndicator={false}>
          {loadingSalesmen ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#1f4f8f" />
              <Text style={styles.loadingText}>Φόρτωση πωλητών...</Text>
            </View>
          ) : (
            <View style={styles.salesmenGrid}>
              {filteredSalesmen.map((salesman) => {
                const active = draftMerchIds.includes(salesman.id);
                return (
                  <TouchableOpacity
                    key={salesman.id}
                    style={[
                      styles.salesmanToggle,
                      active && styles.salesmanToggleActive,
                    ]}
                    onPress={() => toggleSalesman(salesman.id)}
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name={active ? 'checkbox-outline' : 'square-outline'}
                      size={20}
                      color={active ? '#1f4f8f' : '#64748b'}
                      style={styles.checkboxIcon}
                    />
                    <View style={styles.salesmanInfo}>
                      <Text
                        style={[
                          styles.salesmanToggleText,
                          active && styles.salesmanToggleTextActive,
                        ]}
                      >
                        {salesman.name}
                      </Text>
                      <Text style={styles.salesmanBrandText}>
                        {BRAND_LABEL[salesman.brand] || salesman.brand}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              {filteredSalesmen.length === 0 && !loadingSalesmen && (
                <View style={styles.emptyContainer}>
                  <Ionicons name="people-outline" size={48} color="#94a3b8" />
                  <Text style={styles.emptyText}>
                    {salesmanSearch ? 'Δεν βρέθηκαν πωλητές που να ταιριάζουν με την αναζήτηση' : 'Δεν βρέθηκαν πωλητές'}
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            disabled={saving}
          >
            <Text style={styles.cancelButtonText}>Ακύρωση</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={saveChanges}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Αποθήκευση</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerSpacer: {
    width: 40,
  },
  userInfo: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  userSubtitle: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  salesmenContainer: {
    flex: 1,
    marginHorizontal: 16,
    marginTop: 16,
  },
  salesmenGrid: {
    gap: 12,
  },
  salesmanToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  salesmanToggleActive: {
    borderColor: '#1f4f8f',
    backgroundColor: '#eef2ff',
  },
  checkboxIcon: {
    marginRight: 12,
  },
  salesmanInfo: {
    flex: 1,
  },
  salesmanToggleText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  salesmanToggleTextActive: {
    color: '#1f4f8f',
    fontWeight: '600',
  },
  salesmanBrandText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#1f4f8f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
  },
});

export default SalesmanManagementScreen;




