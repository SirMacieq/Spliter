import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings } from '../lib/types';
import { STORAGE_KEYS, SolanaNetwork, APP_NETWORK } from '../lib/constants';

/**
 * Settings Store
 * 
 * NOTE: Network switching is DISABLED in this build.
 * The app always uses APP_NETWORK from constants.ts.
 * 
 * The `network` field here is kept for UI display purposes only
 * and always reflects APP_NETWORK. It cannot be changed.
 */

interface SettingsStore {
  // State - network is READ-ONLY, always APP_NETWORK
  network: SolanaNetwork;
  isHydrated: boolean;
  
  // Actions
  hydrate: () => Promise<void>;
  /**
   * @deprecated Network switching is disabled in this build.
   * This function logs a warning and does nothing.
   */
  setNetwork: (network: SolanaNetwork) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  // ALWAYS use APP_NETWORK - no persisted override
  network: APP_NETWORK,
  isHydrated: false,
  
  hydrate: async () => {
    console.log('[settings] Hydrating - network locked to:', APP_NETWORK);
    
    try {
      // Read settings but DO NOT apply persisted network
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (data) {
        const settings: AppSettings = JSON.parse(data);
        console.log('[settings] Found persisted settings:', { 
          persisted: settings.network, 
          appNetwork: APP_NETWORK,
          action: 'IGNORING persisted network, using APP_NETWORK'
        });
      }
      
      // Always use APP_NETWORK regardless of persisted value
      set({ 
        network: APP_NETWORK,
        isHydrated: true,
      });
    } catch (error) {
      console.error('[settings] Failed to hydrate:', error);
      set({ 
        network: APP_NETWORK,
        isHydrated: true,
      });
    }
  },
  
  setNetwork: async (network) => {
    // Network switching is DISABLED
    console.warn('[settings] setNetwork() called but IGNORED - app locked to:', APP_NETWORK, '| attempted:', network);
    
    // Clear any persisted network to prevent confusion on restart
    try {
      const settings: AppSettings = { network: APP_NETWORK };
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      // Ignore storage errors
    }
    
    // State stays at APP_NETWORK
    set({ network: APP_NETWORK });
  },
}));

// Stable selectors
export const useNetwork = () => useSettingsStore((state) => state.network);
export const useIsSettingsHydrated = () => useSettingsStore((state) => state.isHydrated);
