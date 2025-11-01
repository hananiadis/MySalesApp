// /src/screens/MainHomeScreen.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, View, Text, StyleSheet, ToastAndroid, useWindowDimensions, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import SafeScreen from '../components/SafeScreen';
import SalesmanInfoCard from '../components/SalesmanInfoCard';
import KPIBox from '../components/KPIBox';
import { useAuth, ROLES } from '../context/AuthProvider';
import { useOnlineStatus } from '../utils/OnlineStatusContext';
import colors from '../theme/colors';

const BRAND_ROUTE = {
  playmobil: 'PlaymobilModule',
  kivos: 'KivosModule',
  john: 'JohnModule',
};

const STRINGS = {
  monthlyOrders: 'Μηνιαίες Παραγγελίες',
  totalValue: 'Συνολική Αξία (EUR)',
  pendingOrders: 'Εκκρεμείς Παραγγελίες',
  targetRate: 'Επίτευξη Στόχου %',
  performance: 'KPIs',
  salesmanPrefix: 'Πωλητής: ',
  regionPrefix: 'Περιοχή: ',
  defaultRegion: 'Β. Ελλάδα',
  lastSyncPrefix: 'Τελευταίος Συγχρονισμός: ',
};

const DEFAULT_SALESMAN = {
  firstName: 'Demo',
  lastName: 'Salesperson',
};

const KPI_METRICS = [
  { key: 'monthlyOrders', label: STRINGS.monthlyOrders, value: '37' },
  { key: 'totalValue', label: STRINGS.totalValue, value: '18 420' },
  { key: 'pendingOrders', label: STRINGS.pendingOrders, value: '5' },
  { key: 'targetRate', label: STRINGS.targetRate, value: '72 %' },
];

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
  const { profile, hasRole, hasBrand } = useAuth();
  const { isConnected } = useOnlineStatus();
  const { width } = useWindowDimensions();
  const lastBackPressRef = useRef(0);
  const [lastSyncISO, setLastSyncISO] = useState(null);

  const isAdmin = hasRole([ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER]);
  const isTablet = width >= 700;

  const availableBrands = useMemo(() => {
    const list = [];
    if (hasBrand('playmobil')) list.push('playmobil');
    if (hasBrand('kivos')) list.push('kivos');
    if (hasBrand('john')) list.push('john');
    return list;
  }, [hasBrand]);

  const userBrandRoutes = useMemo(
    () => availableBrands.map((brandKey) => BRAND_ROUTE[brandKey]).filter(Boolean),
    [availableBrands]
  );

  useEffect(() => {
    if (!isAdmin && userBrandRoutes.length === 1) {
      const onlyRoute = userBrandRoutes[0];
      navigation.reset({ index: 0, routes: [{ name: onlyRoute }] });
    }
  }, [isAdmin, userBrandRoutes, navigation]);

  // Fetch last sync time (either from profile or local data)
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
  const regionLabel = `${STRINGS.regionPrefix}${profile?.region ?? STRINGS.defaultRegion}`;

  const formattedSync = useMemo(() => {
    if (!lastSyncISO) return '-';
    const d = new Date(lastSyncISO);
    const dd = d.getDate().toString().padStart(2, '0');
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const hh = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    return `${dd}/${mm} ${hh}:${mins}`;
  }, [lastSyncISO]);

  const connectionDot = (
    <View
      style={[
        styles.dot,
        { backgroundColor: isConnected ? '#4CAF50' : '#D32F2F' },
      ]}
    />
  );

  useFocusEffect(
  useCallback(() => {
    const onBackPress = () => {
      const now = Date.now();
      if (now - lastBackPressRef.current < 1500) {
        BackHandler.exitApp(); // double press → exit
      } else {
        lastBackPressRef.current = now;
        ToastAndroid.show('Πατήστε ξανά για έξοδο', ToastAndroid.SHORT); // ✅ toast on first press
      }
      return true; // intercept back, prevents default navigation
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [])
);

  const kpiColumns = isTablet ? 3 : 2;

  return (
    <SafeScreen
      title="MySales"
      style={styles.screen}
      scroll
      bodyStyle={styles.scrollBody}
      contentContainerStyle={styles.contentContainer}
    >
      {/* USER INFO BOX (clickable → profile) */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => navigation.navigate('Profile')}
      >
        <SalesmanInfoCard
          name={`${STRINGS.salesmanPrefix}${salesmanName}`}
          region={
            <Text style={{ color: colors.textPrimary }}>
              {regionLabel} {connectionDot}
            </Text>
          }
          lastSyncLabel={`${STRINGS.lastSyncPrefix}${formattedSync}`}
          isOnline={isConnected}
          brands={availableBrands.map((b) => ({
            key: b,
            label: BRAND_NAMES[b] || b,
          }))}
        />
      </TouchableOpacity>

      {/* KPIs Section */}
      <View style={[styles.section, { marginTop: 16 }]}>
        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>{STRINGS.performance}</Text>
        <View style={styles.kpiGrid}>
          {KPI_METRICS.map((metric) => (
            <View
              key={metric.key}
              style={[
                styles.kpiItem,
                kpiColumns === 3 ? styles.kpiItemTablet : styles.kpiItemPhone,
              ]}
            >
              <KPIBox label={metric.label} value={metric.value} />
            </View>
          ))}
        </View>
      </View>
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
    marginTop: 12, // extra space above header
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
});
