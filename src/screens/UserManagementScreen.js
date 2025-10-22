import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
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

const ROLE_LABEL = {
  [ROLES.OWNER]: 'Ιδιοκτήτης',
  [ROLES.ADMIN]: 'Διαχειριστής',
  [ROLES.DEVELOPER]: 'Προγραμματιστής',
  [ROLES.SALES_MANAGER]: 'Υπεύθυνος Πωλήσεων',
  [ROLES.SALESMAN]: 'Πωλητής',
  [ROLES.WAREHOUSE_MANAGER]: 'Αποθηκάριος',
  [ROLES.CUSTOMER]: 'Πελάτης',
};

const ROLE_ORDER = [
  ROLES.OWNER,
  ROLES.ADMIN,
  ROLES.DEVELOPER,
  ROLES.SALES_MANAGER,
  ROLES.SALESMAN,
  ROLES.WAREHOUSE_MANAGER,
  ROLES.CUSTOMER,
];

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const FIELD_STRINGS = {
  firstName: 'Όνομα',
  lastName: 'Επώνυμο',
  email: 'Email',
  invalidEmailTitle: 'Μη έγκυρο email',
  invalidEmailMessage: 'Εισάγετε έγκυρη διεύθυνση email.',
  noAccessTitle: 'Άδεια πρόσβασης',
  noAccessMessage: 'Δεν μπορείτε να διαχειριστείτε τον χρήστη με αυτά τα δικαιώματα.',
  noBrandsNotice: 'Δεν έχετε πρόσβαση σε μάρκες.',
  modalTitle: 'Επεξεργασία χρήστη',
  modalRolesHeading: 'Ρόλοι',
  modalBrandsHeading: 'Μάρκες',
  modalCancel: 'Άκυρο',
  modalSave: 'Αποθήκευση',
};

const getInitials = (name, fallback) => {
  const basis = (name || '').trim() || (fallback || '').trim();
  if (!basis) return '?';
  const pieces = basis.split(/\s+/).filter(Boolean);
  if (pieces.length === 1) {
    const word = pieces[0];
    if (word.includes('@')) return word[0]?.toUpperCase() || '?';
    return word.slice(0, 2).toUpperCase();
  }
  return `${pieces[0][0] || ''}${pieces[pieces.length - 1][0] || ''}`.toUpperCase();
};

