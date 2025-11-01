// src/screens/PlaymobilScreen.js
// Legacy entry point mapped to the new brand tab navigator.
import React, { useMemo } from 'react';

import BrandTabsNavigator from '../navigation/BrandTabsNavigator';

const PlaymobilScreen = ({ navigation, route }) => {
  const mergedRoute = useMemo(
    () => ({
      ...route,
      params: { ...(route?.params || {}), brand: 'playmobil' },
    }),
    [route]
  );

  return <BrandTabsNavigator navigation={navigation} route={mergedRoute} />;
};

export default PlaymobilScreen;
