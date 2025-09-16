import React from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  BackHandler,
  Image,
} from 'react-native';

const HomeScreen = ({ navigation }) => {
  const handleExit = () => {
    BackHandler.exitApp();
  };

  const buttons = [
    { // Playmobil
      key: 'playmobil',
      image: require('../../assets/playmobil_logo.png'),
      onPress: () => navigation.navigate('Playmobil'),
      isLogoOnly: true,
    },
    { // ΚΥΒΟΣ
      key: 'kivos',
      image: require('../../assets/kivos_logo.png'),
      onPress: () => {},
      isLogoOnly: true,
    },
    { // John Hellas
      key: 'john_hellas',
      image: require('../../assets/john_hellas_logo.png'),
      onPress: () => {},
      isLogoOnly: true,
    },
    { // Placeholder
      key: 'placeholder1',
      isPlaceholder: true,
    },
    { // Placeholder
      key: 'placeholder2',
      isPlaceholder: true,
    },
    { // Placeholder
      key: 'placeholder3',
      isPlaceholder: true,
    },
    { // Placeholder
      key: 'placeholder4',
      isPlaceholder: true,
    },
    { // Έξοδος (Exit)
      key: 'exit',
      title: 'Έξοδος',
      onPress: handleExit,
      isExit: true,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>MySalesApp</Text>
        <View style={styles.buttonGrid}>
          {buttons.map((button) => {
            if (button.isPlaceholder) {
              return (
                <View
                  key={button.key}
                  style={[styles.button, styles.blueButton]}
                />
              );
            }
            return (
              <TouchableOpacity
                key={button.key}
                style={[
                  styles.button,
                  button.isLogoOnly && styles.logoButton,
                  button.isExit && styles.exitButton,
                  // All non-logo, non-exit buttons will default to blue
                  !button.isLogoOnly && !button.isExit && styles.blueButton
                ]}
                onPress={button.onPress}
              >
                {button.image && (
                  <Image
                    source={button.image}
                    style={[styles.buttonImage, styles.logoImage]}
                    resizeMode="contain"
                  />
                )}
                {button.title && (
                  <Text style={styles.exitButtonText}>{button.title}</Text>
                )}
              </TouchableOpacity>
            );
          })}
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
    backgroundColor: '#fff',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  blueButton: {
    backgroundColor: '#00ADEF',
    borderWidth: 0,
  },
  logoButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  buttonImage: {
    width: '60%',
    height: '60%',
  },
  logoImage: {
    width: '80%',
    height: '80%',
  },
  exitButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  exitButtonText: {
    color: '#333',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default HomeScreen;
