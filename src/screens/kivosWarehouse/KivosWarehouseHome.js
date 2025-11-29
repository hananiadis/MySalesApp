import React, { useLayoutEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import SafeScreen from '../../components/SafeScreen';
import colors from '../../theme/colors';

const KivosWarehouseHome = ({ navigation }) => {
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const headerLeft = (
    <TouchableOpacity
      onPress={() => navigation.goBack()}
      style={styles.backButton}
      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      activeOpacity={0.75}
    >
      <Ionicons name="chevron-back" size={22} color={colors.primary} />
      <Text style={styles.backLabel}>Back</Text>
    </TouchableOpacity>
  );

  const BrandButton = ({ label, onPress, iconName }) => (
    <TouchableOpacity style={styles.button} activeOpacity={0.9} onPress={onPress}>
      <View style={styles.buttonContent}>
        {iconName ? (
          <Ionicons name={iconName} size={20} color={colors.primary} />
        ) : null}
        <Text style={styles.buttonLabel}>{label}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeScreen
      title="Warehouse Manager"
      headerLeft={headerLeft}
      style={styles.screen}
      bodyStyle={styles.body}
      contentContainerStyle={styles.content}
      scroll={false}
    >
      <Text style={styles.heading}>Warehouse Manager</Text>

      <View style={styles.buttons}>
        <BrandButton
          label="Stock"
          onPress={() => navigation.navigate('KivosStockList')}
          iconName="cube-outline"
        />
        <BrandButton
          label="Adjust Stock"
          onPress={() => navigation.navigate('KivosStockAdjust')}
          iconName="construct-outline"
        />
        <BrandButton
          label="Orders"
          onPress={() => navigation.navigate('KivosOrdersList')}
          iconName="receipt-outline"
        />
        <BrandButton
          label="Create Supplier Order"
          onPress={() => navigation.navigate('KivosSupplierOrderCreate')}
          iconName="add-circle-outline"
        />
        <BrandButton
          label="Supplier Orders"
          onPress={() => navigation.navigate('KivosSupplierOrdersList')}
          iconName="business-outline"
        />
        <BrandButton
          label="Low Stock Editor"
          iconName="trending-down-outline"
          onPress={() => navigation.navigate('KivosLowStockEditor')}
        />
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
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 16,
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
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'left',
  },
  buttons: {
    gap: 14,
  },
  button: {
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
  },
  buttonIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
});

export default KivosWarehouseHome;
