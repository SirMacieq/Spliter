import { create } from 'zustand';
import { WalletState } from '../lib/types';

interface WalletStore {
  // State
  wallet: WalletState;
  
  // Actions
  setConnecting: () => void;
  setConnected: (publicKey: string) => void;
  setDisconnected: () => void;
  setError: (error: string) => void;
}

export const useWalletStore = create<WalletStore>((set) => ({
  wallet: { status: 'disconnected' },
  
  setConnecting: () => set({ wallet: { status: 'connecting' } }),
  
  setConnected: (publicKey) => set({ 
    wallet: { status: 'connected', publicKey } 
  }),
  
  setDisconnected: () => set({ wallet: { status: 'disconnected' } }),
  
  setError: (error) => set({ wallet: { status: 'error', error } }),
}));

// Selector hooks for convenience
export const useWalletStatus = () => useWalletStore((state) => state.wallet.status);
export const useWalletPublicKey = () => {
  const wallet = useWalletStore((state) => state.wallet);
  return wallet.status === 'connected' ? wallet.publicKey : null;
};
export const useIsConnected = () => useWalletStore((state) => state.wallet.status === 'connected');
