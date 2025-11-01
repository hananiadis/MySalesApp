// src/screens/BrandHomeScreen.js
import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import SafeScreen from '../components/SafeScreen';
import colors from '../theme/colors';
import { normalizeBrandKey, BRAND_LABEL } from '../constants/brands';

const BRAND_ART = {
  playmobil: require('../../assets/playmobil_logo.png'),
  kivos: require('../../assets/kivos_logo.png'),
  john: require('../../assets/john_hellas_logo.png'),
};

const STRINGS = {
  quickActions: "Γρήγορες Ενέργειες",
  newOrder: "Νέα Παραγγελία",
  orders: "Διαχείριση Παραγγελιών",
  supermarket: "Παραγγελία SuperMarket",
  back: "Επιστροφή στην Αρχική",
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
});

export default BrandHomeScreen;


