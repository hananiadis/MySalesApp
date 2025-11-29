// src/hooks/useKivosKpi.js
// Hook for Kivos KPI data with salesman filtering

import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCustomerCodes, calculateKPIs, getAllSheetsData } from '../services/kivosKpi';

/**
 * Hook for fetching and calculating Kivos KPI data
 * @param {string[]} selectedSalesmenIds - Array of selected salesman IDs (e.g., ['KIVOS_JOHN', 'KIVOS_MARIA'])
 * @param {Date} referenceDate - Reference date for calculations
 * @param {number} reloadToken - Token to force reload
 * @returns {object} KPI data and helper functions
 */
export function useKivosKpi(
  selectedSalesmenIds = null,
  referenceDate = new Date(),
  reloadToken = 0
) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [kpis, setKpis] = useState(null);
  const [recordSets, setRecordSets] = useState(null);
  const [availableSalesmen, setAvailableSalesmen] = useState([]);
  const [activeSalesmenIds, setActiveSalesmenIds] = useState([]);

  // Load available salesmen from Firestore once
  useEffect(() => {
    loadAvailableSalesmen();
  }, []);

  // Load KPI data when parameters change
  useEffect(() => {
    loadKpiData();
  }, [selectedSalesmenIds, referenceDate, reloadToken]);

  /**
   * Load available Kivos salesmen
   */
  const loadAvailableSalesmen = useCallback(async () => {
    try {
      console.log('[useKivosKpi] Loading available salesmen from customers_kivos...');
      
      const { default: firestore } = await import('@react-native-firebase/firestore');
      const { default: auth } = await import('@react-native-firebase/auth');
      
      // Get current user's merchIds
      const currentUser = auth().currentUser;
      if (!currentUser) {
        console.warn('[useKivosKpi] No authenticated user');
        return;
      }
      
      const userDoc = await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .get();
      
      const userData = userDoc.data();
      const merchIds = userData?.merchIds || [];
      
      console.log('[useKivosKpi] User merchIds:', merchIds);
      
      // Filter for Kivos salesmen (prefix: kivos_)
      const kivosMerchIds = merchIds.filter(id => 
        String(id).toLowerCase().startsWith('kivos_')
      );
      
      console.log('[useKivosKpi] Kivos merchIds:', kivosMerchIds);
      
      if (kivosMerchIds.length === 0) {
        console.warn('[useKivosKpi] No Kivos merchIds found for user');
        setAvailableSalesmen([]);
        return;
      }
      
      // Extract unique merch names from customers_kivos collection
      const snapshot = await firestore()
        .collection('customers_kivos')
        .get();
      
      console.log('[useKivosKpi] Found', snapshot.size, 'Kivos customers');
      
      const merchSet = new Set();
      snapshot.forEach(doc => {
        const merch = doc.data().merch;
        // Handle both array and string merch field (for backward compatibility)
        if (Array.isArray(merch)) {
          merch.forEach(m => {
            if (m) merchSet.add(String(m).trim());
          });
        } else if (merch) {
          merchSet.add(String(merch).trim());
        }
      });

      console.log('[useKivosKpi] Unique merch names from customers:', Array.from(merchSet));

      // Build salesman objects from user's merchIds that match customers
      const salesmen = kivosMerchIds
        .map(merchId => {
          // Extract salesman name from kivos_NAME format
          const parts = String(merchId).split('_');
          if (parts.length < 2) return null;
          
          const salesmanName = parts.slice(1).join('_'); // Handle names with underscores
          const salesmanNameUpper = salesmanName.toUpperCase();
          
          // Check if this salesman exists in customers
          const hasCustomers = Array.from(merchSet).some(merch => 
            String(merch).toUpperCase().trim() === salesmanNameUpper
          );
          
          if (!hasCustomers) {
            console.log('[useKivosKpi] Salesman', salesmanName, 'has no customers, skipping');
            return null;
          }
          
          return {
            id: merchId, // Use the full kivos_NAME format
            label: salesmanName, // Display the name part
            merchName: salesmanName, // For filtering customers
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.label.localeCompare(b.label, 'el'));

      console.log('[useKivosKpi] Available salesmen:', salesmen.length, salesmen);
      setAvailableSalesmen(salesmen);
    } catch (err) {
      console.error('[useKivosKpi] Error loading available salesmen:', err);
    }
  }, []);

  /**
   * Load and calculate KPI data
   */
  const loadKpiData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('[useKivosKpi] Loading KPI data', {
        selectedSalesmenIds,
        referenceDate: referenceDate.toISOString().split('T')[0],
        reloadToken,
      });

      // Smart default: single salesman = auto-select, multiple = require explicit selection
      let targetSalesmenIds = selectedSalesmenIds;
      if (!targetSalesmenIds || targetSalesmenIds.length === 0) {
        if (availableSalesmen.length === 1) {
          // User has only 1 salesman - use it by default
          targetSalesmenIds = [availableSalesmen[0].id];
          console.log('[useKivosKpi] User has 1 salesman, using as default:', availableSalesmen[0].label);
        } else if (availableSalesmen.length > 1) {
          // User has multiple salesmen - wait for selection
          console.log('[useKivosKpi] User has multiple salesmen, waiting for selection');
          setLoading(false);
          setKpis(null);
          setRecordSets(null);
          return;
        } else {
          // No salesmen available
          console.log('[useKivosKpi] No salesmen available, loading all Kivos data');
          targetSalesmenIds = null; // Signal to get all customers
        }
      }

      setActiveSalesmenIds(targetSalesmenIds || []);

      console.log('[useKivosKpi] Target salesmen:', targetSalesmenIds);

      // Get customer codes for selected salesmen (or all if null)
      const customerCodes = targetSalesmenIds 
        ? await getCustomerCodes(targetSalesmenIds, 'kivos')
        : await getCustomerCodes(null, 'kivos'); // Get all Kivos customers
      
      console.log('[useKivosKpi] Customer codes:', customerCodes.length);

      if (customerCodes.length === 0) {
        console.warn('[useKivosKpi] No customers found for selected salesmen');
        setKpis({
          referenceMoment: referenceDate,
          context: {
            year: referenceDate.getFullYear(),
            month: referenceDate.getMonth(),
            day: referenceDate.getDate(),
          },
          sales: {
            year2025: {
              ytd: { amount: 0, diff: { percent: null } },
              mtd: { amount: 0, diff: { percent: null } },
              yearly: { amount: 0, diff: { percent: null } }
            },
            year2024: {
              ytd: { amount: 0 },
              mtd: { amount: 0 },
              yearly: { amount: 0 }
            },
            year2023: {
              ytd: { amount: 0 },
              mtd: { amount: 0 },
              yearly: { amount: 0 }
            },
            year2022: {
              ytd: { amount: 0 },
              mtd: { amount: 0 },
              yearly: { amount: 0 }
            }
          }
        });
        setRecordSets({ 
          sales: { 
            year2025: [], 
            year2024: [], 
            year2023: [], 
            year2022: [] 
          } 
        });
        setLoading(false);
        return;
      }

      // Calculate KPIs
      const kpiData = await calculateKPIs(customerCodes, referenceDate, { force: reloadToken > 0 });

      console.log('[useKivosKpi] KPIs calculated:', {
        hasSales: !!kpiData.sales,
        hasYear2025: !!kpiData.sales?.year2025,
      });

      setKpis(kpiData);

      // Organize records for modal display
      setRecordSets({
        sales: {
          year2025: kpiData.records?.year2025 || [],
          year2024: kpiData.records?.year2024 || [],
          year2023: kpiData.records?.year2023 || [],
          year2022: kpiData.records?.year2022 || [],
        },
      });

      setLoading(false);
    } catch (err) {
      console.error('[useKivosKpi] Error loading KPI data:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [selectedSalesmenIds, referenceDate, reloadToken]);

  // Memoized reference moment
  const referenceMoment = useMemo(() => {
    if (kpis?.referenceMoment) {
      return kpis.referenceMoment;
    }
    return referenceDate;
  }, [kpis, referenceDate]);

  return {
    loading,
    error,
    kpis,
    recordSets,
    referenceMoment,
    availableSalesmen: availableSalesmen || [],
    activeSalesmenIds: activeSalesmenIds || [],
  };
}
