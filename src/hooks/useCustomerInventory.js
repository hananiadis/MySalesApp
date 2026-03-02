// src/hooks/useCustomerInventory.js
import { useState, useCallback, useEffect } from 'react';
import InventoryService from '../services/inventoryService';
import { useOnlineStatus } from '../utils/OnlineStatusContext';

export function useCustomerInventory(customerId) {
  const { isConnected } = useOnlineStatus();
  const [inventory, setInventory] = useState(null);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState({ pending: 0, synced: 0, failed: 0 });

  // Fetch active inventory
  const refresh = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const inv = await InventoryService.getActiveInventory(customerId);
      setInventory(inv);
      setLines(inv?.lines || []);
    } catch (error) {
      console.error('[useCustomerInventory] Fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  // Try to sync offline queue
  const sync = useCallback(async () => {
    if (!isConnected) return;
    try {
      const result = await InventoryService.syncOfflineQueue();
      setSyncStatus({
        pending: result.pendingCount,
        synced: result.synced,
        failed: result.failed,
      });
      if (result.synced > 0) {
        refresh();
      }
    } catch (error) {
      console.error('[useCustomerInventory] Sync error:', error);
    }
  }, [isConnected, refresh]);

  // Watch for online status change and auto-sync
  useEffect(() => {
    if (isConnected) {
      sync();
    }
  }, [isConnected, sync]);

  // Initial load
  useEffect(() => {
    refresh();
  }, [customerId, refresh]);

  return {
    inventory,
    lines,
    loading,
    syncStatus,
    refresh,
    sync,
  };
}
