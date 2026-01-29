import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings } from '../lib/types';
import { STORAGE_KEYS, setSolanaNetwork, SolanaNetwork } from '../lib/constants';

interface SettingsStore {
  // State
  network: SolanaNetwork;
  isHydrated: boolean;
  
  // Actions
  hydrate: () => Promise<void>;
  setNetwork: (network: SolanaNetwork) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  network: 'devnet',
  isHydrated: false,
  
  hydrate: async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (data) {
        const settings: AppSettings = JSON.parse(data);
        // Apply network to global config
        setSolanaNetwork(settings.network);
        set({ 
          network: settings.network,
          isHydrated: true,
        });
      } else {
        set({ isHydrated: true });
      }
    } catch (error) {
      console.error('Failed to hydrate settings store:', error);
      set({ isHydrated: true });
    }
  },
  
  setNetwork: async (network) => {
    // Update global config
    setSolanaNetwork(network);
    
    // Persist
    const settings: AppSettings = { network };
    await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    set({ network });
  },
}));

// Stable selectors
export const useNetwork = () => useSettingsStore((state) => state.network);
export const useIsSettingsHydrated = () => useSettingsStore((state) => state.isHydrated);
