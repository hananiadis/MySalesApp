// src/screens/BrandContactsScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeScreen from '../components/SafeScreen';
import colors from '../theme/colors';
import { fetchBrandContacts, groupContactsByDepartment, importContactsFromCSV } from '../services/brandContacts';

const BrandContactsScreen = ({ navigation, route }) => {
  const { brand } = route.params || {};
  
  const [contacts, setContacts] = useState([]);
  const [groupedContacts, setGroupedContacts] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDepartments, setExpandedDepartments] = useState({});
  const searchWasActive = useRef(false);

  useEffect(() => {
    if (brand) {
      loadContacts();
    }
  }, [brand]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await fetchBrandContacts(brand);
      setContacts(data);
    } catch (err) {
      console.error('[BrandContactsScreen] Error loading contacts:', err);
      setError('Αδυναμία φόρτωσης επαφών. Παρακαλώ δοκιμάστε ξανά.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const filtered = getFilteredContacts(contacts, searchQuery);
    const grouped = groupContactsByDepartment(filtered);
    setGroupedContacts(grouped);

    const searchActive = searchQuery.trim().length > 0;
    setExpandedDepartments(prev => {
      const next = {};
      Object.keys(grouped).forEach(dept => {
        if (searchActive) {
          next[dept] = true;
          return;
        }
        if (searchWasActive.current) {
          next[dept] = false;
          return;
        }
        if (typeof prev[dept] !== 'undefined') {
          next[dept] = prev[dept];
        } else {
          next[dept] = false;
        }
      });
      return next;
    });
    searchWasActive.current = searchActive;
  }, [contacts, searchQuery]);

  const getFilteredContacts = (data, query) => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return data;
    }

    return data.filter(contact => {
      return ['fullName', 'department', 'mobile', 'internal', 'fullPhone', 'email'].some(key => {
        const value = contact[key];
        return value && value.toString().toLowerCase().includes(trimmed);
      });
    });
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadContacts();
  };

  const handleImportContacts = async () => {
    Alert.alert(
      'Εισαγωγή Επαφών',
      `Θέλετε να εισάγετε επαφές από το CSV για το brand "${brand}"?\n\nΟι υπάρχουσες επαφές θα διαγραφούν.`,
      [
        { text: 'Ακύρωση', style: 'cancel' },
        {
          text: 'Εισαγωγή',
          style: 'destructive',
          onPress: async () => {
            try {
              setImporting(true);
              const result = await importContactsFromCSV(brand, true);
              Alert.alert(
                'Επιτυχία',
                `Εισήχθησαν ${result.imported} επαφές για το brand "${brand}".\nΔιαγράφηκαν ${result.cleared} παλιές επαφές.`
              );
              await loadContacts();
            } catch (err) {
              console.error('[BrandContactsScreen] Import error:', err);
              Alert.alert('Σφάλμα', 'Αποτυχία εισαγωγής επαφών: ' + err.message);
            } finally {
              setImporting(false);
            }
          },
        },
      ]
    );
  };

  const handleCall = (phoneNumber) => {
    if (!phoneNumber) {
      Alert.alert('Σφάλμα', 'Δεν υπάρχει διαθέσιμο τηλέφωνο');
      return;
    }

    // Clean phone number (remove spaces, dashes, etc.)
    const cleaned = phoneNumber.replace(/[\s\-()]/g, '');
    Linking.openURL(`tel:${cleaned}`);
  };

  const handleEmail = (email) => {
    if (!email) {
      Alert.alert('Σφάλμα', 'Δεν υπάρχει διαθέσιμο email');
      return;
    }

    Linking.openURL(`mailto:${email}`);
  };

  const handleViber = (phoneNumber) => {
    if (!phoneNumber) {
      Alert.alert('Σφάλμα', 'Δεν υπάρχει διαθέσιμο τηλέφωνο');
      return;
    }

    // Clean and format for Viber (add +30 if not present)
    let cleaned = phoneNumber.replace(/[\s\-()]/g, '');
    if (!cleaned.startsWith('+')) {
      cleaned = '+30' + cleaned;
    }

    Linking.openURL(`viber://chat?number=${cleaned}`);
  };

  const handleTeams = (email) => {
    if (!email) {
      Alert.alert('Σφάλμα', 'Δεν υπάρχει διαθέσιμο email');
      return;
    }

    // Open Teams chat with user
    Linking.openURL(`msteams://teams.microsoft.com/l/chat/0/0?users=${email}`);
  };

  const renderContactItem = ({ item }) => (
    <View style={styles.contactCard}>
      <View style={styles.contactHeader}>
        <Ionicons name="person-circle-outline" size={40} color={colors.primary} />
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.fullName}</Text>
          {item.department && (
            <Text style={styles.contactDepartment}>{item.department}</Text>
          )}
        </View>
      </View>

      <View style={styles.contactDetails}>
        {item.mobile && (
          <TouchableOpacity 
            style={styles.detailRow}
            onPress={() => handleCall(item.mobile)}
          >
            <Ionicons name="phone-portrait-outline" size={16} color="#6b7280" />
            <Text style={styles.detailText}>Κινητό: {item.mobile}</Text>
          </TouchableOpacity>
        )}
        
        {item.internal && (
          <TouchableOpacity 
            style={styles.detailRow}
            onPress={() => handleCall(item.internal)}
          >
            <Ionicons name="business-outline" size={16} color="#6b7280" />
            <Text style={styles.detailText}>Εσωτ.: {item.internal}</Text>
          </TouchableOpacity>
        )}

        {item.fullPhone && (
          <TouchableOpacity 
            style={styles.detailRow}
            onPress={() => handleCall(item.fullPhone)}
          >
            <Ionicons name="call-outline" size={16} color="#6b7280" />
            <Text style={styles.detailText}>{item.fullPhone}</Text>
          </TouchableOpacity>
        )}

        {item.email && (
          <TouchableOpacity 
            style={styles.detailRow}
            onPress={() => handleEmail(item.email)}
          >
            <Ionicons name="mail-outline" size={16} color="#6b7280" />
            <Text style={styles.detailText}>{item.email}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.contactActions}>
        {item.internal && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleCall(item.internal)}
          >
            <Ionicons name="business" size={20} color="#8b5cf6" />
            <Text style={styles.actionButtonText}>Εσωτ.</Text>
          </TouchableOpacity>
        )}

        {item.mobile && (
          <>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleCall(item.mobile)}
            >
              <Ionicons name="call" size={20} color="#10b981" />
              <Text style={styles.actionButtonText}>Κλήση</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleViber(item.mobile)}
            >
              <Ionicons name="chatbubbles" size={20} color="#7360f2" />
              <Text style={styles.actionButtonText}>Viber</Text>
            </TouchableOpacity>
          </>
        )}

        {item.email && (
          <>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleEmail(item.email)}
            >
              <Ionicons name="mail" size={20} color="#3b82f6" />
              <Text style={styles.actionButtonText}>Email</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleTeams(item.email)}
            >
              <Ionicons name="people" size={20} color="#5558af" />
              <Text style={styles.actionButtonText}>Teams</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  const toggleDepartment = (department) => {
    setExpandedDepartments(prev => ({
      ...prev,
      [department]: !prev[department],
    }));
  };

  const renderDepartmentSection = (department, contacts) => {
    const isExpanded = expandedDepartments[department] ?? true;

    return (
      <View key={department} style={styles.departmentSection}>
        <TouchableOpacity
          style={styles.departmentHeader}
          onPress={() => toggleDepartment(department)}
          activeOpacity={0.7}
        >
          <View style={styles.departmentTitleRow}>
            <Ionicons
              name={isExpanded ? 'chevron-down' : 'chevron-forward'}
              size={18}
              color={colors.textPrimary}
            />
            <Text style={styles.departmentTitle}>{department}</Text>
          </View>
          <Text style={styles.departmentCount}>{contacts.length}</Text>
        </TouchableOpacity>

        {isExpanded &&
          contacts.map((contact, index) => (
            <View key={`${department}-${index}`}>
              {renderContactItem({ item: contact })}
            </View>
          ))}
      </View>
    );
  };

  const visibleCount = Object.values(groupedContacts).reduce(
    (sum, list) => sum + list.length,
    0
  );

  if (loading && !refreshing) {
    return (
      <SafeScreen title="Επαφές" showBack>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Φόρτωση επαφών...</Text>
        </View>
      </SafeScreen>
    );
  }

  if (error) {
    return (
      <SafeScreen title="Επαφές" showBack>
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadContacts(true)}>
            <Text style={styles.retryButtonText}>Δοκιμάστε Ξανά</Text>
          </TouchableOpacity>
        </View>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen
      title="Επαφές Εταιρείας"
      showBack
      scroll
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={[colors.primary]}
        />
      }
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Επαφές Υπαλλήλων</Text>
          <Text style={styles.headerSubtitle}>
            {visibleCount} {visibleCount === 1 ? 'επαφή' : 'επαφές'} • Brand: {brand}
          </Text>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#6b7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Αναζήτηση επαφών σε όλα τα πεδία"
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Admin Import Button - Hidden in production */}
        {__DEV__ && (
          <TouchableOpacity
            style={styles.importButton}
            onPress={handleImportContacts}
            disabled={importing}
          >
            {importing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={20} color="#ffffff" />
                <Text style={styles.importButtonText}>Εισαγωγή από CSV</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {Object.keys(groupedContacts).length > 0 ? (
          Object.entries(groupedContacts).map(([department, deptContacts]) =>
            renderDepartmentSection(department, deptContacts)
          )
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>Δεν βρέθηκαν επαφές</Text>
          </View>
        )}
      </View>
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  departmentSection: {
    marginBottom: 24,
  },
  departmentTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    paddingHorizontal: 4,
  },
  departmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  departmentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  departmentCount: {
    fontSize: 13,
    color: colors.textSecondary,
    paddingHorizontal: 4,
  },
  contactCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactInfo: {
    marginLeft: 12,
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  contactDepartment: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  contactDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    fontSize: 14,
    color: '#4b5563',
    marginLeft: 8,
  },
  contactActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    gap: 6,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#9ca3af',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  importButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default BrandContactsScreen;
