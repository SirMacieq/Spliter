import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings } from '../lib/types';
import { STORAGE_KEYS, setSolanaNetwork, SolanaNetwork, getSolanaNetwork } from '../lib/constants';

interface SettingsStore {
  // State
  network: SolanaNetwork;
  isHydrated: boolean;
  
  // Actions
  hydrate: () => Promise<void>;
  setNetwork: (network: SolanaNetwork) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  // Initialize from constants (which reads from env) - SINGLE SOURCE OF TRUTH
  network: getSolanaNetwork(),
  isHydrated: false,
  
  hydrate: async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      const envNetwork = getSolanaNetwork(); // Already set from env in constants.ts
      
      if (data) {
        const settings: AppSettings = JSON.parse(data);
        // Only use persisted network if explicitly saved, otherwise use env
        const networkToUse = settings.network || envNetwork;
        setSolanaNetwork(networkToUse);
        set({ 
          network: networkToUse,
          isHydrated: true,
        });
        console.log('[settings] Hydrated from storage:', { 
          persisted: settings.network, 
          env: envNetwork,
          using: networkToUse 
        });
      } else {
        // No saved settings - use env default (already set in constants)
        set({ 
          network: envNetwork,
          isHydrated: true 
        });
        console.log('[settings] No saved settings, using env:', envNetwork);
      }
    } catch (error) {
      console.error('[settings] Failed to hydrate:', error);
      // Fall back to env default
      const envNetwork = getSolanaNetwork();
      set({ 
        network: envNetwork,
        isHydrated: true 
      });
    }
  },
  
  setNetwork: async (network) => {
    console.log('[settings] Network changed:', get().network, '->', network);
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
