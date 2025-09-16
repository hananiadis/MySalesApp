// src/utils/location.js
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from 'react-native-geolocation-service';

/**
 * Requests OS permission (Android) or uses iOS built-in prompt.
 * Returns true if we can access location (permission granted), false otherwise.
 */
export async function requestLocationPermission() {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ]);

      const fine = granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
      const coarse = granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION];

      return fine === PermissionsAndroid.RESULTS.GRANTED ||
             coarse === PermissionsAndroid.RESULTS.GRANTED;
    } catch (e) {
      return false;
    }
  }

  // iOS – Geolocation lib will trigger its own prompt on first use
  return true;
}

/**
 * Get current location once and store it to AsyncStorage as "lastKnownLocation".
 * Returns { lat, lng, accuracy, ts } or null if failed.
 */
export function getAndStoreCurrentLocation(showNeutralAlert = true) {
  return new Promise((resolve) => {
    Geolocation.getCurrentPosition(
      async (pos) => {
        const payload = {
          lat: pos?.coords?.latitude ?? null,
          lng: pos?.coords?.longitude ?? null,
          accuracy: pos?.coords?.accuracy ?? null,
          ts: pos?.timestamp ?? Date.now(),
        };
        await AsyncStorage.setItem('lastKnownLocation', JSON.stringify(payload));
        if (showNeutralAlert) {
          Alert.alert('Τοποθεσία', 'Ελήφθη τρέχουσα τοποθεσία.', [{ text: 'OK' }]);
        }
        resolve(payload);
      },
      async (err) => {
        // Show a neutral message (no scary “user did not share”)
        if (showNeutralAlert) {
          Alert.alert(
            'Τοποθεσία',
            'Δεν ήταν δυνατή η λήψη τοποθεσίας αυτή τη στιγμή.',
            [{ text: 'OK' }]
          );
        }
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
        forceRequestLocation: true, // uses RN Geolocation Service extra flag on Android
        showLocationDialog: true,
      }
    );
  });
}

/**
 * Ask for GPS permission ONCE (first run). If not asked before, request permission
 * and try to fetch a single fix and store it.
 */
export async function askLocationOnceOnFirstRun() {
  const key = 'locationPermAsked';
  const already = await AsyncStorage.getItem(key);
  if (already === 'yes') return;

  const ok = await requestLocationPermission();
  // Mark as asked regardless, so we don't keep bugging on each launch.
  await AsyncStorage.setItem(key, 'yes');

  if (ok) {
    await getAndStoreCurrentLocation(false); // no alert during app start
  }
}

/**
 * Testing helper – clears the "asked" flag so you can trigger the prompt again.
 */
export async function resetLocationAskedFlag() {
  await AsyncStorage.removeItem('locationPermAsked');
}
