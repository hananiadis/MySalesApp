// src/context/OrderContext.js
import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { Platform, InteractionManager, PermissionsAndroid } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import { useAuth } from './AuthProvider';

import { saveOrder, updateOrderStatus, getOrders, deleteOrder } from '../utils/localOrders';
import { createOrder, updateOrder, getCollectionName } from '../utils/firestoreOrders';
import { computeOrderTotals } from '../utils/orderTotals';
import { getPaymentOptions } from '../constants/paymentOptions';
import { normalizeBrandKey, isSuperMarketBrand, DEFAULT_BRAND } from '../constants/brands';
import { useOnlineStatus } from '../utils/OnlineStatusContext';

const initialState = {
  id: null,
  status: 'draft',
  customer: null,
  customerId: null,
  brand: null,
  createdBy: null,
  lines: [],
  notes: '',
  paymentMethod: 'prepaid_cash',
  deliveryInfo: '',
  createdAt: null,
  updatedAt: null,
  netValue: 0,
  discount: 0,
  vat: 0,
  finalValue: 0,
  startedAt: null,
  startedLocation: null,
  exported: false,
  exportedAt: null,
  exportedLocation: null,
  userId: null,
};

const normalizeBrandOrNull = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return normalizeBrandKey(trimmed);
};

function orderReducer(state, action) {
  switch (action.type) {
    case 'INIT_ORDER':
      return {
        ...initialState,
        ...action.payload,
        lines: action.payload.lines || [],
        status: 'draft',
        createdAt: new Date().toISOString(),
      };
    case 'LOAD_ORDER':
      return { ...initialState, ...action.payload, lines: action.payload.lines || [] };
    case 'UPDATE_ORDER':
      return {
        ...state,
        ...action.payload,
        lines: Array.isArray(action.payload?.lines) ? action.payload.lines : state.lines,
        updatedAt: new Date().toISOString(),
      };
    case 'RESET_ORDER':
      return { ...initialState };
    default:
      return state;
  }
}

const OrderContext = createContext(null);

