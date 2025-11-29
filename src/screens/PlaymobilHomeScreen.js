// src/screens/PlaymobilHomeScreen.js
import React, { useMemo } from 'react';

import BrandTabsNavigator from '../navigation/BrandTabsNavigator';

const PlaymobilHomeScreen = ({ navigation, route }) => {
  const mergedRoute = useMemo(
    () => ({
      ...route,
      params: { 
        ...(route?.params || {}), 
        brand: 'playmobil',
        // Pass selectedSalesmenIds if provided in route params
        // This allows navigation from other screens to set initial filter
        ...(route?.params?.selectedSalesmenIds && {
          selectedSalesmenIds: route.params.selectedSalesmenIds
        })
      },
    }),
    [route]
  );

  return <BrandTabsNavigator navigation={navigation} route={mergedRoute} />;
};

export default PlaymobilHomeScreen;
