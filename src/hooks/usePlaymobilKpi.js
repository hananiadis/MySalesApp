import { useEffect, useMemo, useState } from 'react';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../services/firebase';
import { 
  getCustomerCodes,
  getAllSheetsData,
  calculateAllKPIs,
  getCustomerSalesSummary 
} from '../services/playmobilKpi';

console.log('[usePlaymobilKpi] Module loaded');

const STATUS = {
  INITIAL: 'initial',
  LOADING: 'loading',
  DONE: 'done',
  ERROR: 'error',
};

const DEFAULT_RESULT = {
  kpis: null,
  customers: [],
  recordSets: null,
  metricSnapshot: {
    invoiced: null,
    orders: null,
    totals: {
      invoicedCurrent: 0,
      invoicedPrevious: 0,
      ordersCurrent: 0,
      ordersPrevious: 0,
    },
  },
};

export default function usePlaymobilKpi({
  referenceDate = new Date(),
  enabled = true,
  verbose = false,
  reloadToken = 0,
} = {}) {
  console.log('[usePlaymobilKpi] Hook initialized', { 
    referenceDate: referenceDate.toISOString(), 
    enabled, 
    verbose,
    reloadToken,
  });

  const [status, setStatus] = useState(STATUS.INITIAL);
  const [error, setError] = useState(null);
  const [kpis, setKpis] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [recordSets, setRecordSets] = useState(null);

  useEffect(() => {
    if (!enabled) {
      console.log('[usePlaymobilKpi:useEffect] Hook disabled');
      return () => {};
    }

    let cancelled = false;
    console.log('[usePlaymobilKpi:useEffect] Starting data load...');

    (async () => {
      try {
        if (cancelled) {
          console.log('[usePlaymobilKpi] Cancelled before start');
          return;
        }

        console.log('[usePlaymobilKpi] Setting status to loading');
        setStatus(STATUS.LOADING);
        setError(null);

        console.log('[usePlaymobilKpi] Getting current user...');
        const user = auth().currentUser;
        if (!user) {
          throw new Error('User not authenticated');
        }
        console.log('[usePlaymobilKpi] User ID:', user.uid);

        console.log('[usePlaymobilKpi] Loading user document...');
        const userSnap = await firestore().collection('users').doc(user.uid).get();
        if (!userSnap.exists) {
          console.error('[usePlaymobilKpi] User document not found');
          throw new Error('User document not found');
        }

        const userData = userSnap.data() || {};
        console.log('[usePlaymobilKpi] User data:', {
          uid: user.uid,
          email: userData.email,
          name: userData.name,
          role: userData.role,
          merchIdsCount: userData.merchIds?.length || 0
        });

        const rawMerchIds = Array.isArray(userData.merchIds)
          ? userData.merchIds.filter(Boolean)
          : [];

        console.log('[usePlaymobilKpi] Raw merch IDs:', rawMerchIds);

        if (!rawMerchIds.length) {
          console.error('[usePlaymobilKpi] No merchIds found');
          throw new Error('No salesmen linked to this user');
        }

        // Filter for Playmobil salesmen (IDs starting with 'playmobil_')
        console.log('[usePlaymobilKpi] Filtering for Playmobil salesmen...');
        const playmobilIds = rawMerchIds.filter(id => {
          const idStr = String(id).toLowerCase();
          const isPlaymobil = idStr.startsWith('playmobil_');
          console.log(`[usePlaymobilKpi] Checking "${id}": ${isPlaymobil ? 'PLAYMOBIL' : 'OTHER'}`);
          return isPlaymobil;
        });

        console.log('[usePlaymobilKpi] Playmobil IDs:', playmobilIds);

        if (!playmobilIds.length) {
          console.error('[usePlaymobilKpi] No Playmobil salesmen found');
          throw new Error('No Playmobil salesmen linked to this user');
        }

        // Get customer codes
        console.log('[usePlaymobilKpi] Fetching customer codes...');
        const customerCodes = await getCustomerCodes(playmobilIds, 'playmobil');
        console.log('[usePlaymobilKpi] Customer codes received:', customerCodes.length);

        if (!customerCodes.length) {
          console.error('[usePlaymobilKpi] No customers found');
          throw new Error('No customers found for this user');
        }

        // Check for cached KPI results first (lightweight summary only)
        console.log('[usePlaymobilKpi] Checking for cached KPI summary...');
        const cachedKpiJson = await AsyncStorage.getItem('playmobil_kpi_results');
        const cachedKpiTimestamp = await AsyncStorage.getItem('playmobil_kpi_timestamp');
        
        if (cachedKpiJson && cachedKpiTimestamp) {
          const cacheAge = Date.now() - new Date(cachedKpiTimestamp).getTime();
          const cacheAgeHours = cacheAge / (1000 * 60 * 60);
          console.log(`[usePlaymobilKpi] Found cached KPI summary, age: ${cacheAgeHours.toFixed(2)} hours`);
          
          if (cacheAgeHours < 12) {
            console.log('[usePlaymobilKpi] Cache is fresh but need full records for modals');
            console.log('[usePlaymobilKpi] Will load sheets and recalculate with full records');
            // Don't return early - we need the full records for the modals
            // Fall through to load sheets data
          } else {
            console.log('[usePlaymobilKpi] Cached KPI summary expired, will recalculate');
          }
        }

        // Load sheets data
        console.log('[usePlaymobilKpi] Loading sheets data...');
        const sheetsData = await getAllSheetsData();
        console.log('[usePlaymobilKpi] Sheets data loaded:', {
          invoiced2025: sheetsData.invoiced2025.length,
          invoiced2024: sheetsData.invoiced2024.length,
          orders2025: sheetsData.orders2025.length,
          orders2024: sheetsData.orders2024.length,
        });

        // Determine reference date from sheet header dates
        // Requirement: use the latest sales (invoiced) sheet header date when available
        const headerDates = sheetsData._headerDates || {};
        const invoicedHeader = headerDates.invoiced2025;
        const ordersHeader = headerDates.orders2025;
        let headerReferenceDate = referenceDate;
        if (invoicedHeader) {
          const d = invoicedHeader instanceof Date ? invoicedHeader : new Date(invoicedHeader);
          if (!Number.isNaN(d.getTime())) headerReferenceDate = d;
        } else if (ordersHeader) {
          const d = ordersHeader instanceof Date ? ordersHeader : new Date(ordersHeader);
          if (!Number.isNaN(d.getTime())) headerReferenceDate = d;
        }
        console.log('[usePlaymobilKpi] Header reference date (sales-first) selected:', headerReferenceDate.toISOString());

  // Calculate KPIs
        console.log('[usePlaymobilKpi] Calculating KPIs...');
  const kpiResult = calculateAllKPIs(sheetsData, customerCodes, { referenceDate: headerReferenceDate });
        
        console.log('[usePlaymobilKpi] Getting customer summary...');
        const summary = getCustomerSalesSummary(sheetsData, customerCodes);

        // Cache only lightweight summary (not detailed records - they're too big)
        console.log('[usePlaymobilKpi] Caching KPI summary metrics (lightweight)...');
        try {
          const lightweightCache = {
            // Store only the metrics, not the detailed records
            invoiced: {
              yearly: kpiResult?.invoiced?.yearly,
              monthly: kpiResult?.invoiced?.monthly,
              mtd: kpiResult?.invoiced?.mtd,
            },
            orders: {
              yearly: kpiResult?.orders?.yearly,
              monthly: kpiResult?.orders?.monthly,
              mtd: kpiResult?.orders?.mtd,
            },
            summary: summary.slice(0, 100), // Store only top 100 customers for summary
            timestamp: new Date().toISOString(),
          };
          
          await AsyncStorage.setItem('playmobil_kpi_results', JSON.stringify(lightweightCache));
          await AsyncStorage.setItem('playmobil_kpi_timestamp', new Date().toISOString());
          console.log('[usePlaymobilKpi] KPI summary cached (without heavy record details)');
        } catch (cacheError) {
          console.warn('[usePlaymobilKpi] Failed to cache KPI results:', cacheError.message);
          console.warn('[usePlaymobilKpi] Continuing without cache - will recalculate on next load');
          // Don't throw - we have the data, just can't cache it
        }

        console.log('[usePlaymobilKpi] KPI calculation complete');
        console.log('[usePlaymobilKpi] Final totals:', {
          invoiced: {
            yearly: kpiResult?.invoiced?.yearly?.current?.amount ?? 0,
            customers: kpiResult?.invoiced?.yearly?.current?.customers ?? 0,
          },
          orders: {
            yearly: kpiResult?.orders?.yearly?.current?.amount ?? 0,
            customers: kpiResult?.orders?.yearly?.current?.customers ?? 0,
          },
        });

        if (cancelled) {
          console.log('[usePlaymobilKpi] Cancelled during processing');
          return;
        }

        console.log('[usePlaymobilKpi] Setting state with results');
        console.log('[usePlaymobilKpi] kpiResult.records structure:', {
          hasRecords: !!kpiResult.records,
          hasInvoiced: !!kpiResult.records?.invoiced,
          hasOrders: !!kpiResult.records?.orders,
          invoicedCurrentCount: kpiResult.records?.invoiced?.current?.length,
          invoicedPreviousCount: kpiResult.records?.invoiced?.previous?.length,
          ordersCurrentCount: kpiResult.records?.orders?.current?.length,
          ordersPreviousCount: kpiResult.records?.orders?.previous?.length,
        });
        console.log('[usePlaymobilKpi] Sample invoiced current record:', kpiResult.records?.invoiced?.current?.[0]);
        console.log('[usePlaymobilKpi] Sample orders current record:', kpiResult.records?.orders?.current?.[0]);
        setKpis(kpiResult);
        setCustomers(summary);
        setRecordSets(kpiResult.records);
        setStatus(STATUS.DONE);
        
        console.log('[usePlaymobilKpi] SUCCESS - Status set to done');
      } catch (err) {
        if (cancelled) {
          console.log('[usePlaymobilKpi] Cancelled, not setting error state');
          return;
        }

        console.error('[usePlaymobilKpi] ERROR:', err);
        console.error('[usePlaymobilKpi] Error code:', err?.code);
        console.error('[usePlaymobilKpi] Error message:', err?.message);
        console.error('[usePlaymobilKpi] Error stack:', err?.stack);

        let message = err?.message || 'Unknown KPI error';
        if (
          err?.code === 'firestore/permission-denied' ||
          (typeof message === 'string' && message.includes('permission-denied'))
        ) {
          message =
            'Permission denied while loading Playmobil customers. Verify Firestore access rights.';
        } else if (typeof message === 'string' && message.includes('SQLITE_FULL')) {
          message =
            'Local storage is full while caching sheet data. Please clear cached sheets.';
        }

        console.log('[usePlaymobilKpi] Setting error state:', message);
        setError(message);
        setStatus(STATUS.ERROR);
      }
    })();

    return () => {
      console.log('[usePlaymobilKpi:useEffect] Cleanup - setting cancelled to true');
      cancelled = true;
    };
  }, [enabled, referenceDate, verbose, reloadToken]);

  const metricSnapshot = useMemo(() => {
    const base = kpis || {};
    const records = base.records || {};
    return {
      invoiced: base.invoiced || null,
      orders: base.orders || null,
      totals: {
        invoicedCurrent: records?.invoiced?.current?.length ?? 0,
        invoicedPrevious: records?.invoiced?.previous?.length ?? 0,
        ordersCurrent: records?.orders?.current?.length ?? 0,
        ordersPrevious: records?.orders?.previous?.length ?? 0,
      },
    };
  }, [kpis]);

  const referenceMoment = useMemo(() => {
    const context = kpis?.invoiced?.context;
    if (context) {
      return new Date(context.year, context.month, context.day);
    }
    return referenceDate;
  }, [kpis, referenceDate]);

  const returnValue = {
    status,
    error,
    kpis,
    customers,
    recordSets,
    referenceMoment,
    metricSnapshot,
    isLoading: status === STATUS.LOADING || status === STATUS.INITIAL,
    isError: status === STATUS.ERROR,
    isDone: status === STATUS.DONE,
  };

  console.log('[usePlaymobilKpi] Hook returning:', {
    status,
    hasKpis: !!kpis,
    customersCount: customers.length,
    hasError: !!error,
    hasRecordSets: !!recordSets,
    isLoading: returnValue.isLoading,
    isError: returnValue.isError,
    isDone: returnValue.isDone,
  });

  return returnValue;
}

usePlaymobilKpi.STATUS = STATUS;
