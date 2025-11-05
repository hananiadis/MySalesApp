import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Alert, ScrollView, Modal, TextInput } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';

import { getOrders, deleteOrder, deleteMany } from '../utils/localOrders';
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
    cancel: 'Άκυρο',
    confirmDelete: 'Διαγραφή',
    deleteManyTitle: 'Διαγραφή επιλεγμένων',
    deleteManyMessage: (count) => `Να διαγραφούν οριστικά οι ${count} επιλεγμένες παραγγελίες;`,
    noneSelectedTitle: 'Καμία επιλογή',
    noneSelectedMessage: 'Δεν έχετε επιλέξει παραγγελίες.',
    deleteErrorTitle: 'Σφάλμα',
    deleteErrorMessage: 'Η διαγραφή απέτυχε. Δοκιμάστε ξανά.',
    deleteManySuccessTitle: 'Ολοκληρώθηκε',
    deleteManySuccessMessage: (count) => `${count} παραγγελίες διαγράφηκαν.`,
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
  return `${STRINGS.totals.currencySymbol}${amount.toFixed(2)}`;
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
  const [loading, setLoading] = useState(true);
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

  const rawBrand = typeof route?.params?.brand === 'string' ? route.params.brand : null;
  const brand = useMemo(
    () => (rawBrand ? normalizeBrandKey(rawBrand) : null),
    [rawBrand]
  );

  const handleBackToBrandHome = useCallback(() => {
    const targetBrand = brand || 'playmobil';
    navigation.navigate('BrandHome', { brand: targetBrand });
  }, [brand, navigation]);

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = navigation.addListener('beforeRemove', (event) => {
        if (event.data.action?.type === 'GO_BACK') {
          event.preventDefault();
          handleBackToBrandHome();
        }
      });
      return () => unsubscribe();
    }, [handleBackToBrandHome, navigation])
  );

  // Check if user can filter orders by salesman
  const canFilterBySalesman = useMemo(() => {
    return hasRole([ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER, ROLES.SALES_MANAGER]);
  }, [hasRole, ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER, ROLES.SALES_MANAGER]);

  // Check if user can access Firestore orders
  const canAccessFirestoreOrders = useMemo(() => {
    return hasRole([ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER, ROLES.SALES_MANAGER]);
  }, [hasRole, ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER, ROLES.SALES_MANAGER]);

  // Check if user should only see local orders
  const shouldOnlySeeLocalOrders = useMemo(() => {
    return hasRole([ROLES.SALESMAN, ROLES.WAREHOUSE_MANAGER, ROLES.CUSTOMER]);
  }, [hasRole, ROLES.SALESMAN, ROLES.WAREHOUSE_MANAGER, ROLES.CUSTOMER]);

  const brandScopedOrders = useMemo(() => {
    const allOrders = [...orders, ...firestoreOrders];
    if (!brand) return allOrders;
    return allOrders.filter((order) => normalizeBrandKey(order?.brand || 'playmobil') === brand);
  }, [brand, orders, firestoreOrders]);

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
    
    return filtered;
  }, [brandScopedOrders, activeTab, orderTypeFilter, dateFilter, customDateRange, selectedSalesman, canFilterBySalesman]);

  const emptyTabMessage = activeTab === 'sent' ? STRINGS.empty.sent : STRINGS.empty.drafts;

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
      } else if (hasRole([ROLES.SALES_MANAGER])) {
        // Sales managers: orders from their managed salesmen
        if (profile?.merchIds?.length > 0) {
          const linkedUserIds = new Set();
          
          for (const merchId of profile.merchIds) {
            if (typeof merchId === 'string' && merchId.includes('_')) {
              // Find users linked to this salesman
              const usersSnapshot = await firestore()
                .collection('users')
                .where('merchIds', 'array-contains', merchId)
                .get();
              
              usersSnapshot.docs.forEach(doc => {
                linkedUserIds.add(doc.data().uid || doc.id);
              });
            }
          }
          
          filtered = filtered.filter(order => linkedUserIds.has(order.userId));
        }
      }
      
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

  const loadFirestoreOrders = useCallback(async () => {
    if (!canAccessFirestoreOrders || !profile?.uid) return;
    
    try {
      const allFirestoreOrders = [];
      
      if (hasRole([ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER])) {
        // Load all orders from all collections
        const collections = ['orders', 'orders_kivos', 'orders_john', 'orders_john_supermarket'];
        
        for (const collectionName of collections) {
          try {
            const snapshot = await firestore()
              .collection(collectionName)
              .select('id', 'customerId', 'customer', 'userId', 'createdBy', 'createdAt', 'updatedAt', 'firestoreCreatedAt', 'status', 'sent', 'exportedAt', 'brand', 'netValue', 'finalValue', 'lines', 'orderType', 'storeName', 'storeCode', 'storeCategory')
              .orderBy('updatedAt', 'desc')
              .limit(100) // Limit for performance
              .get();
            
            const collectionOrders = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
              source: 'firestore',
              collection: collectionName,
              isHeaderOnly: true // Flag to indicate we need to load full details later
            }));
            
            allFirestoreOrders.push(...collectionOrders);
          } catch (error) {
            console.log(`Error loading orders from ${collectionName}:`, error);
          }
        }
      } else if (hasRole([ROLES.SALES_MANAGER])) {
        // Load orders from salesmen linked to this sales manager
        if (profile?.merchIds?.length > 0) {
          // Get all users linked to the salesmen this sales manager manages
          const linkedUserIds = new Set();
          
          for (const merchId of profile.merchIds) {
            if (typeof merchId === 'string' && merchId.includes('_')) {
              const salesmanName = merchId.split('_').slice(1).join('_');
              
              // Find users linked to this salesman
              const usersSnapshot = await firestore()
                .collection('users')
                .where('merchIds', 'array-contains', merchId)
                .get();
              
              usersSnapshot.docs.forEach(doc => {
                linkedUserIds.add(doc.data().uid || doc.id);
              });
            }
          }
          
          // Load orders for these users from all collections
          const collections = ['orders', 'orders_kivos', 'orders_john', 'orders_john_supermarket'];
          
          for (const collectionName of collections) {
            try {
              const snapshot = await firestore()
                .collection(collectionName)
                .select('id', 'customerId', 'customer', 'userId', 'createdBy', 'createdAt', 'updatedAt', 'firestoreCreatedAt', 'status', 'sent', 'exportedAt', 'brand', 'netValue', 'finalValue', 'lines', 'orderType', 'storeName', 'storeCode', 'storeCategory')
                .where('userId', 'in', Array.from(linkedUserIds))
                .orderBy('updatedAt', 'desc')
                .limit(100) // Limit for performance
                .get();
              
              const collectionOrders = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                source: 'firestore',
                collection: collectionName,
                isHeaderOnly: true // Flag to indicate we need to load full details later
              }));
              
              allFirestoreOrders.push(...collectionOrders);
            } catch (error) {
              console.log(`Error loading orders from ${collectionName}:`, error);
            }
          }
        }
      } else {
        // Non-admin users: only their own orders
        const collections = ['orders', 'orders_kivos', 'orders_john', 'orders_john_supermarket'];
        
        for (const collectionName of collections) {
          try {
            const snapshot = await firestore()
              .collection(collectionName)
              .select('id', 'customerId', 'customer', 'userId', 'createdBy', 'createdAt', 'updatedAt', 'firestoreCreatedAt', 'status', 'sent', 'exportedAt', 'brand', 'netValue', 'finalValue', 'lines', 'orderType', 'storeName', 'storeCode', 'storeCategory')
              .where('userId', '==', profile.uid)
              .orderBy('updatedAt', 'desc')
              .limit(100) // Limit for performance
              .get();
            
            const collectionOrders = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
              source: 'firestore',
              collection: collectionName,
              isHeaderOnly: true // Flag to indicate we need to load full details later
            }));
            
            allFirestoreOrders.push(...collectionOrders);
          } catch (error) {
            console.log(`Error loading orders from ${collectionName}:`, error);
          }
        }
      }
      
      setFirestoreOrders(allFirestoreOrders);
    } catch (error) {
      console.error('Error loading Firestore orders:', error);
      setFirestoreOrders([]);
    }
  }, [canAccessFirestoreOrders, profile?.uid, profile?.merchIds, hasRole, ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER, ROLES.SALES_MANAGER]);

  const loadSalesmen = useCallback(async () => {
    if (!canFilterBySalesman || !profile?.brands?.length) return;
    
    setLoadingSalesmen(true);
    try {
      // Get salesmen from the salesmen collection
      const salesmenSnapshot = await firestore()
        .collection('salesmen')
        .where('brand', 'in', profile.brands)
        .get();
      
      const salesmenData = salesmenSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || doc.data().merch || 'Άγνωστος',
        brand: doc.data().brand,
        ...doc.data()
      }));
      
      // Get users who have these salesmen linked
      const usersSnapshot = await firestore()
        .collection('users')
        .get();
      
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        uid: doc.data().uid || doc.id,
        name: doc.data().name || '',
        email: doc.data().email || '',
        merchIds: Array.isArray(doc.data().merchIds) ? doc.data().merchIds : [],
        brands: Array.isArray(doc.data().brands) ? doc.data().brands : [],
        ...doc.data()
      }));
      
      // Create a mapping of salesman names to user IDs
      const salesmanToUsers = new Map();
      
      usersData.forEach(user => {
        if (user.merchIds && user.merchIds.length > 0) {
          user.merchIds.forEach(merchId => {
            // Extract salesman name from merchId (format: "brand_NAME")
            if (typeof merchId === 'string' && merchId.includes('_')) {
              const salesmanName = merchId.split('_').slice(1).join('_');
              if (!salesmanToUsers.has(salesmanName)) {
                salesmanToUsers.set(salesmanName, []);
              }
              salesmanToUsers.get(salesmanName).push(user);
            }
          });
        }
      });
      
      // Add user information to salesmen
      const salesmenWithUsers = salesmenData.map(salesman => ({
        ...salesman,
        users: salesmanToUsers.get(salesman.name) || []
      }));
      
      setSalesmen(salesmenWithUsers);
    } catch (error) {
      console.error('Error loading salesmen:', error);
      Alert.alert('Σφάλμα', 'Προέκυψε πρόβλημα κατά τη φόρτωση των πωλητών.');
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
                await deleteOrder(order.id);
                setOrders((prev) => prev.filter((o) => o.id !== order.id));
                setSelected((prev) => {
                  const newSet = new Set(prev);
                  newSet.delete(order.id);
                  return newSet;
                });
              } catch (error) {
              Alert.alert(STRINGS.alerts.deleteErrorTitle, STRINGS.alerts.deleteErrorMessage);
            }
          },
        },
        ]
    );
    },
    []
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
              await deleteMany(Array.from(selected));
              setOrders((prev) => prev.filter((o) => !selected.has(o.id)));
              setSelected(new Set());
              Alert.alert(
                STRINGS.alerts.deleteManySuccessTitle,
                STRINGS.alerts.deleteManySuccessMessage(selected.size)
              );
            } catch (error) {
              Alert.alert(STRINGS.alerts.deleteErrorTitle, STRINGS.alerts.deleteErrorMessage);
            }
          },
        },
      ]
    );
  }, [selected]);

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
      const totals = calcTotals(order);
      const isSent = isSentOrder(order);
      const isSuperMarket = order?.orderType === 'supermarket';
      const customerName = isSuperMarket
        ? order?.storeName || order?.customer?.name || STRINGS.card.noCustomer
        : order?.customer?.name || STRINGS.card.noCustomer;

    return (
        <TouchableOpacity
          style={[styles.orderCard, isSelected && styles.orderCardSelected]}
          onPress={() => handleSelectOne(order.id)}
          onLongPress={() => handleEditOrder(order)}
        >
          <View style={styles.orderCardContent}>
            <View style={styles.orderCardLeft}>
              <Text style={styles.orderId}>#{formatId(order.id)}</Text>
              <Text style={styles.customerName}>
                {customerName}
              </Text>
              {isSuperMarket && (
                <Text style={styles.superMarketMeta}>
                  SuperMarket · {order?.storeCode || order?.customer?.customerCode || '-'}
                </Text>
              )}
              <Text style={styles.orderDate}>
                {new Date(order?.updatedAt || order?.createdAt || 0).toLocaleDateString('el-GR')}
            </Text>
          </View>
            
            <View style={styles.orderCardRight}>
              <Text style={styles.orderTotal}>{formatCurrency(totals.total)}</Text>
              <View style={[styles.orderTypeChipIndicator, isSuperMarket && styles.orderTypeChipIndicatorSuper]}>
                <Text style={[styles.orderTypeChipTextIndicator, isSuperMarket && styles.orderTypeChipTextIndicatorSuper]}>
                  {isSuperMarket ? STRINGS.orderTypes.supermarket : STRINGS.orderTypes.standard}
                </Text>
              </View>
              <View style={[styles.statusChip, isSent ? styles.statusChipSent : styles.statusChipDraft]}>
                <Text style={[styles.statusChipText, isSent ? styles.statusChipTextSent : styles.statusChipTextDraft]}>
                  {isSent ? STRINGS.chips.sent : STRINGS.chips.draft}
            </Text>
          </View>
              <View style={styles.orderCardActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleEditOrder(order)}
                >
                  <Ionicons name="create-outline" size={14} color="#007AFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleDeleteOne(order)}
                >
                  <Ionicons name="trash-outline" size={14} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </View>
        </View>

          {isSelected && (
            <View style={styles.orderCardSelectedOverlay}>
              <Ionicons name="checkmark-circle" size={20} color="#007AFF" />
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [selected, handleSelectOne, handleEditOrder, handleDeleteOne]
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
              onPress={clearDateFilter}
            >
              <Text style={styles.clearFilterText}>Καθαρισμός Φίλτρου</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderCustomDateModal = () => (
    <Modal
      visible={showCustomDateModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowCustomDateModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Προσαρμοσμένο Εύρος Ημερομηνιών</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowCustomDateModal(false)}
            >
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <View style={styles.dateInputContainer}>
              <Text style={styles.dateInputLabel}>Από:</Text>
              <TextInput
                style={styles.dateInput}
                placeholder="DD/MM/YYYY"
                value={customDateRange.start ? formatDateToDDMMYYYY(customDateRange.start) : ''}
                onChangeText={(text) => {
                  if (text) {
                    const date = parseDDMMYYYYDate(text);
                    if (date && !isNaN(date.getTime())) {
                      setCustomDateRange(prev => ({ ...prev, start: date }));
                    }
                  }
                }}
              />
            </View>
            
            <View style={styles.dateInputContainer}>
              <Text style={styles.dateInputLabel}>Έως:</Text>
              <TextInput
                style={styles.dateInput}
                placeholder="DD/MM/YYYY"
                value={customDateRange.end ? formatDateToDDMMYYYY(customDateRange.end) : ''}
                onChangeText={(text) => {
                  if (text) {
                    const date = parseDDMMYYYYDate(text);
                    if (date && !isNaN(date.getTime())) {
                      setCustomDateRange(prev => ({ ...prev, end: date }));
                    }
                  }
                }}
              />
            </View>
          </View>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.clearFilterButton}
              onPress={() => setShowCustomDateModal(false)}
            >
              <Text style={styles.clearFilterText}>Άκυρο</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.clearFilterButton, { backgroundColor: '#007AFF' }]}
              onPress={() => {
                if (customDateRange.start && customDateRange.end) {
                  handleCustomDateRange(customDateRange.start, customDateRange.end);
                }
              }}
            >
              <Text style={[styles.clearFilterText, { color: '#fff' }]}>Εφαρμογή</Text>
          </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
          onPress={() => navigation.goBack()}
          >
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{STRINGS.title}</Text>
        <TouchableOpacity
          style={styles.newOrderButton}
          onPress={handleNewOrder}
        >
          <Ionicons name="add" size={24} color="#007AFF" />
        </TouchableOpacity>
        </View>

      {/* Tabs */}
      <View style={styles.tabs}>
          <TouchableOpacity
          style={[styles.tab, activeTab === 'drafts' && styles.tabActive]}
            onPress={() => setActiveTab('drafts')}
          >
            <Text style={[styles.tabText, activeTab === 'drafts' && styles.tabTextActive]}>
              {STRINGS.tabs.drafts}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
          style={[styles.tab, activeTab === 'sent' && styles.tabActive]}
            onPress={() => setActiveTab('sent')}
          >
            <Text style={[styles.tabText, activeTab === 'sent' && styles.tabTextActive]}>
              {STRINGS.tabs.sent}
            </Text>
          </TouchableOpacity>
        </View>

      {/* Order type filter */}
      <View style={styles.orderTypeRow}>
        {['all', 'standard', 'supermarket'].map((typeKey) => {
          const isActive = orderTypeFilter === typeKey;
          const label = STRINGS.orderTypes[typeKey];
          return (
            <TouchableOpacity
              key={typeKey}
              style={[styles.orderTypeChip, isActive && styles.orderTypeChipActive]}
              onPress={() => setOrderTypeFilter(typeKey)}
            >
              <Text style={[styles.orderTypeChipText, isActive && styles.orderTypeChipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <View style={styles.toolbarLeft}>
          <TouchableOpacity
            style={styles.toolbarButton}
            onPress={handleSelectAll}
          >
            <Text style={styles.toolbarButtonText}>{STRINGS.toolbar.selectAll}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.toolbarRight}>
          {(canAccessFirestoreOrders || canFilterBySalesman) && (
            <TouchableOpacity
              style={[styles.toolbarButton, dateFilter && styles.toolbarBtnActive]}
              onPress={() => setShowDateModal(true)}
            >
              <Ionicons name="calendar" size={16} color={dateFilter ? "#fff" : "#007AFF"} />
          </TouchableOpacity>
          )}
          {canFilterBySalesman && (
            <TouchableOpacity
              style={[styles.toolbarButton, selectedSalesman && styles.toolbarBtnActive]}
              onPress={() => setShowFilterModal(true)}
            >
              <Ionicons name="filter" size={16} color={selectedSalesman ? "#fff" : "#007AFF"} />
            </TouchableOpacity>
          )}
          {selected.size > 0 && (
            <TouchableOpacity
              style={[styles.toolbarButton, styles.toolbarButtonDanger]}
              onPress={handleDeleteMany}
            >
              <Text style={styles.toolbarButtonText}>{STRINGS.toolbar.delete}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Orders List */}
        <FlatList
          data={displayedOrders}
        renderItem={renderOrderCard}
          keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{emptyTabMessage}</Text>
          </View>
        }
      />

      {/* Filter Modal */}
      {renderFilterModal()}
      
      {/* Date Filter Modal */}
      {renderDateModal()}
      
      {/* Custom Date Range Modal */}
      {renderCustomDateModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  newOrderButton: {
    padding: 8,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  orderTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  orderTypeChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  orderTypeChipActive: {
    backgroundColor: '#DBEAFE',
  },
  orderTypeChipText: {
    color: '#1f2937',
    fontSize: 13,
    fontWeight: '500',
  },
  orderTypeChipTextActive: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  toolbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolbarButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    marginLeft: 8,
  },
  toolbarBtnActive: {
    backgroundColor: '#007AFF',
  },
  toolbarButtonDanger: {
    backgroundColor: '#FF3B30',
  },
  toolbarButtonText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  listContainer: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    position: 'relative',
  },
  orderCardSelected: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  orderCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderCardLeft: {
    flex: 1,
    marginRight: 12,
  },
  orderCardRight: {
    alignItems: 'flex-end',
  },
  superMarketMeta: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '500',
    marginTop: 2,
  },
  orderTypeChipIndicator: {
    alignSelf: 'flex-start',
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 6,
  },
  orderTypeChipIndicatorSuper: {
    backgroundColor: '#bfdbfe',
  },
  orderTypeChipTextIndicator: {
    fontSize: 11,
    color: '#374151',
    fontWeight: '600',
  },
  orderTypeChipTextIndicatorSuper: {
    color: '#1d4ed8',
  },
  orderId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  orderDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  statusChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 4,
  },
  statusChipSent: {
    backgroundColor: '#D1FAE5',
  },
  statusChipDraft: {
    backgroundColor: '#FEF3C7',
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: '500',
  },
  statusChipTextSent: {
    color: '#065F46',
  },
  statusChipTextDraft: {
    color: '#92400E',
  },
  orderCardActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 4,
    marginLeft: 2,
  },
  orderCardSelectedOverlay: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    maxHeight: 300,
    padding: 8,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  salesmanItem: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 2,
    backgroundColor: '#F9FAFB',
  },
  salesmanItemSelected: {
    backgroundColor: '#007AFF',
  },
  salesmanText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  salesmanTextSelected: {
    color: '#fff',
  },
  salesmanItemContent: {
    flex: 1,
  },
  salesmanInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  salesmanBrand: {
    fontSize: 12,
    color: '#6B7280',
  },
  salesmanUserCount: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  clearFilterButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  clearFilterText: {
    color: '#6B7280',
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
    backgroundColor: '#007AFF',
  },
  dateFilterText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  dateFilterTextSelected: {
    color: '#fff',
  },
  dateInputContainer: {
    marginBottom: 16,
  },
  dateInputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 8,
  },
  dateInput: {
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    backgroundColor: '#fff',
    fontWeight: '500',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});



