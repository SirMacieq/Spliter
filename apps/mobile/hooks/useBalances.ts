import { useState, useEffect, useCallback } from 'react';
import { getSolBalance, getUsdcBalance } from '../lib/solana';
import { useWalletPublicKey } from '../stores/walletStore';

interface Balances {
  sol: number | null;
  usdc: number | null;
}

export const useBalances = (autoRefresh: boolean = true) => {
  const publicKey = useWalletPublicKey();
  const [balances, setBalances] = useState<Balances>({ sol: null, usdc: null });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const refresh = useCallback(async () => {
    if (!publicKey) {
      setBalances({ sol: null, usdc: null });
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const [sol, usdc] = await Promise.all([
        getSolBalance(publicKey),
        getUsdcBalance(publicKey),
      ]);
      setBalances({ sol, usdc });
    } catch (err) {
      console.error('Failed to fetch balances:', err);
      setError('Failed to fetch balances');
    } finally {
      setIsLoading(false);
    }
  }, [publicKey]);
  
  useEffect(() => {
    if (autoRefresh) {
      refresh();
    }
  }, [autoRefresh, refresh]);
  
  return {
    ...balances,
    isLoading,
    error,
    refresh,
  };
};
