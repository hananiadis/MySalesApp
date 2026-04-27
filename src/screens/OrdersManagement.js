import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Alert, ScrollView, Modal, TextInput, RefreshControl, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getOrders, deleteOrder, deleteMany } from '../utils/localOrders';
import { deleteFirestoreOrder } from '../utils/firestoreOrders';

const HIDDEN_ORDERS_KEY = 'hidden_orders_v1';
const FIRESTORE_LAST_SYNC_KEY = 'firestore_orders_sync_v1';
const FIRESTORE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
import { useOrder } from '../context/OrderContext';
import { normalizeBrandKey } from '../constants/brands';
import { useAuth, ROLES as ROLE_DEFAULTS } from '../context/AuthProvider';

const STRINGS = {
  title: 'Διαχείριση Παραγγελιών',
  nav: { back: 'Πίσω' },
  tabs: {
    drafts: 'Πρόχειρες',
    sent: 'Απεσταλμένες',
  },
  toolbar: {
    selectAll: 'Επιλογή όλων',
    delete: 'Διαγραφή',
  },
  alerts: {
    deleteOneTitle: 'Διαγραφή παραγγελίας',
    deleteOneMessage: 'Να διαγραφεί οριστικά αυτή η παραγγελία;',
    hideSentTitle: 'Απόκρυψη παραγγελίας',
    hideSentMessage: 'Η παραγγελία θα αποκρυφτεί από τη λίστα σας. Τα δεδομένα παραμένουν αποθηκευμένα.',
    cancel: 'Άκυρο',
    confirmDelete: 'Διαγραφή',
    confirmHide: 'Απόκρυψη',
    deleteManyTitle: 'Διαγραφή επιλεγμένων',
    deleteManyMessage: (count) => `Να διαγραφούν οριστικά οι ${count} επιλεγμένες παραγγελίες;`,
    noneSelectedTitle: 'Καμία επιλογή',
    noneSelectedMessage: 'Δεν έχετε επιλέξει παραγγελίες.',
    deleteErrorTitle: 'Σφάλμα',
    deleteErrorMessage: 'Η ενέργεια απέτυχε. Δοκιμάστε ξανά.',
    deleteManySuccessTitle: 'Ολοκληρώθηκε',
    deleteManySuccessMessage: (count) => `${count} παραγγελίες επεξεργάστηκαν.`,
  },
  empty: {
    none: 'Δεν υπάρχουν παραγγελίες.',
    drafts: 'Δεν υπάρχουν πρόχειρες παραγγελίες.',
    sent: 'Δεν υπάρχουν απεσταλμένες παραγγελίες.',
  },
  chips: {
    sent: 'Απεσταλμένη',
    draft: 'Πρόχειρη',
  },
  orderTypes: {
    all: '\u038c\u03bb\u03b5\u03c2 \u03bf\u03b9 \u03c0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03af\u03b5\u03c2',
    standard: '\u039a\u03b1\u03bd\u03bf\u03bd\u03b9\u03ba\u03ad\u03c2',
    supermarket: 'SuperMarket',
  },
  card: {
    noCustomer: 'Χωρίς πελάτη',
    edit: 'Επεξεργασία',
    delete: 'Διαγραφή',
  },
  loading: 'Φόρτωση παραγγελιών...',
  totals: {
    currencySymbol: '€',
  },
  filter: {
    title: 'Φίλτρο Πωλητών',
    allSalesmen: 'Όλοι οι Πωλητές',
    noSalesmen: 'Δεν βρέθηκαν πωλητές',
    loadingSalesmen: 'Φόρτωση πωλητών...',
    clearFilter: 'Καθαρισμός Φίλτρου',
  },
};

function calcTotals(order) {
  const lines = Array.isArray(order?.lines) ? order.lines : [];
  const net = lines.reduce((sum, line) => sum + Number(line.wholesalePrice || 0) * Number(line.quantity || 0), 0);
  const discount = order?.paymentMethod === 'prepaid_cash' ? +(net * 0.03).toFixed(2) : 0;
  const vat = +((net - discount) * 0.24).toFixed(2);
  const total = +(net - discount + vat).toFixed(2);
  return { net, discount, vat, total };
}

const formatId = (id) => {
  if (!id) return '-';
  const s = String(id);
  if (s.length <= 10) return s;
  return `${s.slice(0, 4)}...${s.slice(-4)}`;
};

const isSentOrder = (o) => o?.sent === true || o?.status === 'sent' || !!o?.exportedAt;

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  return '\u20ac' + amount.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Helper functions for date formatting
const formatDateToDDMMYYYY = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const parseDDMMYYYYDate = (dateString) => {
  if (!dateString) return null;
  const parts = dateString.split('/');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
  const year = parseInt(parts[2], 10);
  return new Date(year, month, day);
};

// Returns the number of days since the order was last updated (or created)
const getDaysSince = (order) => {
  const d = new Date(order?.updatedAt || order?.createdAt || 0);
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
};

