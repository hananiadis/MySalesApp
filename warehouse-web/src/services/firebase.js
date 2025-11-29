import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Reuse the existing mobile Firebase configuration for the web dashboard.
const firebaseConfig = {
  apiKey: 'AIzaSyAADPmQCg2916WMmKl1-H78bLQdLcLmtLY',
  authDomain: 'mysalesapp-38ccf.firebaseapp.com',
  projectId: 'mysalesapp-38ccf',
  storageBucket: 'mysalesapp-38ccf.firebasestorage.app',
  messagingSenderId: '570551628901',
  appId: '1:570551628901:android:b03de7bb211e90f319028c',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
