// src/navigation/BrandTabsNavigator.js
import React, { useCallback, useMemo } from 'react';
import { BackHandler, useWindowDimensions } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import CurvedBottomBar from '../components/CurvedBottomBar';
import BrandHomeScreen from '../screens/BrandHomeScreen';
import ProductsScreen from '../screens/ProductsScreen';
import CustomersScreen from '../screens/CustomersScreen';
import CataloguesScreen from '../screens/CataloguesScreen';
import OrdersMgmtScreen from '../screens/OrdersMgmtScreen';
import OrderScreen from '../screens/OrderScreen';
import { normalizeBrandKey, SUPERMARKET_BRANDS } from '../constants/brands';

const Tab = createBottomTabNavigator();

const BRAND_LABELS = {
  brandHome: "Αρχική",
  products: "Προϊόντα",
  customers: "Πελάτες",
  catalogues: "Κατάλογοι",
  ordersMgmt: "Διαχείριση Παραγγελιών",
};

const ICONS = {
  brandHome: (props) => <Ionicons name="home-outline" {...props} />,
  brandHomeActive: (props) => <Ionicons name="home" {...props} />,
  products: (props) => <Ionicons name="cube-outline" {...props} />,
  productsActive: (props) => <Ionicons name="cube" {...props} />,
  customers: (props) => <Ionicons name="people-outline" {...props} />,
  customersActive: (props) => <Ionicons name="people" {...props} />,
  catalogues: (props) => <Ionicons name="book-outline" {...props} />,
  cataloguesActive: (props) => <Ionicons name="book" {...props} />,
  ordersMgmt: (props) => <Ionicons name="stats-chart-outline" {...props} />,
  ordersMgmtActive: (props) => <Ionicons name="stats-chart" {...props} />,
};

function getIcon(name, focused, color, size) {
  const key = `${name}${focused ? 'Active' : ''}`;
  const iconRenderer = ICONS[key] || ICONS[name];
  if (typeof iconRenderer === 'function') {
    return iconRenderer({ color, size });
  }
  return <Ionicons name="ellipse-outline" color={color} size={size} />;
}

const defaultLayoutStrategy = (routes, { isTablet }) => {
  const targetLeft = Math.min(isTablet ? 3 : 2, routes.length);
  return {
    leftRoutes: routes.slice(0, targetLeft),
    rightRoutes: routes.slice(targetLeft),
  };
};

export default function BrandTabsNavigator({ navigation, route }) {
  const mainNavigation = useNavigation();
  const { width } = useWindowDimensions();
  const isTablet = width >= 700;

  const brandParam =
    route?.params?.brand ??
    route?.params?.brandKey ??
    route?.params?.initialBrand ??
    route?.params?.brandId;

  const brand = useMemo(() => normalizeBrandKey(brandParam), [brandParam]);
  const supportsSuperMarket = useMemo(
    () => SUPERMARKET_BRANDS.includes(brand),
    [brand]
  );

  const handleFabPress = useCallback(() => {
    navigation.navigate('NewOrder', { brand });
  }, [navigation, brand]);

  const layoutStrategy = useCallback(
    (routes, context) => defaultLayoutStrategy(routes, context),
    []
  );

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        const canNavigateTo = (navigatorRef, routeName) => {
          const state = navigatorRef?.getState?.();
          return state?.routeNames?.includes?.(routeName) ?? false;
        };

        const parentNavigator = navigation.getParent?.();
        if (parentNavigator?.navigate) {
          if (canNavigateTo(parentNavigator, 'MainHome')) {
            parentNavigator.navigate('MainHome');
            return true;
          }
        }
        if (mainNavigation?.navigate) {
          if (canNavigateTo(mainNavigation, 'MainHome')) {
            mainNavigation.navigate('MainHome');
            return true;
          }
          if (canNavigateTo(mainNavigation, 'Home')) {
            mainNavigation.navigate('Home');
            return true;
          }
        }
        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [navigation, mainNavigation])
  );

  return (
    <Tab.Navigator
      initialRouteName="BrandHome"
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
      tabBar={(props) => (
        <CurvedBottomBar
          {...props}
          fab={{
            icon: 'add',
            onPress: handleFabPress,
            accessibilityLabel: 'Create new order',
            testID: `brand-${brand}-fab`,
          }}
          layoutStrategy={layoutStrategy}
          testIDPrefix={`brand-${brand}`}
        />
      )}
    >
      <Tab.Screen
        name="BrandHome"
        component={BrandHomeScreen}
        initialParams={{ brand, supportsSuperMarket }}
        options={{
          tabBarLabel: BRAND_LABELS.brandHome,
          tabBarVisible: true,
          tabBarIcon: ({ color, size, focused }) =>
            getIcon('brandHome', focused, color, size),
          unmountOnBlur: false,
        }}
      />
      <Tab.Screen
        name="Products"
        component={ProductsScreen}
        initialParams={{ brand }}
        options={{
          tabBarLabel: BRAND_LABELS.products,
          tabBarVisible: true,
          tabBarIcon: ({ color, size, focused }) =>
            getIcon('products', focused, color, size),
          unmountOnBlur: false,
        }}
      />
      <Tab.Screen
        name="Customers"
        component={CustomersScreen}
        initialParams={{ brand }}
        options={{
          tabBarLabel: BRAND_LABELS.customers,
          tabBarVisible: true,
          tabBarIcon: ({ color, size, focused }) =>
            getIcon('customers', focused, color, size),
          unmountOnBlur: false,
        }}
      />
      <Tab.Screen
        name="Catalogues"
        component={CataloguesScreen}
        initialParams={{ brand }}
        options={{
          tabBarLabel: BRAND_LABELS.catalogues,
          tabBarVisible: true,
          tabBarIcon: ({ color, size, focused }) =>
            getIcon('catalogues', focused, color, size),
          unmountOnBlur: false,
        }}
      />
      {isTablet ? (
        <Tab.Screen
          name="OrdersMgmt"
          component={OrdersMgmtScreen}
          initialParams={{ brand }}
          options={{
            tabBarLabel: BRAND_LABELS.ordersMgmt,
            tabBarVisible: true,
            tabBarIcon: ({ color, size, focused }) =>
              getIcon('ordersMgmt', focused, color, size),
            unmountOnBlur: false,
          }}
        />
      ) : null}
      <Tab.Screen
        name="NewOrder"
        component={OrderScreen}
        initialParams={{ brand }}
        options={{
          tabBarLabel: 'New Order',
          tabBarVisible: false,
          tabBarButton: () => null,
          unmountOnBlur: false,
        }}
      />
    </Tab.Navigator>
  );
}

