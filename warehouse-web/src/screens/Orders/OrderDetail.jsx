import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from 'react-query';
import t from '../../utils/translations';
import { 
  fetchOrdersIncremental, 
  fetchProductsCached, 
  fetchCustomersCached 
} from '../../services/optimizedFirestoreService';
import { packOrderWithBackorder } from '../../services/orderPackingService';
import { useAuth } from '../../context/AuthContext';

const OrderDetail = () => {
  const { id: orderId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const [isLoadingAction, setIsLoadingAction] = useState(null);
  const [showPackModal, setShowPackModal] = useState(false);
  const [packedItems, setPackedItems] = useState({});

  // Fetch orders
  const { data: orders = [], isLoading: loadingOrders } = useQuery(
    ['orders'],
    () => fetchOrdersIncremental()
  );

  // Fetch customers
  const { data: customers = {} } = useQuery(
    ['customers'],
    () => fetchCustomersCached()
  );

  // Fetch products
  const { data: products = {} } = useQuery(
    ['products'],
    () => fetchProductsCached()
  );

  const order = orders.find(o => o.id === orderId);

  if (loadingOrders) {
    return (
      <div className="p-6">
        <div className="animate-pulse">{t.common.loading}</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6">
        <div className="text-red-600">Order not found (ID: {orderId})</div>
        <div className="text-gray-600 mt-2">Available orders: {orders.length}</div>
        <button 
          onClick={() => navigate('/orders')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {t.common.back}
        </button>
      </div>
    );
  }

  // Resolve customer
  const customerKey = order?.customer?.id || order?.customerCode;
  const customer = customerKey ? customers[customerKey] : {};
  const customerName = customer?.name || order?.customer?.name || t.common.unknown;

  // Resolve order lines
  const lines = order.lines || order.items || [];

  // Helper to safely format dates as dd/mm/yyyy
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
    if (!date) return null;
    try {
      const d = date instanceof Date ? date : new Date(date);
      if (isNaN(d.getTime())) return null;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch {
      return null;
    }
  };

  // Status badge colors
  const statusColors = {
    pending: 'yellow',
    packing: 'blue',
    packed: 'green',
    shipped: 'purple',
    backorder: 'orange',
    sent: 'indigo',
    cancelled: 'red',
  };

  const getStatusLabel = (status) => {
    return t.ordersList[status] || status;
  };

  const getStatusColor = (status) => {
    const colorName = statusColors[status] || 'gray';
    const colors = {
      yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      blue: 'bg-blue-100 text-blue-800 border-blue-300',
      green: 'bg-green-100 text-green-800 border-green-300',
      purple: 'bg-purple-100 text-purple-800 border-purple-300',
      orange: 'bg-orange-100 text-orange-800 border-orange-300',
      indigo: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      red: 'bg-red-100 text-red-800 border-red-300',
      gray: 'bg-gray-100 text-gray-800 border-gray-300',
    };
    return colors[colorName];
  };

  // Calculate line total
  const getLineTotal = (item) => {
    const qty = item.quantity || item.qty || 0;
    const price = item.wholesalePrice || item.price || 0;
    return qty * price;
  };

  // Calculate order totals
  const netValue = lines.reduce((sum, item) => sum + getLineTotal(item), 0);
  const vat = order.vatValue || 0;
  const finalValue = order.finalValue || netValue + vat;

  // Handle packing workflow
  const handleMarkAsPacking = async () => {
    try {
      setIsLoadingAction('packing');
      // Update order status to packing
      const updatedOrder = {
        ...order,
        status: 'packing',
      };
      // TODO: Update in Firestore via orderPackingService or similar
      setIsLoadingAction(null);
      // Refetch to get updated data
      queryClient.invalidateQueries(['orders']);
    } catch (error) {
      console.error('Error marking as packing:', error);
      setIsLoadingAction(null);
    }
  };

  const handlePackOrder = async () => {
    try {
      setIsLoadingAction('packing');
      
      // Prepare packed items (assume all items are packed unless specified otherwise)
      const packed = lines.reduce((acc, item, idx) => {
        acc[idx] = packedItems[idx] !== undefined ? packedItems[idx] : item.quantity || item.qty || 0;
        return acc;
      }, {});

      // Call packing service
      if (user) {
        await packOrderWithBackorder({
          orderId: order.id,
          packedItems: packed,
          userId: user.uid,
        });

        // Show success and refetch
        queryClient.invalidateQueries(['orders']);
        setShowPackModal(false);
        setPackedItems({});
      }
    } catch (error) {
      console.error('Error packing order:', error);
    } finally {
      setIsLoadingAction(null);
    }
  };

  const handleMarkAsShipped = async () => {
    try {
      setIsLoadingAction('shipped');
      // Update order status to shipped
      const updatedOrder = {
        ...order,
        status: 'shipped',
      };
      // TODO: Update in Firestore
      setIsLoadingAction(null);
      queryClient.invalidateQueries(['orders']);
    } catch (error) {
      console.error('Error marking as shipped:', error);
      setIsLoadingAction(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t.ordersList.orderId}: {order.id}
          </h1>
          <p className="text-gray-600 mt-1">
            {formatDate(order.createdAt)}
          </p>
        </div>
        <button
          onClick={() => navigate('/orders')}
          className="px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
        >
          {t.common.back}
        </button>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-4">
        <span className={`inline-block px-4 py-2 rounded border font-semibold ${getStatusColor(order.status)}`}>
          {getStatusLabel(order.status)}
        </span>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Customer & Order Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Info Card */}
          <div className="border border-gray-200 rounded-lg p-6 bg-white">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t.ordersList.customer}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="text-lg font-semibold text-gray-900">{customerName}</p>
              </div>
              {customer?.city && (
                <div>
                  <p className="text-sm text-gray-600">City</p>
                  <p className="text-lg font-semibold text-gray-900">{customer.city}</p>
                </div>
              )}
              {customer?.phone && (
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="text-lg font-semibold text-gray-900">{customer.phone}</p>
                </div>
              )}
              {customer?.email && (
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="text-lg font-semibold text-gray-900">{customer.email}</p>
                </div>
              )}
              {customer?.address && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-600">Address</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {typeof customer.address === 'string' 
                      ? customer.address 
                      : `${customer.address.street || ''}, ${customer.address.city || ''} ${customer.address.postalCode || ''}`.trim()}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Order Items Table */}
          <div className="border border-gray-200 rounded-lg p-6 bg-white">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t.ordersList.items}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">{t.stockList.productCode}</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">{t.stockList.description}</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900">Qty</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900">Price</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((item, idx) => {
                    const product = products[item.productCode] || {};
                    const qty = item.quantity || item.qty || 0;
                    const price = item.wholesalePrice || item.price || 0;
                    const total = getLineTotal(item);

                    return (
                      <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-900 font-semibold">{item.productCode}</td>
                        <td className="py-3 px-4 text-gray-700">{product.description || item.description || '-'}</td>
                        <td className="py-3 px-4 text-right text-gray-900">{qty}</td>
                        <td className="py-3 px-4 text-right text-gray-900">€{price.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-semibold text-gray-900">€{total.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Summary & Actions */}
        <div className="space-y-6">
          {/* Order Summary Card */}
          <div className="border border-gray-200 rounded-lg p-6 bg-white">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Net Value:</span>
                <span className="font-semibold text-gray-900">€{netValue.toFixed(2)}</span>
              </div>
              {vat > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">VAT:</span>
                  <span className="font-semibold text-gray-900">€{vat.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-3 flex justify-between">
                <span className="font-bold text-gray-900">Total:</span>
                <span className="font-bold text-lg text-gray-900">€{finalValue.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          {order.paymentMethod && (
            <div className="border border-gray-200 rounded-lg p-6 bg-white">
              <h3 className="font-semibold text-gray-900 mb-2">Payment Method</h3>
              <p className="text-gray-700">{order.paymentMethod}</p>
            </div>
          )}

          {/* Timeline Card */}
          <div className="border border-gray-200 rounded-lg p-6 bg-white">
            <h3 className="font-semibold text-gray-900 mb-4">Timeline</h3>
            <div className="space-y-3">
              {formatDateTime(order.createdAt) && (
                <div className="text-sm">
                  <p className="text-gray-600">Created</p>
                  <p className="text-gray-900 font-semibold">{formatDateTime(order.createdAt)}</p>
                </div>
              )}
              {formatDateTime(order.updatedAt) && (
                <div className="text-sm">
                  <p className="text-gray-600">Updated</p>
                  <p className="text-gray-900 font-semibold">{formatDateTime(order.updatedAt)}</p>
                </div>
              )}
              {formatDateTime(order.packedAt) && (
                <div className="text-sm">
                  <p className="text-gray-600">Packed</p>
                  <p className="text-gray-900 font-semibold">{formatDateTime(order.packedAt)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="border border-gray-200 rounded-lg p-6 bg-white space-y-3">
            {(order.status === 'pending' || order.status === 'backorder') && (
              <button
                onClick={() => setShowPackModal(true)}
                disabled={isLoadingAction === 'packing'}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                {isLoadingAction === 'packing' ? t.common.saving : 'Pack Order'}
              </button>
            )}

            {order.status === 'packed' && (
              <button
                onClick={handleMarkAsShipped}
                disabled={isLoadingAction === 'shipped'}
                className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                {isLoadingAction === 'shipped' ? t.common.saving : 'Mark as Shipped'}
              </button>
            )}

            <button
              onClick={() => navigate('/orders')}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 font-semibold"
            >
              Back to Orders
            </button>
          </div>
        </div>
      </div>

      {/* Pack Modal */}
      {showPackModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-96 overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Pack Order</h2>
            
            <p className="text-gray-600 mb-4">Enter the quantity packed for each item:</p>

            <div className="space-y-4 mb-6">
              {lines.map((item, idx) => {
                const qty = item.quantity || item.qty || 0;
                const packed = packedItems[idx] !== undefined ? packedItems[idx] : qty;

                return (
                  <div key={idx} className="border border-gray-200 rounded p-4">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <p className="font-semibold text-gray-900">{item.productCode}</p>
                        <p className="text-sm text-gray-600">Available: {qty}</p>
                      </div>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max={qty}
                      value={packed}
                      onChange={(e) => setPackedItems({
                        ...packedItems,
                        [idx]: parseInt(e.target.value) || 0,
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handlePackOrder}
                disabled={isLoadingAction === 'packing'}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                {isLoadingAction === 'packing' ? t.common.saving : 'Confirm Pack'}
              </button>
              <button
                onClick={() => setShowPackModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 font-semibold"
              >
                {t.common.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderDetail;
