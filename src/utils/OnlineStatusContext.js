// src/utils/OnlineStatusContext.js
// -------------------------------------------------------------
// Handles online/offline status across the app
// -------------------------------------------------------------
import React, { createContext, useState, useEffect, useContext } from 'react';
import NetInfo from '@react-native-community/netinfo';

const OnlineStatusContext = createContext({ isConnected: true });
export const useOnlineStatus = () => useContext(OnlineStatusContext);

export const OnlineStatusProvider = ({ children }) => {
  console.log('🌐 [OnlineStatusProvider] Mounting...');

  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    console.log('🌍 [OnlineStatusProvider] Subscribing to NetInfo listener...');
    const unsubscribe = NetInfo.addEventListener((state) => {
      console.log(
        '📶 [OnlineStatusProvider] Connection changed:',
        state.isConnected
      );
      setIsConnected(!!state.isConnected);
    });

    return () => {
      console.log('🧹 [OnlineStatusProvider] Cleaning up NetInfo listener');
      unsubscribe();
    };
  }, []);

  return (
    <OnlineStatusContext.Provider value={{ isConnected }}>
      {children}
    </OnlineStatusContext.Provider>
  );
};
