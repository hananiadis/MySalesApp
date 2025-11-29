// Firebase modular app initializer for JS SDK usage in React Native.
// Keeps a single app instance shared across the app to avoid duplicate initialization errors.
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAADPmQCg2916WMmKl1-H78bLQdLcLmtLY',
  authDomain: 'mysalesapp-38ccf.firebaseapp.com',
  projectId: 'mysalesapp-38ccf',
  storageBucket: 'mysalesapp-38ccf.firebasestorage.app',
  messagingSenderId: '570551628901',
  appId: '1:570551628901:android:b03de7bb211e90f319028c',
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
