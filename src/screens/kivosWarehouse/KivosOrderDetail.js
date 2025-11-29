import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';

import SafeScreen from '../../components/SafeScreen';
import colors from '../../theme/colors';

const KivosOrderDetail = ({ route, navigation }) => {
  const orderId = route?.params?.orderId || '';
  const displayId = route?.params?.displayId || orderId;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const parseDate = useCallback((value) => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }, []);

  const loadOrder = useCallback(async () => {
    if (!orderId) {
      setError('Λείπει το αναγνωριστικό παραγγελίας');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const doc = await firestore().collection('orders_kivos').doc(orderId).get();
      if (!doc.exists) {
        setError('Η παραγγελία δεν βρέθηκε');
        setOrder(null);
        return;
      }
      setOrder({ id: doc.id, ...doc.data() });
    } catch (e) {
      console.error('[KivosOrderDetail] Failed to load order', e);
      setError(e?.message || 'Αποτυχία φόρτωσης παραγγελίας');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const createdAt = useMemo(
    () =>
      parseDate(
        order?.createdAt || order?.firestoreCreatedAt || order?.startedAt
      ),
    [order, parseDate]
  );

  const linesCount = order?.lines?.length || 0;
  const customerName =
    order?.customerName ||
    order?.customer?.name ||
    order?.customer?.displayName ||
    '-';
  const paymentMethod = order?.paymentMethodLabel || order?.paymentMethod || '-';
  const status = order?.status || 'Pending';
  const netValue = Number(order?.netValue ?? 0);
  const vat = Number(order?.vat ?? 0);
  const discount = Number(order?.discount ?? 0);
  const finalValue = Number(order?.finalValue ?? netValue + vat - discount);
  const dateLabel = createdAt ? createdAt.toLocaleString() : '-';

  const headerLeft = (
    <TouchableOpacity
      onPress={() => navigation.goBack()}
      style={styles.backButton}
      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      activeOpacity={0.75}
    >
      <Ionicons name="chevron-back" size={22} color={colors.primary} />
      <Text style={styles.backLabel}>Πίσω</Text>
    </TouchableOpacity>
  );

  return (
    <SafeScreen
      title="Λεπτομέρειες Παραγγελίας"
      headerLeft={headerLeft}
      style={styles.screen}
      bodyStyle={styles.body}
      contentContainerStyle={styles.content}
      scroll={false}
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.statusText}>Φόρτωση παραγγελίας...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : order ? (
        <View style={styles.card}>
          <Text style={styles.title}>Παραγγελία {displayId || order?.id}</Text>
          <Text style={styles.subtitle}>Πελάτης: {customerName}</Text>
          <Text style={styles.subtitle}>Κατάσταση: {status}</Text>
          <Text style={styles.subtitle}>Ημερομηνία: {dateLabel}</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Καθαρό</Text>
            <Text style={styles.summaryValue}>{netValue.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>ΦΠΑ</Text>
            <Text style={styles.summaryValue}>{vat.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Έκπτωση</Text>
            <Text style={styles.summaryValue}>{discount.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Σύνολο</Text>
            <Text style={styles.totalValue}>{finalValue.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Γραμμές</Text>
            <Text style={styles.summaryValue}>{linesCount}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Πληρωμή</Text>
            <Text style={styles.summaryValue}>{paymentMethod}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.center}>
          <Text style={styles.statusText}>Δεν υπάρχουν στοιχεία παραγγελίας.</Text>
        </View>
      )}
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
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: 14,
    color: '#c62828',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  summaryRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
});

export default KivosOrderDetail;
