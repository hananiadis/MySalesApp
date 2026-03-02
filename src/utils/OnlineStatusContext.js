// src/utils/OnlineStatusContext.js
// -------------------------------------------------------------
// Handles online/offline status across the app
// -------------------------------------------------------------
import React, { createContext, useState, useEffect, useContext } from 'react';
import NetInfo from '@react-native-community/netinfo';
import InventoryService from '../services/inventoryService';

const OnlineStatusContext = createContext({ isConnected: true });
export const useOnlineStatus = () => useContext(OnlineStatusContext);

export const OnlineStatusProvider = ({ children }) => {
  console.log('🌐 [OnlineStatusProvider] Mounting...');

  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    console.log('🌍 [OnlineStatusProvider] Subscribing to NetInfo listener...');
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = !!state.isConnected;
      console.log(
        '📶 [OnlineStatusProvider] Connection changed:',
        isOnline
      );
      setIsConnected(isOnline);
      
      // Auto-sync inventory queue when coming online
      if (isOnline) {
        console.log('[OnlineStatusProvider] Network online → attempting inventory sync');
        InventoryService.syncOfflineQueue()
          .then((result) => {
            console.log('[OnlineStatusProvider] Inventory sync result:', result);
          })
          .catch((err) => {
            console.error('[OnlineStatusProvider] Inventory sync error:', err);
          });
      }
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
