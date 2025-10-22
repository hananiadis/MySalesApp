// src/utils/OnlineStatusContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import NetInfo from '@react-native-community/netinfo';

const OnlineStatusContext = createContext({ isConnected: true });

export function OnlineStatusProvider({ children }) {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(!!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  return (
    <OnlineStatusContext.Provider value={{ isConnected }}>
      {children}
    </OnlineStatusContext.Provider>
  );
}

export function useOnlineStatus() {
  return useContext(OnlineStatusContext);
}