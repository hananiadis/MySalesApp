// src/services/firebase.js
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

// Optional but recommended so Firestore ignores undefined fields
firestore().settings({ ignoreUndefinedProperties: true });

export { auth, firestore };
