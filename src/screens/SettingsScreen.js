import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import SafeScreen from '../components/SafeScreen';
import { useAuth, ROLES } from '../context/AuthProvider';

const MANAGEMENT_ROLES = [ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER];

const ROLE_LABELS = {
  [ROLES.OWNER]: 'Ιδιοκτήτης',
  [ROLES.ADMIN]: 'Διαχειριστής',
  [ROLES.DEVELOPER]: 'Προγραμματιστής',
  [ROLES.SALES_MANAGER]: 'Υπεύθυνος Πωλήσεων',
  [ROLES.SALESMAN]: 'Πωλητής',
  [ROLES.WAREHOUSE_MANAGER]: 'Υπεύθυνος Αποθήκης',
  [ROLES.CUSTOMER]: 'Πελάτης',
};

const formatRole = (role) => ROLE_LABELS[role] || role || 'Άγνωστος';

const SettingsScreen = ({ navigation }) => {
  const { profile, signOut, hasRole } = useAuth();
  const canManageUsers = hasRole(MANAGEMENT_ROLES);

  const displayName = profile?.name?.trim() ? profile.name : 'Χωρίς όνομα';
  const email = profile?.email || '—';
  const brands = Array.isArray(profile?.brands) ? profile.brands : [];
  const roleLabel = formatRole(profile?.role);

  const handleSignOut = () => {
    Alert.alert(
      'Αποσύνδεση',
      'Θέλεις σίγουρα να αποσυνδεθείς;',
      [
        { text: 'Άκυρο', style: 'cancel' },
        {
          text: 'Αποσύνδεση',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              Alert.alert('Σφάλμα', 'Η αποσύνδεση απέτυχε. Δοκίμασε ξανά.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const headerLeft = (
    <TouchableOpacity
      style={styles.backButton}
      onPress={() => navigation.goBack()}
      accessibilityRole="button"
      accessibilityLabel="Πίσω"
    >
      <Ionicons name="arrow-back" size={22} color="#1f4f8f" />
    </TouchableOpacity>
  );

  return (
    <SafeScreen title="Ρυθμίσεις" headerLeft={headerLeft} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Λογαριασμός</Text>
          <View style={styles.card}>
            <Text style={styles.accountName}>{displayName}</Text>
            <Text style={styles.accountEmail}>{email}</Text>
            <View style={styles.roleBadge}>
              <Ionicons
                name="shield-checkmark-outline"
                size={16}
                color="#1f4f8f"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.roleBadgeText}>{roleLabel}</Text>
            </View>
            {brands.length > 0 && (
              <View style={styles.brandList}>
                {brands.map((brand) => (
                  <View key={brand} style={styles.brandChip}>
                    <Text style={styles.brandChipText}>{brand}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {canManageUsers && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Διαχείριση</Text>
            <TouchableOpacity
              style={styles.listItem}
              onPress={() => navigation.navigate('UserManagement')}
              accessibilityRole="button"
            >
              <View style={styles.listItemIcon}>
                <Ionicons name="people-outline" size={22} color="#1f4f8f" />
              </View>
              <View style={styles.listItemContent}>
                <Text style={styles.listItemTitle}>Διαχείριση χρηστών</Text>
                <Text style={styles.listItemSubtitle}>Προσθήκη, ρόλοι και δικαιώματα</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Ενέργειες</Text>
          <TouchableOpacity
            style={[styles.listItem, styles.dangerItem]}
            onPress={handleSignOut}
            accessibilityRole="button"
          >
            <View style={[styles.listItemIcon, styles.dangerIcon]}>
              <Ionicons name="log-out-outline" size={22} color="#E53935" />
            </View>
            <Text style={[styles.listItemTitle, styles.dangerText]}>Αποσύνδεση</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f6f8fa',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef4ff',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6b7da2',
    marginBottom: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e1e7f5',
    shadowColor: '#0f1c3f',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 2,
  },
  accountName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2d3d',
  },
  accountEmail: {
    fontSize: 15,
    color: '#4f5d75',
    marginTop: 6,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 14,
    backgroundColor: '#e8f2ff',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  roleBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f4f8f',
  },
  brandList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
  },
  brandChip: {
    backgroundColor: '#eef4ff',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
    marginBottom: 8,
  },
  brandChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f4f8f',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#e1e7f5',
    shadowColor: '#0f1c3f',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 1,
  },
  listItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e8f2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2d3d',
  },
  listItemSubtitle: {
    fontSize: 13,
    color: '#6b7da2',
    marginTop: 4,
  },
  dangerItem: {
    borderColor: '#ffd1d1',
    backgroundColor: '#fff7f7',
  },
  dangerIcon: {
    backgroundColor: '#ffe4e6',
  },
  dangerText: {
    color: '#E53935',
  },
});

export default SettingsScreen;
