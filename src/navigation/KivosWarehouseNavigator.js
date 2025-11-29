import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import KivosWarehouseHome from '../screens/kivosWarehouse/KivosWarehouseHome';
import KivosStockList from '../screens/kivosWarehouse/KivosStockList';
import KivosStockAdjust from '../screens/kivosWarehouse/KivosStockAdjust';
import KivosOrdersList from '../screens/kivosWarehouse/KivosOrdersList';
import KivosSupplierOrderCreate from '../screens/kivosWarehouse/KivosSupplierOrderCreate';
import KivosOrderDetail from '../screens/kivosWarehouse/KivosOrderDetail';
import KivosSupplierOrdersList from '../screens/kivosWarehouse/KivosSupplierOrdersList';
import KivosSupplierOrderDetail from '../screens/kivosWarehouse/KivosSupplierOrderDetail';
import KivosSupplierOrderReview from '../screens/kivosWarehouse/KivosSupplierOrderReview';
import KivosPackingList from '../screens/kivosWarehouse/KivosPackingList';
import KivosLowStockEditor from '../screens/kivosWarehouse/KivosLowStockEditor';

const Stack = createNativeStackNavigator();

export default function KivosWarehouseNavigator() {
  return (
    <Stack.Navigator initialRouteName="KivosWarehouseHome">
      <Stack.Screen name="KivosWarehouseHome" component={KivosWarehouseHome} />
      <Stack.Screen name="KivosStockList" component={KivosStockList} />
      <Stack.Screen name="KivosStockAdjust" component={KivosStockAdjust} />
      <Stack.Screen name="KivosOrdersList" component={KivosOrdersList} />
      <Stack.Screen name="KivosOrderDetail" component={KivosOrderDetail} />
      <Stack.Screen name="KivosPackingList" component={KivosPackingList} />
      <Stack.Screen name="KivosLowStockEditor" component={KivosLowStockEditor} />
      <Stack.Screen
        name="KivosSupplierOrderCreate"
        component={KivosSupplierOrderCreate}
      />
      <Stack.Screen
        name="KivosSupplierOrdersList"
        component={KivosSupplierOrdersList}
      />
      <Stack.Screen
        name="KivosSupplierOrderDetail"
        component={KivosSupplierOrderDetail}
      />
      <Stack.Screen
        name="KivosSupplierOrderReview"
        component={KivosSupplierOrderReview}
      />
    </Stack.Navigator>
  );
}
