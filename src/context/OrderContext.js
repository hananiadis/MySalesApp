// src/context/OrderContext.js
import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { Platform, InteractionManager, PermissionsAndroid } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import { useAuth } from './AuthProvider';

import { saveOrder, updateOrderStatus, getOrders, deleteOrder } from '../utils/localOrders';
import { updateOrder } from '../utils/firestoreOrders'; // ⬅️ upsert only
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

  const { isConnected } = useOnlineStatus();
  const { user } = useAuth();
  const currentUserId = user?.uid || user?.id || null;

  const calculateTotals = useCallback((o) => {
    const lines = Array.isArray(o?.lines) ? o.lines : [];
    const netValue = lines.reduce(
      (sum, l) => sum + Number(l.wholesalePrice || 0) * Number(l.quantity || 0),
      0
    );
    const discount = o.paymentMethod === 'prepaid_cash' ? +(netValue * 0.03).toFixed(2) : 0;
    const vat = +((netValue - discount) * 0.24).toFixed(2);
    const finalValue = +((netValue - discount) + vat).toFixed(2);
    return { netValue, discount, vat, finalValue };
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

  // === Auto-persist (avoid keeping empty drafts) ============================
  useEffect(() => {
    (async () => {
      if (!order?.id || !order?.customer) return;

      const lines = Array.isArray(order.lines) ? order.lines : [];
      const hasLines = lines.some(l => Number(l.quantity || 0) > 0);
      const hasNotes = !!(order.notes && order.notes.trim().length > 0);
      const isDraft = order.status === 'draft';

      const totals = calculateTotals(order);
      const withTotals = {
        ...order,
        ...totals,
        userId: order.userId || currentUserId || 'demoUserId',
        createdBy: order.createdBy || order.userId || currentUserId || 'demoUserId',
      };

      // Don’t store truly empty drafts
      if (isDraft && !hasLines && !hasNotes) {
        try { await deleteOrder(order.id); } catch {}
        return;
      }

      // Local save
      try { await saveOrder(withTotals, order.status); } catch {}

      // Remote upsert (both draft and sent)
      if (isConnected && order.id && (order.customerId || order.customer?.id)) {
        try {
          const firestoreOrder = {
            ...withTotals,
            customerId: order.customerId || order.customer?.id || null,
            userId: withTotals.userId,
            createdBy: withTotals.createdBy,
            createdAt: order.createdAt || new Date().toISOString(),
            updatedAt: order.updatedAt || new Date().toISOString(),
          };
          await updateOrder(order.id, firestoreOrder); // ⬅️ upsert for all states
        } catch (error) {
          console.log('Error saving to Firestore:', error);
        }
      }
    })();
  }, [order, isConnected, calculateTotals]);
  // ========================================================================

  // --- Actions --------------------------------------------------------------
  const loadOrder = async (orderData) => {
    dispatch({ type: 'LOAD_ORDER', payload: orderData });
  };

  const startOrder = async (orderId, customerObj, brandKey = null) => {
    if (!orderId || !customerObj) throw new Error('Απαιτείται αριθμός παραγγελίας και πελάτης.');

    const resolvedBrand = brandKey ?? orderRef.current?.brand ?? null;
    const startedAt = new Date().toISOString();
    let draft = {
      ...initialState,
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

    if (isConnected) {
      try {
        const firestoreDraft = {
          ...draft,
          ...calculateTotals(draft),
          customerId: draft.customerId,
          userId: draft.userId || currentUserId || 'demoUserId',
          createdBy: draft.createdBy || draft.userId || currentUserId || 'demoUserId',
          brand: draft.brand ?? null,
          createdAt: draft.createdAt,
          updatedAt: draft.updatedAt || new Date().toISOString(),
        };
        await updateOrder(draft.id, firestoreDraft);
      } catch (error) {
        console.log('Error creating draft order in Firestore:', error);
      }
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
  const setPaymentMethod = (paymentMethod) => dispatch({ type: 'UPDATE_ORDER', payload: { paymentMethod } });

  const updateCurrentOrder = (fields) => {
    const next = { ...order, ...fields };
    const totals = calculateTotals(next);
    dispatch({ type: 'UPDATE_ORDER', payload: { ...fields, ...totals } });
  };

  const markOrderSent = async () => {
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
        paymentMethod: order.paymentMethod,
        startOrder,
        setCurrentCustomer,
        setOrderLines,
        setNotes,
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
