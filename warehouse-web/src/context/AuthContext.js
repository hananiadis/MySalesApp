/**
 * @typedef {Object} UserProfile
 * @property {string} uid
 * @property {string | null} email
 * @property {string} [role]
 * @property {string[]} [brands]
 * @property {string} [id]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {Object} AuthContextValue
 * @property {UserProfile | null} user
 * @property {boolean} loading
 * @property {(email: string, password: string) => Promise<UserProfile>} login
 * @property {() => Promise<void>} logout
 */

import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

const allowedRoles = ['warehouse_manager', 'owner', 'admin'];

/** @type {import('react').Context<AuthContextValue | null>} */
const AuthContext = createContext(null);

const isAuthorizedUser = (profile) => {
  if (!profile) return false;

  const hasRole = allowedRoles.includes(profile.role);
  const hasBrandAccess = Array.isArray(profile.brands) && profile.brands.includes('kivos');

  return hasRole && hasBrandAccess;
};

export const AuthProvider = ({ children }) => {
  /** @type {[UserProfile | null, (value: UserProfile | null) => void]} */
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);
  const navigate = useNavigate();

  const fetchUserProfile = async (uid) => {
    const userRef = doc(db, 'users', uid);
    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) return null;

    return { id: snapshot.id, ...snapshot.data() };
  };

  const handleUnauthorized = () => {
    setUser(null);
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        handleUnauthorized();
        setInitializing(false);
        return;
      }

      try {
        const profile = await fetchUserProfile(firebaseUser.uid);

        if (!isAuthorizedUser(profile)) {
          await signOut(auth);
          handleUnauthorized();
          return;
        }

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          ...profile,
        });
      } catch (error) {
        console.error('Error while verifying auth state', error);
        handleUnauthorized();
      } finally {
        setInitializing(false);
      }
    });

    return unsubscribe;
  }, [navigate]);

  const login = async (email, password) => {
    setAuthenticating(true);

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const profile = await fetchUserProfile(credential.user.uid);

      if (!isAuthorizedUser(profile)) {
        await signOut(auth);
        handleUnauthorized();
        throw new Error('You do not have permission to access this dashboard.');
      }

      const currentUser = {
        uid: credential.user.uid,
        email: credential.user.email,
        ...profile,
      };

      setUser(currentUser);
      navigate('/');
      return currentUser;
    } finally {
      setAuthenticating(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
    handleUnauthorized();
  };

  const value = useMemo(
    () => ({
      user,
      loading: initializing || authenticating,
      login,
      logout,
    }),
    [user, initializing, authenticating],
  );

  return createElement(AuthContext.Provider, { value }, children);
};

/** @returns {AuthContextValue} */
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};

export default AuthContext;
