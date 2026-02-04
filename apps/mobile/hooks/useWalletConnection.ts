import { Buffer } from "buffer";
import { useCallback, useRef } from 'react';
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

// Generate a simple session ID for logging correlation
let sessionCounter = 0;
const generateSessionId = () => `sess_${++sessionCounter}_${Date.now().toString(36)}`;

export const useWalletConnection = () => {
  const { setConnecting, setConnected, setDisconnected, setError } = useWalletStore();
  const lastSessionId = useRef<string | null>(null);
  
  const connect = useCallback(async () => {
    const sessionId = generateSessionId();
    lastSessionId.current = sessionId;
    
    console.log('[wallet][connect] START', { 
      sessionId, 
      cluster: getSolanaNetwork(),
    });
    
    setConnecting();
    
    try {
      await transact(async (wallet: Web3MobileWallet) => {
        const authResult = await wallet.authorize({
          cluster: getSolanaNetwork(),
          identity: APP_IDENTITY,
        });
        
        // Log ALL accounts returned by wallet
        const accounts = authResult.accounts || [];
        console.log('[wallet][authorize] RESULT', {
          sessionId,
          walletUriBase: authResult.wallet_uri_base,
          accountCount: accounts.length,
          accounts: accounts.map((acc, i) => ({
            index: i,
            address: acc.address ? 
              (typeof acc.address === 'string' 
                ? `${acc.address.slice(0, 8)}...${acc.address.slice(-4)}`
                : `[bytes:${(acc.address as any).length}]`) 
              : 'null',
            label: acc.label,
          })),
          authToken: authResult.auth_token ? `${authResult.auth_token.slice(0, 8)}...` : 'none',
        });

        const rawAddress: unknown = accounts[0]?.address;

        if (rawAddress == null) {
          console.error('[wallet][authorize] No address returned', { sessionId, accounts });
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

        const pubkeyStr = publicKey.toBase58();
        console.log('[wallet][connect] SUCCESS', { 
          sessionId, 
          publicKey: `${pubkeyStr.slice(0, 8)}...${pubkeyStr.slice(-4)}`,
          fullKey: pubkeyStr,
          accountIndex: 0,
          totalAccounts: accounts.length,
        });
        
        setConnected(pubkeyStr);
      });
    } catch (error: unknown) {
      console.error('[wallet][connect] ERROR', { 
        sessionId, 
        error: error instanceof Error ? error.message : String(error),
      });
      
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('User rejected') || message.includes('cancelled') || message.includes('Cancelled')) {
        setError('Connection cancelled');
      } else if (message.includes('No wallet')) {
        setError('No wallet app found. Install Phantom or Solflare.');
      } else {
        setError(message || 'Failed to connect wallet');
      }
      
      setTimeout(() => setDisconnected(), 3000);
    }
  }, [setConnecting, setConnected, setDisconnected, setError]);
  
  const disconnect = useCallback(async (options?: { clearAuth?: boolean }) => {
    const sessionId = lastSessionId.current;
    console.log('[wallet][disconnect] START', { sessionId, clearAuth: options?.clearAuth });
    
    if (options?.clearAuth) {
      // Attempt to deauthorize (best effort - not all wallets support this)
      try {
        await transact(async (wallet: Web3MobileWallet) => {
          // MWA doesn't have explicit deauthorize, but we can try to clear by
          // not storing the auth token. The wallet will require new authorization next time.
          console.log('[wallet][disconnect] Clearing session (no explicit deauthorize in MWA)');
        });
      } catch (e) {
        // Ignore errors - deauthorize is best effort
        console.log('[wallet][disconnect] Deauthorize attempt completed (may not be supported)');
      }
    }
    
    setDisconnected();
    console.log('[wallet][disconnect] DONE', { sessionId });
  }, [setDisconnected]);
  
  // Force reconnect - disconnect then immediately connect
  const reconnect = useCallback(async () => {
    console.log('[wallet][reconnect] START');
    await disconnect({ clearAuth: true });
    // Small delay to ensure state is cleared
    await new Promise(r => setTimeout(r, 100));
    await connect();
  }, [disconnect, connect]);
  
  return { connect, disconnect, reconnect };
};
