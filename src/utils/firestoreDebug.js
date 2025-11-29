// Firestore debugging utilities
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

/**
 * Test if the current user can write to their own user document
 */
export const testUserDocumentWrite = async () => {
  try {
    const currentUser = auth().currentUser;
    
    if (!currentUser) {
      console.log('[Firestore Debug] ❌ No authenticated user');
      return {
        success: false,
        error: 'No authenticated user',
      };
    }

    console.log('[Firestore Debug] Testing write for user:', currentUser.uid);
    console.log('[Firestore Debug] Email:', currentUser.email);
    console.log('[Firestore Debug] Email verified:', currentUser.emailVerified);

    // Test data
    const testData = {
      testField: 'test',
      testTimestamp: firestore.FieldValue.serverTimestamp(),
    };

    console.log('[Firestore Debug] Attempting to write test data...');
    
    await firestore()
      .collection('users')
      .doc(currentUser.uid)
      .set(testData, { merge: true });

    console.log('[Firestore Debug] ✅ Write successful!');

    // Read it back
    const doc = await firestore()
      .collection('users')
      .doc(currentUser.uid)
      .get();

    if (doc.exists) {
      console.log('[Firestore Debug] ✅ Document exists');
      console.log('[Firestore Debug] Document data:', JSON.stringify(doc.data(), null, 2));
      return {
        success: true,
        exists: true,
        data: doc.data(),
      };
    } else {
      console.log('[Firestore Debug] ⚠️ Document does not exist after write');
      return {
        success: true,
        exists: false,
      };
    }
  } catch (error) {
    console.error('[Firestore Debug] ❌ Error:', error);
    console.error('[Firestore Debug] Error code:', error.code);
    console.error('[Firestore Debug] Error message:', error.message);
    
    return {
      success: false,
      error: error.message,
      code: error.code,
    };
  }
};

/**
 * Check Firestore connection and settings
 */
export const checkFirestoreSettings = async () => {
  try {
    console.log('[Firestore Debug] Checking Firestore settings...');
    
    const settings = firestore().settings;
    console.log('[Firestore Debug] Firestore settings:', settings);
    
    // Try a simple read operation
    console.log('[Firestore Debug] Testing read access...');
    const testDoc = await firestore()
      .collection('_test')
      .doc('connection')
      .get();
    
    console.log('[Firestore Debug] ✅ Firestore connection is working');
    
    return {
      success: true,
      connected: true,
      settings,
    };
  } catch (error) {
    console.error('[Firestore Debug] ❌ Connection error:', error);
    return {
      success: false,
      connected: false,
      error: error.message,
    };
  }
};

/**
 * Get current auth state
 */
export const getAuthState = () => {
  const currentUser = auth().currentUser;
  
  if (!currentUser) {
    console.log('[Firestore Debug] No authenticated user');
    return null;
  }

  const state = {
    uid: currentUser.uid,
    email: currentUser.email,
    emailVerified: currentUser.emailVerified,
    displayName: currentUser.displayName,
    isAnonymous: currentUser.isAnonymous,
    metadata: {
      creationTime: currentUser.metadata.creationTime,
      lastSignInTime: currentUser.metadata.lastSignInTime,
    },
  };

  console.log('[Firestore Debug] Auth state:', JSON.stringify(state, null, 2));
  return state;
};
