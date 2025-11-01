// /src/components/GlobalUserMenu.js
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { useAuth } from '../context/AuthProvider';
import { updateAllDataForUser, formatUpdateAllSummary } from '../services/updateAll';
import { isSuperMarketBrand, AVAILABLE_BRANDS, normalizeBrandKey } from '../constants/brands';

const getInitials = (name, email) => {
  const source = (name || '').trim() || (email || '').trim();
  if (!source) return '?';

  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    const word = parts[0];
    if (word.includes('@')) return word[0]?.toUpperCase() || '?';
    return word.slice(0, 2).toUpperCase();
  }

  return parts
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() || '')
    .join('')
    .padEnd(2, '?');
};

const MENU_STRINGS = {
  profile: 'Προφίλ χρήστη',
  sync: 'Συγχρονισμός δεδομένων',
  updateAll: 'Ενημέρωση όλων',
  settings: 'Ρυθμίσεις',
  adminTools: 'Εργαλεία διαχειριστή',
  signOut: 'Αποσύνδεση',
  exit: 'Έξοδος',
};

const GlobalUserMenu = ({ style }) => {
  const { user, profile, signOut, hasRole, ROLES } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [updatingAll, setUpdatingAll] = useState(false);

  const isAdmin = hasRole
    ? hasRole([ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER])
    : false;

  const email = useMemo(() => user?.email || profile?.email || '', [profile?.email, user?.email]);
  const displayName = useMemo(() => {
    const name = profile?.name?.trim() || user?.displayName?.trim();
    if (name && name.length > 0) return name;
    return email || 'No name';
  }, [profile?.name, user?.displayName, email]);

  const roleLabel = profile?.role ? String(profile.role).toUpperCase() : null;

  const brands = useMemo(() => {
    const set = new Set();
    if (isAdmin) AVAILABLE_BRANDS.forEach((b) => set.add(b));
    if (Array.isArray(profile?.brands)) {
      profile.brands.forEach((b) => {
        const normalized = normalizeBrandKey(b);
        if (normalized) set.add(normalized);
      });
    }
    if (!set.size) AVAILABLE_BRANDS.forEach((b) => set.add(b));
    return Array.from(set);
  }, [isAdmin, profile?.brands]);

  const initials = useMemo(
    () => getInitials(profile?.name || user?.displayName, email),
    [profile?.name, user?.displayName, email]
  );

  if (!user || !profile) return null;

  const closeMenu = () => setOpen(false);
  const handleProfilePress = () => { closeMenu(); navigation.navigate('Profile'); };
  const handleSyncPress = () => { closeMenu(); navigation.navigate('Data'); };
  const handleSettingsPress = () => { closeMenu(); navigation.navigate('Settings'); };
  const handleAdminToolsPress = () => { if (!isAdmin) return; closeMenu(); navigation.navigate('UserManagement'); };
  const handleExitApp = () => { closeMenu(); BackHandler.exitApp(); };

  const handleUpdateAllPress = async () => {
    if (updatingAll) return;
    setUpdatingAll(true);
    try {
      closeMenu();
      const summary = await updateAllDataForUser({
        brandAccess: brands,
        supportsSuperMarketBrand: (b) => isSuperMarketBrand(b),
      });
      const message = formatUpdateAllSummary(summary);
      Alert.alert('Ενημέρωση όλων', message);
    } catch (e) {
      console.warn('Update All failed:', e?.message);
      Alert.alert('Ενημέρωση όλων', e?.message || 'Η ενημέρωση δεν ολοκληρώθηκε. Προσπαθήστε ξανά.');
    } finally {
      setUpdatingAll(false);
    }
  };
  const handleLogout = () => {
    if (signingOut) return;
    Alert.alert('Αποσύνδεση', 'Είστε σίγουροι ότι θέλετε να αποσυνδεθείτε;', [
      { text: 'Ακύρωση', style: 'cancel' },
      {
        text: 'Αποσύνδεση',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut();
          } catch (e) {
            console.warn('Logout failed:', e);
          } finally {
            setSigningOut(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.triggerWrapper, style]}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setOpen((prev) => !prev)}
        style={[styles.trigger, open && styles.triggerActive]}
      >
        <Text style={styles.triggerInitials}>{initials}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color="#1f4f8f"
          style={{ marginLeft: 6 }}
        />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={closeMenu} statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu} />
          <View style={[styles.menuContainer, { paddingTop: insets.top + 56 }]}>
            <View style={styles.menu}>
              <View style={styles.profileRow}>
                <View style={styles.profileInitialsBubble}>
                  <Text style={styles.profileInitialsText}>{initials}</Text>
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName} numberOfLines={1}>{displayName}</Text>
                  {email ? <Text style={styles.profileEmail} numberOfLines={1}>{email}</Text> : null}
                  {roleLabel ? (
                    <View style={styles.roleBadge}>
                      <Text style={styles.roleBadgeText}>{roleLabel}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {brands.length ? (
                <View style={styles.brandsWrap}>
                  {brands.map((brand) => (
                    <View key={brand} style={styles.brandChip}>
                      <Text style={styles.brandChipText}>{brand}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <TouchableOpacity style={styles.menuItem} onPress={handleProfilePress}>
                <Ionicons name="person-circle-outline" size={20} color="#1f4f8f" style={styles.menuIcon} />
                <Text style={styles.menuItemText}>{MENU_STRINGS.profile}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={handleSyncPress}>
                <Ionicons name="sync-outline" size={20} color="#1f4f8f" style={styles.menuIcon} />
                <Text style={styles.menuItemText}>{MENU_STRINGS.sync}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={handleUpdateAllPress} disabled={updatingAll}>
                {updatingAll ? (
                  <ActivityIndicator size="small" color="#1f4f8f" style={styles.menuIcon} />
                ) : (
                  <Ionicons name="cloud-download-outline" size={20} color="#1f4f8f" style={styles.menuIcon} />
                )}
                <Text style={styles.menuItemText}>
                  {updatingAll ? 'Ενημέρωση…' : MENU_STRINGS.updateAll}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={handleSettingsPress}>
                <Ionicons name="settings-outline" size={20} color="#1f4f8f" style={styles.menuIcon} />
                <Text style={styles.menuItemText}>{MENU_STRINGS.settings}</Text>
              </TouchableOpacity>

              {isAdmin ? (
                <TouchableOpacity style={styles.menuItem} onPress={handleAdminToolsPress}>
                  <Ionicons name="hammer-outline" size={20} color="#1f4f8f" style={styles.menuIcon} />
                  <Text style={styles.menuItemText}>{MENU_STRINGS.adminTools}</Text>
                </TouchableOpacity>
              ) : null}

              <View style={styles.separator} />

              <TouchableOpacity
                style={[styles.menuItem, styles.logoutItem]}
                onPress={handleLogout}
                disabled={signingOut}
              >
                {signingOut ? (
                  <ActivityIndicator size="small" color="#D0021B" />
                ) : (
                  <>
                    <Ionicons name="log-out-outline" size={20} color="#D0021B" style={styles.menuIcon} />
                    <Text style={[styles.menuItemText, styles.logoutText]}>{MENU_STRINGS.signOut}</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={[styles.menuItem, styles.exitItem]} onPress={handleExitApp}>
                <Ionicons name="exit-outline" size={20} color="#D0021B" style={styles.menuIcon} />
                <Text style={[styles.menuItemText, styles.exitText]}>{MENU_STRINGS.exit}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  triggerWrapper: { flexDirection: 'row', alignItems: 'center' },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d9dee8',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  triggerActive: { borderColor: '#1f4f8f' },
  triggerInitials: { color: '#1f4f8f', fontSize: 15, fontWeight: '700', letterSpacing: 0.4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,28,63,0.15)' },
  menuContainer: { flex: 1, paddingHorizontal: 16, alignItems: 'flex-end' },
  menu: {
    width: 260,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
  },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  profileInitialsBubble: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#E6F0FF', alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  profileInitialsText: { color: '#1B60E0', fontSize: 18, fontWeight: '700' },
  profileInfo: { flex: 1, minWidth: 0 },
  profileName: { fontSize: 17, fontWeight: '600', color: '#111827' },
  profileEmail: { fontSize: 13, color: '#4b5563', marginTop: 4 },
  roleBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: '#EEF4FF', marginTop: 8 },
  roleBadgeText: { fontSize: 11, fontWeight: '700', color: '#1f4f8f', letterSpacing: 0.5 },
  brandsWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, marginBottom: 8 },
  brandChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#EEF2FF', marginRight: 6, marginBottom: 6 },
  brandChipText: { fontSize: 12, fontWeight: '600', color: '#1f4f8f' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  menuIcon: { marginRight: 12 },
  menuItemText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#E2E3E5', marginVertical: 4 },
  logoutItem: { paddingTop: 10 },
  logoutText: { color: '#D0021B' },
  exitItem: { paddingTop: 6 },
  exitText: { color: '#D0021B', fontWeight: '700' },
});

export default GlobalUserMenu;



