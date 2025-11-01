// src/screens/KivosHomeScreen.js
import React, { useMemo } from 'react';

import BrandTabsNavigator from '../navigation/BrandTabsNavigator';

const KivosHomeScreen = ({ navigation, route }) => {
  const mergedRoute = useMemo(
    () => ({
      ...route,
      params: { ...(route?.params || {}), brand: 'kivos' },
    }),
    [route]
  );

  return <BrandTabsNavigator navigation={navigation} route={mergedRoute} />;
};

export default KivosHomeScreen;
