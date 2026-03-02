// App.js
// -------------------------------------------------------------
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import * as Font from 'expo-font';

// Providers
import { AuthProvider, useAuth } from './src/context/AuthProvider';
import { OnlineStatusProvider } from './src/utils/OnlineStatusContext';
import { OrderProvider } from './src/context/OrderContext';
import { ExpenseProvider } from './src/context/ExpenseContext';

// Components
import OnlineStatusBanner from './src/utils/OnlineStatusBanner';
import colors from './src/theme/colors';
import AuthStack from './src/navigation/AuthStack';
import MainTabsNavigator from './src/navigation/MainTabsNavigator';
import InventoryService from './src/services/inventoryService';

// Screens
import PlaymobilScreen from './src/screens/PlaymobilScreen';
import KivosScreen from './src/screens/KivosScreen';
import JohnScreen from './src/screens/JohnScreen';
import DataScreen from './src/screens/DataScreen';
import ProductDetailScreen from './src/screens/ProductDetailScreen';
import StockDetailsScreen from './src/screens/StockDetailsScreen';
import CustomerDetailScreen from './src/screens/CustomerDetailScreen';
import KivosCustomerDetailScreen from './src/screens/KivosCustomerDetailScreen';
import JohnCustomerDetailScreen from './src/screens/JohnCustomerDetailScreen';
import CustomerSalesSummary from './src/screens/CustomerSalesSummary';
import CustomerMonthlySales from './src/screens/CustomerMonthlySales';
import CustomerSalesDetail from './src/screens/CustomerSalesDetail';
import OrdersManagementScreen from './src/screens/OrdersManagement';
import OrderCustomerSelectScreen from './src/screens/OrderCustomerSelectScreen';
import OrderProductSelectionScreen from './src/screens/OrderProductSelectionScreen';
import OrderReviewScreen from './src/screens/OrderReviewScreen';
import OrderSummaryScreen from './src/screens/OrderSummaryScreen';
import ExportSuccessScreen from './src/screens/ExportSuccessScreen';
import OrderDetailScreen from './src/screens/OrderDetailScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import UserManagementScreen from './src/screens/UserManagementScreen';
import SalesmanManagementScreen from './src/screens/SalesmanManagementScreen';
import CataloguesScreen from './src/screens/CataloguesScreen';
import SuperMarketOrderFlowScreen from './src/screens/SuperMarketOrderFlowScreen';
import SuperMarketStoreSelectScreen from './src/screens/SuperMarketStoreSelectScreen';
import SuperMarketProductSelectionScreen from './src/screens/SuperMarketProductSelectionScreen';
import SuperMarketOrderReviewScreen from './src/screens/SuperMarketOrderReviewScreen';
import SuperMarketOrderSummaryScreen from './src/screens/SuperMarketOrderSummaryScreen';
import SuperMarketStoreDetailsScreen from './src/screens/SuperMarketStoreDetailsScreen';
import BrandContactsScreen from './src/screens/BrandContactsScreen';
import SalesAnalyticsScreen from './src/screens/SalesAnalyticsScreen';
import MonthlyComparisonScreen from './src/screens/MonthlyComparisonScreen';
import ScanInventoryScreen from './src/screens/ScanInventoryScreen';
import InventoryUploadScreen from './src/screens/InventoryUploadScreen';
import KivosBrandStatisticsScreen from './src/screens/KivosBrandStatisticsScreen';
import KivosCustomerHistoryScreen from './src/screens/KivosCustomerHistoryScreen';
import CompanyInfoScreen from './src/screens/CompanyInfoScreen';
import CustomerSalesSummaryTest from './src/screens/CustomerSalesSummaryTest';
import TestKPI from './src/screens/TestKPI';
import KivosWarehouseNavigator from './src/navigation/KivosWarehouseNavigator';
import FieldSalesProScreen from './src/screens/FieldSalesProScreen';
import ExpenseTrackerScreen from './src/screens/ExpenseTrackerScreen';
import ExpenseDetailScreen from './src/screens/ExpenseDetailScreen';
import ExpenseReportsScreen from './src/screens/ExpenseReportsScreen';
import WeeklyTrackingScreen from './src/screens/WeeklyTrackingScreen';
import WeeklyReportScreen from './src/screens/WeeklyReportScreen';
import ManagerWeeklyReportScreen from './src/screens/ManagerWeeklyReportScreen';
import ManagerInboxScreen from './src/screens/ManagerInboxScreen';
const Stack = createNativeStackNavigator();

const loadFonts = async () => {
  console.log('🔤 [App] Loading custom fonts...');
  try {
    await Font.loadAsync({
      'LibreBarcode128Text-Regular': require('./assets/fonts/LibreBarcode128Text-Regular.ttf'),
      'LibreBarcode39Text-Regular': require('./assets/fonts/LibreBarcode39Text-Regular.ttf'),
    });
    console.log('✅ [App] Fonts loaded successfully');
  } catch (error) {
    console.warn('⚠️ [App] Font load failed:', error);
  }
};

