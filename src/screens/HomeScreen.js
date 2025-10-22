// src/screens/HomeScreen.js
import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, BackHandler } from 'react-native';
import SafeScreen from '../components/SafeScreen';
import { useAuth, ROLES } from '../context/AuthProvider';

const BRAND_ROUTE = {
  playmobil: 'Playmobil',
  kivos: 'Kivos',
  john: 'John',
};

const EXIT_STRINGS = {
  exit: '\u0388\u03be\u03bf\u03b4\u03bf\u03c2',
};

export default function HomeScreen({ navigation }) {
  const { hasRole, hasBrand } = useAuth();

  const isAdmin = hasRole([ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER]);

  const showPlaymobil = hasBrand('playmobil');
  const showKivos = hasBrand('kivos');
  const showJohn = hasBrand('john');

  const userBrandRoutes = useMemo(() => {
    const list = [];
    if (showPlaymobil) list.push(BRAND_ROUTE.playmobil);
    if (showKivos) list.push(BRAND_ROUTE.kivos);
    if (showJohn) list.push(BRAND_ROUTE.john);
    return list;
  }, [showPlaymobil, showKivos, showJohn]);

  useEffect(() => {
    if (!isAdmin && userBrandRoutes.length === 1) {
      const onlyRoute = userBrandRoutes[0];
      navigation.reset({ index: 0, routes: [{ name: onlyRoute }] });
    }
  }, [isAdmin, userBrandRoutes, navigation]);

  const buttons = [
    showPlaymobil && {
      key: 'playmobil',
      image: require('../../assets/playmobil_logo.png'),
      onPress: () => navigation.navigate('Playmobil'),
      isLogoOnly: true,
    },
    showKivos && {
      key: 'kivos',
      image: require('../../assets/kivos_logo.png'),
      onPress: () => navigation.navigate('Kivos'),
      isLogoOnly: true,
    },
    showJohn && {
      key: 'john_hellas',
      image: require('../../assets/john_hellas_logo.png'),
      onPress: () => navigation.navigate('John'),
      isLogoOnly: true,
    },
    isAdmin
      ? {
          key: 'settings',
          title: 'Ρυθμίσεις',
          onPress: () => navigation.navigate('Settings'),
          isPrimary: true,
        }
      : null,
  ].filter(Boolean);

  return (
    <SafeScreen title="MySales" style={styles.screen} bodyStyle={styles.body}>
        <View style={styles.contentContainer}>
          <Text style={styles.subtitle}>Επιλέξτε brand για να συνεχίσετε</Text>
          <View style={styles.buttonGrid}>
            {buttons.map((button) => {
              const isLogoOnly = !!button.image;

              const containerStyle = [
                styles.button,
                isLogoOnly && styles.logoButton,
                !isLogoOnly && !button.isPrimary && styles.neutralButton,
                button.isPrimary && styles.primaryButton,
              ];

              return (
                <TouchableOpacity key={button.key} style={containerStyle} onPress={button.onPress}>
                  {button.image && (
                    <Image
                      source={button.image}
                      style={[styles.buttonImage, styles.logoImage]}
                      resizeMode="contain"
                    />
                  )}
                  {button.title && (
                    <Text
                      style={[
                        styles.buttonLabel,
                        button.isPrimary && styles.primaryText,
                      ]}
                    >
                      {button.title}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.exitButton}
            onPress={() => BackHandler.exitApp()}
            activeOpacity={0.85}
          >
            <Text style={styles.exitButtonText}>{EXIT_STRINGS.exit}</Text>
          </TouchableOpacity>
        </View>
    </SafeScreen>
  );
}

const TILE_MIN_HEIGHT = 96;

const styles = StyleSheet.create({
  screen: { backgroundColor: '#fff' },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  contentContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderRadius: 20,
    padding: 20,
    justifyContent: 'space-between',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#545f73',
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  button: {
    width: '48%',
    minHeight: TILE_MIN_HEIGHT,
    marginBottom: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  logoButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e1e7f5' },
  primaryButton: { backgroundColor: '#eef4ff' },
  primaryText: { color: '#123', fontWeight: '800' },
  neutralButton: { backgroundColor: '#f6f7fb' },
  buttonLabel: { textAlign: 'center', fontWeight: '800', color: '#123' },
  buttonImage: { width: '100%', height: 44, marginBottom: 4 },
  logoImage: { height: 44 },
  exitButton: {
    marginTop: 24,
    alignSelf: 'center',
    backgroundColor: '#d32f2f',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  exitButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
