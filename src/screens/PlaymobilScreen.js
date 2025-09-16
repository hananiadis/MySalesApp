import React from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';

const PlaymobilScreen = ({ navigation }) => {
  const buttons = [
    {
      title: 'Νέα Παραγγελία',
      onPress: () => navigation.navigate('OrderCustomerSelectScreen'),
    },
    {
      title: 'Προϊόντα',
      onPress: () => navigation.navigate('Products'),
    },
    {
      title: 'Πελάτες',
      onPress: () => navigation.navigate('Customers'),
    },
    {
      title: 'Διαχείριση Δεδομένων',
      image: require('../../assets/firestore_data.png'),
      onPress: () => navigation.navigate('Data'),
    },
    {
      title: 'Διαχείριση Παραγγελιών',
      onPress: () => navigation.navigate('OrdersManagement'),
    },
    { title: '', onPress: () => {} },
    { title: '', onPress: () => {} },
    {
      title: 'Πίσω',
      onPress: () => navigation.goBack(),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Playmobil</Text>
        <View style={styles.buttonGrid}>
          {buttons.map((button, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.button,
                button.title === 'Διαχείριση Δεδομένων' && styles.specialButton,
                button.title === '' && styles.disabledButton,
              ]}
              onPress={button.onPress}
              disabled={button.title === ''}
            >
              {button.image && (
                <Image
                  source={button.image}
                  style={styles.buttonIcon}
                  resizeMode="contain"
                />
              )}
              <Text
                style={[
                  styles.buttonText,
                  button.title === 'Διαχείριση Δεδομένων' && styles.specialButtonText,
                ]}
              >
                {button.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 30,
    textAlign: 'center',
  },
  buttonGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
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
  disabledButton: {
    opacity: 0,
  },
});

export default PlaymobilScreen;
