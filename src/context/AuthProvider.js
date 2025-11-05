import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

import { ROLES } from '../constants/roles';

export { ROLES } from '../constants/roles';

const AuthContext = createContext(null);

const splitDisplayName = (displayName = '') => {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? '';
  const lastName = parts.slice(1).join(' ') || '';
  return { firstName, lastName };
};

const normaliseArray = (value) => (Array.isArray(value) ? value : []);

const basePermissions = {
  [ROLES.OWNER]: ['*'],
  [ROLES.ADMIN]: ['*'],
  [ROLES.DEVELOPER]: ['*', 'debug'],
  [ROLES.SALES_MANAGER]: [
    'products.view',
    'orders.view.all',
    'warehouse.view',
  ],
  [ROLES.SALESMAN]: [
    'products.view',
    'orders.view.mine',
    'orders.edit.mine',
    'cache.manage',
  ],
  [ROLES.WAREHOUSE_MANAGER]: ['warehouse.view', 'warehouse.edit'],
  [ROLES.CUSTOMER]: ['products.view'],
};

const createDefaultProfilePayload = (firebaseUser) => {
  const email = firebaseUser?.email || '';
  const { firstName, lastName } = splitDisplayName(firebaseUser?.displayName);
  const fallbackName =
    firebaseUser?.displayName ||
    [firstName, lastName].filter(Boolean).join(' ') ||
    email;

  return {
    firestore: {
      firstName,
      lastName,
      name: fallbackName,
      email,
      role: ROLES.CUSTOMER,
      brands: [],
      merchIds: [],
      isActive: true,
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    },
    state: {
      uid: firebaseUser?.uid || null,
      firstName,
      lastName,
      name: fallbackName,
      email,
      role: ROLES.CUSTOMER,
      brands: [],
      merchIds: [],
      isActive: true,
    },
  };
};

export const AuthProvider = ({ children }) => {
  const [init, setInit] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authReady) {
      return undefined;
    }

    let active = true;
    let unsubscribeProfile = null;

    if (!user || !user.uid) {
      setProfile(null);
      setLoadingProfile(false);
      setInit(false);
      return undefined;
    }

    setLoadingProfile(true);
    const ref = firestore().collection('users').doc(user.uid);

    unsubscribeProfile = ref.onSnapshot(
      async (snapshot) => {
        if (!active) {
          return;
        }

        if (!snapshot.exists) {
          try {
            const { firestore: payload, state } = createDefaultProfilePayload(
              user
            );
            await ref.set(payload, { merge: true });
            if (active) {
              setProfile(state);
            }
          } catch (error) {
            console.error('[AuthProvider] Failed to create profile:', error);
            if (active) {
              setProfile(createDefaultProfilePayload(user).state);
            }
          } finally {
            if (active) {
              setLoadingProfile(false);
              setInit(false);
            }
          }
          return;
        }

        const data = snapshot.data() || {};
        const fallback = createDefaultProfilePayload(user).state;
        setProfile({
          ...fallback,
          ...data,
          uid: user.uid,
          email: data.email || user.email || fallback.email,
          role: data.role || fallback.role,
          brands: normaliseArray(data.brands),
          merchIds: normaliseArray(data.merchIds),
        });
        setLoadingProfile(false);
        setInit(false);
      },
      (error) => {
        console.error('[AuthProvider] Failed to load profile:', error);
        if (active) {
          setProfile(null);
          setLoadingProfile(false);
          setInit(false);
        }
      }
    );

    return () => {
      active = false;
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, [authReady, user]);

  const signIn = useCallback(async (email, password) => {
    const trimmedEmail = (email || '').trim();
    const trimmedPassword = password || '';
    return auth().signInWithEmailAndPassword(trimmedEmail, trimmedPassword);
  }, []);

  const signUp = useCallback(
    async (firstName, lastName, email, password) => {
      const trimmedEmail = (email || '').trim();
      const trimmedFirst = (firstName || '').trim();
      const trimmedLast = (lastName || '').trim();
      const displayName = [trimmedFirst, trimmedLast]
        .filter(Boolean)
        .join(' ')
        .trim();

      const credential = await auth().createUserWithEmailAndPassword(
        trimmedEmail,
        password
      );

      if (displayName) {
        await credential.user.updateProfile({ displayName });
      }

      const { firestore: payload } = createDefaultProfilePayload(
        credential.user
      );
      const profileOverride = {
        ...payload,
        firstName: trimmedFirst || payload.firstName,
        lastName: trimmedLast || payload.lastName,
        name: displayName || payload.name,
        email: trimmedEmail,
      };

      await firestore()
        .collection('users')
        .doc(credential.user.uid)
        .set(profileOverride, { merge: true });
    },
    []
  );

  const signOutUser = useCallback(async () => {
    await auth().signOut();
    setProfile(null);
  }, []);

  const updateProfileInfo = useCallback(
    async ({ firstName, lastName, email, password }) => {
      const currentUser = auth().currentUser;
      if (!currentUser) {
        throw new Error('No authenticated user.');
      }

      const trimmedFirst = (firstName || '').trim();
      const trimmedLast = (lastName || '').trim();
      const trimmedEmail = (email || '').trim() || currentUser.email || '';
      const displayName = [trimmedFirst, trimmedLast]
        .filter(Boolean)
        .join(' ')
        .trim();

      if (trimmedEmail && trimmedEmail !== currentUser.email) {
        await currentUser.updateEmail(trimmedEmail);
      }

      if (displayName && displayName !== currentUser.displayName) {
        await currentUser.updateProfile({ displayName });
      }

      if (password) {
        await currentUser.updatePassword(password);
      }

      await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .set(
          {
            firstName: trimmedFirst,
            lastName: trimmedLast,
            name: displayName || trimmedEmail,
            email: trimmedEmail,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    },
    []
  );

  const myRole = profile?.role || null;
  const myBrands = normaliseArray(profile?.brands);

  const hasRole = useCallback(
    (roleOrRoles) => {
      if (!myRole) {
        return false;
      }
      if (Array.isArray(roleOrRoles)) {
        return roleOrRoles.includes(myRole);
      }
      return myRole === roleOrRoles;
    },
    [myRole]
  );

  const hasBrand = useCallback(
    (brandOrBrands) => {
      if (!myBrands.length) {
        return false;
      }
      if (Array.isArray(brandOrBrands)) {
        return brandOrBrands.some((brand) =>
          myBrands.includes(String(brand).toLowerCase())
        );
      }
      return myBrands.includes(String(brandOrBrands).toLowerCase());
    },
    [myBrands]
  );

  const can = useCallback(
    (permission) => {
      if (!myRole) {
        return false;
      }
      const permissions = basePermissions[myRole] || [];
      return permissions.includes('*') || permissions.includes(permission);
    },
    [myRole]
  );

  const contextValue = useMemo(
    () => ({
      init,
      user,
      profile,
      loadingProfile,
      signIn,
      signUp,
      signOut: signOutUser,
      updateProfileInfo,
      hasRole,
      hasBrand,
      can,
      ROLES,
    }),
    [
      init,
      user,
      profile,
      loadingProfile,
      signIn,
      signUp,
      signOutUser,
      updateProfileInfo,
      hasRole,
      hasBrand,
      can,
    ]
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

