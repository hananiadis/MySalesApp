import { Navigate, Route, Routes } from 'react-router-dom';
import MainLayout from '../components/Layout/MainLayout';
import RequireAuth from './RequireAuth';
import LoginScreen from '../screens/Auth/LoginScreen';
import WarehouseDashboard from '../screens/Dashboard/WarehouseDashboard';
import SupplierOrdersList from '../screens/SupplierOrders/SupplierOrdersList';
import SupplierOrderDetail from '../screens/SupplierOrders/SupplierOrderDetail';
import ActivityLogScreen from '../screens/ActivityLog/ActivityLogScreen';
import FirestoreDebugScreen from '../screens/Debug/FirestoreDebugScreen';
import StockList from '../screens/Stock/StockList';
import StockAdjustment from '../screens/Stock/StockAdjustment';
import ProductDetail from '../screens/Stock/ProductDetail';
import InventoryCount from '../screens/Stock/InventoryCount';
import OrdersList from '../screens/Orders/OrdersList';
import OrderDetail from '../screens/Orders/OrderDetail';
import CacheManagement from '../screens/Settings/CacheManagement';

const AppRouter = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route
        element={
          <RequireAuth>
            <MainLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<WarehouseDashboard />} />
        <Route path="/stock" element={<StockList />} />
        <Route path="/stock/adjust" element={<StockAdjustment />} />
        <Route path="/stock/count" element={<InventoryCount />} />
        <Route path="/orders" element={<OrdersList />} />
        <Route path="/orders/:id" element={<OrderDetail />} />
        <Route path="/supplier-orders" element={<SupplierOrdersList />} />
        <Route path="/supplier-orders" element={<SupplierOrdersList />} />
        <Route path="/supplier-orders/:id" element={<SupplierOrderDetail />} />
        <Route path="/activity-log" element={<ActivityLogScreen />} />
        <Route path="/settings/cache" element={<CacheManagement />} />
        <Route path="/debug-firestore" element={<FirestoreDebugScreen />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default AppRouter;
