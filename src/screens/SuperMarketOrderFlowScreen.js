// src/screens/SuperMarketOrderFlowScreen.js
import React, { useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { normalizeBrandKey } from '../constants/brands';
import SuperMarketStoreSelectScreen from './SuperMarketStoreSelectScreen';
import SuperMarketProductSelectionScreen from './SuperMarketProductSelectionScreen';
import SuperMarketOrderReviewScreen from './SuperMarketOrderReviewScreen';
import SuperMarketOrderSummaryScreen from './SuperMarketOrderSummaryScreen';
import SuperMarketStoreDetailsScreen from './SuperMarketStoreDetailsScreen';

const FlowStack = createNativeStackNavigator();

const SuperMarketOrderFlowScreen = ({ route }) => {
  const brandParam = route?.params?.brand;
  const brand = useMemo(() => normalizeBrandKey(brandParam), [brandParam]);

  const sharedParams = useMemo(() => ({ brand }), [brand]);

  return (
    <FlowStack.Navigator
      initialRouteName="SuperMarketStoreSelect"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <FlowStack.Screen
        name="SuperMarketStoreSelect"
        component={SuperMarketStoreSelectScreen}
        initialParams={sharedParams}
      />
      <FlowStack.Screen
        name="SuperMarketProductSelection"
        component={SuperMarketProductSelectionScreen}
        initialParams={sharedParams}
      />
      <FlowStack.Screen
        name="SuperMarketOrderReview"
        component={SuperMarketOrderReviewScreen}
        initialParams={sharedParams}
      />
      <FlowStack.Screen
        name="SuperMarketOrderSummary"
        component={SuperMarketOrderSummaryScreen}
        initialParams={sharedParams}
      />
      <FlowStack.Screen
        name="SuperMarketStoreDetails"
        component={SuperMarketStoreDetailsScreen}
        initialParams={sharedParams}
      />
    </FlowStack.Navigator>
  );
};

export default SuperMarketOrderFlowScreen;
