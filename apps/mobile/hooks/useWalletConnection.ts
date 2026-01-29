import { Buffer } from "buffer";
import { useCallback } from 'react';
import { 
  transact, 
  Web3MobileWallet 
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { PublicKey } from '@solana/web3.js';
import { useWalletStore } from '../stores/walletStore';
import { APP_NAME, getSolanaNetwork } from '../lib/constants';

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
        const authResult = await wallet.authorize({
          cluster: getSolanaNetwork(),
          identity: APP_IDENTITY,
        });
        
        const rawAddress: unknown = authResult.accounts?.[0]?.address;

        if (rawAddress == null) {
          throw new Error("Wallet did not return an address.");
        }

        let publicKey: PublicKey;

        // Handle various address formats from MWA
        if (typeof rawAddress === 'object' && rawAddress !== null) {
          // Uint8Array or array-like
          if ('length' in rawAddress) {
            const arr = rawAddress as ArrayLike<number>;
            publicKey = new PublicKey(Uint8Array.from(Array.from({ length: arr.length }, (_, i) => arr[i])));
          } else {
            throw new Error('Wallet returned address in unknown object format');
          }
        } else if (typeof rawAddress === "string") {
          const cleaned = rawAddress.trim().replace(/^solana:/i, "").replace(/^sol:/i, "");
          try {
            publicKey = new PublicKey(cleaned);
          } catch {
            const bytes = Buffer.from(cleaned, "base64");
            if (bytes.length !== 32) {
              throw new Error(`Invalid address length: ${bytes.length}`);
            }
            publicKey = new PublicKey(bytes);
          }
        } else {
          throw new Error(`Wallet returned address in unknown format: ${typeof rawAddress}`);
        }

        setConnected(publicKey.toBase58());
      });
    } catch (error: unknown) {
      console.error('Wallet connection error:', error);
      
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('User rejected') || message.includes('cancelled')) {
        setError('Connection cancelled');
      } else if (message.includes('No wallet')) {
        setError('No wallet app found. Install Phantom or Solflare.');
      } else {
        setError(message || 'Failed to connect wallet');
      }
      
      setTimeout(() => setDisconnected(), 3000);
    }
  }, [setConnecting, setConnected, setDisconnected, setError]);
  
  const disconnect = useCallback(() => {
    setDisconnected();
  }, [setDisconnected]);
  
  return { connect, disconnect };
};
