import React, { useEffect, useState } from 'react';
import { clearAllCaches, clearCache, STORES, getLastSyncTime } from '../../services/cacheService';
import { useQueryClient } from 'react-query';
import { 
  forceRefreshAll,
  fetchOrdersIncremental,
  fetchProductsCached,
  fetchCustomersCached,
  fetchStockCached,
} from '../../services/optimizedFirestoreService';

const CacheManagement = () => {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [lastSync, setLastSync] = useState({
    orders_kivos: null,
    products_kivos: null,
    customers_kivos: null,
    stock_kivos: null,
  });
  const [loading, setLoading] = useState({
    orders: false,
    products: false,
    customers: false,
    stock: false,
    all: false,
  });

  const showMessage = (msg, duration = 3000) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), duration);
  };

  const handleClearAllCache = async () => {
    try {
      await clearAllCaches();
      queryClient.clear(); // Also clear React Query cache
      showMessage('✅ All caches cleared successfully!');
    } catch (error) {
      showMessage('❌ Error clearing caches: ' + error.message);
    }
  };

  const handleClearStore = async (storeName, queryKey) => {
    try {
      await clearCache(storeName);
      if (queryKey) {
        queryClient.invalidateQueries(queryKey);
      }
      showMessage(`✅ ${storeName} cache cleared!`);
    } catch (error) {
      showMessage('❌ Error: ' + error.message);
    }
  };

  const handleRefreshAll = () => {
    showMessage('🔄 Refreshing all data from Firestore...');
    setLoading((l) => ({ ...l, all: true }));
    forceRefreshAll()
      .then(() => {
        // Invalidate queries so UI re-reads fresh cache values
        queryClient.invalidateQueries(['orders']);
        queryClient.invalidateQueries(['products']);
        queryClient.invalidateQueries(['customers']);
        queryClient.invalidateQueries(['stock']);
        // Refresh last sync timestamps immediately
        loadLastSyncTimes();
        // Show a brief summary with updated times
        setTimeout(() => {
          const msg = `✅ Data refreshed successfully\n` +
            `📦 Orders: ${formatTs(lastSync.orders_kivos)}\n` +
            `🏪 Products: ${formatTs(lastSync.products_kivos)}\n` +
            `👥 Customers: ${formatTs(lastSync.customers_kivos)}\n` +
            `📊 Stock: ${formatTs(lastSync.stock_kivos)}`;
          showMessage(msg, 5000);
        }, 200);
      })
      .catch((err) => {
        showMessage('❌ Refresh failed: ' + (err?.message || 'Unknown error'));
      })
      .finally(() => setLoading((l) => ({ ...l, all: false })));
  };

  const refreshOrdersOnly = async () => {
    showMessage('🔄 Refreshing orders...');
    setLoading((l) => ({ ...l, orders: true }));
    try {
      await fetchOrdersIncremental({ forceRefresh: true });
      queryClient.invalidateQueries(['orders']);
      await loadLastSyncTimes();
      showMessage(`✅ Orders refreshed. Last sync: ${formatTs(lastSync.orders_kivos)}`, 4000);
    } catch (e) {
      showMessage('❌ Orders refresh failed: ' + (e?.message || 'Unknown error'));
    } finally {
      setLoading((l) => ({ ...l, orders: false }));
    }
  };

  const refreshProductsOnly = async () => {
    showMessage('🔄 Refreshing products...');
    setLoading((l) => ({ ...l, products: true }));
    try {
      await fetchProductsCached(true);
      queryClient.invalidateQueries(['products']);
      await loadLastSyncTimes();
      showMessage(`✅ Products refreshed. Last sync: ${formatTs(lastSync.products_kivos)}`, 4000);
    } catch (e) {
      showMessage('❌ Products refresh failed: ' + (e?.message || 'Unknown error'));
    } finally {
      setLoading((l) => ({ ...l, products: false }));
    }
  };

  const refreshCustomersOnly = async () => {
    showMessage('🔄 Refreshing customers...');
    setLoading((l) => ({ ...l, customers: true }));
    try {
      await fetchCustomersCached(true);
      queryClient.invalidateQueries(['customers']);
      await loadLastSyncTimes();
      showMessage(`✅ Customers refreshed. Last sync: ${formatTs(lastSync.customers_kivos)}`, 4000);
    } catch (e) {
      showMessage('❌ Customers refresh failed: ' + (e?.message || 'Unknown error'));
    } finally {
      setLoading((l) => ({ ...l, customers: false }));
    }
  };

  const refreshStockOnly = async () => {
    showMessage('🔄 Refreshing stock...');
    setLoading((l) => ({ ...l, stock: true }));
    try {
      await fetchStockCached(true);
      queryClient.invalidateQueries(['stock']);
      await loadLastSyncTimes();
      showMessage(`✅ Stock refreshed. Last sync: ${formatTs(lastSync.stock_kivos)}`, 4000);
    } catch (e) {
      showMessage('❌ Stock refresh failed: ' + (e?.message || 'Unknown error'));
    } finally {
      setLoading((l) => ({ ...l, stock: false }));
    }
  };

  const loadLastSyncTimes = async () => {
    const [ordersTs, productsTs, customersTs, stockTs] = await Promise.all([
      getLastSyncTime('orders_kivos'),
      getLastSyncTime('products_kivos'),
      getLastSyncTime('customers_kivos'),
      getLastSyncTime('stock_kivos'),
    ]);
    setLastSync({
      orders_kivos: ordersTs,
      products_kivos: productsTs,
      customers_kivos: customersTs,
      stock_kivos: stockTs,
    });
  };

  useEffect(() => {
    loadLastSyncTimes();
    // Optionally poll every 10s to reflect background incremental updates
    const id = setInterval(loadLastSyncTimes, 10000);
    return () => clearInterval(id);
  }, []);

  const formatTs = (ts) => {
    if (!ts) return '—';
    try {
      const d = new Date(ts);
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
    } catch {
      return String(ts);
    }
  };

  const getCacheSize = async () => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const usedMB = (estimate.usage / 1024 / 1024).toFixed(2);
      const quotaMB = (estimate.quota / 1024 / 1024).toFixed(2);
      showMessage(`📊 Storage: ${usedMB} MB / ${quotaMB} MB used`, 5000);
    } else {
      showMessage('⚠️ Storage API not supported');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Cache Management</h2>
        <p className="text-gray-600 mt-1">
          Manage local data cache to control Firestore quota usage
        </p>
      </div>

      {/* Status Message */}
      {message && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg">
          {message}
        </div>
      )}

      {/* Cache Info */}
      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Cache Information</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm font-medium text-gray-700">How Caching Works</p>
            <ul className="text-sm text-gray-600 mt-2 space-y-1 list-disc list-inside">
              <li>First load: Fetches from Firestore and stores locally (IndexedDB)</li>
              <li>Subsequent loads: Uses cached data instantly (0 reads)</li>
              <li>Incremental updates: Background checks for changes since last sync</li>
              <li>Manual refresh: Use Update/Refresh buttons to force a full fetch</li>
            </ul>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm font-medium text-gray-700">Cache Durations</p>
            <ul className="text-sm text-gray-600 mt-2 space-y-1">
              <li>📦 Orders: Persistent (manual refresh only; incremental via <code>firestoreUpdatedAt</code>)</li>
              <li>🏪 Products: Persistent (incremental via <code>lastUpdated</code>)</li>
              <li>👥 Customers: Persistent (full fetch; changes rarely)</li>
              <li>📊 Stock: Persistent (incremental via <code>lastUpdated</code>)</li>
            </ul>
            <p className="text-xs text-gray-500 mt-2">React Query is configured with <strong>staleTime</strong> and <strong>cacheTime</strong> as Infinity, so there is no auto-refetch. All updates are manual or incremental.</p>
          </div>
        </div>

        {/* Last Sync Times */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 p-4 rounded-lg">
            <p className="text-sm font-medium text-gray-700">Last Sync Times</p>
            <ul className="text-sm text-gray-600 mt-2 space-y-2">
              <li className="flex items-center justify-between">
                <span>📦 Orders: <span className="font-mono">{formatTs(lastSync.orders_kivos)}</span></span>
                <button onClick={refreshOrdersOnly} disabled={loading.orders} className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed">
                  {loading.orders ? 'Refreshing…' : 'Refresh'}
                </button>
              </li>
              <li className="flex items-center justify-between">
                <span>🏪 Products: <span className="font-mono">{formatTs(lastSync.products_kivos)}</span></span>
                <button onClick={refreshProductsOnly} disabled={loading.products} className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed">
                  {loading.products ? 'Refreshing…' : 'Refresh'}
                </button>
              </li>
              <li className="flex items-center justify-between">
                <span>👥 Customers: <span className="font-mono">{formatTs(lastSync.customers_kivos)}</span></span>
                <button onClick={refreshCustomersOnly} disabled={loading.customers} className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed">
                  {loading.customers ? 'Refreshing…' : 'Refresh'}
                </button>
              </li>
              <li className="flex items-center justify-between">
                <span>📊 Stock: <span className="font-mono">{formatTs(lastSync.stock_kivos)}</span></span>
                <button onClick={refreshStockOnly} disabled={loading.stock} className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed">
                  {loading.stock ? 'Refreshing…' : 'Refresh'}
                </button>
              </li>
            </ul>
            <div className="mt-3 flex gap-2">
              <button
                onClick={loadLastSyncTimes}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-xs font-medium"
              >
                ↻ Refresh Timestamps
              </button>
              <button
                onClick={handleRefreshAll}
                disabled={loading.all}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading.all ? 'Refreshing…' : '🔄 Update All Data'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">Timestamps update automatically when incremental background fetches detect changes.</p>
          </div>
        </div>

        <button
          onClick={getCacheSize}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium text-sm"
        >
          📊 Check Storage Usage
        </button>
      </div>

      {/* Individual Cache Controls */}
      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Clear Individual Caches</h3>
        <p className="text-sm text-gray-600">
          Clear specific data caches to force fresh data from Firestore
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => handleClearStore(STORES.ORDERS, 'orders')}
            className="px-4 py-3 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-lg hover:bg-yellow-100 font-medium text-left"
          >
            <div className="flex items-center justify-between">
              <span>📦 Orders Cache</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <p className="text-xs text-yellow-600 mt-1">Clear orders data</p>
          </button>

          <button
            onClick={() => handleClearStore(STORES.PRODUCTS, 'products')}
            className="px-4 py-3 bg-green-50 text-green-800 border border-green-200 rounded-lg hover:bg-green-100 font-medium text-left"
          >
            <div className="flex items-center justify-between">
              <span>🏪 Products Cache</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <p className="text-xs text-green-600 mt-1">Clear products data</p>
          </button>

          <button
            onClick={() => handleClearStore(STORES.CUSTOMERS, 'customers')}
            className="px-4 py-3 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg hover:bg-blue-100 font-medium text-left"
          >
            <div className="flex items-center justify-between">
              <span>👥 Customers Cache</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <p className="text-xs text-blue-600 mt-1">Clear customers data</p>
          </button>

          <button
            onClick={() => handleClearStore(STORES.STOCK, 'stock')}
            className="px-4 py-3 bg-purple-50 text-purple-800 border border-purple-200 rounded-lg hover:bg-purple-100 font-medium text-left"
          >
            <div className="flex items-center justify-between">
              <span>📊 Stock Cache</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <p className="text-xs text-purple-600 mt-1">Clear stock data</p>
          </button>
        </div>
      </div>

      {/* Bulk Actions */}
      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Bulk Actions</h3>
        
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleClearAllCache}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
          >
            🗑️ Clear All Caches
          </button>

          <button
            onClick={handleRefreshAll}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            🔄 Refresh All Data
          </button>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
          <p className="text-sm font-medium text-yellow-800">⚠️ Warning</p>
          <p className="text-sm text-yellow-700 mt-1">
            Clearing caches will force the app to fetch fresh data from Firestore on the next load and reset incremental sync markers. This consumes read quota. Only do this if you're experiencing data issues.
          </p>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg border border-blue-200">
        <h3 className="text-lg font-semibold text-gray-900">💡 Tips to Save Quota</h3>
        <ul className="text-sm text-gray-700 mt-3 space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-blue-600">✓</span>
            <span>Rely on cached data and incremental updates instead of manual refreshes</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600">✓</span>
            <span>Avoid clearing caches unless necessary; it resets incremental sync and increases reads</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600">✓</span>
            <span>Close browser tabs you're not using to prevent duplicate fetches</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600">✓</span>
            <span>Cached data is instant and uses zero Firestore reads!</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default CacheManagement;
