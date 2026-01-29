import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WalletState, WalletStatus } from '../lib/types';
import { STORAGE_KEYS } from '../lib/constants';

interface PersistedWalletData {
  lastConnectedWallet?: string;
}

interface WalletStore {
  // State
  wallet: WalletState;
  isHydrated: boolean;
  
  // Actions
  hydrate: () => Promise<void>;
  setConnecting: () => void;
  setConnected: (publicKey: string) => void;
  setDisconnected: () => void;
  setError: (error: string) => void;
  getLastConnectedWallet: () => string | undefined;
}

export const useWalletStore = create<WalletStore>((set, get) => ({
  wallet: { status: 'booting' },
  isHydrated: false,
  
  hydrate: async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.WALLET);
      if (data) {
        const parsed: PersistedWalletData = JSON.parse(data);
        // We don't auto-connect, just remember the last wallet
        // User needs to reconnect via MWA each session
        set({ 
          wallet: { status: 'disconnected' },
          isHydrated: true,
        });
      } else {
        set({ 
          wallet: { status: 'disconnected' },
          isHydrated: true,
        });
      }
    } catch (error) {
      console.error('Failed to hydrate wallet store:', error);
      set({ 
        wallet: { status: 'disconnected' },
        isHydrated: true,
      });
    }
  },
  
  setConnecting: () => set({ wallet: { status: 'connecting' } }),
  
  setConnected: (publicKey) => {
    // Persist last connected wallet
    const data: PersistedWalletData = { lastConnectedWallet: publicKey };
    AsyncStorage.setItem(STORAGE_KEYS.WALLET, JSON.stringify(data)).catch(console.error);
    set({ wallet: { status: 'connected', publicKey } });
  },
  
  setDisconnected: () => set({ wallet: { status: 'disconnected' } }),
  
  setError: (error) => set({ wallet: { status: 'error', error } }),
  
  getLastConnectedWallet: () => {
    const wallet = get().wallet;
    if (wallet.status === 'connected') {
      return wallet.publicKey;
    }
    return undefined;
  },
}));

// Stable selector hooks to avoid infinite loops
export const useWalletStatus = (): WalletStatus => 
  useWalletStore((state) => state.wallet.status);

export const useWalletPublicKey = (): string | null => {
  const wallet = useWalletStore((state) => state.wallet);
  return wallet.status === 'connected' ? wallet.publicKey : null;
};

export const useIsConnected = (): boolean => 
  useWalletStore((state) => state.wallet.status === 'connected');

export const useIsWalletHydrated = (): boolean => 
  useWalletStore((state) => state.isHydrated);

export const useIsBooting = (): boolean => 
  useWalletStore((state) => state.wallet.status === 'booting' || !state.isHydrated);
