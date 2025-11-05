import { useEffect, useState, useRef } from 'react';
import firestore from '@react-native-firebase/firestore';
import { PLAYMOBIL_CONFIG } from '../config/playmobil';
import { getLinkedSalesmenForUser, fetchCustomersForSalesmen } from '../services/customerService';
import { calculateAllKPIs } from '../services/kpiCalculations';
import { loadOrFetchSheetCsv, parseCsvToRows } from '../services/googleSheetsCache';

export const usePlaymobilData = (user) => {
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 👇 Add this line — keeps track if run() already executed
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (!user?.uid) return;                 // wait until Firebase user loaded
    if (hasRunRef.current) return;          // prevent re-running
    hasRunRef.current = true;               // mark as already executed

    const run = async () => {
      console.log('🚀 [usePlaymobilData] Starting KPI flow...');
      try {
        setLoading(true);
        const fs = firestore();

        const salesmen = await getLinkedSalesmenForUser(user, 'playmobil');
        console.log('👥 [usePlaymobilData] Salesmen:', salesmen);

        const { customerCodesSet } = await fetchCustomersForSalesmen(fs, 'playmobil', salesmen);
        const customerCodes = Array.from(customerCodesSet);
        console.log('📇 [usePlaymobilData] Found', customerCodes.length, 'customers');

        const keys = ['sales2025', 'orders2025', 'balance2025', 'sales2024', 'orders2024'];
        const sheets = {};

        for (const key of keys) {
          const csv = await loadOrFetchSheetCsv(key, PLAYMOBIL_CONFIG.sheetUrls[key]);
          const rows = parseCsvToRows(csv);
          sheets[key] = rows;
          console.log(`📊 [usePlaymobilData] Parsed ${rows.length} rows for ${key}`);
        }

        console.log('🧩 [DEBUG] calculateAllKPIs type:', typeof calculateAllKPIs);
        const result = calculateAllKPIs(sheets, customerCodes);
        console.log('✅ [usePlaymobilData] KPI calculation done:', result);
        setKpis(result);
      } catch (err) {
        console.error('❌ [usePlaymobilData] Error loading KPI data:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [user?.uid]); // only rerun when user UID changes (not whole user object)

  return { kpis, loading, error };
};
