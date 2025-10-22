import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import SafeScreen from '../components/SafeScreen';

const STRINGS = {
  newOrder: '\u039d\u03ad\u03b1 \u03c0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03af\u03b1',
  products: '\u03a0\u03c1\u03bf\u03ca\u03cc\u03bd\u03c4\u03b1',
  customers: '\u03a0\u03b5\u03bb\u03ac\u03c4\u03b5\u03c2',
  catalogs: '\u039a\u03b1\u03c4\u03ac\u03bb\u03bf\u03b3\u03bf\u03b9',
  data: '\u0394\u03b5\u03b4\u03bf\u03bc\u03ad\u03bd\u03b1 Firestore',
  supermarket: '\u03a0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03af\u03b5\u03c2 SuperMarket',
  orders: '\u03a0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03af\u03b5\u03c2',
  back: '\u03a0\u03af\u03c3\u03c9',
};

const BRAND_KEY = 'playmobil';

const PlaymobilScreen = ({ navigation }) => {
  const buttons = [
    {
      key: 'new',
      title: STRINGS.newOrder,
      onPress: () => navigation.navigate('OrderCustomerSelectScreen', { brand: BRAND_KEY }),
    },
    {
      key: 'products',
      title: STRINGS.products,
      onPress: () => navigation.navigate('Products', { brand: BRAND_KEY }),
    },
    {
      key: 'customers',
      title: STRINGS.customers,
      onPress: () => navigation.navigate('Customers', { brand: BRAND_KEY }),
    },
    {
      key: 'catalogs',
      title: STRINGS.catalogs,
      onPress: () => navigation.navigate('Catalog', { brand: BRAND_KEY }),
    },
    {
      key: 'data',
      title: STRINGS.data,
      image: require('../../assets/firestore_data.png'),
      onPress: () => navigation.navigate('Data', { brand: BRAND_KEY }),
    },
    {
      key: 'supermarket',
      title: STRINGS.supermarket,
      onPress: () => navigation.navigate('SuperMarketOrderFlow', { brand: BRAND_KEY }),
    },
    {
      key: 'orders',
      title: STRINGS.orders,
      onPress: () => navigation.navigate('OrdersManagement', { brand: BRAND_KEY }),
    },
    {
      key: 'back',
      title: STRINGS.back,
      onPress: () => navigation.navigate('Home'),
      isExit: true,
    },
  ];

  return (
    <SafeScreen title="Playmobil" style={styles.container} bodyStyle={styles.body}>
      <View style={styles.buttonGrid}>
        {buttons.map((button) => (
          <TouchableOpacity
            key={`${BRAND_KEY}-${button.key}`}
            style={[
              styles.button,
              button.title === STRINGS.data && styles.specialButton,
              button.isExit && styles.exitButton,
            ]}
            onPress={button.onPress}
          >
            {button.image && (
              <Image source={button.image} style={styles.buttonIcon} resizeMode="contain" />
            )}
            <Text
              style={[
                styles.buttonText,
                button.title === STRINGS.data && styles.specialButtonText,
                button.isExit && styles.exitButtonText,
              ]}
            >
              {button.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  body: {
    flex: 1,
    padding: 20,
  },
  buttonGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  button: {
    width: '48%',
    aspectRatio: 1,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    padding: 8,
  },
  buttonIcon: {
    width: 54,
    height: 54,
    marginBottom: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  specialButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    elevation: 3,
  },
  specialButtonText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 16,
  },
  exitButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ffcac7',
  },
  exitButtonText: {
    color: '#d32f2f',
    fontWeight: '700',
  },
});

export default PlaymobilScreen;
