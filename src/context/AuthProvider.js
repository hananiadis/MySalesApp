import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import firestoreModule from '@react-native-firebase/firestore';
import { auth, firestore } from '../services/firebase';

const AuthContext = createContext(null);

export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  DEVELOPER: 'developer',
  CUSTOMER: 'customer',
  SALES_MANAGER: 'sales_manager',
  SALESMAN: 'salesman',
  WAREHOUSE_MANAGER: 'warehouse_manager',
};

const PERMISSIONS_BY_ROLE = {
  [ROLES.OWNER]: ['*'],
  [ROLES.ADMIN]: ['*'],
  [ROLES.DEVELOPER]: ['*', 'debug'],
  [ROLES.CUSTOMER]: ['products.view'],
  [ROLES.SALES_MANAGER]: ['products.view', 'orders.view.all', 'warehouse.view'],
  [ROLES.SALESMAN]: ['products.view', 'orders.view.mine', 'orders.edit.mine', 'cache.manage'],
  [ROLES.WAREHOUSE_MANAGER]: ['warehouse.view', 'warehouse.edit'],
};

const splitDisplayName = (displayName) => {
  if (!displayName) {
    return { firstName: '', lastName: '' };
  }

  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: '', lastName: '' };
  }

  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  return { firstName, lastName };
};

export function AuthProvider({ children }) {
  const [init, setInit] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let unsubscribeProfile;
    let active = true;

    const loadProfile = async () => {
      if (!user) {
        if (!active) return;
        setProfile(null);
        setLoadingProfile(false);
        setInit(false);
        return;
      }

      setLoadingProfile(true);
      const ref = firestore().collection('users').doc(user.uid);

      unsubscribeProfile = ref.onSnapshot(
        async (snapshot) => {
          if (!active) return;
          try {
            if (!snapshot.exists) {
              const { firstName, lastName } = splitDisplayName(user.displayName || '');
              const fallbackName = [firstName, lastName].filter(Boolean).join(' ') || user.displayName || '';
              const data = {
                uid: user.uid,
                firstName,
                lastName,
                name: fallbackName,
                email: user.email || '',
                role: ROLES.CUSTOMER,
                brands: [],
                merchIds: [],
                createdAt: firestoreModule.FieldValue.serverTimestamp(),
                updatedAt: firestoreModule.FieldValue.serverTimestamp(),
              };
              await ref.set(data, { merge: true });
              if (!active) return;
              setProfile({ ...data });
            } else {
              setProfile({ uid: user.uid, ...snapshot.data() });
            }
          } catch (error) {
            console.error('AuthProvider subscribe error:', error);
          } finally {
            if (!active) return;
            setLoadingProfile(false);
            setInit(false);
          }
        },
        (error) => {
          console.error('AuthProvider subscribe error:', error);
          if (!active) return;
          setLoadingProfile(false);
          setInit(false);
        }
      );
    };

    loadProfile();

    return () => {
      active = false;
      if (typeof unsubscribeProfile === 'function') {
        unsubscribeProfile();
      }
    };
  }, [user]);

  const signIn = async (email, password) => {
    return auth().signInWithEmailAndPassword(email.trim(), password);
  };

  const signUp = async (firstName, lastName, email, password) => {
    const trimmedFirst = (firstName || '').trim();
    const trimmedLast = (lastName || '').trim();
    const trimmedEmail = (email || '').trim();
    const fullName = [trimmedFirst, trimmedLast].filter(Boolean).join(' ');

    const credential = await auth().createUserWithEmailAndPassword(trimmedEmail, password);

    if (fullName) {
      await credential.user.updateProfile({ displayName: fullName });
    }

    const ref = firestore().collection('users').doc(credential.user.uid);
    await ref.set(
      {
        uid: credential.user.uid,
        firstName: trimmedFirst,
        lastName: trimmedLast,
        name: fullName || trimmedFirst || trimmedLast || credential.user.email || '',
        email: credential.user.email,
        role: ROLES.CUSTOMER,
        brands: [],
        merchIds: [],
        createdAt: firestoreModule.FieldValue.serverTimestamp(),
        updatedAt: firestoreModule.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  };

  const signOut = async () => {
    await auth().signOut();
    setProfile(null);
  };

  const updateProfileInfo = async ({ firstName, lastName, email, password }) => {
    const current = auth().currentUser;
    if (!current) {
      throw new Error('No authenticated user.');
    }

    const trimmedFirst = (firstName || '').trim();
    const trimmedLast = (lastName || '').trim();
    const trimmedEmail = (email || '').trim() || current.email || '';
    const fullName = [trimmedFirst, trimmedLast].filter(Boolean).join(' ');

    if (trimmedEmail !== current.email) {
      await current.updateEmail(trimmedEmail);
    }

    if (fullName && fullName !== (current.displayName || '')) {
      await current.updateProfile({ displayName: fullName });
    }

    if (password) {
      await current.updatePassword(password);
    }

    const ref = firestore().collection('users').doc(current.uid);
    await ref.set(
      {
        firstName: trimmedFirst,
        lastName: trimmedLast,
        name: fullName || trimmedFirst || trimmedLast || trimmedEmail,
        email: trimmedEmail,
        updatedAt: firestoreModule.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  };

  const myRole = profile?.role || null;
  const myBrands = Array.isArray(profile?.brands) ? profile.brands : [];

  const hasRole = (roleOrArray) => {
    if (!myRole) return false;
    return Array.isArray(roleOrArray) ? roleOrArray.includes(myRole) : myRole === roleOrArray;
  };

  const hasBrand = (brandOrArray) => {
    if (!myBrands.length) return false;
    return Array.isArray(brandOrArray)
      ? brandOrArray.some((brand) => myBrands.includes(brand))
      : myBrands.includes(brandOrArray);
  };

  const can = (permission) => {
    if (!myRole) return false;
    const permissions = PERMISSIONS_BY_ROLE[myRole] || [];
    return permissions.includes('*') || permissions.includes(permission);
  };

  const value = useMemo(
    () => ({
      init,
      user,
      profile,
      loadingProfile,
      signIn,
      signUp,
      signOut,
      updateProfileInfo,
      hasRole,
      hasBrand,
      can,
      ROLES,
    }),
    [init, user, profile, loadingProfile, myRole, myBrands, updateProfileInfo]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);