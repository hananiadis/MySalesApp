import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import SafeScreen from '../components/SafeScreen';
import colors from '../theme/colors';

const KivosWarehouseHome = ({ navigation }) => {
  const actions = useMemo(
    () => [
      {
        key: 'stock-list',
        label: 'Απόθεμα',
        icon: 'cube-outline',
        onPress: () => navigation.navigate('KivosStockList'),
      },
      {
        key: 'stock-adjust',
        label: 'Απογραφή / Ρυθμίσεις',
        icon: 'create-outline',
        onPress: () => navigation.navigate('KivosStockAdjust'),
      },
      {
        key: 'orders',
        label: 'Παραγγελίες',
        icon: 'list-circle-outline',
        onPress: () => navigation.navigate('KivosOrdersList'),
      },
      {
        key: 'supplier-order',
        label: 'Νέα παραγγελία προμηθευτή',
        icon: 'cart-outline',
        onPress: () => navigation.navigate('KivosSupplierOrderCreate'),
      },
    ],
    [navigation]
  );

  return (
    <SafeScreen
      title="Αποθήκη Kivos"
      style={styles.screen}
      bodyStyle={styles.body}
      contentContainerStyle={styles.content}
      scroll={false}
    >
      <View style={styles.actionsTitleWrap}>
        <Text style={styles.actionsTitle}>Ενέργειες αποθήκης</Text>
      </View>
      <View style={styles.actionGrid}>
        {actions.map((action) => (
          <TouchableOpacity
            key={action.key}
            style={styles.actionCard}
            onPress={action.onPress}
            activeOpacity={0.85}
          >
            <View style={styles.actionIconWrap}>
              <Ionicons name={action.icon} size={30} color={colors.primary} />
            </View>
            <Text style={styles.actionLabel} numberOfLines={2}>
              {action.label}
            </Text>
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
  content: {
    padding: 20,
    flexGrow: 1,
  },
  actionsTitleWrap: {
    marginBottom: 14,
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionCard: {
    width: '48%',
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#e6f0ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionLabel: {
    flex: 1,
    textAlign: 'left',
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});

export default KivosWarehouseHome;
