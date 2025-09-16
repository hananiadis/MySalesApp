// App.js
import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/context/AuthProvider';
import AuthStack from './src/navigation/AuthStack';
// Providers
import { OnlineStatusProvider } from './src/utils/OnlineStatusContext';
import OnlineStatusBanner from './src/utils/OnlineStatusBanner';
import { OrderProvider } from './src/context/OrderContext';

// Screens
import HomeScreen from './src/screens/HomeScreen';
import PlaymobilScreen from './src/screens/PlaymobilScreen';
import ProductsScreen from './src/screens/ProductsScreen';
import CustomersScreen from './src/screens/CustomersScreen';
import DataScreen from './src/screens/DataScreen';
import ProductDetailScreen from './src/screens/ProductDetailScreen';
import StockDetailsScreen from './src/screens/StockDetailsScreen';
import CustomerDetailScreen from './src/screens/CustomerDetailScreen';
import CustomerSalesSummary from './src/screens/CustomerSalesSummary';
import CustomerSalesDetail from './src/screens/CustomerSalesDetail';
import OrdersManagementScreen from './src/screens/OrdersManagement';
import OrderCustomerSelectScreen from './src/screens/OrderCustomerSelectScreen';
import OrderProductSelectionScreen from './src/screens/OrderProductSelectionScreen';
import OrderReviewScreen from './src/screens/OrderReviewScreen';
import OrderSummaryScreen from './src/screens/OrderSummaryScreen';
import ExportSuccessScreen from './src/screens/ExportSuccessScreen';
import OrderDetailScreen from './src/screens/OrderDetailScreen';

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { init, user, loadingProfile } = useAuth();

  if (init || loadingProfile) {
    return null;
  }

  if (!user) {
    return <AuthStack />;
  }

  return (
    <>
      <OnlineStatusBanner />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* Main */}
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Playmobil" component={PlaymobilScreen} />
        <Stack.Screen name="Products" component={ProductsScreen} />
        <Stack.Screen name="Customers" component={CustomersScreen} />
        <Stack.Screen name="Data" component={DataScreen} />
        <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
        <Stack.Screen name="StockDetails" component={StockDetailsScreen} />
        <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} />
        <Stack.Screen name="CustomerSalesSummary" component={CustomerSalesSummary} />
        <Stack.Screen name="CustomerSalesDetail" component={CustomerSalesDetail} />
        <Stack.Screen name="OrdersManagement" component={OrdersManagementScreen} />
        <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />

        {/* Order flow (names used by navigation.navigate) */}
        <Stack.Screen
          name="OrderCustomerSelectScreen"
          component={OrderCustomerSelectScreen}
        />
        <Stack.Screen
          name="OrderProductSelectionScreen"
          component={OrderProductSelectionScreen}
        />
        <Stack.Screen
          name="OrderReviewScreen"
          component={OrderReviewScreen}
        />
        <Stack.Screen
          name="OrderSummaryScreen"
          component={OrderSummaryScreen}
        />
        <Stack.Screen
          name="ExportSuccessScreen"
          component={ExportSuccessScreen}
        />
      </Stack.Navigator>
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <OnlineStatusProvider>
          <OrderProvider>
            <StatusBar barStyle="dark-content" backgroundColor="#f2f2f2" />
            <NavigationContainer>
              <AppNavigator />
            </NavigationContainer>
          </OrderProvider>
        </OnlineStatusProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
