import React, { useMemo } from 'react';
import SalesAnalyticsScreen from './SalesAnalyticsScreen';

/**
 * KivosBrandStatisticsScreen
 * Wrapper that reuses the Playmobil-style SalesAnalytics layout for Kivos data,
 * passing brand='kivos' to enable Kivos sheets, filters, charts, etc.
 */
const KivosBrandStatisticsScreen = ({ navigation, route }) => {
  const mergedRoute = useMemo(
    () => ({
      ...(route || {}),
      params: { ...(route?.params || {}), brand: 'kivos' },
    }),
    [route]
  );

  return <SalesAnalyticsScreen navigation={navigation} route={mergedRoute} />;
};

export default KivosBrandStatisticsScreen;
