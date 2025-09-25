import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthProvider';

const getInitials = (name) =>
  name
    ?.split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 2);

const GlobalLogoutButton = () => {
  const { user, profile, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [signingOut, setSigningOut] = useState(false);
  const initials = useMemo(() => getInitials(profile?.name), [profile?.name]);

  if (!user || !profile) {
    return null;
  }

  const confirmLogout = () => {
    if (signingOut) return;

    Alert.alert('Αποσύνδεση;', 'Θέλεις σίγουρα να αποσυνδεθείς;', [
      { text: 'Ακύρωση', style: 'cancel' },
      {
        text: 'Αποσύνδεση',
        style: 'destructive',
        onPress: async () => {
          try {
            setSigningOut(true);
            await signOut();
          } catch (error) {
            Alert.alert('Σφάλμα', 'Δεν ήταν δυνατή η αποσύνδεση. Προσπάθησε ξανά.');
            setSigningOut(false);
          }
        },
      },
    ]);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={confirmLogout}
      disabled={signingOut}
      style={[
        styles.button,
        {
          top: insets.top + 12,
          opacity: signingOut ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.content}>
        {initials ? (
          <View style={styles.initialsBubble}>
            <Text style={styles.initialsText}>{initials}</Text>
          </View>
        ) : null}

        {signingOut ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.label}>Αποσύνδεση</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 16,
    zIndex: 1000,
    backgroundColor: '#007AFF',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  initialsBubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
});

export default GlobalLogoutButton;
