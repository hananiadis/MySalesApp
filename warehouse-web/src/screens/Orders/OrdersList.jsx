import React, { useState, useMemo } from 'react';
import { useQuery } from 'react-query';
import * as XLSX from 'xlsx';
import t from '../../utils/translations';
import { useNavigate } from 'react-router-dom';
import { 
  fetchOrdersIncremental, 
  fetchProductsCached, 
  fetchCustomersCached 
} from '../../services/optimizedFirestoreService';

const OrdersList = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedGroups, setExpandedGroups] = useState({});

  // Format date as dd/mm/yyyy
  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      const d = date instanceof Date ? date : new Date(date);
      if (isNaN(d.getTime())) return 'N/A';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return 'N/A';
    }
  };

  const formatDateTime = (date) => {
    if (!date) return 'N/A';
    try {
      const d = date instanceof Date ? date : new Date(date);
      if (isNaN(d.getTime())) return 'N/A';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch {
      return 'N/A';
    }
  };

  const statusOptions = [
    { value: 'pending', label: t.ordersList.pending, color: 'yellow' },
    { value: 'packing', label: t.ordersList.packing, color: 'blue' },
    { value: 'packed', label: t.ordersList.packed, color: 'green' },
    { value: 'shipped', label: t.ordersList.shipped, color: 'purple' },
    { value: 'backorder', label: t.ordersList.backorder, color: 'orange' },
    { value: 'sent', label: t.ordersList.sent || 'Sent', color: 'blue' },
    { value: 'cancelled', label: t.ordersList.cancelled, color: 'red' },
  ];

  // Fetch orders with persistent cache - incremental updates in background
  const { data: orders = [], isLoading, refetch } = useQuery(
    ['orders'],
    () => fetchOrdersIncremental()
  );

  // Fetch customers with persistent cache - updates in background
  const { data: customers = {} } = useQuery(
    ['customers'],
    () => fetchCustomersCached()
  );

  // Fetch products with persistent cache - updates in background
  const { data: products = {} } = useQuery(
    ['products'],
    () => fetchProductsCached()
  );

  // Filter orders
  const filteredOrders = useMemo(() => {
    let filtered = [...orders];

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(order => {
        const customerKey = order?.customer?.id || order?.customerCode || order?.customer?.customerCode;
        const customer = customerKey ? customers[customerKey] : undefined;
        const customerName = (customer?.name || order?.customer?.name || '').toLowerCase();
        const orderId = order.id.toLowerCase();
        
        // Search in lines
        const itemMatch = order.lines?.some(item => {
          const product = products[item.productCode] || {};
          return (
            (product.description || '').toLowerCase().includes(search) ||
            (product.productCode || '').toLowerCase().includes(search) ||
            (item.productCode || '').toLowerCase().includes(search) ||
            (item.description || '').toLowerCase().includes(search)
          );
        });

        return orderId.includes(search) || 
               customerName.includes(search) || 
               itemMatch;
      });
    }

    // Status filter
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter(order => 
        selectedStatuses.includes(order.status)
      );
    }

    // Date range filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(order => 
        order.createdAt >= fromDate
      );
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(order => 
        order.createdAt <= toDate
      );
    }

    return filtered;
  }, [orders, searchTerm, selectedStatuses, dateFrom, dateTo, customers, products]);

  // Group orders by status
  const groupedOrders = useMemo(() => {
    const groups = {};
    filteredOrders.forEach(order => {
      const status = order.status || 'pending';
      if (!groups[status]) {
        groups[status] = [];
      }
      groups[status].push(order);
    });
    return groups;
  }, [filteredOrders]);

  // Calculate order total
  const calculateOrderTotal = (order) => {
    if (Array.isArray(order.lines)) {
      return order.lines.reduce((total, item) => {
        const product = products[item.productCode];
        const price = (item.wholesalePrice ?? product?.wholesalePrice ?? 0);
        const qty = (item.quantity ?? item.qty ?? 0);
        return total + (price * qty);
      }, 0);
    }
    // Fallback to provided finalValue if available
    return Number(order.finalValue || 0);
  };

  // Calculate stats
  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const packedToday = orders.filter(o => {
      if (o.status !== 'packed' || !o.packedAt) return false;
      const packedDate = o.packedAt instanceof Date ? o.packedAt : o.packedAt.toDate();
      return packedDate >= today;
    }).length;

    const totalValue = orders.reduce((sum, order) => sum + calculateOrderTotal(order), 0);

    return { totalOrders, pendingOrders, packedToday, totalValue };
  }, [orders, products]);

  // Toggle status filter
  const toggleStatus = (status) => {
    setSelectedStatuses(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  // Expand/Collapse all groups
  const expandAll = () => {
    const allExpanded = {};
    Object.keys(groupedOrders).forEach(status => {
      allExpanded[status] = true;
    });
    setExpandedGroups(allExpanded);
  };

  const collapseAll = () => {
    setExpandedGroups({});
  };

  // Toggle group
  const toggleGroup = (status) => {
    setExpandedGroups(prev => ({
      ...prev,
      [status]: !prev[status]
    }));
  };

  // Export to Excel
  const exportToExcel = () => {
    const exportData = filteredOrders.map(order => {
      const customer = customers[order.userId];
      return {
        [t.ordersList.orderId]: order.id,
        [t.ordersList.customer]: customer?.name || order.userId,
        [t.ordersList.status]: statusOptions.find(s => s.value === order.status)?.label || order.status,
        [t.ordersList.items]: order.items?.length || 0,
        [t.ordersList.total]: calculateOrderTotal(order).toFixed(2),
        [t.ordersList.created]: formatDate(order.createdAt),
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t.ordersList.title);
    XLSX.writeFile(wb, `orders_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Get status badge color
  const getStatusColor = (status) => {
    const statusOption = statusOptions.find(s => s.value === status);
    const color = statusOption?.color || 'gray';
    
    const colorMap = {
      yellow: 'bg-yellow-100 text-yellow-800',
      blue: 'bg-blue-100 text-blue-800',
      green: 'bg-green-100 text-green-800',
      purple: 'bg-purple-100 text-purple-800',
      orange: 'bg-orange-100 text-orange-800',
      red: 'bg-red-100 text-red-800',
      gray: 'bg-gray-100 text-gray-800',
    };
    
    return colorMap[color];
  };

  // Get status label
  const getStatusLabel = (status) => {
    return statusOptions.find(s => s.value === status)?.label || status;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t.ordersList.title}</h1>
        <p className="text-gray-600 mt-1">{t.ordersList.subtitle}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">{t.ordersList.totalOrders}</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalOrders}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">{t.ordersList.pendingOrders}</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pendingOrders}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">{t.ordersList.packedToday}</p>
          <p className="text-2xl font-bold text-green-600">{stats.packedToday}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">{t.ordersList.totalValue}</p>
          <p className="text-2xl font-bold text-blue-600">€{stats.totalValue.toFixed(2)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        {/* Search */}
        <div>
          <input
            type="text"
            placeholder={t.ordersList.searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t.ordersList.orderStatus}
          </label>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map(status => (
              <button
                key={status.value}
                onClick={() => toggleStatus(status.value)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedStatuses.includes(status.value)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t.ordersList.from}
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {dateFrom && (
              <p className="text-xs text-gray-500 mt-1">
                {formatDate(new Date(dateFrom))}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t.ordersList.to}
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {dateTo && (
              <p className="text-xs text-gray-500 mt-1">
                {formatDate(new Date(dateTo))}
              </p>
            )}
          </div>
        </div>

        {/* Update Controls */}
        <div className="border-t border-gray-200 pt-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-blue-900">📦 Persistent Cache Active</p>
                <p className="text-xs text-blue-700 mt-1">
                  All data is stored locally. Background updates check for changes automatically.
                  <br />Currently loaded: <strong>{orders.length} orders</strong>
                </p>
              </div>
              <button
                onClick={() => {
                  // Force refresh all data
                  fetchOrdersIncremental({ forceRefresh: true });
                  fetchProductsCached(true);
                  fetchCustomersCached(true);
                  refetch();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm flex items-center gap-2 whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Update All Data
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 border-t border-gray-200 pt-4">
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedStatuses([]);
              setDateFrom('');
              setDateTo('');
            }}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
          >
            {t.ordersList.reset}
          </button>
          <button
            onClick={exportToExcel}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
          >
            {t.ordersList.exportExcel}
          </button>
        </div>
      </div>

      {/* Expand/Collapse Controls */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-600">
          {t.ordersList.showing} {filteredOrders.length} {t.ordersList.of} {orders.length}
        </div>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium text-sm"
          >
            {t.common.expandAll}
          </button>
          <button
            onClick={collapseAll}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium text-sm"
          >
            {t.common.collapseAll}
          </button>
        </div>
      </div>

      {/* Orders List - Grouped by Status */}
      <div className="space-y-4">
        {Object.keys(groupedOrders).length === 0 ? (
          <div className="bg-white p-12 rounded-lg shadow text-center">
            <p className="text-gray-500">{t.ordersList.noOrders}</p>
          </div>
        ) : (
          Object.entries(groupedOrders).map(([status, statusOrders]) => (
            <div key={status} className="bg-white rounded-lg shadow overflow-hidden">
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(status)}
                className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status)}`}>
                    {getStatusLabel(status)}
                  </span>
                  <span className="text-gray-600">
                    ({statusOrders.length})
                  </span>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-500 transition-transform ${
                    expandedGroups[status] ? 'transform rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Orders Table */}
              {expandedGroups[status] && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t.ordersList.orderId}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t.ordersList.customer}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t.ordersList.created}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t.ordersList.items}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t.ordersList.total}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t.ordersList.actions}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {statusOrders.map(order => {
                        const customerKey = order?.customer?.id || order?.customerCode || order?.customer?.customerCode;
                        const customer = customerKey ? customers[customerKey] : undefined;
                        const orderTotal = calculateOrderTotal(order);
                        
                        return (
                          <tr key={order.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {order.id.substring(0, 8)}...
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {customer?.name || order?.customer?.name || customerKey || ''}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDateTime(order.createdAt)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {order.lines?.length || 0}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              €{orderTotal.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <button
                                onClick={() => navigate(`/orders/${order.id}`)}
                                className="text-blue-600 hover:text-blue-800 font-medium"
                              >
                                {t.ordersList.viewDetails}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default OrdersList;
