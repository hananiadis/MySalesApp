// Firebase modular app initializer for JS SDK usage in React Native.
// Keeps a single app instance shared across the app to avoid duplicate initialization errors.
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {

};

let appInstance;

export const getFirebaseApp = () => {
  if (appInstance) {
    return appInstance;
  }
  appInstance = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return appInstance;
};

export const getFirebaseDb = () => getFirestore(getFirebaseApp());