const UserManagementScreen = ({ navigation }) => {
  const { hasRole, profile } = useAuth();
  const canManageUsers = hasRole(MANAGEMENT_ROLES);
  const currentUid = profile?.uid || null;

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [expanded, setExpanded] = useState(() =>
    ROLE_ORDER.reduce((acc, role) => ({ ...acc, [role]: true }), {})
  );
  const [query, setQuery] = useState('');

  const [selectedUser, setSelectedUser] = useState(null);
  const [draftRole, setDraftRole] = useState(null);
  const [draftBrands, setDraftBrands] = useState([]);
  const [draftFirstName, setDraftFirstName] = useState('');
  const [draftLastName, setDraftLastName] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftMerchIds, setDraftMerchIds] = useState([]);
  const [allSalesmen, setAllSalesmen] = useState([]);

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
  const manageableBrandSet = useMemo(() => new Set(manageableBrands), [manageableBrands]);

  const canViewUser = useCallback(
    (user) => {
      if (!user) return false;
      if (!canManageUsers) return false;
      if (currentUid && user.uid === currentUid) return true;
      if (hasGlobalAccess) return true;
      const targetBrands = Array.isArray(user.brands) ? user.brands.filter(Boolean) : [];
      if (targetBrands.length === 0) {
        return manageableBrandSet.size > 0;
      }
      return targetBrands.every((brand) => manageableBrandSet.has(brand));
    },
    [canManageUsers, currentUid, hasGlobalAccess, manageableBrandSet]
  );

  useEffect(() => {
    if (!canManageUsers) {
      setLoading(false);
      return undefined;
    }

    const unsubscribe = firestore()
      .collection('users')
      .onSnapshot(
        (snapshot) => {
          const next = snapshot.docs.map((doc) => {
            const data = doc.data() || {};
            return {
              id: doc.id,
              uid: data.uid || doc.id,
              name: data.name || '',
              firstName: data.firstName || '',
              lastName: data.lastName || '',
              email: data.email || '',
              role: data.role || ROLES.CUSTOMER,
              brands: Array.isArray(data.brands) ? data.brands.filter(Boolean) : [],
              merchIds: Array.isArray(data.merchIds) ? data.merchIds.filter(Boolean) : [],
            };
          });
          setUsers(next);
          setLoading(false);
        },
        (error) => {
          console.error('UserManagement subscribe error:', error);
          Alert.alert('\u03a3\u03c6\u03ac\u03bb\u03bc\u03b1', 'Προέκυψε πρόβλημα κατά την ανάγνωση χρηστών.');
          setUsers([]);
          setLoading(false);
        }
      );

    return () => unsubscribe();
  }, [canManageUsers]);

  useEffect(() => {
    // Fetch salesman metadata so merch chips show friendly names instead of raw ids
    if (!canManageUsers) {
      setAllSalesmen([]);
      return undefined;
    }

    if (!hasGlobalAccess && manageableBrands.length === 0) {
      setAllSalesmen([]);
      return undefined;
    }

    let query = firestore().collection('salesmen');
    if (!hasGlobalAccess) {
      query = query.where('brand', 'in', manageableBrands);
    }

    const unsubscribe = query.onSnapshot(
      (snapshot) => {
        const next = snapshot.docs.map((doc) => {
          const data = doc.data() || {};
          return {
            id: doc.id,
            name: data.name || '',
            brand: data.brand || '',
          };
        });
        setAllSalesmen(next);
      },
      (error) => {
        console.error('UserManagement loadSalesmen error:', error);
        setAllSalesmen([]);
      }
    );

    return () => unsubscribe();
  }, [canManageUsers, hasGlobalAccess, manageableBrands]);

  // Build role-based buckets for the section list
  const sections = useMemo(() => {
    const buckets = ROLE_ORDER.map((role) => ({
      role,
      title: ROLE_LABEL[role] || role,
      data: [],
    }));

    const byRole = Object.fromEntries(buckets.map((bucket) => [bucket.role, bucket]));

    users
      .slice()
      .filter(canViewUser)
      .sort((a, b) => {
        const ra = ROLE_ORDER.indexOf(a.role);
        const rb = ROLE_ORDER.indexOf(b.role);
        if (ra !== rb) return ra - rb;
        const nameA = (a.name || a.email || '').toLocaleLowerCase('el-GR');
        const nameB = (b.name || b.email || '').toLocaleLowerCase('el-GR');
        return nameA.localeCompare(nameB, 'el-GR');
      })
      .forEach((user) => {
        const bucket = byRole[user.role] || byRole[ROLES.CUSTOMER];
        if (bucket) bucket.data.push(user);
      });

    return buckets;
  }, [users, canViewUser]);

  const filteredSections = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('el-GR');
    if (!q) return sections;

    return sections
      .map((section) => {
        const data = section.data.filter((user) => {
          const name = (user.name || '').toLocaleLowerCase('el-GR');
          const email = (user.email || '').toLocaleLowerCase('el-GR');
          const brands = (user.brands || []).join(' ').toLocaleLowerCase('el-GR');
          return (
            name.includes(q) ||
            email.includes(q) ||
            brands.includes(q) ||
            user.role.toLocaleLowerCase('el-GR').includes(q)
          );
        });
        return { ...section, data };
      })
      .filter((section) => section.data.length);
  }, [query, sections]);

  const openEditor = useCallback((user) => {
    if (!canViewUser(user)) {
      Alert.alert(FIELD_STRINGS.noAccessTitle, FIELD_STRINGS.noAccessMessage);
      return;
    }
    setSelectedUser(user);
    setDraftRole(user.role);
    const initialBrands = Array.isArray(user.brands) ? user.brands : [];
    setDraftBrands(initialBrands.filter((brand) => manageableBrandSet.has(brand)));
    setDraftFirstName(user.firstName || '');
    setDraftLastName(user.lastName || '');
    setDraftEmail(user.email || '');
    const initialMerchIds = Array.isArray(user.merchIds) ? user.merchIds : [];
    setDraftMerchIds(initialMerchIds);
    setModalVisible(true);
  }, [canViewUser, manageableBrandSet]);

  const closeEditor = useCallback(() => {
    setSelectedUser(null);
    setDraftRole(null);
    setDraftBrands([]);
    setDraftFirstName('');
    setDraftLastName('');
    setDraftEmail('');
    setDraftMerchIds([]);
    setModalVisible(false);
  }, []);

  const saveChanges = useCallback(async () => {
    if (!selectedUser) return;
    const docId = selectedUser.uid || selectedUser.id;
    if (!docId) {
      Alert.alert('\u03a3\u03c6\u03ac\u03bb\u03bc\u03b1', 'Ο χρήστης δεν έχει έγκυρο αναγνωριστικό.');
      return;
    }

    if (
      selectedUser.role === ROLES.OWNER &&
      draftRole !== ROLES.OWNER &&
      users.filter((u) => u.role === ROLES.OWNER).length <= 1
    ) {
      Alert.alert('\u03a0\u03c1\u03bf\u03b5\u03b9\u03b4\u03bf\u03c0\u03bf\u03af\u03b7\u03c3\u03b7', '\u03a0\u03c1\u03ad\u03c0\u03b5\u03b9 \u03bd\u03b1 \u03c5\u03c0\u03ac\u03c1\u03c7\u03b5\u03b9 \u03c4\u03bf\u03c5\u03bb\u03ac\u03c7\u03b9\u03c3\u03c4\u03bf\u03bd \u03ad\u03bd\u03b1\u03c2 \u03b9\u03b4\u03b9\u03bf\u03ba\u03c4\u03ae\u03c4\u03b7\u03c2 \u03c3\u03c4\u03bf \u03c3\u03cd\u03c3\u03c4\u03b7\u03bc\u03b1.');
      return;
    }

    const trimmedFirst = draftFirstName.trim();
    const trimmedLast = draftLastName.trim();
    const trimmedEmail = draftEmail.trim();

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      Alert.alert(FIELD_STRINGS.invalidEmailTitle, FIELD_STRINGS.invalidEmailMessage);
      return;
    }

    const safeBrands = Array.from(new Set(draftBrands.filter((brand) => manageableBrandSet.has(brand))));
    const displayName = [trimmedFirst, trimmedLast].filter(Boolean).join(' ');
    const nextRole = draftRole || selectedUser.role || ROLES.CUSTOMER;

    try {
      setSaving(true);
      await firestore().collection('users').doc(docId).set(
        {
          firstName: trimmedFirst,
          lastName: trimmedLast,
          name: displayName || trimmedEmail,
          email: trimmedEmail,
          role: nextRole,
          brands: safeBrands,
          merchIds: Array.from(new Set(draftMerchIds.filter(Boolean))),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      closeEditor();
    } catch (error) {
      console.error('UserManagement saveChanges error:', error);
      Alert.alert('\u03a3\u03c6\u03ac\u03bb\u03bc\u03b1', '\u0391\u03c0\u03bf\u03c4\u03c5\u03c7\u03af\u03b1 \u03b1\u03c0\u03bf\u03b8\u03ae\u03ba\u03b5\u03c5\u03c3\u03b7\u03c2 \u03b1\u03bb\u03bb\u03b1\u03b3\u03ce\u03bd. \u0394\u03bf\u03ba\u03b9\u03bc\u03ac\u03c3\u03c4\u03b5 \u03be\u03b1\u03bd\u03ac.');
    } finally {
      setSaving(false);
    }
  }, [closeEditor, draftBrands, draftEmail, draftFirstName, draftLastName, draftRole, draftMerchIds, manageableBrandSet, selectedUser, users]);

  const toggleSection = useCallback((role) => {
    setExpanded((prev) => ({ ...prev, [role]: !prev[role] }));
  }, []);

  const toggleBrand = useCallback((brand) => {
    setDraftBrands((prev) => {
      if (prev.includes(brand)) {
        return prev.filter((b) => b !== brand);
      }
      return [...prev, brand];
    });
  }, []);

  const toggleSalesman = useCallback((salesmanId) => {
    setDraftMerchIds((prev) => {
      if (prev.includes(salesmanId)) {
        return prev.filter((id) => id !== salesmanId);
      }
      return [...prev, salesmanId];
    });
  }, []);

  const deleteUser = useCallback(async (user) => {
    if (!user || !user.uid) {
      Alert.alert('Σφάλμα', 'Δεν είναι δυνατή η διαγραφή του χρήστη.');
      return;
    }

    if (user.uid === currentUid) {
      Alert.alert('Σφάλμα', 'Δεν μπορείτε να διαγράψετε τον ίδιο σας λογαριασμό.');
      return;
    }

    Alert.alert(
      'Επιβεβαίωση Διαγραφής',
      `Είστε σίγουροι ότι θέλετε να διαγράψετε τον χρήστη "${user.name || user.email}"?\n\nΑυτή η ενέργεια δεν μπορεί να αναιρεθεί.`,
      [
        {
          text: 'Ακύρωση',
          style: 'cancel',
        },
        {
          text: 'Διαγραφή',
          style: 'destructive',
          onPress: async () => {
            try {
              await firestore().collection('users').doc(user.uid).delete();
              // Refresh the users list
              const updatedUsers = users.filter(u => u.uid !== user.uid);
              setUsers(updatedUsers);
              Alert.alert('Επιτυχία', 'Ο χρήστης διαγράφηκε επιτυχώς.');
            } catch (error) {
              console.error('Error deleting user:', error);
              Alert.alert('Σφάλμα', 'Προέκυψε πρόβλημα κατά τη διαγραφή του χρήστη.');
            }
          },
        },
      ]
    );
  }, [users, currentUid]);

  const headerLeft = (
    <TouchableOpacity
      style={styles.backButton}
      onPress={() => navigation.goBack()}
      accessibilityRole="button"
      accessibilityLabel="Πίσω"
    >
      <Ionicons name="arrow-back" size={22} color="#1f4f8f" />
      <Text style={styles.backButtonText}>Πίσω</Text>
    </TouchableOpacity>
  );

  if (!canManageUsers) {
    return (
      <SafeScreen title="Διαχείριση Χρηστών" headerLeft={headerLeft}>
        <View style={styles.centeredState}>
          <Ionicons name="shield-outline" size={56} color="#94a3b8" />
          <Text style={styles.centeredTitle}>Δεν έχετε πρόσβαση</Text>
          <Text style={styles.centeredSubtitle}>
            Επικοινωνήστε με έναν διαχειριστή για να αποκτήσετε τα κατάλληλα δικαιώματα.
          </Text>
        </View>
      </SafeScreen>
    );
  }

  const dataForList = filteredSections.map((section) => ({
    ...section,
    data: expanded[section.role] ? section.data : [],
    count: section.data.length,
  }));

  return (
    <SafeScreen title="Διαχείριση Χρηστών" headerLeft={headerLeft}>
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color="#64748b" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Αναζήτηση χρηστών ή μαρκών"
          placeholderTextColor="#94a3b8"
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')} accessibilityRole="button">
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
      </View>


      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#1f4f8f" />
          <Text style={styles.loadingLabel}>Φόρτωση χρηστών…</Text>
        </View>
      ) : (
        <SectionList
          sections={dataForList}
          keyExtractor={(item) => item.uid || item.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={
            dataForList.every((section) => section.data.length === 0)
              ? styles.emptyListContent
              : styles.listContent
          }
          renderSectionHeader={({ section }) => (
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => toggleSection(section.role)}
              accessibilityRole="button"
            >
              <View style={styles.sectionHeaderLeft}>
                <Text style={styles.sectionHeaderTitle}>{section.title}</Text>
                <View style={styles.counterPill}>
                  <Text style={styles.counterPillText}>{section.count}</Text>
                </View>
              </View>
              <Ionicons
                name={expanded[section.role] ? 'chevron-up' : 'chevron-down'}
                size={18}
                color="#475569"
              />
            </TouchableOpacity>
          )}
          renderItem={({ item: user }) => {
            const initials = getInitials(user.name, user.email);
            const isCurrent = currentUid && currentUid === user.uid;
            return (
              <TouchableOpacity
                style={[styles.userRow, isCurrent && styles.userRowCurrent]}
                onPress={() => openEditor(user)}
                accessibilityRole="button"
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
                <View style={styles.userInfo}>
                  <View style={styles.userLineOne}>
                    <Text style={styles.userName} numberOfLines={1}>
                      {user.name || user.email || '—'}
                    </Text>
                    <View style={styles.roleBadgeSm}>
                      <Text style={styles.roleBadgeSmText}>
                        {ROLE_LABEL[user.role] || user.role}
                      </Text>
                    </View>
                  </View>
                  {user.email ? (
                    <Text style={styles.userEmail} numberOfLines={1}>
                      {user.email}
                    </Text>
                  ) : null}
                  <View style={styles.brandsRow}>
                    {user.brands.length ? (
                      user.brands.map((brand) => (
                        <View key={brand} style={styles.brandChip}>
                          <Text style={styles.brandChipText}>
                            {BRAND_LABEL[brand] || brand}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.noBrandText}>Χωρίς brands</Text>
                    )}
                  </View>
                  {user.merchIds && user.merchIds.length > 0 && (
                    <View style={styles.merchRow}>
                      <Text style={styles.merchLabel}>Συνδεδεμένοι πωλητές:</Text>
                      <View style={styles.merchChips}>
                        {user.merchIds.slice(0, 3).map((merchId) => {
                          const salesman = allSalesmen.find(s => s.id === merchId);
                          return (
                            <View key={merchId} style={styles.merchChip}>
                              <Text style={styles.merchChipText}>
                                {salesman?.name || merchId}
                              </Text>
                            </View>
                          );
                        })}
                        {user.merchIds.length > 3 && (
                          <View style={styles.merchChip}>
                            <Text style={styles.merchChipText}>
                              +{user.merchIds.length - 3} ακόμη
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                </View>
                <View style={styles.userActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => openEditor(user)}
                    accessibilityRole="button"
                    accessibilityLabel="Επεξεργασία χρήστη"
                  >
                    <Ionicons name="create-outline" size={18} color="#1f4f8f" />
                  </TouchableOpacity>
                  {user.uid !== currentUid && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => deleteUser(user)}
                      accessibilityRole="button"
                      accessibilityLabel="Διαγραφή χρήστη"
                    >
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.centeredState}>
              <Ionicons name="people-outline" size={48} color="#cbd5f5" />
              <Text style={styles.centeredTitle}>Δεν βρέθηκαν χρήστες</Text>
              <Text style={styles.centeredSubtitle}>
                Δοκιμάστε διαφορετικό φίλτρο ή ελέγξτε τα δικαιώματα σας.
              </Text>
            </View>
          }
        />
      )}

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeEditor}>
        <View style={styles.modalWrapper}>
          <Pressable style={styles.modalBackdrop} onPress={closeEditor} />
          <KeyboardAvoidingView
            style={styles.modalCard}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <ScrollView
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.modalTitle}>{FIELD_STRINGS.modalTitle}</Text>
              <Text style={styles.modalSubtitle}>
                {selectedUser?.name || selectedUser?.email || '—'}
              </Text>

              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>{FIELD_STRINGS.firstName}</Text>
                <TextInput
                  style={styles.modalInput}
                  value={draftFirstName}
                  onChangeText={setDraftFirstName}
                  placeholder={FIELD_STRINGS.firstName}
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>{FIELD_STRINGS.lastName}</Text>
                <TextInput
                  style={styles.modalInput}
                  value={draftLastName}
                  onChangeText={setDraftLastName}
                  placeholder={FIELD_STRINGS.lastName}
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>{FIELD_STRINGS.email}</Text>
                <TextInput
                  style={styles.modalInput}
                  value={draftEmail}
                  onChangeText={setDraftEmail}
                  placeholder={FIELD_STRINGS.email}
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  returnKeyType="next"
                />
              </View>

              <Text style={styles.subHeading}>{FIELD_STRINGS.modalRolesHeading}</Text>
              <View style={styles.roleGrid}>
                {ROLE_ORDER.map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.rolePill,
                      draftRole === role && styles.rolePillActive,
                    ]}
                    onPress={() => setDraftRole(role)}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        styles.rolePillText,
                        draftRole === role && styles.rolePillTextActive,
                      ]}
                    >
                      {ROLE_LABEL[role] || role}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.subHeading, { marginTop: 18 }]}>{FIELD_STRINGS.modalBrandsHeading}</Text>
              <View style={styles.brandGrid}>
                {manageableBrands.length ? (
                  manageableBrands.map((brand) => {
                    const active = draftBrands.includes(brand);
                    return (
                      <TouchableOpacity
                        key={brand}
                        style={[
                          styles.brandToggle,
                          active && styles.brandToggleActive,
                        ]}
                        onPress={() => toggleBrand(brand)}
                        accessibilityRole="button"
                      >
                        <Ionicons
                          name={active ? 'checkbox-outline' : 'square-outline'}
                          size={18}
                          color={active ? '#1f4f8f' : '#64748b'}
                          style={{ marginRight: 8 }}
                        />
                        <Text
                          style={[
                            styles.brandToggleText,
                            active && styles.brandToggleTextActive,
                          ]}
                        >
                          {BRAND_LABEL[brand] || brand}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <Text style={styles.noBrandsNotice}>{FIELD_STRINGS.noBrandsNotice}</Text>
                )}
              </View>

              <Text style={[styles.subHeading, { marginTop: 18 }]}>Σύνδεση με Πελάτες (Merch)</Text>
              
              <TouchableOpacity
                style={styles.salesmanManagementButton}
                onPress={() => navigation.navigate('SalesmanManagement', {
                  userId: selectedUser?.uid || selectedUser?.id,
                  userName: `${draftFirstName} ${draftLastName}`.trim() || selectedUser?.email,
                  currentMerchIds: draftMerchIds
                })}
                accessibilityRole="button"
              >
                <Ionicons name="people-outline" size={20} color="#1f4f8f" />
                <Text style={styles.salesmanManagementButtonText}>
                  Διαχείριση Πωλητών ({draftMerchIds.length})
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#64748b" />
              </TouchableOpacity>

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonGhost]}
                  onPress={closeEditor}
                  disabled={saving}
                >
                  <Text style={styles.modalButtonGhostText}>{FIELD_STRINGS.modalCancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary, saving && { opacity: 0.7 }]}
                  onPress={saveChanges}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonPrimaryText}>{FIELD_STRINGS.modalSave}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#e0eaff',
  },
  backButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#1f4f8f',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    margin: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 0,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingLabel: {
    marginTop: 12,
    fontSize: 15,
    color: '#4b5563',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  emptyListContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 40,
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 16,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  counterPill: {
    backgroundColor: '#e0eaff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  counterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f4f8f',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginTop: 10,
    gap: 12,
  },
  userRowCurrent: {
    borderColor: '#93c5fd',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e0eaff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f4f8f',
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userLineOne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  userEmail: {
    marginTop: 4,
    fontSize: 13,
    color: '#475569',
  },
  roleBadgeSm: {
    backgroundColor: '#eef2ff',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  roleBadgeSmText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1f4f8f',
  },
  brandsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  brandChip: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  brandChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1e293b',
  },
  noBrandText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  merchRow: {
    marginTop: 8,
  },
  merchLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 4,
  },
  merchChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  merchChip: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  merchChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#0369a1',
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  centeredTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2d3d',
    marginTop: 16,
  },
  centeredSubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  modalWrapper: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    width: '100%',
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#475569',
  },
  modalInputGroup: {
    marginTop: 16,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  modalContent: { paddingBottom: 16 },
  noBrandsNotice: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginTop: 8,
  },
  subHeading: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rolePill: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  rolePillActive: {
    borderColor: '#1f4f8f',
    backgroundColor: '#eef2ff',
  },
  rolePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  rolePillTextActive: {
    color: '#1f4f8f',
  },
  brandGrid: {
    gap: 8,
  },
  brandToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  brandToggleActive: {
    borderColor: '#1f4f8f',
    backgroundColor: '#eef2ff',
  },
  brandToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  brandToggleTextActive: {
    color: '#1f4f8f',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 20,
  },
  modalButton: {
    minWidth: 92,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonGhost: {
    backgroundColor: '#f1f5f9',
  },
  modalButtonGhostText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f4f8f',
  },
  modalButtonPrimary: {
    backgroundColor: '#1f4f8f',
  },
  modalButtonPrimaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748b',
  },
  salesmanGrid: {
    gap: 8,
    maxHeight: 200,
  },
  salesmanToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  salesmanToggleActive: {
    borderColor: '#1f4f8f',
    backgroundColor: '#eef2ff',
  },
  salesmanInfo: {
    flex: 1,
  },
  salesmanToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  salesmanToggleTextActive: {
    color: '#1f4f8f',
  },
  salesmanBrandText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  noSalesmenNotice: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  userActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  deleteButton: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  salesmanScrollContainer: {
    maxHeight: 200,
    marginTop: 8,
  },
  salesmanManagementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 8,
  },
  salesmanManagementButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginLeft: 12,
  },
});

export default UserManagementScreen;
