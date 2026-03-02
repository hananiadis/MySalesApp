import React from "react";
import { HashRouter, Routes as RouterRoutes, Route } from "react-router-dom";
import ScrollToTop from "components/ScrollToTop";
import ErrorBoundary from "components/ErrorBoundary";
import NotFound from "pages/NotFound";
import ManagerDashboard from './pages/manager-dashboard';
import TerritoryPlanning from './pages/territory-planning';
import PerformanceAnalytics from './pages/performance-analytics';
import MyDayMobile from './pages/my-day-mobile';
import CustomerManagement from './pages/customer-management';
import VisitScheduling from './pages/visit-scheduling';

const Routes = () => {
  return (
    <HashRouter>
      <ErrorBoundary>
      <ScrollToTop />
      <RouterRoutes>
        {/* Define your route here */}
        <Route path="/" element={<ManagerDashboard />} />
        <Route path="/manager-dashboard" element={<ManagerDashboard />} />
        <Route path="/territory-planning" element={<TerritoryPlanning />} />
        <Route path="/performance-analytics" element={<PerformanceAnalytics />} />
        <Route path="/my-day-mobile" element={<MyDayMobile />} />
        <Route path="/customer-management" element={<CustomerManagement />} />
        <Route path="/visit-scheduling" element={<VisitScheduling />} />
        <Route path="*" element={<NotFound />} />
      </RouterRoutes>
      </ErrorBoundary>
    </HashRouter>
  );
};

export default Routes;
