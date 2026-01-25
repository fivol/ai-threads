/**
 * Store exports and context setup
 */

import { createContext, useContext } from 'react';
import { SettingsStore } from './SettingsStore';
import { ThreadsStore } from './ThreadsStore';

// Create singleton instances
const settingsStore = new SettingsStore();
const threadsStore = new ThreadsStore(settingsStore);

export const stores = {
  settingsStore,
  threadsStore,
};

export type RootStore = typeof stores;

// React context for stores
const StoreContext = createContext<RootStore | null>(null);

export const StoreProvider = StoreContext.Provider;

/**
 * Hook to access stores
 */
export function useStores(): RootStore {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStores must be used within a StoreProvider');
  }
  return context;
}

/**
 * Hook to access settings store
 */
export function useSettingsStore(): SettingsStore {
  return useStores().settingsStore;
}

/**
 * Hook to access threads store
 */
export function useThreadsStore(): ThreadsStore {
  return useStores().threadsStore;
}

export { SettingsStore } from './SettingsStore';
export { ThreadsStore } from './ThreadsStore';
