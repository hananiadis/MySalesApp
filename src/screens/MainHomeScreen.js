// /src/screens/MainHomeScreen.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  View,
  Text,
  StyleSheet,
  ToastAndroid,
  useWindowDimensions,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import SafeScreen from '../components/SafeScreen';
import SalesmanInfoCard from '../components/SalesmanInfoCard';
import { useAuth } from '../context/AuthProvider';
import { useOnlineStatus } from '../utils/OnlineStatusContext';
import colors from '../theme/colors';

const BRAND_ROUTE = {
  playmobil: 'PlaymobilModule',
  kivos: 'KivosModule',
  john: 'JohnModule',
};

const STRINGS = {
  salesmanPrefix: 'Salesperson: ',
  regionPrefix: 'Region',
  defaultRegion: 'Not set',
  lastSyncPrefix: 'Last sync: ',
  exitHint: 'Press back again to exit',
  testButton: 'Debug - Test Playmobil KPIs',
};

const DEFAULT_SALESMAN = {
  firstName: 'Demo',
  lastName: 'Salesperson',
};

const BRAND_NAMES = {
  playmobil: 'Playmobil',
  kivos: 'Kivos',
  john: 'John Hellas',
};

// -------------------------------------------------------
// Helper to get the newest sync timestamp from AsyncStorage
// -------------------------------------------------------
async function getLatestSyncTimestamp() {
  const keys = await AsyncStorage.getAllKeys();
  const syncKeys = keys.filter((k) => k.startsWith('sync:last:'));
  if (!syncKeys.length) return null;

  const values = await AsyncStorage.multiGet(syncKeys);
  let max = 0;
  for (const [, v] of values) {
    if (!v) continue;
    const t = new Date(v).getTime();
    if (t > max) max = t;
  }
  return max ? new Date(max).toISOString() : null;
}

export default function MainHomeScreen({ navigation }) {
  const auth = useAuth() || {};
  const profile = auth.profile || null;
  const role = profile?.role || null;
  const brands = Array.isArray(profile?.brands) ? profile.brands : [];
  const { isConnected } = useOnlineStatus();
  const { width } = useWindowDimensions();
  const lastBackPressRef = useRef(0);
  const [lastSyncISO, setLastSyncISO] = useState(null);

  const isAdmin = ['owner', 'admin', 'developer'].includes(role);
  const isTablet = width >= 700;

  const availableBrands = useMemo(() => {
    const normalized = brands.map((b) =>
      typeof b === 'string' ? b.toLowerCase() : String(b || '').toLowerCase()
    );
    const membership = new Set(normalized);
    const list = [];
    if (membership.has('playmobil')) list.push('playmobil');
    if (membership.has('kivos')) list.push('kivos');
    if (membership.has('john')) list.push('john');
    return list;
  }, [brands]);

  const userBrandRoutes = useMemo(
    () => availableBrands.map((brandKey) => BRAND_ROUTE[brandKey]).filter(Boolean),
    [availableBrands]
  );
  const singleBrandRoute = userBrandRoutes.length === 1 ? userBrandRoutes[0] : null;

  useEffect(() => {
    if (isAdmin || !singleBrandRoute) {
      return;
    }
    const state = navigation.getState?.();
    const activeRoute = state?.routes?.[state.index]?.name;
    if (activeRoute !== singleBrandRoute) {
      navigation.navigate(singleBrandRoute);
    }
  }, [isAdmin, singleBrandRoute, navigation]);

  // Fetch last sync time
  useEffect(() => {
    (async () => {
      const local = await getLatestSyncTimestamp();
      const profileSync = profile?.lastSyncedAt;
      const mostRecent = new Date(
        Math.max(new Date(local || 0), new Date(profileSync || 0))
      ).toISOString();
      setLastSyncISO(mostRecent);
    })();
  }, [profile?.lastSyncedAt]);

  const salesmanName =
    profile?.name?.trim() ||
    `${profile?.firstName ?? DEFAULT_SALESMAN.firstName} ${
      profile?.lastName ?? DEFAULT_SALESMAN.lastName
    }`.trim();
  // Show email under the name instead of region (no regions assigned for now)
  const emailLabel = profile?.email ? String(profile.email) : '';

  const formattedSync = useMemo(() => {
    if (!lastSyncISO) return '-';
    const d = new Date(lastSyncISO);
    const dd = d.getDate().toString().padStart(2, '0');
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const hh = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    return `${dd}/${mm} ${hh}:${mins}`;
  }, [lastSyncISO]);

  // Single status dot is shown inside SalesmanInfoCard status row; do not append extra dots in the meta line

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        const now = Date.now();
        if (now - lastBackPressRef.current < 1500) {
          BackHandler.exitApp();
        } else {
          lastBackPressRef.current = now;
          ToastAndroid.show(STRINGS.exitHint, ToastAndroid.SHORT);
        }
        return true;
      };

      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [])
  );

  return (
    <SafeScreen
      title="MySales"
      style={styles.screen}
      scroll
      bodyStyle={styles.scrollBody}
      contentContainerStyle={styles.contentContainer}
    >
      {/* USER INFO BOX */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => navigation.navigate('Profile')}
      >
        <SalesmanInfoCard
          name={`${STRINGS.salesmanPrefix}${salesmanName}`}
          region={emailLabel ? (
            <Text style={{ color: colors.textPrimary }}>{emailLabel}</Text>
          ) : null}
          lastSyncLabel={`${STRINGS.lastSyncPrefix}${formattedSync}`}
          isOnline={isConnected}
          brands={availableBrands.map((b) => ({
            key: b,
            label: BRAND_NAMES[b] || b,
            onPress: () =>
              navigation.navigate(BRAND_ROUTE[b], {
                screen: 'BrandHome',
                params: { brand: b },
              }),
          }))}
        />
      </TouchableOpacity>

      {/* Debug actions */}
      <TouchableOpacity
        style={styles.testButton}
        onPress={() => navigation.navigate('TestKPI')}
      >
        <Text style={styles.testButtonText}>{STRINGS.testButton}</Text>
      </TouchableOpacity>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scrollBody: { flex: 1 },
  contentContainer: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 },
  section: { backgroundColor: 'transparent', marginBottom: 28 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 18,
    marginTop: 12,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  kpiItem: { flexGrow: 1 },
  kpiItemPhone: { width: '47%', marginBottom: 16 },
  kpiItemTablet: { width: '30%', marginBottom: 18 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 6,
    alignSelf: 'center',
  },

  // 🧪 TEMP TEST BUTTON STYLE
  testButton: {
    marginTop: 40,
    backgroundColor: '#1976d2',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});





