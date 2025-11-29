// src/screens/KivosScreen.js
import React, { useMemo } from 'react';

import BrandTabsNavigator from '../navigation/BrandTabsNavigator';

const KivosScreen = ({ navigation, route }) => {
  const mergedRoute = useMemo(
    () => ({
      ...route,
      params: { ...(route?.params || {}), brand: 'kivos', useKivosHomeTab: true },
    }),
    [route]
  );

  return <BrandTabsNavigator navigation={navigation} route={mergedRoute} />;
};

export default KivosScreen;