export default function OrdersManagement() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { loadOrder, startOrder, setOrderLines } = useOrder();
  const auth = useAuth() || {};
  const {
    hasRole = () => false,
    profile = null,
    ROLES: contextRoles = ROLE_DEFAULTS,
  } = auth;
  const ROLES = contextRoles || ROLE_DEFAULTS;

  const [orders, setOrders] = useState([]);
  const [firestoreOrders, setFirestoreOrders] = useState([]);
  const [hiddenOrderIds, setHiddenOrderIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [activeTab, setActiveTab] = useState('drafts');
  const [orderTypeFilter, setOrderTypeFilter] = useState('all');
  
  // Salesman filtering states
  const [salesmen, setSalesmen] = useState([]);
  const [loadingSalesmen, setLoadingSalesmen] = useState(false);
  const [selectedSalesman, setSelectedSalesman] = useState(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  
  // Date filtering states
  const [dateFilter, setDateFilter] = useState(null); // null, 'today', 'week', 'month', 'custom'
  const [customDateRange, setCustomDateRange] = useState({ start: null, end: null });
  const [showDateModal, setShowDateModal] = useState(false);
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);
  const [calStep, setCalStep] = useState('start'); // 'start' | 'end'
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(7);

  useEffect(() => {
    if (!showCustomDateModal) return;
    const base = customDateRange.start || customDateRange.end || new Date();
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
  }, [showCustomDateModal, customDateRange.start, customDateRange.end]);

  // Load hidden order IDs from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(HIDDEN_ORDERS_KEY).then((raw) => {
      if (!raw) return;
      try {
        const ids = JSON.parse(raw);
        if (Array.isArray(ids)) setHiddenOrderIds(new Set(ids.map(String)));
      } catch {}
    });
  }, []);

  const hideOrderById = useCallback((id) => {
    setHiddenOrderIds((prev) => {
      const next = new Set(prev);
      next.add(String(id));
      AsyncStorage.setItem(HIDDEN_ORDERS_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, []);

  const rawBrand = typeof route?.params?.brand === 'string' ? route.params.brand : null;
  const brand = useMemo(
    () => (rawBrand ? normalizeBrandKey(rawBrand) : null),
    [rawBrand]
  );

  const handleBackToBrandHome = useCallback(() => {
    const targetBrand = brand || 'playmobil';
    navigation.navigate('BrandHome', { brand: targetBrand });
  }, [brand, navigation]);

  // Pull-to-refresh: forces a fresh Firestore fetch regardless of cache TTL.
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLocal();
    if (canAccessFirestoreOrders) {
      await loadFirestoreOrders(true); // forceRefresh = true
    }
    setRefreshing(false);
  }, [loadLocal, loadFirestoreOrders, canAccessFirestoreOrders]);

  useFocusEffect(
    useCallback(() => {
      // Reload orders whenever the screen is focused
      loadLocal();
      if (canAccessFirestoreOrders) {
        loadFirestoreOrders();
      }

      const unsubscribe = navigation.addListener('beforeRemove', (event) => {
        if (event.data.action?.type === 'GO_BACK') {
          event.preventDefault();
          handleBackToBrandHome();
        }
      });
      return () => unsubscribe();
    }, [handleBackToBrandHome, navigation, loadLocal, loadFirestoreOrders, canAccessFirestoreOrders])
  );

  // Check if user can filter orders by salesman
  const canFilterBySalesman = useMemo(() => {
    const hasPermission = hasRole([ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER, ROLES.SALES_MANAGER]);
    console.log('[OrdersManagement] canFilterBySalesman:', hasPermission, {
      userRole: profile?.role,
      requiredRoles: [ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER, ROLES.SALES_MANAGER]
    });
    return hasPermission;
  }, [hasRole, profile?.role, ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER, ROLES.SALES_MANAGER]);

  // Check if user can access Firestore orders
  const canAccessFirestoreOrders = useMemo(() => {
    const hasPermission = hasRole([ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER, ROLES.SALES_MANAGER, ROLES.SALESMAN]);
    console.log('[OrdersManagement] canAccessFirestoreOrders:', hasPermission, {
      userRole: profile?.role,
      requiredRoles: [ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER, ROLES.SALES_MANAGER, ROLES.SALESMAN]
    });
    return hasPermission;
  }, [hasRole, profile?.role, ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER, ROLES.SALES_MANAGER, ROLES.SALESMAN]);

  // Check if user should only see local orders
  const shouldOnlySeeLocalOrders = useMemo(() => {
    return hasRole([ROLES.SALESMAN, ROLES.WAREHOUSE_MANAGER, ROLES.CUSTOMER]);
  }, [hasRole, ROLES.SALESMAN, ROLES.WAREHOUSE_MANAGER, ROLES.CUSTOMER]);

  const brandScopedOrders = useMemo(() => {
    // Merge local + Firestore orders, preferring the local version (more up-to-date) when id matches
    const merged = new Map();
    for (const o of firestoreOrders) {
      if (o?.id) merged.set(String(o.id), o);
    }
    for (const o of orders) {
      if (o?.id) merged.set(String(o.id), o); // local overrides Firestore
    }
    const allOrders = Array.from(merged.values()).filter((o) => !hiddenOrderIds.has(String(o?.id)));
    if (!brand) return allOrders;
    return allOrders.filter((order) => normalizeBrandKey(order?.brand || 'playmobil') === brand);
  }, [brand, orders, firestoreOrders, hiddenOrderIds]);

  const displayedOrders = useMemo(() => {
    let filtered = brandScopedOrders;
    
    if (activeTab === 'sent') {
      filtered = filtered.filter((o) => isSentOrder(o));
    } else {
      filtered = filtered.filter((o) => !isSentOrder(o));
    }
    
    // Apply date filter
    if (orderTypeFilter === 'supermarket') {
      filtered = filtered.filter((o) => o?.orderType === 'supermarket');
    } else if (orderTypeFilter === 'standard') {
      filtered = filtered.filter((o) => o?.orderType !== 'supermarket');
    } else if (orderTypeFilter === 'stale') {
      filtered = filtered.filter((o) => getDaysSince(o) >= 30);
    }

    if (dateFilter) {
      const now = new Date();
      let startDate = null;
      let endDate = null;
      
      switch (dateFilter) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
          break;
        case 'week':
          const dayOfWeek = now.getDay();
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
          endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          break;
        case 'custom':
          startDate = customDateRange.start;
          endDate = customDateRange.end;
          break;
      }
      
      if (startDate && endDate) {
        filtered = filtered.filter((order) => {
          const orderDate = new Date(order?.updatedAt || order?.createdAt || order?.firestoreCreatedAt || 0);
          return orderDate >= startDate && orderDate < endDate;
        });
      }
    }
    
    // Apply salesman filter if selected
    if (selectedSalesman && canFilterBySalesman && selectedSalesman.users?.length > 0) {
      const salesmanUserIds = selectedSalesman.users.map(user => user.uid || user.id);
      filtered = filtered.filter((order) => {
        const orderUserId = order?.userId || order?.createdBy;
        return salesmanUserIds.includes(orderUserId);
      });
    }

    // Always sort latest first (updatedAt → createdAt fallback)
    filtered = [...filtered].sort((a, b) =>
      new Date(b?.updatedAt || b?.createdAt || 0) - new Date(a?.updatedAt || a?.createdAt || 0)
    );

    // Search filter — customer name or order number
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((o) => {
        const name = (o?.customer?.name || o?.storeName || '').toLowerCase();
        const num = String(o?.number || o?.id || '').toLowerCase();
        return name.includes(q) || num.includes(q);
      });
    }

    return filtered;
  }, [brandScopedOrders, activeTab, orderTypeFilter, dateFilter, customDateRange, selectedSalesman, canFilterBySalesman, searchQuery]);

  const emptyTabMessage = activeTab === 'sent' ? STRINGS.empty.sent : STRINGS.empty.drafts;

  const draftCount = useMemo(() => brandScopedOrders.filter((o) => !isSentOrder(o)).length, [brandScopedOrders]);
  const sentCount  = useMemo(() => brandScopedOrders.filter((o) => isSentOrder(o)).length,  [brandScopedOrders]);

  const totalDraftValue = useMemo(() =>
    brandScopedOrders
      .filter((o) => !isSentOrder(o))
      .reduce((sum, o) => sum + Number(o?.finalValue || o?.netValue || calcTotals(o).total || 0), 0),
    [brandScopedOrders]
  );

  const staleCount = useMemo(() =>
    brandScopedOrders.filter((o) => !isSentOrder(o) && getDaysSince(o) >= 30).length,
    [brandScopedOrders]
  );

  const slicedOrders = useMemo(() =>
    displayedOrders.slice(0, visibleCount),
    [displayedOrders, visibleCount]
  );

  // Reset visible count when tab, filter or search changes
  useEffect(() => { setVisibleCount(7); }, [activeTab, orderTypeFilter, searchQuery]);

  const purgeEmptyDrafts = useCallback(async (list) => {
    const toKeep = [];
    const toDeleteIds = [];
    for (const o of list) {
      const lines = Array.isArray(o?.lines) ? o.lines : [];
      const hasQty = lines.some((l) => Number(l.quantity || 0) > 0);
      const hasNotes = !!(o?.notes && String(o.notes).trim().length > 0);
      const hasCustomer = !!o?.customer;
      const isSent = isSentOrder(o);
      if (!isSent && !hasCustomer && !hasQty && !hasNotes && o?.id) toDeleteIds.push(o.id);
      else toKeep.push(o);
    }
    await Promise.all(toDeleteIds.map((id) => deleteOrder(id)));
    return toKeep;
  }, []);

  const loadLocal = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getOrders();
      let filtered = Array.isArray(all) ? all : [];
      
      // Filter local orders based on user role
      if (!hasRole([ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER, ROLES.SALES_MANAGER])) {
        // Non-admin users: only their own orders
        filtered = filtered.filter(order => order.userId === profile?.uid);
      } else if (hasRole([ROLES.SALES_MANAGER]) && !hasRole([ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER])) {
        // Sales managers (who are not also admins): only their own orders
        // Note: Sales managers can use the salesman filter to view orders from linked salesmen
        filtered = filtered.filter(order => order.userId === profile?.uid);
      }
      // OWNER, ADMIN, DEVELOPER see all orders
      
      const cleaned = await purgeEmptyDrafts(filtered);
      cleaned.sort((a, b) => new Date(b?.updatedAt || b?.createdAt || 0) - new Date(a?.updatedAt || a?.createdAt || 0));
      setOrders(cleaned);
    } catch (error) {
      console.error('Error loading orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [purgeEmptyDrafts, hasRole, profile?.uid, profile?.merchIds, ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER, ROLES.SALES_MANAGER]);

  const loadFirestoreOrders = useCallback(async (forceRefresh = false) => {
    if (!canAccessFirestoreOrders || !profile?.uid) return;

    // Cache check: skip the Firestore fetch if data is fresh and no force-refresh.
    if (!forceRefresh) {
      try {
        const rawTs = await AsyncStorage.getItem(FIRESTORE_LAST_SYNC_KEY);
        if (rawTs) {
          const lastSync = parseInt(rawTs, 10);
          if (Date.now() - lastSync < FIRESTORE_CACHE_TTL) return; // still fresh
        }
      } catch {}
    }
    
    try {
      const allFirestoreOrders = [];
      
      if (hasRole([ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER])) {
        // Load all orders from all collections
        const collections = ['orders', 'orders_kivos', 'orders_john', 'orders_john_supermarket'];
        
        for (const collectionName of collections) {
          try {
            const snapshot = await firestore()
              .collection(collectionName)
              .orderBy('updatedAt', 'desc')
              .limit(100) // Limit for performance
              .get();
            
            const collectionOrders = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
              source: 'firestore',
              collection: collectionName,
            }));
            
            allFirestoreOrders.push(...collectionOrders);
          } catch (error) {
            console.log(`Error loading orders from ${collectionName}:`, error);
          }
        }
      } else if (hasRole([ROLES.SALES_MANAGER]) && !hasRole([ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER])) {
        // Sales managers (who are not also admins): only their own orders
        const collections = ['orders', 'orders_kivos', 'orders_john', 'orders_john_supermarket'];
        
        for (const collectionName of collections) {
          try {
            const snapshot = await firestore()
              .collection(collectionName)
              .where('userId', '==', profile.uid)
              .limit(100)
              .get();
            
            const collectionOrders = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
              source: 'firestore',
              collection: collectionName,
            }));
            
            allFirestoreOrders.push(...collectionOrders);
          } catch (error) {
            console.log(`[OrdersManagement] Error loading orders from ${collectionName}:`, error);
          }
        }
      } else if (hasRole([ROLES.SALES_MANAGER])) {
        // This case shouldn't happen, but keep it for backwards compatibility
        // Sales managers with query access
        if (profile?.merchIds?.length > 0) {
          // Get all users linked to the salesmen this sales manager manages
          const linkedUserIds = new Set();
          
          for (const merchId of profile.merchIds) {
            if (typeof merchId === 'string' && merchId.includes('_')) {
              const salesmanName = merchId.split('_').slice(1).join('_');
              
              // Find users linked to this salesman
              try {
                const usersSnapshot = await firestore()
                  .collection('users')
                  .where('merchIds', 'array-contains', merchId)
                  .get();
                
                usersSnapshot.docs.forEach(doc => {
                  linkedUserIds.add(doc.data().uid || doc.id);
                });
              } catch (error) {
                console.warn('[OrdersManagement] Cannot query users collection:', error?.code);
                // If we can't query users, skip this merchId
                continue;
              }
            }
          }
          
          // Load orders for these users from all collections
          const collections = ['orders', 'orders_kivos', 'orders_john', 'orders_john_supermarket'];
          
          for (const collectionName of collections) {
            try {
              if (linkedUserIds.size > 0) {
                const snapshot = await firestore()
                  .collection(collectionName)
                  .where('userId', 'in', Array.from(linkedUserIds))
                  .limit(100)
                  .get();
                
                const collectionOrders = snapshot.docs.map(doc => ({
                  id: doc.id,
                  ...doc.data(),
                  source: 'firestore',
                  collection: collectionName,
                }));
                
                allFirestoreOrders.push(...collectionOrders);
              }
            } catch (error) {
              console.log(`[OrdersManagement] Error loading orders from ${collectionName}:`, error);
            }
          }
        }
      } else {
        // Non-admin users (salesman): only their own orders
        const collections = ['orders', 'orders_kivos', 'orders_john', 'orders_john_supermarket'];
        
        for (const collectionName of collections) {
          try {
            const snapshot = await firestore()
              .collection(collectionName)
              .where('userId', '==', profile.uid)
              .limit(200)
              .get();
            
            const collectionOrders = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
              source: 'firestore',
              collection: collectionName,
            }));
            
            allFirestoreOrders.push(...collectionOrders);
          } catch (error) {
            console.log(`Error loading orders from ${collectionName}:`, error);
          }
        }
      }
      
      // Sort in JS to avoid composite index requirement
      allFirestoreOrders.sort((a, b) =>
        new Date(b?.updatedAt || b?.createdAt || 0) - new Date(a?.updatedAt || a?.createdAt || 0)
      );
      setFirestoreOrders(allFirestoreOrders);
      AsyncStorage.setItem(FIRESTORE_LAST_SYNC_KEY, String(Date.now())).catch(() => {});
    } catch (error) {
      console.error('Error loading Firestore orders:', error);
      setFirestoreOrders([]);
    }
  }, [canAccessFirestoreOrders, profile?.uid, profile?.merchIds, hasRole, ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER, ROLES.SALES_MANAGER]);

  const loadSalesmen = useCallback(async () => {
    if (!canFilterBySalesman || !profile?.brands?.length) return;
    
    setLoadingSalesmen(true);
    try {
      console.log('[OrdersManagement] Loading salesmen for brands:', profile.brands);
      
      // Get salesmen from the salesmen collection
      const salesmenSnapshot = await firestore()
        .collection('salesmen')
        .where('brand', 'in', profile.brands)
        .get();
      
      const salesmenData = salesmenSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || doc.data().merch || 'Άγνωστος',
        merch: doc.data().merch || doc.data().name || '',
        brand: doc.data().brand,
        ...doc.data()
      }));
      
      console.log('[OrdersManagement] Loaded salesmen:', salesmenData.length);
      console.log('[OrdersManagement] Sample salesmen:', salesmenData.slice(0, 3).map(s => ({ 
        id: s.id, 
        name: s.name, 
        merch: s.merch, 
        brand: s.brand 
      })));
      
      // For sales managers, we can only see current user's linked salesmen
      // Build salesmen list with current user info only
      const currentUserMerchIds = profile?.merchIds || [];
      
      console.log('[OrdersManagement] Current user merchIds:', currentUserMerchIds);
      
      // Create a mapping of salesman identifiers using current user's merchIds
      // merchId format: "brand_NAME" where NAME should match salesman.merch or salesman.name
      const salesmanToUsers = new Map();
      
      currentUserMerchIds.forEach(merchId => {
        if (typeof merchId === 'string' && merchId.includes('_')) {
          const parts = merchId.split('_');
          const brandPrefix = parts[0];
          const salesmanName = parts.slice(1).join('_');
          
          // Create normalized keys for matching
          const normalizedName = salesmanName.trim().toLowerCase();
          
          if (!salesmanToUsers.has(normalizedName)) {
            salesmanToUsers.set(normalizedName, []);
          }
          salesmanToUsers.get(normalizedName).push({
            uid: profile.uid,
            name: profile.name || profile.email || 'Current User',
            email: profile.email,
          });
          
          console.log('[OrdersManagement] Mapping current user to salesman:', {
            merchId,
            brandPrefix,
            salesmanName,
            normalizedName,
          });
        }
      });
      
      console.log('[OrdersManagement] salesmanToUsers map size:', salesmanToUsers.size);
      console.log('[OrdersManagement] salesmanToUsers keys:', Array.from(salesmanToUsers.keys()));
      
      // Add user information to salesmen with multiple matching strategies
      const salesmenWithUsers = salesmenData.map(salesman => {
        // Try multiple matching strategies
        const normalizedName = (salesman.name || '').trim().toLowerCase();
        const normalizedMerch = (salesman.merch || '').trim().toLowerCase();
        
        let users = [];
        
        // Strategy 1: Match by normalized name
        if (salesmanToUsers.has(normalizedName)) {
          users = salesmanToUsers.get(normalizedName);
        }
        // Strategy 2: Match by normalized merch field
        else if (normalizedMerch && salesmanToUsers.has(normalizedMerch)) {
          users = salesmanToUsers.get(normalizedMerch);
        }
        // Strategy 3: Try document ID
        else if (salesmanToUsers.has(salesman.id.toLowerCase())) {
          users = salesmanToUsers.get(salesman.id.toLowerCase());
        }
        
        console.log('[OrdersManagement] Salesman matching:', {
          salesmanId: salesman.id,
          salesmanName: salesman.name,
          salesmanMerch: salesman.merch,
          normalizedName,
          normalizedMerch,
          foundUsers: users.length
        });
        
        return {
          ...salesman,
          users
        };
      });
      
      console.log('[OrdersManagement] Final salesmen with users:', 
        salesmenWithUsers.map(s => ({ 
          name: s.name, 
          merch: s.merch, 
          userCount: s.users.length 
        })));
      
      setSalesmen(salesmenWithUsers);
    } catch (error) {
      console.error('[OrdersManagement] Error loading salesmen:', error);
      console.error('[OrdersManagement] Error code:', error?.code);
      console.error('[OrdersManagement] Error message:', error?.message);
      
      // If permission denied, it means user doesn't have access to salesmen collection
      // This could be due to Firestore rules or authentication issues
      if (error?.code === 'permission-denied') {
        console.warn('[OrdersManagement] Permission denied - user may not have proper role or authentication');
        // Set empty array but don't show error to user - they just won't see the filter
        setSalesmen([]);
      } else {
        Alert.alert('Σφάλμα', 'Προέκυψε πρόβλημα κατά τη φόρτωση των πωλητών.');
      }
    } finally {
      setLoadingSalesmen(false);
    }
  }, [canFilterBySalesman, profile?.brands]);

  useEffect(() => {
    if (canFilterBySalesman) {
      loadSalesmen();
    }
  }, [canFilterBySalesman, loadSalesmen]);

  useEffect(() => {
    loadLocal();
    if (canAccessFirestoreOrders) {
      loadFirestoreOrders();
    }
  }, [loadLocal, loadFirestoreOrders, canAccessFirestoreOrders]);

  const handleSelectAll = useCallback(() => {
    if (selected.size === displayedOrders.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(displayedOrders.map((o) => o.id)));
    }
  }, [selected.size, displayedOrders]);

  const handleSelectOne = useCallback((id) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  }, [selected]);

  const handleDeleteOne = useCallback(
    (order) => {
      const isSent = isSentOrder(order);
      Alert.alert(
        STRINGS.alerts.deleteOneTitle,
        STRINGS.alerts.deleteOneMessage,
        [
          { text: STRINGS.alerts.cancel, style: 'cancel' },
          {
            text: STRINGS.alerts.confirmDelete,
            style: 'destructive',
            onPress: async () => {
              try {
                if (isSent) {
                  // Sent orders: hide from UI, keep Firestore intact
                  hideOrderById(order.id);
                  await deleteOrder(order.id).catch(() => {});
                  setFirestoreOrders((prev) => prev.filter((o) => o.id !== order.id));
                } else {
                  // Drafts: delete from local storage AND Firestore so they don't come back on reload
                  await deleteOrder(order.id);
                  await deleteFirestoreOrder(order.id, order.brand, order.orderType).catch(() => {});
                  setFirestoreOrders((prev) => prev.filter((o) => o.id !== order.id));
                }
                setOrders((prev) => prev.filter((o) => o.id !== order.id));
                setSelected((prev) => {
                  const next = new Set(prev);
                  next.delete(order.id);
                  return next;
                });
              } catch {
                Alert.alert(STRINGS.alerts.deleteErrorTitle, STRINGS.alerts.deleteErrorMessage);
              }
            },
          },
        ]
      );
    },
    [hideOrderById]
  );

  const handleDeleteMany = useCallback(async () => {
    if (selected.size === 0) {
      Alert.alert(STRINGS.alerts.noneSelectedTitle, STRINGS.alerts.noneSelectedMessage);
      return;
    }

    Alert.alert(
      STRINGS.alerts.deleteManyTitle,
      STRINGS.alerts.deleteManyMessage(selected.size),
      [
        { text: STRINGS.alerts.cancel, style: 'cancel' },
        {
          text: STRINGS.alerts.confirmDelete,
          style: 'destructive',
          onPress: async () => {
            try {
              const selectedIds = Array.from(selected);
              const sentIds  = selectedIds.filter((id) => isSentOrder(displayedOrders.find((x) => x.id === id)));
              const draftIds = selectedIds.filter((id) => !isSentOrder(displayedOrders.find((x) => x.id === id)));

              // Sent: hide locally, keep Firestore intact
              for (const id of sentIds) {
                hideOrderById(id);
                await deleteOrder(id).catch(() => {});
              }
              // Drafts: delete from local storage AND Firestore
              if (draftIds.length > 0) {
                await deleteMany(draftIds);
                const draftOrders = draftIds.map((id) => displayedOrders.find((x) => x.id === id)).filter(Boolean);
                for (const o of draftOrders) {
                  await deleteFirestoreOrder(o.id, o.brand, o.orderType).catch(() => {});
                }
              }

              setOrders((prev) => prev.filter((o) => !selected.has(o.id)));
              setFirestoreOrders((prev) => prev.filter((o) => !selected.has(o.id)));
              setSelected(new Set());
              Alert.alert(
                STRINGS.alerts.deleteManySuccessTitle,
                STRINGS.alerts.deleteManySuccessMessage(selected.size)
              );
            } catch {
              Alert.alert(STRINGS.alerts.deleteErrorTitle, STRINGS.alerts.deleteErrorMessage);
            }
          },
        },
      ]
    );
  }, [selected, displayedOrders, hideOrderById]);

  const handleEditOrder = useCallback(
    (order) => {
      loadOrder(order);
      if (order?.orderType === 'supermarket') {
        const storePayload = {
          id: order?.storeId || order?.customerId,
          storeName: order?.storeName || order?.customer?.name,
          storeCode: order?.storeCode || order?.customer?.customerCode,
          storeCategory: order?.storeCategory || order?.customer?.storeCategory,
          companyName: order?.companyName || order?.customer?.companyName,
          city: order?.customer?.city || null,
          area: order?.customer?.area || null,
        };
        navigation.navigate('SuperMarketProductSelection', { store: storePayload });
      } else {
        navigation.navigate('OrderProductSelectionScreen');
      }
    },
    [loadOrder, navigation]
  );

  const handleNewOrder = useCallback(() => {
    if (brand) {
      navigation.navigate('OrderCustomerSelectScreen', { brand });
    } else {
      navigation.navigate('OrderCustomerSelectScreen');
    }
  }, [brand, navigation]);

  const handleSalesmanSelect = useCallback((salesman) => {
    if (salesman === null) {
      setSelectedSalesman(null);
    } else {
      setSelectedSalesman(salesman);
    }
    setShowFilterModal(false);
  }, []);

  const clearFilter = useCallback(() => {
    setSelectedSalesman(null);
  }, []);

  const clearDateFilter = useCallback(() => {
    setDateFilter(null);
    setCustomDateRange({ start: null, end: null });
  }, []);

  const disableDateFilter = useCallback(() => {
    clearDateFilter();
    setShowDateModal(false);
    setShowCustomDateModal(false);
  }, [clearDateFilter]);

  const handleDateFilterSelect = useCallback((filterType) => {
    if (filterType === 'custom') {
      setShowDateModal(false);
      setShowCustomDateModal(true);
    } else {
      setDateFilter(filterType);
      setShowDateModal(false);
    }
  }, []);

  const handleCustomDateRange = useCallback((startDate, endDate) => {
    setCustomDateRange({ start: startDate, end: endDate });
    setDateFilter('custom');
    setShowCustomDateModal(false);
  }, []);

  const renderOrderCard = useCallback(
    ({ item: order }) => {
      const isSelected = selected.has(order.id);
      const isSent = isSentOrder(order);
      const isSuperMarket = order?.orderType === 'supermarket';
      const lines = Array.isArray(order?.lines) ? order.lines : [];
      const linesCount = lines.filter((l) => Number(l?.quantity || 0) > 0).length;
      const customerName = isSuperMarket
        ? order?.storeName || order?.customer?.name || STRINGS.card.noCustomer
        : order?.customer?.name || STRINGS.card.noCustomer;
      const displayNumber = order?.number || formatId(order.id);
      const dateValue = isSent
        ? (order?.exportedAt || order?.updatedAt || order?.createdAt)
        : (order?.updatedAt || order?.createdAt);
      const dateLabel = new Date(dateValue || 0).toLocaleDateString('el-GR');
      const finalValue = Number(order?.finalValue || order?.netValue || calcTotals(order).total || 0);
      const days = getDaysSince(order);
      const isStaleAmber = days >= 30 && days < 90;
      const isStaleRed   = days >= 90;

      const leftBorderColor = isStaleRed ? '#E24B4A' : isStaleAmber ? '#EF9F27' : 'transparent';

      return (
        <TouchableOpacity
          style={[styles.orderCard, isSelected && styles.orderCardSelected, { borderLeftColor: leftBorderColor }]}
          onPress={() => handleEditOrder(order)}
          activeOpacity={0.85}
        >
          {/* Left border stale indicator */}
          {/* Main content */}
          <View style={styles.cardInner}>
            {/* Customer name — primary element */}
            <View style={styles.cardTopRow}>
              <Text style={styles.cardCustomer} numberOfLines={1}>{customerName}</Text>
              <Text style={styles.cardTotal}>{formatCurrency(finalValue)}</Text>
            </View>

            {/* Metadata row: code · date · count */}
            <Text style={styles.cardMeta}>
              {displayNumber}
              {dateLabel ? `  ·  ${dateLabel}` : ''}
              {linesCount > 0 ? `  ·  ${linesCount} ${linesCount === 1 ? 'προϊόν' : 'προϊόντα'}` : ''}
            </Text>

            {/* Badge row */}
            <View style={styles.cardBadgeRow}>
              <View style={[styles.badge, isSuperMarket ? styles.badgeSuperMarket : styles.badgeNormal]}>
                <Text style={[styles.badgeText, isSuperMarket ? styles.badgeTextSuper : styles.badgeTextNormal]}>
                  {isSuperMarket ? 'SuperMarket' : 'Κανονική'}
                </Text>
              </View>
              {isStaleAmber && (
                <View style={styles.badgeAmber}>
                  <Text style={styles.badgeAmberText}>{days} ημέρες</Text>
                </View>
              )}
              {isStaleRed && (
                <View style={styles.badgeRed}>
                  <Text style={styles.badgeRedText}>{days} ημέρες</Text>
                </View>
              )}

              {/* Actions pushed to right */}
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                style={styles.cardActionEdit}
                onPress={() => handleEditOrder(order)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
              >
                <Ionicons name={isSent ? 'eye-outline' : 'create-outline'} size={16} color="#555" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cardActionDelete}
                onPress={() => handleDeleteOne(order)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
              >
                <Ionicons name="trash-outline" size={16} color="#A32D2D" />
              </TouchableOpacity>
            </View>
          </View>

          {isSelected && (
            <View style={styles.orderCardSelectedOverlay}>
              <Ionicons name="checkmark-circle" size={22} color="#185FA5" />
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [selected, handleEditOrder, handleDeleteOne]
  );

  const renderDateModal = () => (
    <Modal
      visible={showDateModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowDateModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Φίλτρο Ημερομηνίας</Text>
          <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowDateModal(false)}
            >
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
        </View>

          <View style={styles.modalBody}>
            <ScrollView>
              <TouchableOpacity
                style={[
                  styles.dateFilterItem,
                  !dateFilter && styles.dateFilterItemSelected
                ]}
                onPress={disableDateFilter}
              >
                <Text style={[
                  styles.dateFilterText,
                  !dateFilter && styles.dateFilterTextSelected
                ]}>
                  Χωρίς φίλτρο ημερομηνίας
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.dateFilterItem,
                  dateFilter === 'today' && styles.dateFilterItemSelected
                ]}
                onPress={() => handleDateFilterSelect('today')}
              >
                <Text style={[
                  styles.dateFilterText,
                  dateFilter === 'today' && styles.dateFilterTextSelected
                ]}>
                  Σήμερα
                </Text>
              </TouchableOpacity>

          <TouchableOpacity
                style={[
                  styles.dateFilterItem,
                  dateFilter === 'week' && styles.dateFilterItemSelected
                ]}
                onPress={() => handleDateFilterSelect('week')}
              >
                <Text style={[
                  styles.dateFilterText,
                  dateFilter === 'week' && styles.dateFilterTextSelected
                ]}>
                  Αυτή την εβδομάδα
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.dateFilterItem,
                  dateFilter === 'month' && styles.dateFilterItemSelected
                ]}
                onPress={() => handleDateFilterSelect('month')}
              >
                <Text style={[
                  styles.dateFilterText,
                  dateFilter === 'month' && styles.dateFilterTextSelected
                ]}>
                  Αυτόν τον μήνα
                </Text>
          </TouchableOpacity>

          <TouchableOpacity
                style={[
                  styles.dateFilterItem,
                  dateFilter === 'custom' && styles.dateFilterItemSelected
                ]}
                onPress={() => handleDateFilterSelect('custom')}
              >
                <Text style={[
                  styles.dateFilterText,
                  dateFilter === 'custom' && styles.dateFilterTextSelected
                ]}>
                  Προσαρμοσμένο εύρος
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.clearFilterButton}
              onPress={disableDateFilter}
            >
              <Text style={styles.clearFilterText}>Καθαρισμός Φίλτρου</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderCustomDateModal = () => {

    const MONTH_NAMES = ['Ιαν','Φεβ','Μαρ','Απρ','Μαΐ','Ιουν','Ιουλ','Αυγ','Σεπ','Οκτ','Νοε','Δεκ'];
    const DAY_NAMES   = ['Κυ','Δε','Τρ','Τε','Πε','Πα','Σα'];

    const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
    const getFirstDayOfWeek = (y, m) => new Date(y, m, 1).getDay();

    const handleDayPress = (day) => {
      const picked = new Date(viewYear, viewMonth, day);
      if (calStep === 'start') {
        setCustomDateRange({ start: picked, end: null });
        setCalStep('end');
      } else {
        const start = customDateRange.start;
        if (start && picked < start) {
          setCustomDateRange({ start: picked, end: null });
          setCalStep('end');
        } else {
          setCustomDateRange(prev => ({ ...prev, end: picked }));
          setCalStep('start');
        }
      }
    };

    const prevMonth = () => {
      if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
      else setViewMonth(m => m - 1);
    };
    const nextMonth = () => {
      if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
      else setViewMonth(m => m + 1);
    };

    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDow    = getFirstDayOfWeek(viewYear, viewMonth);
    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const isSel = (d) => {
      if (!d) return false;
      const dt = new Date(viewYear, viewMonth, d);
      const s  = customDateRange.start;
      const e  = customDateRange.end;
      if (s && dt.toDateString() === s.toDateString()) return 'start';
      if (e && dt.toDateString() === e.toDateString()) return 'end';
      if (s && e && dt > s && dt < e) return 'range';
      return false;
    };

    const fmtDate = (d) => d ? d.toLocaleDateString('el-GR') : '—';

    return (
      <Modal
        visible={showCustomDateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCustomDateModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <View style={[styles.calModal, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Επιλογή εύρους ημερομηνιών</Text>
              <TouchableOpacity onPress={() => setShowCustomDateModal(false)}>
                <Ionicons name="close" size={22} color="#555" />
              </TouchableOpacity>
            </View>

            {/* Step indicator */}
            <View style={styles.calStepRow}>
              <TouchableOpacity
                style={[styles.calStepChip, calStep === 'start' && styles.calStepChipActive]}
                onPress={() => setCalStep('start')}
              >
                <Text style={[styles.calStepLabel, calStep === 'start' && styles.calStepLabelActive]}>
                  Από: {fmtDate(customDateRange.start)}
                </Text>
              </TouchableOpacity>
              <Ionicons name="arrow-forward" size={16} color="#aaa" />
              <TouchableOpacity
                style={[styles.calStepChip, calStep === 'end' && styles.calStepChipActive]}
                onPress={() => setCalStep('end')}
              >
                <Text style={[styles.calStepLabel, calStep === 'end' && styles.calStepLabelActive]}>
                  Έως: {fmtDate(customDateRange.end)}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Month navigation */}
            <View style={styles.calNavRow}>
              <TouchableOpacity onPress={prevMonth} style={styles.calNavBtn}>
                <Ionicons name="chevron-back" size={20} color="#185FA5" />
              </TouchableOpacity>
              <Text style={styles.calMonthLabel}>
                {MONTH_NAMES[viewMonth]} {viewYear}
              </Text>
              <TouchableOpacity onPress={nextMonth} style={styles.calNavBtn}>
                <Ionicons name="chevron-forward" size={20} color="#185FA5" />
              </TouchableOpacity>
            </View>

            {/* Day headers */}
            <View style={styles.calDayHeaders}>
              {DAY_NAMES.map(d => (
                <Text key={d} style={styles.calDayHeader}>{d}</Text>
              ))}
            </View>

            {/* Days grid */}
            <View style={styles.calGrid}>
              {cells.map((day, idx) => {
                const sel = isSel(day);
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.calCell,
                      !day && styles.calCellEmpty,
                      (sel === 'start' || sel === 'end') && styles.calCellSel,
                      sel === 'range' && styles.calCellRange,
                    ]}
                    onPress={() => day && handleDayPress(day)}
                    disabled={!day}
                  >
                    <Text style={[
                      styles.calCellText,
                      (sel === 'start' || sel === 'end') && styles.calCellTextSel,
                      sel === 'range' && styles.calCellTextRange,
                    ]}>
                      {day || ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.clearFilterButton}
                onPress={() => {
                  setCustomDateRange({ start: null, end: null });
                  setDateFilter(null);
                  setCalStep('start');
                  setShowCustomDateModal(false);
                }}
              >
                <Text style={styles.clearFilterText}>Καθαρισμός</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.clearFilterButton, { backgroundColor: customDateRange.start && customDateRange.end ? '#185FA5' : '#ccc' }]}
                onPress={() => {
                  if (customDateRange.start && customDateRange.end) {
                    handleCustomDateRange(customDateRange.start, customDateRange.end);
                    setCalStep('start');
                  }
                }}
                disabled={!customDateRange.start || !customDateRange.end}
              >
                <Text style={[styles.clearFilterText, { color: customDateRange.start && customDateRange.end ? '#fff' : '#999' }]}>
                  Εφαρμογή
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };


  const renderFilterModal = () => (
    <Modal
      visible={showFilterModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowFilterModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{STRINGS.filter.title}</Text>
          <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowFilterModal(false)}
          >
              <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

          <View style={styles.modalBody}>
            {loadingSalesmen ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.loadingText}>{STRINGS.filter.loadingSalesmen}</Text>
      </View>
            ) : salesmen.length === 0 ? (
              <Text style={styles.emptyText}>{STRINGS.filter.noSalesmen}</Text>
            ) : (
              <ScrollView>
                <TouchableOpacity
                  style={[
                    styles.salesmanItem,
                    !selectedSalesman && styles.salesmanItemSelected
                  ]}
                  onPress={() => handleSalesmanSelect(null)}
                >
                  <Text style={[
                    styles.salesmanText,
                    !selectedSalesman && styles.salesmanTextSelected
                  ]}>
                    {STRINGS.filter.allSalesmen}
                  </Text>
                </TouchableOpacity>

                {salesmen.map((salesman) => (
                  <TouchableOpacity
                    key={salesman.id}
                    style={[
                      styles.salesmanItem,
                      selectedSalesman?.id === salesman.id && styles.salesmanItemSelected
                    ]}
                    onPress={() => handleSalesmanSelect(salesman)}
                  >
                    <View style={styles.salesmanItemContent}>
                      <Text style={[
                        styles.salesmanText,
                        selectedSalesman?.id === salesman.id && styles.salesmanTextSelected
                      ]}>
                        {salesman.name}
                      </Text>
                      <View style={styles.salesmanInfo}>
                        <Text style={styles.salesmanBrand}>{salesman.brand}</Text>
                        <Text style={styles.salesmanUserCount}>
                          {salesman.users?.length || 0} χρήστες
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.clearFilterButton}
              onPress={clearFilter}
            >
              <Text style={styles.clearFilterText}>{STRINGS.filter.clearFilter}</Text>
          </TouchableOpacity>
        </View>
      </View>
      </View>
    </Modal>
    );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>{STRINGS.loading}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackToBrandHome}>
          <Ionicons name="arrow-back" size={22} color="#185FA5" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{STRINGS.title}</Text>
        <TouchableOpacity style={styles.newOrderButton} onPress={handleNewOrder}>
          <Ionicons name="add" size={22} color="#185FA5" />
        </TouchableOpacity>
      </View>

      {/* ── Summary Bar ── */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>Πρόχειρα</Text>
          <Text style={styles.summaryValue}>{draftCount}</Text>
        </View>
        <View style={styles.summarySep} />
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>Σύνολο</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalDraftValue)}</Text>
        </View>
        <View style={styles.summarySep} />
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>Παλαιά</Text>
          <Text style={[styles.summaryValue, { color: '#BA7517' }]}>{staleCount}</Text>
        </View>
      </View>

      {/* ── Tab Bar ── */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'drafts' && styles.tabActive]}
          onPress={() => setActiveTab('drafts')}
        >
          <View style={styles.tabInner}>
            <Text style={[styles.tabText, activeTab === 'drafts' && styles.tabTextActive]}>
              {STRINGS.tabs.drafts}
            </Text>
            {draftCount > 0 && (
              <View style={[styles.tabBadge, activeTab === 'drafts' && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === 'drafts' && styles.tabBadgeTextActive]}>
                  {draftCount}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'sent' && styles.tabActive]}
          onPress={() => setActiveTab('sent')}
        >
          <View style={styles.tabInner}>
            <Text style={[styles.tabText, activeTab === 'sent' && styles.tabTextActive]}>
              {STRINGS.tabs.sent}
            </Text>
            {sentCount > 0 && (
              <View style={[styles.tabBadge, activeTab === 'sent' && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === 'sent' && styles.tabBadgeTextActive]}>
                  {sentCount}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Search Bar ── */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color="#aaa" style={{ marginRight: 6 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Αναζήτηση πελάτη ή αρ. παραγγελίας..."
          placeholderTextColor="#aaa"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {/* ── Filter Pills ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pillScrollView}
        contentContainerStyle={styles.pillRow}
      >
        {[
          { key: 'all',         label: 'Όλες' },
          { key: 'standard',    label: 'Κανονικές' },
          { key: 'supermarket', label: 'SuperMarket' },
          { key: 'stale',       label: 'Παλαιές' },
        ].map(({ key, label }) => {
          const isActive = orderTypeFilter === key;
          const isStale  = key === 'stale';
          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.pill,
                isActive && !isStale && styles.pillActive,
                isActive && isStale  && styles.pillStaleActive,
                !isActive && isStale && styles.pillStaleInactive,
              ]}
              onPress={() => setOrderTypeFilter(key)}
            >
              <Text style={[
                styles.pillText,
                isActive && !isStale && styles.pillTextActive,
                isStale && styles.pillTextStale,
              ]}>{label}</Text>
            </TouchableOpacity>
          );
        })}

        {/* Toolbar icons in pill row */}
        {(canAccessFirestoreOrders || canFilterBySalesman) && (
          <TouchableOpacity
            style={[styles.pill, dateFilter && styles.dateToolPillActive]}
            onPress={() => {
              if (dateFilter) {
                disableDateFilter();
                return;
              }
              setShowDateModal(true);
            }}
          >
            <Ionicons name="calendar-outline" size={14} color={dateFilter ? '#854F0B' : '#888'} />
            {dateFilter && <View style={styles.activeDot} />}
          </TouchableOpacity>
        )}
        {canFilterBySalesman && (
          <TouchableOpacity
            style={[styles.pill, selectedSalesman && styles.pillActive]}
            onPress={() => setShowFilterModal(true)}
          >
            <Ionicons name="filter-outline" size={14} color={selectedSalesman ? '#185FA5' : '#888'} />
          </TouchableOpacity>
        )}
        {selected.size > 0 && (
          <TouchableOpacity
            style={[styles.pill, { backgroundColor: '#FCEBEB', borderColor: '#F7C1C1', borderWidth: 1 }]}
            onPress={handleDeleteMany}
          >
            <Ionicons name="trash-outline" size={14} color="#A32D2D" />
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ── Order List ── */}
      <FlatList
        data={slicedOrders}
        renderItem={renderOrderCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListFooterComponent={
          displayedOrders.length > visibleCount ? (
            <TouchableOpacity
              style={styles.showMoreBtn}
              onPress={() => setVisibleCount((v) => v + 20)}
            >
              <Text style={styles.showMoreText}>
                + {displayedOrders.length - visibleCount} ακόμα {activeTab === 'drafts' ? 'πρόχειρες' : 'απεσταλμένες'} παραγγελίες
              </Text>
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name={activeTab === 'sent' ? 'checkmark-done-outline' : 'document-outline'}
              size={52}
              color="#D1D5DB"
            />
            <Text style={styles.emptyText}>{emptyTabMessage}</Text>
          </View>
        }
      />

      {/* ── Legend ── */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#185FA5' }]} />
          <Text style={styles.legendText}>Πρόσφατη</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#EF9F27' }]} />
          <Text style={styles.legendText}>Παλαιά ({'>'}30 μέρες)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#E24B4A' }]} />
          <Text style={styles.legendText}>Πολύ παλαιά ({'>'}90 μέρες)</Text>
        </View>
      </View>

      {/* ── Modals ── */}
      {renderFilterModal()}
      {renderDateModal()}
      {renderCustomDateModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Layout ───────────────────────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: '#f7f5f0',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7f5f0',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#888',
  },

  // ── Header ───────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0ddd6',
  },
  backButton: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: '#1a1a1a',
    letterSpacing: 0.1,
  },
  newOrderButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#E6F1FB',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Summary Bar ───────────────────────────────────────────────────────────
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: '#ece9e3',
    paddingVertical: 10,
    paddingHorizontal: 0,
  },
  summaryCol: {
    flex: 1,
    alignItems: 'center',
  },
  summarySep: {
    width: 0.5,
    backgroundColor: '#ccc8c0',
    marginVertical: 4,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#888',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.3,
  },

  // ── Tabs ──────────────────────────────────────────────────────────────────
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0ddd6',
  },
  tab: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#185FA5',
  },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabText: {
    fontSize: 15,
    color: '#888',
    fontWeight: '400',
  },
  tabTextActive: {
    color: '#185FA5',
    fontWeight: '600',
  },
  tabBadge: {
    backgroundColor: '#e5e5e5',
    borderRadius: 999,
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    alignItems: 'center',
  },
  tabBadgeActive: {
    backgroundColor: '#E6F1FB',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
  },
  tabBadgeTextActive: {
    color: '#185FA5',
  },

  // ── Search Bar ────────────────────────────────────────────────────────────
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#EEECE7',
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1a1a1a',
    padding: 0,
  },

  // ── Filter Pills ──────────────────────────────────────────────────────────
  pillScrollView: {
    flexGrow: 0,
    flexShrink: 0,
  },
  pillRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 8,
    alignItems: 'center',
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#EEECE7',
    borderWidth: 1,
    borderColor: '#dedad3',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pillActive: {
    backgroundColor: '#185FA5',
    borderColor: '#185FA5',
  },
  dateToolPillActive: {
    backgroundColor: '#FAEEDA',
    borderColor: '#FAC775',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#BA7517',
    marginLeft: 2,
  },
  pillText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
  },
  pillTextActive: {
    color: '#fff',
  },
  pillTextStale: {
    color: '#854F0B',
  },
  pillStaleInactive: {
    backgroundColor: '#FAEEDA',
    borderColor: '#FAC775',
  },
  pillStaleActive: {
    backgroundColor: '#EF9F27',
    borderColor: '#EF9F27',
  },

  // ── Order List ────────────────────────────────────────────────────────────
  listContainer: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0ddd6',
    borderLeftWidth: 3,
    paddingVertical: 12,
    paddingRight: 12,
    paddingLeft: 10,
    position: 'relative',
  },
  orderCardSelected: {
    backgroundColor: '#F0F7FF',
  },
  cardInner: {
    flex: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  cardCustomer: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginRight: 10,
  },
  cardTotal: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  cardMeta: {
    fontSize: 12,
    color: '#888',
    marginBottom: 7,
  },
  cardBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeNormal: {
    backgroundColor: '#E6F1FB',
  },
  badgeSuperMarket: {
    backgroundColor: '#E6F1FB',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  badgeTextNormal: {
    color: '#185FA5',
  },
  badgeTextSuper: {
    color: '#185FA5',
  },
  badgeAmber: {
    backgroundColor: '#FAEEDA',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeAmberText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#854F0B',
  },
  badgeRed: {
    backgroundColor: '#FCEBEB',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeRedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A32D2D',
  },
  cardActionEdit: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#f0ede8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardActionDelete: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FCEBEB',
    borderWidth: 1,
    borderColor: '#F7C1C1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderCardSelectedOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
  },

  // ── Show more ─────────────────────────────────────────────────────────────
  showMoreBtn: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  showMoreText: {
    fontSize: 13,
    color: '#888',
  },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    marginTop: 12,
  },

  // ── Legend ────────────────────────────────────────────────────────────────
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#f7f5f0',
    borderTopWidth: 0.5,
    borderTopColor: '#e0ddd6',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: '#888',
  },

  // ── Modals ────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0ddd6',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    maxHeight: 300,
    padding: 8,
  },
  modalFooter: {
    padding: 14,
    borderTopWidth: 0.5,
    borderTopColor: '#e0ddd6',
    flexDirection: 'row',
    gap: 10,
  },
  salesmanItem: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 2,
    backgroundColor: '#F9FAFB',
  },
  salesmanItemSelected: {
    backgroundColor: '#185FA5',
  },
  salesmanText: {
    fontSize: 15,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  salesmanTextSelected: {
    color: '#fff',
  },
  salesmanItemContent: { flex: 1 },
  salesmanInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  salesmanBrand: { fontSize: 12, color: '#888' },
  salesmanUserCount: { fontSize: 11, color: '#aaa', fontStyle: 'italic' },
  clearFilterButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  clearFilterText: {
    color: '#555',
    fontSize: 14,
    fontWeight: '500',
  },
  dateFilterItem: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 2,
    backgroundColor: '#F9FAFB',
  },
  dateFilterItemSelected: {
    backgroundColor: '#185FA5',
  },
  dateFilterText: {
    fontSize: 15,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  dateFilterTextSelected: {
    color: '#fff',
  },
  dateInputContainer: { marginBottom: 16 },
  dateInputLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  dateInput: {
    borderWidth: 1.5,
    borderColor: '#185FA5',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#fff',
    fontWeight: '500',
  },

  // ── Calendar date picker ──────────────────────────────────────────────────
  calModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  calStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f7f5f0',
  },
  calStepChip: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#EEECE7',
    alignItems: 'center',
  },
  calStepChipActive: {
    backgroundColor: '#E6F1FB',
    borderWidth: 1.5,
    borderColor: '#185FA5',
  },
  calStepLabel: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  calStepLabelActive: {
    color: '#185FA5',
    fontWeight: '700',
  },
  calNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  calNavBtn: {
    padding: 6,
  },
  calMonthLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: 0.2,
  },
  calDayHeaders: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    marginBottom: 4,
  },
  calDayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: '#aaa',
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    paddingBottom: 6,
  },
  calCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 999,
  },
  calCellEmpty: {
    opacity: 0,
  },
  calCellSel: {
    backgroundColor: '#185FA5',
  },
  calCellRange: {
    backgroundColor: '#E6F1FB',
    borderRadius: 0,
  },
  calCellText: {
    fontSize: 14,
    color: '#1a1a1a',
  },
  calCellTextSel: {
    color: '#fff',
    fontWeight: '700',
  },
  calCellTextRange: {
    color: '#185FA5',
  },
});

