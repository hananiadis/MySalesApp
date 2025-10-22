import React, { useContext } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useOnlineStatus } from './OnlineStatusContext';

const OnlineStatusBanner = () => {
  const { isConnected } = useOnlineStatus();

  if (isConnected) return null; // Hide banner if online

  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText}>
        Εκτός σύνδεσης - Οι αλλαγές θα συγχρονιστούν όταν επανέλθει το internet
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#D0021B',
    paddingVertical: 6,
    alignItems: 'center',
    zIndex: 9999, // Always on top
  },
  bannerText: { color: '#fff', fontWeight: 'bold', fontSize: 15 }
});

export default OnlineStatusBanner;