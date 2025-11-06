// src/screens/BrandHomeScreen.js
import React, { useMemo, useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import SafeScreen from '../components/SafeScreen';
import colors from '../theme/colors';
import { normalizeBrandKey, BRAND_LABEL } from '../constants/brands';
import PlaymobilKpiCards from '../components/PlaymobilKpiCards';
import usePlaymobilKpi from '../hooks/usePlaymobilKpi';
import { refreshAllSheetsAndCache } from '../services/playmobilKpi';

const BRAND_ART = {
  playmobil: require('../../assets/playmobil_logo.png'),
  kivos: require('../../assets/kivos_logo.png'),
  john: require('../../assets/john_hellas_logo.png'),
};

const STRINGS = {
  quickActions: '\u0393\u03c1\u03ae\u03b3\u03bf\u03c1\u03b5\u03c2 \u03b5\u03bd\u03ad\u03c1\u03b3\u03b5\u03b9\u03b5\u03c2',
  newOrder: '\u039d\u03ad\u03b1 \u03c0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03af\u03b1',
  orders: '\u0394\u03b9\u03b1\u03c7\u03b5\u03af\u03c1\u03b9\u03c3\u03b7 \u03c0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03b9\u03ce\u03bd',
  supermarket: '\u03a0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03af\u03b1 SuperMarket',
  back: '\u0395\u03c0\u03b9\u03c3\u03c4\u03c1\u03bf\u03c6\u03ae \u03c3\u03c4\u03b7\u03bd \u03ba\u03b5\u03bd\u03c4\u03c1\u03b9\u03ba\u03ae',
};

const ICONS = {
  newOrder: 'add-circle-outline',
  orders: 'file-tray-full-outline',
  supermarket: 'cart-outline',
  back: 'arrow-back-circle-outline',
};

const buildActions = ({
  brand,
  navigation,
  supportsSuperMarket,
  hasOrdersTab,
  navigateToStack,
}) => {
  const actions = [
    {
      key: 'new-order',
      label: STRINGS.newOrder,
      icon: ICONS.newOrder,
      onPress: () => navigation.navigate('NewOrder', { brand }),
    },
    {
      key: 'orders',
      label: STRINGS.orders,
      icon: ICONS.orders,
      onPress: () => {
        const routeNames = navigation?.getState?.()?.routeNames || [];
        if (hasOrdersTab && routeNames.includes('OrdersMgmt')) {
          navigation.navigate('OrdersMgmt', { brand });
        } else {
          navigateToStack('OrdersManagement', { brand });
        }
      },
    },
  ];

  if (supportsSuperMarket) {
    actions.splice(1, 0, {
      key: 'supermarket',
      label: STRINGS.supermarket,
      icon: ICONS.supermarket,
      onPress: () => navigateToStack('SuperMarketOrderFlow', { brand }),
    });
  }

  actions.push({
    key: 'back',
    label: STRINGS.back,
    icon: ICONS.back,
    onPress: () => navigateToStack('MainHome'),
  });

  return actions;
};

const BrandHomeScreen = ({ navigation, route }) => {
  const brandParam = route?.params?.brand;
  const brand = useMemo(() => normalizeBrandKey(brandParam), [brandParam]);
  const title = BRAND_LABEL[brand] || BRAND_LABEL.playmobil;
  const art = BRAND_ART[brand] || BRAND_ART.playmobil;
  const supportsSuperMarket = Boolean(route?.params?.supportsSuperMarket);
  const routeNames = navigation?.getState?.()?.routeNames || [];
  const hasOrdersTab = routeNames.includes('OrdersMgmt');

  // KPI state for Playmobil brand only
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [referenceDate] = useState(() => new Date());

  const isPlaymobil = brand === 'playmobil';

  // Use the KPI hook only for Playmobil
  const {
    status,
    error,
    metricSnapshot,
    referenceMoment,
    isLoading: kpisLoading,
  } = usePlaymobilKpi({
    referenceDate,
    enabled: isPlaymobil,
    reloadToken,
  });

  const systemDateLabel = useMemo(() => {
    return new Date().toLocaleDateString('el-GR');
  }, []);

  const handleRefreshSheets = useCallback(async () => {
    if (isRefreshing) return;
    try {
      setIsRefreshing(true);
      const result = await refreshAllSheetsAndCache();
      console.log('[BrandHomeScreen] Sheets refreshed:', {
        invoiced2025: result?.invoiced2025?.length,
        invoiced2024: result?.invoiced2024?.length,
        orders2025: result?.orders2025?.length,
        orders2024: result?.orders2024?.length,
        headerDates: result?._headerDates,
      });
      // Write last sync timestamp
      try {
        const nowISO = new Date().toISOString();
        await AsyncStorage.setItem('sync:last:playmobilSheets', nowISO);
        console.log('[BrandHomeScreen] Wrote last sync timestamp:', nowISO);
      } catch (err) {
        console.warn('[BrandHomeScreen] Failed to write last sync timestamp:', err);
      }
      // Trigger re-fetch in the hook
      setReloadToken((t) => t + 1);
      Alert.alert('Sheets refreshed', 'Τα δεδομένα ανανεώθηκαν από τα Google Sheets.');
    } catch (e) {
      console.error('[BrandHomeScreen] handleRefreshSheets ERROR:', e);
      Alert.alert('Refresh failed', e?.message || 'Unknown error');
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  const navigateToStack = useCallback(
    (routeName, params) => {
      let navigatorRef = navigation;
      let parentRef = navigation?.getParent?.();

      while (parentRef && typeof parentRef.navigate === 'function') {
        navigatorRef = parentRef;
        parentRef = parentRef.getParent?.();
      }

      if (typeof navigatorRef.navigate === 'function') {
        navigatorRef.navigate(routeName, params);
      } else {
        navigation.navigate(routeName, params);
      }
    },
    [navigation]
  );

  const goToMainHome = useCallback(() => {
    navigateToStack('MainHome');
  }, [navigateToStack]);

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = navigation.addListener('beforeRemove', (event) => {
        if (event.data.action?.type === 'GO_BACK') {
          event.preventDefault();
          goToMainHome();
        }
      });
      return () => unsubscribe();
    }, [goToMainHome, navigation])
  );

  const actions = useMemo(
    () =>
      buildActions({
        brand,
        navigation,
        supportsSuperMarket,
        hasOrdersTab,
        navigateToStack,
      }),
    [brand, navigation, supportsSuperMarket, hasOrdersTab, navigateToStack]
  );

  return (
    <SafeScreen
      title={title}
      style={styles.screen}
      bodyStyle={styles.body}
      contentContainerStyle={styles.scrollContent}
      scroll
    >
      <View style={styles.headerCard}>
        <Image source={art} style={styles.brandArt} resizeMode="contain" />
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
      </View>

      {isPlaymobil && (
        <>
          <View style={styles.kpiHeader}>
            <Text style={styles.kpiTitle}>KPI Dashboard</Text>
            <View style={styles.kpiActions}>
              <Text style={styles.systemTag}>System: {systemDateLabel}</Text>
              <TouchableOpacity
                style={[styles.refreshButton, isRefreshing && styles.refreshButtonDisabled]}
                onPress={handleRefreshSheets}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <ActivityIndicator size="small" color="#1e88e5" />
                ) : (
                  <Ionicons name="refresh-outline" size={20} color="#1e88e5" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {kpisLoading ? (
            <View style={styles.kpiLoader}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.kpiLoaderText}>Φόρτωση KPI...</Text>
            </View>
          ) : error ? (
            <View style={styles.kpiError}>
              <Text style={styles.kpiErrorText}>{error}</Text>
            </View>
          ) : (
            <PlaymobilKpiCards
              status={status}
              metricSnapshot={metricSnapshot}
              referenceMoment={referenceMoment}
              error={error}
            />
          )}
        </>
      )}

      <Text style={styles.actionsTitle}>{STRINGS.quickActions}</Text>
      <View style={styles.actionGrid}>
        {actions.map((action) => (
          <TouchableOpacity
            key={`${brand}-${action.key}`}
            style={styles.actionCard}
            onPress={action.onPress}
            activeOpacity={0.85}
          >
            <View style={styles.actionIconWrap}>
              <Ionicons name={action.icon} size={28} color={colors.primary} />
            </View>
            <Text style={styles.actionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,
    marginTop: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  brandArt: {
    width: 96,
    height: 72,
    marginRight: 18,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '48%',
    backgroundColor: colors.white,
    borderRadius: 18,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    paddingHorizontal: 12,
  },
  actionIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#e2efff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionLabel: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 8,
  },
  kpiTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  kpiActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  systemTag: {
    fontSize: 12,
    color: '#6b7280',
    marginRight: 6,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cfe1fb',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7fbff',
  },
  refreshButtonDisabled: {
    opacity: 0.6,
  },
  kpiLoader: {
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 26,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  kpiLoaderText: {
    marginTop: 10,
    fontSize: 14,
    color: colors.textSecondary || '#495057',
  },
  kpiError: {
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  kpiErrorText: {
    color: '#856404',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default BrandHomeScreen;


