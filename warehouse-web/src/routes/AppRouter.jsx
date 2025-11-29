import { Navigate, Route, Routes } from 'react-router-dom';
import MainLayout from '../components/Layout/MainLayout';
import RequireAuth from './RequireAuth';
import LoginScreen from '../screens/Auth/LoginScreen';
import WarehouseDashboard from '../screens/Dashboard/WarehouseDashboard';
import SupplierOrdersList from '../screens/SupplierOrders/SupplierOrdersList';
import SupplierOrderDetail from '../screens/SupplierOrders/SupplierOrderDetail';
import ActivityLogScreen from '../screens/ActivityLog/ActivityLogScreen';

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
        <Route path="/supplier-orders" element={<SupplierOrdersList />} />
        <Route path="/supplier-orders/:id" element={<SupplierOrderDetail />} />
        <Route path="/activity-log" element={<ActivityLogScreen />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default AppRouter;
