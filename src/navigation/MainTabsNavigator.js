// src/navigation/MainTabsNavigator.js
import React, { useCallback, useMemo } from 'react';
import { Image } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import CurvedBottomBar from '../components/CurvedBottomBar';
import MainHomeScreen from '../screens/MainHomeScreen';
import PlaymobilHomeScreen from '../screens/PlaymobilHomeScreen';
import KivosHomeScreen from '../screens/KivosHomeScreen';
import JohnHomeScreen from '../screens/JohnHomeScreen';
import { useAuth } from '../context/AuthProvider';

const Tab = createBottomTabNavigator();

const BRAND_TABS = [
  {
    key: 'playmobil',
    name: 'PlaymobilModule',
    label: 'Playmobil',
    component: PlaymobilHomeScreen,
    icon: require('../../assets/playmobil_logo.png'),
  },
  {
    key: 'kivos',
    name: 'KivosModule',
    label: 'Kivos',
    component: KivosHomeScreen,
    icon: require('../../assets/kivos_logo.png'),
  },
  {
    key: 'john',
    name: 'JohnModule',
    label: 'John',
    component: JohnHomeScreen,
    icon: require('../../assets/john_hellas_logo.png'),
  },
];

const renderBrandIcon = (source, focused) => (
  <Image
    source={source}
    style={{
      width: 28,
      height: 28,
      opacity: focused ? 1 : 0.6,
    }}
    resizeMode="contain"
  />
);

export default function MainTabsNavigator() {
  const { hasBrand } = useAuth();

  const accessibleBrandTabs = useMemo(
    () =>
      BRAND_TABS.filter((entry) => {
        if (typeof hasBrand !== 'function') {
          return true;
        }
        return hasBrand(entry.key);
      }),
    [hasBrand]
  );

  const layoutStrategy = useCallback((routes) => {
    if (!routes.length) {
      return { leftRoutes: [], rightRoutes: [] };
    }
    if (routes.length === 1) {
      return { leftRoutes: routes, rightRoutes: [] };
    }
    const leftCount = Math.ceil(routes.length / 2);
    return {
      leftRoutes: routes.slice(0, leftCount),
      rightRoutes: routes.slice(leftCount),
    };
  }, []);

  return (
    <Tab.Navigator
      initialRouteName="MainHome"
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
      tabBar={(props) => {
        const activeRoute = props.state.routes[props.state.index]?.name;
        if (activeRoute && activeRoute !== 'MainHome') {
          return null;
        }
        return (
          <CurvedBottomBar
            {...props}
            layoutStrategy={layoutStrategy}
            testIDPrefix="main"
          />
        );
      }}
    >
      <Tab.Screen
        name="MainHome"
        component={MainHomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarVisible: true,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={size}
              color={color}
            />
          ),
          unmountOnBlur: false,
        }}
      />

      {accessibleBrandTabs.map((tab) => (
        <Tab.Screen
          key={tab.key}
          name={tab.name}
          component={tab.component}
          options={{
            tabBarLabel: tab.label,
            tabBarVisible: true,
            tabBarIcon: ({ focused }) => renderBrandIcon(tab.icon, focused),
            tabBarAccessibilityLabel: `${tab.label} brand`,
            unmountOnBlur: false,
          }}
          initialParams={{ brand: tab.key }}
        />
      ))}
    </Tab.Navigator>
  );
}
