import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Constants from 'expo-constants';
import SafeScreen from '../components/SafeScreen';
import { useAuth, ROLES } from '../context/AuthProvider';
import {
  listSpreadsheetMeta,
  refreshSpreadsheet,
  purgeSpreadsheet,
  clearAllMetaEntries,
} from '../services/spreadsheetCache';

const MANAGEMENT_ROLES = [ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER];

const BRAND_SHEETS = {
  playmobil: ['playmobilSales', 'playmobilStock', 'sales2026', 'orders2026', 'balance2026', 'sales2025', 'orders2025', 'balance2025', 'sales2024', 'orders2024'],
  kivos: ['kivosCustomers', 'kivosCredit', 'kivosSales2026', 'kivosSales2025', 'kivosSales2024', 'kivosSales2023', 'kivosSales2022'],
  john: ['supermarketInventory'],
};

const BRAND_LABELS = {
  playmobil: 'Playmobil',
  kivos: 'Kivos',
  john: 'John Hellas',
};

const SHEET_DISPLAY_NAMES = {
  playmobilSales: 'playmobilSales (weekly)',
};

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
  const [cacheMeta, setCacheMeta] = useState([]);
  const [cacheLoading, setCacheLoading] = useState(false);
  const [busyKey, setBusyKey] = useState(null);
  const [refreshingBrand, setRefreshingBrand] = useState(null);
  const [clearingMeta, setClearingMeta] = useState(false);

  const displayName = profile?.name?.trim() ? profile.name : 'Χωρίς όνομα';
  const email = profile?.email || '—';
  const brands = Array.isArray(profile?.brands) ? profile.brands : [];
  const roleLabel = formatRole(profile?.role);

  const loadCacheMeta = useCallback(async () => {
    console.log('[SettingsScreen] Loading cache metadata...');
    setCacheLoading(true);
    try {
      const meta = await listSpreadsheetMeta();
      console.log('[SettingsScreen] Cache meta loaded:', meta?.length || 0, 'entries');
      const clean = (meta || []).filter(Boolean);
      // Debug: log lastFetchedAt per tracked sheet
      try {
        const allTracked = [
          ...BRAND_SHEETS.playmobil,
          ...BRAND_SHEETS.kivos,
          ...BRAND_SHEETS.john,
        ];
        const summary = clean
          .filter(e => allTracked.includes(e?.key))
          .map(e => ({ key: e.key, lastFetchedAt: e?.meta?.lastFetchedAt, expiresAt: e?.meta?.expiresAt, ttlHours: e?.ttlHours, permanent: e?.permanent }));
        console.log('[SettingsScreen] Tracked meta summary:', summary);
      } catch (e) {
        console.warn('[SettingsScreen] Debug summary failed:', e?.message);
      }
      setCacheMeta(clean);
    } catch (error) {
      console.warn('[Settings] Failed to load cache meta', error?.message);
    } finally {
      setCacheLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCacheMeta();
  }, [loadCacheMeta]);

  const handleClearOldMetadata = async () => {
    console.log('[SettingsScreen] Clearing old metadata...');
    setClearingMeta(true);
    try {
      const res = await clearAllMetaEntries();
      console.log('[SettingsScreen] Metadata cleared:', res);
      // Add small delay to ensure metadata is cleared before reloading
      await new Promise(resolve => setTimeout(resolve, 200));
      await loadCacheMeta();
    } catch (error) {
      console.warn('[SettingsScreen] Clear metadata failed:', error?.message);
      Alert.alert('Σφάλμα', 'Ο καθαρισμός μεταδεδομένων απέτυχε.');
    } finally {
      setClearingMeta(false);
    }
  };

  const handleRefresh = async (key) => {
    console.log('[SettingsScreen] Refresh started for:', key);
    setBusyKey(key + ':refresh');
    try {
      const startTime = Date.now();
      console.log('[SettingsScreen] Calling refreshSpreadsheet...');
      const ok = await refreshSpreadsheet(key);
      
      // Ensure minimum 500ms for animation feedback
      const elapsed = Date.now() - startTime;
      if (elapsed < 500) {
        await new Promise(resolve => setTimeout(resolve, 500 - elapsed));
      }
      
      console.log('[SettingsScreen] Refresh result:', ok);
      if (!ok) {
        Alert.alert('Σφάλμα', 'Η ανανέωση απέτυχε.');
      }
    } catch (error) {
      console.error('[SettingsScreen] Refresh error:', error?.message);
      Alert.alert('Σφάλμα', 'Η ανανέωση απέτυχε.');
    } finally {
      console.log('[SettingsScreen] Reloading cache meta after refresh...');
      setBusyKey(null);
      // Add small delay to ensure metadata is written before reloading
      await new Promise(resolve => setTimeout(resolve, 200));
      await loadCacheMeta();
      console.log('[SettingsScreen] Refresh completed.');
    }
  };

  const handleRefreshBrand = async (brand) => {
    console.log('[SettingsScreen] Brand refresh started for:', brand);
    setRefreshingBrand(brand);
    try {
      const startTime = Date.now();
      const sheets = BRAND_SHEETS[brand] || [];
      console.log('[SettingsScreen] Refreshing', sheets.length, 'sheets for', brand);
      
      for (const key of sheets) {
        console.log('[SettingsScreen] Refreshing sheet:', key);
        await refreshSpreadsheet(key);
      }
      
      // Ensure minimum 800ms for animation feedback
      const elapsed = Date.now() - startTime;
      if (elapsed < 800) {
        await new Promise(resolve => setTimeout(resolve, 800 - elapsed));
      }
      
      console.log('[SettingsScreen] Brand refresh completed for:', brand);
    } catch (error) {
      console.error('[SettingsScreen] Brand refresh error:', error?.message);
      Alert.alert('Σφάλμα', `Η ανανέωση των ${BRAND_LABELS[brand]} απέτυχε.`);
    } finally {
      setRefreshingBrand(null);
      // Add small delay to ensure metadata is written before reloading
      await new Promise(resolve => setTimeout(resolve, 300));
      await loadCacheMeta();
      console.log('[SettingsScreen] Brand refresh UI updated.');
    }
  };

  const handlePurge = async (key) => {
    console.log('[SettingsScreen] Purge started for:', key);
    setBusyKey(key + ':purge');
    try {
      const startTime = Date.now();
      console.log('[SettingsScreen] Calling purgeSpreadsheet...');
      const ok = await purgeSpreadsheet(key);
      
      // Ensure minimum 300ms for animation feedback
      const elapsed = Date.now() - startTime;
      if (elapsed < 300) {
        await new Promise(resolve => setTimeout(resolve, 300 - elapsed));
      }
      
      console.log('[SettingsScreen] Purge result:', ok);
      if (!ok) {
        Alert.alert('Σφάλμα', 'Η διαγραφή cache απέτυχε.');
      }
    } catch (error) {
      console.error('[SettingsScreen] Purge error:', error?.message);
      Alert.alert('Σφάλμα', 'Η διαγραφή cache απέτυχε.');
    } finally {
      console.log('[SettingsScreen] Reloading cache meta after purge...');
      setBusyKey(null);
      // Add small delay to ensure metadata is written before reloading
      await new Promise(resolve => setTimeout(resolve, 200));
      await loadCacheMeta();
      console.log('[SettingsScreen] Purge completed.');
    }
  };

  const formatHours = (hours) => {
    if (hours == null || Number.isNaN(hours)) return '—';
    if (!Number.isFinite(hours)) return '∞';
    return `${hours.toFixed(1)}h`;
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleString('el-GR');
    } catch {
      return '—';
    }
  };

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
          <Text style={styles.sectionLabel}>Cache δεδομένων</Text>
          <View style={[styles.card, { marginBottom: 12, paddingVertical: 12, paddingHorizontal: 16 }] }>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#1f2d3d' }}>Καθαρισμός μεταδεδομένων</Text>
              <TouchableOpacity
                style={[styles.brandRefreshButton, clearingMeta && styles.brandRefreshButtonDisabled]}
                onPress={handleClearOldMetadata}
                disabled={clearingMeta}
              >
                {clearingMeta ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.brandRefreshButtonText}>Καθαρισμός</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
          {cacheLoading ? (
            <View style={styles.card}>
              <Text style={styles.cacheInfo}>Φόρτωση...</Text>
            </View>
          ) : cacheMeta.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.cacheInfo}>Δεν βρέθηκαν καταχωρήσεις cache.</Text>
            </View>
          ) : (
            Object.keys(BRAND_SHEETS).map((brand) => {
              const brandSheets = BRAND_SHEETS[brand];
              const brandEntries = cacheMeta
                .filter(e => brandSheets.includes(e?.key))
                .sort((a, b) => {
                  const indexA = brandSheets.indexOf(a?.key);
                  const indexB = brandSheets.indexOf(b?.key);
                  return indexA - indexB;
                });
              
              // Only show brand if user has access or entries exist
              if (brandEntries.length === 0) return null;
              
              const isBrandRefreshing = refreshingBrand === brand;
              
              return (
                <View key={brand} style={styles.brandCacheCard}>
                  <View style={styles.brandCacheHeader}>
                    <Text style={styles.brandCacheTitle}>{BRAND_LABELS[brand]}</Text>
                    <TouchableOpacity
                      style={[styles.brandRefreshButton, isBrandRefreshing && styles.brandRefreshButtonDisabled]}
                      onPress={() => handleRefreshBrand(brand)}
                      disabled={isBrandRefreshing || Boolean(busyKey)}
                    >
                      {isBrandRefreshing ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="refresh" size={16} color="#fff" style={{ marginRight: 4 }} />
                          <Text style={styles.brandRefreshButtonText}>Ανανέωση όλων</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                  
                  {brandEntries.map((entry) => (
                    <View key={entry?.key} style={styles.cacheRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.listItemTitle}>{SHEET_DISPLAY_NAMES[entry?.key] || entry?.key}</Text>
                        <Text style={styles.cacheInfo}>
                          Τελευταία λήψη: {formatDate(entry?.meta?.lastFetchedAt)}
                        </Text>
                        <Text style={styles.cacheInfo}>
                          Ηλικία: {formatHours(entry?.ageHours)} · Λήξη: {formatDate(entry?.meta?.expiresAt)}
                        </Text>
                        <Text style={styles.cacheInfo}>
                          Μέγεθος: {entry?.cacheFile?.size ? `${(entry.cacheFile.size / 1024).toFixed(1)} KB` : '—'} · TTL: {entry?.ttlHours ? `${entry.ttlHours}h` : 'χωρίς' }
                        </Text>
                        {entry?.permanent ? (
                          <Text style={styles.permanentBadge}>Μόνιμο (χωρίς αυτόματη λήξη)</Text>
                        ) : null}
                      </View>
                      <View style={styles.cacheActions}>
                        <TouchableOpacity
                          style={[styles.cacheButton, (busyKey === `${entry?.key}:refresh` || isBrandRefreshing) && styles.cacheButtonDisabled]}
                          onPress={() => handleRefresh(entry?.key)}
                          disabled={busyKey === `${entry?.key}:refresh` || isBrandRefreshing}
                        >
                          {busyKey === `${entry?.key}:refresh` ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.cacheButtonText}>Refresh</Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.cacheButton, styles.cacheDanger, (busyKey === `${entry?.key}:purge` || isBrandRefreshing) && styles.cacheButtonDisabled]}
                          onPress={() => handlePurge(entry?.key)}
                          disabled={busyKey === `${entry?.key}:purge` || isBrandRefreshing}
                        >
                          {busyKey === `${entry?.key}:purge` ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.cacheButtonText}>Delete</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              );
            })
          )}
          <TouchableOpacity style={styles.reloadButton} onPress={loadCacheMeta}>
            <Text style={styles.reloadButtonText}>Ανανέωση λίστας</Text>
          </TouchableOpacity>
        </View>

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
      
      <View style={styles.footer}>
        <Text style={styles.versionText}>v{Constants.expoConfig?.version || 'unknown'}</Text>
      </View>
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
  brandCacheCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e1e7f5',
    shadowColor: '#0f1c3f',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  brandCacheHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#e8f2ff',
  },
  brandCacheTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f4f8f',
  },
  brandRefreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f4f8f',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    minWidth: 140,
    justifyContent: 'center',
  },
  brandRefreshButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  brandRefreshButtonDisabled: {
    opacity: 0.6,
  },
  cacheRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  cacheInfo: {
    fontSize: 13,
    color: '#4f5d75',
    marginTop: 2,
  },
  cacheActions: {
    marginLeft: 12,
    justifyContent: 'center',
  },
  cacheButton: {
    backgroundColor: '#1f4f8f',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
  cacheButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  cacheDanger: {
    backgroundColor: '#E53935',
  },
  cacheButtonDisabled: {
    opacity: 0.6,
  },
  reloadButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#eef4ff',
  },
  reloadButtonText: {
    color: '#1f4f8f',
    fontWeight: '700',
  },
  permanentBadge: {
    marginTop: 6,
    fontSize: 12,
    color: '#0f5132',
    backgroundColor: '#d1e7dd',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e1e7f5',
    backgroundColor: '#f6f8fa',
  },
  versionText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
});

export default SettingsScreen;