// -------------------------------------------------------------
function AppNavigator() {
  const { init, user, loadingProfile, profile } = useAuth();

  // Auto-sync inventory queue on user auth
  useEffect(() => {
    if (user?.uid) {
      console.log('[AppNavigator] User authenticated → attempting inventory sync');
      InventoryService.syncOfflineQueue(user.uid)
        .then((result) => {
          console.log('[AppNavigator] Inventory sync result:', result);
        })
        .catch((err) => {
          console.error('[AppNavigator] Inventory sync error:', err);
        });
    }
  }, [user?.uid]);

  if (init || loadingProfile) {
    console.log('⏳ [AppNavigator] Waiting for auth initialization...');
    return null;
  }

  if (!user) {
    console.log('🔒 [AppNavigator] No user detected → showing AuthStack');
    return <AuthStack />;
  }

  console.log('✅ [AppNavigator] User authenticated → loading main app...');
  return (
    <ExpenseProvider userId={user?.uid} userRole={profile?.role || 'salesman'}>
      <OnlineStatusBanner />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={MainTabsNavigator} />
        <Stack.Screen name="Playmobil" component={PlaymobilScreen} />
        <Stack.Screen name="Kivos" component={KivosScreen} />
        <Stack.Screen name="John" component={JohnScreen} />
        <Stack.Screen name="Data" component={DataScreen} />
        <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
        <Stack.Screen name="StockDetails" component={StockDetailsScreen} />
        <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} />
        <Stack.Screen name="KivosCustomerDetail" component={KivosCustomerDetailScreen} />
        <Stack.Screen name="JohnCustomerDetail" component={JohnCustomerDetailScreen} />
        <Stack.Screen name="CustomerSalesSummary" component={CustomerSalesSummary} />
        <Stack.Screen name="CustomerMonthlySales" component={CustomerMonthlySales} />
        <Stack.Screen name="CustomerSalesDetail" component={CustomerSalesDetail} />
        <Stack.Screen name="OrdersManagement" component={OrdersManagementScreen} />
        <Stack.Screen name="OrderCustomerSelectScreen" component={OrderCustomerSelectScreen} />
        <Stack.Screen name="OrderProductSelectionScreen" component={OrderProductSelectionScreen} />
        <Stack.Screen name="OrderReviewScreen" component={OrderReviewScreen} />
        <Stack.Screen name="OrderSummaryScreen" component={OrderSummaryScreen} />
        <Stack.Screen name="ExportSuccessScreen" component={ExportSuccessScreen} />
        <Stack.Screen name="SuperMarketOrderFlow" component={SuperMarketOrderFlowScreen} />
        <Stack.Screen name="SuperMarketProductSelection" component={SuperMarketProductSelectionScreen} />
        <Stack.Screen name="SuperMarketOrderReview" component={SuperMarketOrderReviewScreen} />
        <Stack.Screen name="SuperMarketOrderSummary" component={SuperMarketOrderSummaryScreen} />
        <Stack.Screen name="SuperMarketStoreDetails" component={SuperMarketStoreDetailsScreen} />
        <Stack.Screen name="BrandContacts" component={BrandContactsScreen} />
        <Stack.Screen name="SalesAnalytics" component={SalesAnalyticsScreen} />
        <Stack.Screen name="MonthlyComparison" component={MonthlyComparisonScreen} />
        <Stack.Screen name="KivosBrandStatistics" component={KivosBrandStatisticsScreen} />
        <Stack.Screen name="KivosCustomerHistory" component={KivosCustomerHistoryScreen} />
        <Stack.Screen name="CompanyInfo" component={CompanyInfoScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="UserManagement" component={UserManagementScreen} />
        <Stack.Screen name="SalesmanManagement" component={SalesmanManagementScreen} />
        <Stack.Screen name="Catalog" component={CataloguesScreen} />
        <Stack.Screen name="CustomerSalesSummaryTest" component={CustomerSalesSummaryTest} />
        <Stack.Screen name="TestKPI" component={TestKPI} />
        <Stack.Screen name="KivosWarehouseNavigator" component={KivosWarehouseNavigator} />
        <Stack.Screen name="ScanInventory" component={ScanInventoryScreen} />
        <Stack.Screen name="InventoryUpload" component={InventoryUploadScreen} />
        <Stack.Screen name="FieldSalesPro" component={FieldSalesProScreen} />
        <Stack.Screen name="ExpenseTracker" component={ExpenseTrackerScreen} />
        <Stack.Screen name="ExpenseDetail" component={ExpenseDetailScreen} />
        <Stack.Screen name="ExpenseReports" component={ExpenseReportsScreen} />
        <Stack.Screen name="WeeklyTracking" component={WeeklyTrackingScreen} />
        <Stack.Screen name="WeeklyReport" component={WeeklyReportScreen} />
        <Stack.Screen name="ManagerWeeklyReport" component={ManagerWeeklyReportScreen} />
        <Stack.Screen name="ManagerInbox" component={ManagerInboxScreen} />
      </Stack.Navigator>
    </ExpenseProvider>
  );
}

// -------------------------------------------------------------
export default function App() {
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    console.log('🚀 [App] Mounting...');
    let mounted = true;
    (async () => {
      await loadFonts();
      if (mounted) setFontsReady(true);
    })();
    return () => {
      console.log('🧹 [App] Unmounting...');
      mounted = false;
    };
  }, []);

  if (!fontsReady) {
    console.log('⏳ [App] Waiting for fonts...');
    return null;
  }

  console.log('✅ [App] Starting navigation tree');
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <OnlineStatusProvider>
          <OrderProvider>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
            <NavigationContainer>
              <AppNavigator />
            </NavigationContainer>
          </OrderProvider>
        </OnlineStatusProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
