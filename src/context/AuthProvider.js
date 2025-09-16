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
              const data = {
                uid: user.uid,
                name: user.displayName || '',
                email: user.email || '',
                role: ROLES.CUSTOMER,
                brands: [],
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

  const signUp = async (name, email, password) => {
    const trimmedEmail = email.trim();
    const trimmedName = name ? name.trim() : '';
    const credential = await auth().createUserWithEmailAndPassword(trimmedEmail, password);

    if (trimmedName) {
      await credential.user.updateProfile({ displayName: trimmedName });
    }

    const ref = firestore().collection('users').doc(credential.user.uid);
    await ref.set(
      {
        uid: credential.user.uid,
        name: trimmedName,
        email: credential.user.email,
        role: ROLES.CUSTOMER,
        brands: [],
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
      hasRole,
      hasBrand,
      can,
      ROLES,
    }),
    [init, user, profile, loadingProfile, myRole, myBrands]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);