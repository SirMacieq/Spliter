import { useCallback } from 'react';
import { 
  transact, 
  Web3MobileWallet 
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { PublicKey } from '@solana/web3.js';
import { useWalletStore } from '../stores/walletStore';
import { APP_NAME } from '../lib/constants';

const APP_IDENTITY = {
  name: APP_NAME,
  uri: 'https://spliter.app',
  icon: 'favicon.ico',
};

export const useWalletConnection = () => {
  const { setConnecting, setConnected, setDisconnected, setError } = useWalletStore();
  
  const connect = useCallback(async () => {
    setConnecting();
    
    try {
      await transact(async (wallet: Web3MobileWallet) => {
        // Authorize with the wallet
        const authResult = await wallet.authorize({
          cluster: 'mainnet-beta',
          identity: APP_IDENTITY,
        });
        
        // Get the public key from the first account
        const publicKey = new PublicKey(authResult.accounts[0].address);
        setConnected(publicKey.toBase58());
      });
    } catch (error: any) {
      console.error('Wallet connection error:', error);
      
      if (error?.message?.includes('User rejected')) {
        setError('Connection cancelled');
      } else if (error?.message?.includes('No wallet')) {
        setError('No wallet app found. Please install Phantom or another Solana wallet.');
      } else {
        setError(error?.message || 'Failed to connect wallet');
      }
      
      // Reset to disconnected after showing error
      setTimeout(() => setDisconnected(), 3000);
    }
  }, [setConnecting, setConnected, setDisconnected, setError]);
  
  const disconnect = useCallback(() => {
    // MWA doesn't have a persistent session, so just clear local state
    setDisconnected();
  }, [setDisconnected]);
  
  return { connect, disconnect };
};