export function OrderProvider({ children }) {
  const [order, dispatch] = useReducer(orderReducer, initialState);
  const orderRef = useRef(order);
  useEffect(() => { orderRef.current = order; }, [order]);

  // Refs for the 60-second periodic Firestore sync.
  // firestoreDirtyRef  — true when local changes haven't been written to Firestore yet.
  // pendingWriteRef    — holds the latest order snapshot to write.
  // firestoreIntervalRef — the setInterval handle for the 60-second flush.
  const firestoreDirtyRef = useRef(false);
  const pendingWriteRef = useRef(null);
  const firestoreIntervalRef = useRef(null);

  const { isConnected } = useOnlineStatus();
  const { user } = useAuth();
  const currentUserId = user?.uid || user?.id || null;

  const calculateTotals = useCallback((o) => {
  const snapshot = o || {};
  const lines = Array.isArray(snapshot?.lines) ? snapshot.lines : [];
  const brand = snapshot?.brand;
  const paymentMethod = snapshot?.paymentMethod;
  const totals = computeOrderTotals({ lines, brand, paymentMethod, customer: snapshot?.customer });
  const netValue = Number.isFinite(totals.net) ? +totals.net.toFixed(2) : 0;
  return {
    netValue,
    discount: Number.isFinite(totals.discount) ? totals.discount : 0,
    vat: Number.isFinite(totals.vat) ? totals.vat : 0,
    finalValue: Number.isFinite(totals.total) ? totals.total : netValue,
  };
}, []);

  // GPS disabled: always return false for now
  const requestLocationPermission = async () => false;

  // GPS disabled: never attempt to capture for now
  const getLocationOnce = async () => Promise.resolve(null);

  const queueStartedLocationCapture = () => () => {};

  const generateOrderNumber = () => {
    const d = new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${yy}${mm}${dd}-${rand}`;
  };

  // --- purge empty drafts in AsyncStorage (no lines & no notes)
  useEffect(() => {
    (async () => {
      try {
        const all = await getOrders();
        if (!Array.isArray(all) || all.length === 0) return;
        for (const o of all) {
          const lines = Array.isArray(o?.lines) ? o.lines : [];
          const hasLines = lines.some(l => Number(l?.quantity || 0) > 0);
          const hasNotes = !!(o?.notes && String(o.notes).trim().length > 0);
          if (o?.status === 'draft' && !hasLines && !hasNotes && o?.id) {
            await deleteOrder(o.id).catch(() => {});
          }
        }
      } catch {}
    })();
  }, []);

  // === Firestore flush helper ===============================================
  // Writes pendingWriteRef to Firestore immediately and clears the dirty flag.
  // Called by the 60-second interval AND when the user navigates away.
  const flushFirestoreWrite = useCallback(async () => {
    if (!firestoreDirtyRef.current || !pendingWriteRef.current) return;
    const data = pendingWriteRef.current;
    firestoreDirtyRef.current = false;
    pendingWriteRef.current = null;
    try {
      await updateOrder(data.id, data);
    } catch {
      try { await createOrder(data); } catch {}
    }
  }, []);

  // 60-second periodic Firestore flush — runs for the lifetime of the provider.
  useEffect(() => {
    firestoreIntervalRef.current = setInterval(() => {
      flushFirestoreWrite();
    }, 60000);
    return () => {
      clearInterval(firestoreIntervalRef.current);
      // Final flush on unmount so nothing is lost if the provider is torn down.
      flushFirestoreWrite();
    };
  }, [flushFirestoreWrite]);

  // === Auto-persist =========================================================
  // Local (AsyncStorage) -> immediate, for crash safety.
  // Firestore            -> marks dirty + queues data; the 60-second interval
  //                         (or navigate-away flush) does the actual write.
  useEffect(() => {
    if (!order?.id || !order?.customer) return;

    const lines = Array.isArray(order.lines) ? order.lines : [];
    const hasLines = lines.some(l => Number(l.quantity || 0) > 0);
    const hasNotes = !!(order.notes && order.notes.trim().length > 0);
    const isDraft = order.status === 'draft';

    const normalizedOrderBrand =
      normalizeBrandOrNull(order.brand) ??
      normalizeBrandOrNull(order.customer?.brand);
    const brandForOrder = normalizedOrderBrand ?? DEFAULT_BRAND;
    const totals = calculateTotals({ ...order, brand: brandForOrder });
    const withTotals = {
      ...order,
      ...totals,
      brand: brandForOrder,
      userId: order.userId || currentUserId || 'demoUserId',
      createdBy: order.createdBy || order.userId || currentUserId || 'demoUserId',
    };

    // Don't store truly empty drafts
    if (isDraft && !hasLines && !hasNotes) {
      deleteOrder(order.id).catch(() => {});
      return;
    }

    // -- 1. Local save — always immediate (crash safety) ---------------------
    saveOrder(withTotals, order.status).catch(() => {});

    // -- 2. Mark Firestore write as pending ----------------------------------
    // The 60-second interval or navigate-away flush will pick this up.
    if (!isConnected || !order.id || (!order.customerId && !order.customer?.id)) return;

    firestoreDirtyRef.current = true;
    pendingWriteRef.current = {
      ...withTotals,
      customerId: order.customerId || order.customer?.id || null,
      userId: withTotals.userId,
      createdBy: withTotals.createdBy,
      createdAt: order.createdAt || new Date().toISOString(),
      updatedAt: order.updatedAt || new Date().toISOString(),
      brand: brandForOrder,
    };
  }, [order, isConnected, calculateTotals]);
  // ========================================================================

  // --- Actions --------------------------------------------------------------
  const loadOrder = async (orderData) => {
    dispatch({ type: 'LOAD_ORDER', payload: orderData });
  };

  const startOrder = async (orderId, customerObj, brandKey = null) => {
        if (!orderId || !customerObj) throw new Error('Order id and customer are required.');

    const normalizedBrand =
      normalizeBrandOrNull(brandKey) ??
      normalizeBrandOrNull(customerObj?.brand) ??
      normalizeBrandOrNull(orderRef.current?.brand);

    const resolvedBrand = normalizedBrand ?? DEFAULT_BRAND;
    const availablePayments = getPaymentOptions(resolvedBrand);
    const defaultPaymentMethod = availablePayments[0]?.key || initialState.paymentMethod;
    const startedAt = new Date().toISOString();
    let draft = {
      ...initialState,
      paymentMethod: defaultPaymentMethod,
      id: orderId,
      number: generateOrderNumber(),
      customer: customerObj,
      customerId: customerObj?.id ?? customerObj?.customerId ?? null,
      brand: resolvedBrand,
      status: 'draft',
      lines: [],
      startedAt,
      startedLocation: null,
      createdAt: startedAt,
      userId: currentUserId || 'demoUserId',
      createdBy: currentUserId || 'demoUserId',
    };

    try {
      draft = await saveOrder(draft, 'draft');
    } catch (error) {
      console.warn('Failed to persist draft order locally', error);
    }

    // Don't create in Firestore immediately - let useEffect handle it
    // This prevents duplicate order creation

    dispatch({ type: 'INIT_ORDER', payload: draft });
    const cleanup = queueStartedLocationCapture(draft.id);
    return { orderId: draft.id, cleanup };
  };

  const startSuperMarketOrder = async (orderId, storeObj, brandKey) => {
    if (!orderId || !storeObj) {
      throw new Error('Order id and store are required.');
    }

    const fallbackBrand = 'john';
    const normalizedBrand = normalizeBrandKey(brandKey || storeObj?.brand || fallbackBrand);
    const resolvedBrand = isSuperMarketBrand(normalizedBrand) ? normalizedBrand : fallbackBrand;
    const availablePayments = getPaymentOptions(resolvedBrand);
    const defaultPaymentMethod = availablePayments[0]?.key || initialState.paymentMethod;
    const startedAt = new Date().toISOString();

    const storeId = storeObj?.id || storeObj?.refId || storeObj?.storeCode || orderId;
    const storeCode = storeObj?.storeCode || null;
    const storeCategory = storeObj?.storeCategory || storeObj?.hasToys || storeObj?.category || null;

    const customerPayload = {
      id: storeId,
      name: storeObj?.storeName || storeObj?.name || 'SuperMarket Store',
      customerCode: storeCode,
      companyName: storeObj?.companyName || null,
      storeName: storeObj?.storeName || storeObj?.name || null,
      address:
        storeObj?.address && typeof storeObj.address === 'object'
          ? storeObj.address
          : {
              street: storeObj?.address || storeObj?.street || null,
              city: storeObj?.city || null,
              postalCode: storeObj?.postalCode || storeObj?.zip || null,
            },
      city: storeObj?.city || null,
      area: storeObj?.area || null,
      region: storeObj?.region || null,
      phone: storeObj?.telephone || storeObj?.phone || null,
      email: storeObj?.email || null,
      companyVat: storeObj?.vat || storeObj?.vatNumber || null,
      type: 'supermarket_store',
      storeCategory,
      brand: resolvedBrand,
      storeCode,
      rawStore: storeObj,
    };

    let draft = {
      ...initialState,
      paymentMethod: defaultPaymentMethod,
      id: orderId,
      number: generateOrderNumber(),
      brand: resolvedBrand,
      orderType: 'supermarket',
      storeId,
      storeName: storeObj?.storeName || null,
      storeCode,
      storeCategory,
      companyName: storeObj?.companyName || null,
      storeAddress: storeObj?.address || storeObj?.street || null,
      storeCity: storeObj?.city || null,
      storePostalCode: storeObj?.postalCode || storeObj?.zip || null,
      storePhone: storeObj?.telephone || storeObj?.phone || null,
      storeEmail: storeObj?.email || null,
      storeRegion: storeObj?.region || null,
      customer: customerPayload,
      customerId: customerPayload.id,
      status: 'draft',
      lines: [],
      startedAt,
      startedLocation: null,
      createdAt: startedAt,
      userId: currentUserId || 'demoUserId',
      createdBy: currentUserId || 'demoUserId',
      inventorySnapshot: {},
    };

    try {
      draft = await saveOrder(draft, 'draft');
    } catch (error) {
      console.warn('Failed to persist supermarket draft order locally', error);
    }

    dispatch({ type: 'INIT_ORDER', payload: draft });
    const cleanup = queueStartedLocationCapture(draft.id);
    return { orderId: draft.id, cleanup };
  };

  const setCurrentCustomer = (customerObj) => {
    dispatch({
      type: 'UPDATE_ORDER',
      payload: { customer: customerObj, customerId: customerObj?.id ?? customerObj?.customerId ?? null },
    });
  };

  const setOrderLines = (linesUpdater) => {
    dispatch({
      type: 'UPDATE_ORDER',
      payload: {
        lines:
          typeof linesUpdater === 'function'
            ? linesUpdater(Array.isArray(order.lines) ? order.lines : [])
            : Array.isArray(linesUpdater)
            ? linesUpdater
            : [],
      },
    });
  };

  const setNotes = (notes) => dispatch({ type: 'UPDATE_ORDER', payload: { notes } });
  const setDeliveryInfo = (deliveryInfo) => dispatch({ type: 'UPDATE_ORDER', payload: { deliveryInfo } });
  const setPaymentMethod = (paymentMethod) => dispatch({ type: 'UPDATE_ORDER', payload: { paymentMethod } });

  const updateCurrentOrder = (fields) => {
    const next = { ...order, ...fields };
    const totals = calculateTotals(next);
    dispatch({ type: 'UPDATE_ORDER', payload: { ...fields, ...totals } });
  };

  const markOrderSent = async () => {
    // Clear any pending interval write — the explicit send below is the
    // authoritative final state, so we don't want the interval overwriting it.
    firestoreDirtyRef.current = false;
    pendingWriteRef.current = null;

    const exportedAt = new Date().toISOString();
    const exportedLocation = await getLocationOnce();

    const next = {
      ...order,
      userId: order.userId || currentUserId || 'demoUserId',
      createdBy: order.createdBy || order.userId || currentUserId || 'demoUserId',
      status: 'sent',
      sent: true,
      exported: true,
      exportedAt,
      exportedLocation,
      ...calculateTotals(order),
    };

    dispatch({ type: 'UPDATE_ORDER', payload: next });

    try { await saveOrder(next, 'sent'); } catch {}
    try { await updateOrderStatus(order.id, 'sent'); } catch {}

    if (isConnected && order.id) {
      try {
        const firestoreOrder = {
          ...next,
          customerId: order.customerId || order.customer?.id || null,
          userId: next.userId || 'demoUserId',
          createdBy: next.createdBy || next.userId,
        };
        await updateOrder(order.id, firestoreOrder); // ⬅️ upsert sent state
      } catch (error) {
        console.log('Error updating sent order in Firestore:', error);
      }
    }

    return next;
  };

  // 🔧 FIX: don’t delete sent orders; only delete truly empty drafts
  const cancelOrder = async () => {
    // Flush any pending Firestore write before resetting — this is the
    // "navigate away" trigger that ensures the draft is saved to the cloud.
    await flushFirestoreWrite();
    try {
      if (!order?.id) {
        dispatch({ type: 'RESET_ORDER' });
        return;
      }

      const isSent = order?.status === 'sent' || order?.exported === true;

      if (!isSent) {
        // Only delete *truly empty* drafts (no lines and no notes)
        const lines = Array.isArray(order?.lines) ? order.lines : [];
        const hasLines = lines.some(l => Number(l?.quantity || 0) > 0);
        const hasNotes = !!(order?.notes && order.notes.trim().length > 0);

        if (!hasLines && !hasNotes) {
          try { await deleteOrder(order.id); } catch {}
        } else {
          // Keep non-empty drafts in local history
          try { await saveOrder(order, 'draft'); } catch {}
        }
      }

      // For sent orders, do NOT delete from local — keep history visible in OrdersManagement
    } finally {
      dispatch({ type: 'RESET_ORDER' });
    }
  };

  const listUserOrders = async (userId) => {
    const all = await getOrders();
    return all.filter((o) => (userId ? o.userId === userId : true));
  };

  return (
    <OrderContext.Provider
      value={{
        order,
        orderId: order.id,
        customer: order.customer,
        orderLines: Array.isArray(order.lines) ? order.lines : [],
        notes: order.notes,
        deliveryInfo: order.deliveryInfo,
        paymentMethod: order.paymentMethod,
        startOrder,
        startSuperMarketOrder,
        setCurrentCustomer,
        setOrderLines,
        setNotes,
        setDeliveryInfo,
        setPaymentMethod,
        updateCurrentOrder,
        markOrderSent,
        cancelOrder,
        listUserOrders,
        loadOrder,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
}

export function useOrder() {
  return useContext(OrderContext);
}

