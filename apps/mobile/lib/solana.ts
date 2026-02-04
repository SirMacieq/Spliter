import { 
  Connection, 
  PublicKey, 
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionConfirmationStatus,
} from '@solana/web3.js';
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token';
import { 
  transact, 
  Web3MobileWallet 
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { 
  getSolanaRpcUrl,
  APP_NETWORK,
  getCurrentUsdcMint, 
  getExplorerBaseUrl,
  USDC_DECIMALS,
  APP_NAME,
  MIN_SOL_FOR_FEES,
  TX_CONFIRMATION_TIMEOUT,
  FEE_WALLET,
  calculateFee,
  isFeeConfigured,
  NFT_FEE_SOL,
} from './constants';
import {
  executeRpc,
  getBlockhashWithRetry,
  checkRpcHealth,
  RpcError,
  getRpcErrorMessage,
} from './rpc';

const APP_IDENTITY = {
  name: APP_NAME,
  uri: 'https://spliter.app',
  icon: 'favicon.ico',
};

// Re-export RPC utilities for use in components
export { checkRpcHealth, RpcError, getRpcErrorMessage };

// Get Solana connection (basic, for simple operations)
export const getConnection = (): Connection => {
  return new Connection(getSolanaRpcUrl(), 'confirmed');
};

// ===== Robust RPC wrapper =====
// Uses the new rpc.ts layer with retry/fallback/timeout
async function withRpcFallback<T>(
  fn: (connection: Connection, rpcUrl: string) => Promise<T>
): Promise<T> {
  const result = await executeRpc(
    'RPC operation',
    (conn) => fn(conn, ''),  // rpcUrl not needed in callback
    { timeout: 10000, maxRetries: 2 }
  );
  return result.data;
}

// Convert USDC amount to lamports (6 decimals)
export const usdcToLamports = (amount: number): bigint => {
  return BigInt(Math.round(amount * Math.pow(10, USDC_DECIMALS)));
};

// Convert SOL amount to lamports
export const solToLamports = (amount: number): number => {
  return Math.round(amount * LAMPORTS_PER_SOL);
};

// Get SOL balance
export const getSolBalance = async (publicKey: string): Promise<number> => {
  return withRpcFallback(async (connection) => {
    const balance = await connection.getBalance(new PublicKey(publicKey));
    return balance / LAMPORTS_PER_SOL;
  });
};

// Get USDC balance
export const getUsdcBalance = async (publicKey: string): Promise<number> => {
  try {
    return await withRpcFallback(async (connection) => {
      const usdcMint = new PublicKey(getCurrentUsdcMint());
      const owner = new PublicKey(publicKey);

      const ata = await getAssociatedTokenAddress(usdcMint, owner);
      const account = await getAccount(connection, ata);

      return Number(account.amount) / Math.pow(10, USDC_DECIMALS);
    });
  } catch {
    return 0;
  }
};

// Check transaction status
export type TxConfirmationResult = {
  status: 'confirmed' | 'pending' | 'failed' | 'not_found';
  error?: string;
};

export const checkTransactionStatus = async (signature: string): Promise<TxConfirmationResult> => {
  try {
    const connection = getConnection();
    const result = await connection.getSignatureStatus(signature, {
      searchTransactionHistory: true,
    });
    
    if (!result.value) {
      return { status: 'not_found' };
    }
    
    if (result.value.err) {
      return { status: 'failed', error: JSON.stringify(result.value.err) };
    }
    
    const confirmationStatus = result.value.confirmationStatus;
    if (confirmationStatus === 'confirmed' || confirmationStatus === 'finalized') {
      return { status: 'confirmed' };
    }
    
    return { status: 'pending' };
  } catch (error: any) {
    return { status: 'pending', error: error.message };
  }
};

// Wait for confirmation with timeout
export const waitForConfirmation = async (
  signature: string,
  timeoutMs: number = TX_CONFIRMATION_TIMEOUT
): Promise<TxConfirmationResult> => {
  const connection = getConnection();
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const result = await checkTransactionStatus(signature);
    
    if (result.status === 'confirmed' || result.status === 'failed') {
      return result;
    }
    
    // Wait 2 seconds between checks
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  return { status: 'pending', error: 'Confirmation timeout' };
};

// Send USDC transfer (returns signature immediately, doesn't wait for confirmation)
export const sendUsdcTransfer = async (
  fromWallet: string,
  toWallet: string,
  amount: number
): Promise<string> => {
  const connection = getConnection();
  const usdcMint = new PublicKey(getCurrentUsdcMint());
  const fromPubkey = new PublicKey(fromWallet);
  const toPubkey = new PublicKey(toWallet);
  
  const fromAta = await getAssociatedTokenAddress(usdcMint, fromPubkey);
  const toAta = await getAssociatedTokenAddress(usdcMint, toPubkey);
  
  // Check if destination ATA exists
  let createAtaIx: ReturnType<typeof createAssociatedTokenAccountInstruction> | null = null;
  try {
    await getAccount(connection, toAta);
  } catch {
    createAtaIx = createAssociatedTokenAccountInstruction(
      fromPubkey,
      toAta,
      toPubkey,
      usdcMint
    );
  }
  
  const transferIx = createTransferInstruction(
    fromAta,
    toAta,
    fromPubkey,
    usdcToLamports(amount),
    [],
    TOKEN_PROGRAM_ID
  );
  
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const transaction = new Transaction({
    feePayer: fromPubkey,
    blockhash,
    lastValidBlockHeight,
  });
  
  if (createAtaIx) {
    transaction.add(createAtaIx);
  }
  transaction.add(transferIx);
  
  // Sign and send via MWA
  const signature = await transact(async (wallet: Web3MobileWallet) => {
    await wallet.authorize({
      cluster: APP_NETWORK,
      identity: APP_IDENTITY,
    });
    
    const signedTxs = await wallet.signAndSendTransactions({
      transactions: [transaction],
    });
    
    return signedTxs[0];
  });
  
  return signature;
};

// Send SOL transfer (returns signature immediately, doesn't wait for confirmation)
export const sendSolTransfer = async (
  fromWallet: string,
  toWallet: string,
  amount: number
): Promise<string> => {
  const connection = getConnection();
  const fromPubkey = new PublicKey(fromWallet);
  const toPubkey = new PublicKey(toWallet);
  
  const transferIx = SystemProgram.transfer({
    fromPubkey,
    toPubkey,
    lamports: solToLamports(amount),
  });
  
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const transaction = new Transaction({
    feePayer: fromPubkey,
    blockhash,
    lastValidBlockHeight,
  });
  
  transaction.add(transferIx);
  
  const signature = await transact(async (wallet: Web3MobileWallet) => {
    await wallet.authorize({
      cluster: APP_NETWORK,
      identity: APP_IDENTITY,
    });
    
    const signedTxs = await wallet.signAndSendTransactions({
      transactions: [transaction],
    });
    
    return signedTxs[0];
  });
  
  return signature;
};

// Legacy functions (with confirmation) for backwards compatibility
export const transferUsdc = async (
  fromWallet: string,
  toWallet: string,
  amount: number
): Promise<string> => {
  const signature = await sendUsdcTransfer(fromWallet, toWallet, amount);
  const result = await waitForConfirmation(signature);
  
  if (result.status === 'failed') {
    throw new Error(result.error || 'Transaction failed');
  }
  
  return signature;
};

export const transferSol = async (
  fromWallet: string,
  toWallet: string,
  amount: number
): Promise<string> => {
  const signature = await sendSolTransfer(fromWallet, toWallet, amount);
  const result = await waitForConfirmation(signature);
  
  if (result.status === 'failed') {
    throw new Error(result.error || 'Transaction failed');
  }
  
  return signature;
};

// Get explorer URL for transaction
export const getExplorerUrl = (signature: string): string => {
  const baseUrl = getExplorerBaseUrl();
  const cluster = APP_NETWORK === 'devnet' ? '?cluster=devnet' : '';
  return `${baseUrl}/tx/${signature}${cluster}`;
};

// Get explorer URL for account
export const getAccountExplorerUrl = (address: string): string => {
  const baseUrl = getExplorerBaseUrl();
  const cluster = APP_NETWORK === 'devnet' ? '?cluster=devnet' : '';
  return `${baseUrl}/account/${address}${cluster}`;
};

// Check if user has enough SOL for fees
export const hasEnoughSolForFees = async (publicKey: string): Promise<boolean> => {
  const balance = await getSolBalance(publicKey);
  return balance >= MIN_SOL_FOR_FEES;
};

// ============================================
// Fee-aware transfers (for Pay Link flow)
// ============================================

// Send SOL transfer WITH fee (two transfers in one transaction)
export const sendSolTransferWithFee = async (
  fromWallet: string,
  toWallet: string,
  recipientAmount: number, // Amount recipient receives
  feeAmount: number,       // Fee amount
): Promise<string> => {
  if (!isFeeConfigured()) {
    throw new Error('Fee wallet not configured');
  }

  // Get blockhash with robust retry/fallback
  const { blockhash } = await getBlockhashWithRetry();
  
  const fromPubkey = new PublicKey(fromWallet);
  const toPubkey = new PublicKey(toWallet);
  const feePubkey = new PublicKey(FEE_WALLET);
  
  // Transfer to recipient
  const transferToRecipient = SystemProgram.transfer({
    fromPubkey,
    toPubkey,
    lamports: solToLamports(recipientAmount),
  });
  
  // Transfer fee to fee wallet
  const transferFee = SystemProgram.transfer({
    fromPubkey,
    toPubkey: feePubkey,
    lamports: solToLamports(feeAmount),
  });
  
  const transaction = new Transaction({
    feePayer: fromPubkey,
    blockhash: blockhash.blockhash,
    lastValidBlockHeight: blockhash.lastValidBlockHeight,
  });
  
  transaction.add(transferToRecipient);
  transaction.add(transferFee);
  
  const signature = await transact(async (wallet: Web3MobileWallet) => {
    await wallet.authorize({
      cluster: APP_NETWORK,
      identity: APP_IDENTITY,
    });
    
    const signedTxs = await wallet.signAndSendTransactions({
      transactions: [transaction],
    });
    
    return signedTxs[0];
  });
  
  return signature;
};

// Send USDC transfer WITH fee (two token transfers in one transaction)
export const sendUsdcTransferWithFee = async (
  fromWallet: string,
  toWallet: string,
  recipientAmount: number, // Amount recipient receives
  feeAmount: number,       // Fee amount
): Promise<string> => {
  if (!isFeeConfigured()) {
    throw new Error('Fee wallet not configured');
  }

  // Get blockhash with robust retry/fallback FIRST
  const { blockhash, rpcUrl } = await getBlockhashWithRetry();
  
  // Use the same RPC that gave us blockhash for ATA checks
  const connection = new Connection(rpcUrl, 'confirmed');
  const usdcMint = new PublicKey(getCurrentUsdcMint());
  const fromPubkey = new PublicKey(fromWallet);
  const toPubkey = new PublicKey(toWallet);
  const feePubkey = new PublicKey(FEE_WALLET);
  
  const fromAta = await getAssociatedTokenAddress(usdcMint, fromPubkey);
  const toAta = await getAssociatedTokenAddress(usdcMint, toPubkey);
  const feeAta = await getAssociatedTokenAddress(usdcMint, feePubkey);
  
  const transaction = new Transaction({
    feePayer: fromPubkey,
    blockhash: blockhash.blockhash,
    lastValidBlockHeight: blockhash.lastValidBlockHeight,
  });
  
  // Check if recipient ATA exists, create if needed
  try {
    await getAccount(connection, toAta);
  } catch {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        fromPubkey,
        toAta,
        toPubkey,
        usdcMint
      )
    );
  }
  
  // Check if fee wallet ATA exists, create if needed
  try {
    await getAccount(connection, feeAta);
  } catch {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        fromPubkey,
        feeAta,
        feePubkey,
        usdcMint
      )
    );
  }
  
  // Transfer to recipient
  transaction.add(
    createTransferInstruction(
      fromAta,
      toAta,
      fromPubkey,
      usdcToLamports(recipientAmount),
      [],
      TOKEN_PROGRAM_ID
    )
  );
  
  // Transfer fee
  transaction.add(
    createTransferInstruction(
      fromAta,
      feeAta,
      fromPubkey,
      usdcToLamports(feeAmount),
      [],
      TOKEN_PROGRAM_ID
    )
  );
  
  const signature = await transact(async (wallet: Web3MobileWallet) => {
    await wallet.authorize({
      cluster: APP_NETWORK,
      identity: APP_IDENTITY,
    });
    
    const signedTxs = await wallet.signAndSendTransactions({
      transactions: [transaction],
    });
    
    return signedTxs[0];
  });
  
  return signature;
};

// ============================================
// Generic SPL Token transfer with fee (for batch payouts)
// ============================================

// Get token decimals
export const getTokenDecimals = async (mintAddress: string): Promise<number> => {
  // USDC shortcut
  if (mintAddress === getCurrentUsdcMint()) {
    return USDC_DECIMALS;
  }
  
  try {
    const connection = getConnection();
    const mintInfo = await connection.getParsedAccountInfo(new PublicKey(mintAddress));
    const data = mintInfo.value?.data;
    if (data && typeof data === 'object' && 'parsed' in data) {
      return data.parsed?.info?.decimals ?? 9;
    }
    return 9; // Default
  } catch {
    return 9;
  }
};

// Convert token amount to smallest unit
export const tokenToSmallestUnit = (amount: number, decimals: number): bigint => {
  return BigInt(Math.round(amount * Math.pow(10, decimals)));
};

// Get token balance
export const getTokenBalance = async (publicKey: string, mintAddress: string): Promise<number> => {
  try {
    return await withRpcFallback(async (connection) => {
      const mint = new PublicKey(mintAddress);
      const owner = new PublicKey(publicKey);
      const ata = await getAssociatedTokenAddress(mint, owner);
      const account = await getAccount(connection, ata);
      const decimals = await getTokenDecimals(mintAddress);
      return Number(account.amount) / Math.pow(10, decimals);
    });
  } catch {
    return 0;
  }
};

// Send generic SPL token transfer WITH fee
export const sendSplTokenTransferWithFee = async (
  fromWallet: string,
  toWallet: string,
  mintAddress: string,
  recipientAmount: number,
  feeAmount: number,
  decimals: number,
): Promise<string> => {
  if (!isFeeConfigured()) {
    throw new Error('Fee wallet not configured');
  }

  const connection = getConnection();
  const mint = new PublicKey(mintAddress);
  const fromPubkey = new PublicKey(fromWallet);
  const toPubkey = new PublicKey(toWallet);
  const feePubkey = new PublicKey(FEE_WALLET);
  
  const fromAta = await getAssociatedTokenAddress(mint, fromPubkey);
  const toAta = await getAssociatedTokenAddress(mint, toPubkey);
  const feeAta = await getAssociatedTokenAddress(mint, feePubkey);
  
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const transaction = new Transaction({
    feePayer: fromPubkey,
    blockhash,
    lastValidBlockHeight,
  });
  
  // Check if recipient ATA exists, create if needed
  try {
    await getAccount(connection, toAta);
  } catch {
    transaction.add(
      createAssociatedTokenAccountInstruction(fromPubkey, toAta, toPubkey, mint)
    );
  }
  
  // Check if fee wallet ATA exists, create if needed
  try {
    await getAccount(connection, feeAta);
  } catch {
    transaction.add(
      createAssociatedTokenAccountInstruction(fromPubkey, feeAta, feePubkey, mint)
    );
  }
  
  // Transfer to recipient
  transaction.add(
    createTransferInstruction(
      fromAta,
      toAta,
      fromPubkey,
      tokenToSmallestUnit(recipientAmount, decimals),
      [],
      TOKEN_PROGRAM_ID
    )
  );
  
  // Transfer fee
  transaction.add(
    createTransferInstruction(
      fromAta,
      feeAta,
      fromPubkey,
      tokenToSmallestUnit(feeAmount, decimals),
      [],
      TOKEN_PROGRAM_ID
    )
  );
  
  const signature = await transact(async (wallet: Web3MobileWallet) => {
    await wallet.authorize({
      cluster: APP_NETWORK,
      identity: APP_IDENTITY,
    });
    
    const signedTxs = await wallet.signAndSendTransactions({
      transactions: [transaction],
    });
    
    return signedTxs[0];
  });
  
  return signature;
};

// ============================================
// NFT Transfer with SOL fee (for NFT batch)
// ============================================

// Send NFT transfer with flat SOL fee
export const sendNftTransferWithFee = async (
  fromWallet: string,
  toWallet: string,
  nftMint: string,
  feeSol: number = NFT_FEE_SOL,
): Promise<string> => {
  if (!isFeeConfigured()) {
    throw new Error('Fee wallet not configured');
  }

  const connection = getConnection();
  const mint = new PublicKey(nftMint);
  const fromPubkey = new PublicKey(fromWallet);
  const toPubkey = new PublicKey(toWallet);
  const feePubkey = new PublicKey(FEE_WALLET);
  
  const fromAta = await getAssociatedTokenAddress(mint, fromPubkey);
  const toAta = await getAssociatedTokenAddress(mint, toPubkey);
  
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const transaction = new Transaction({
    feePayer: fromPubkey,
    blockhash,
    lastValidBlockHeight,
  });
  
  // Check if recipient ATA exists, create if needed
  try {
    await getAccount(connection, toAta);
  } catch {
    transaction.add(
      createAssociatedTokenAccountInstruction(fromPubkey, toAta, toPubkey, mint)
    );
  }
  
  // Transfer NFT (amount = 1 for NFTs)
  transaction.add(
    createTransferInstruction(
      fromAta,
      toAta,
      fromPubkey,
      BigInt(1), // NFT amount is always 1
      [],
      TOKEN_PROGRAM_ID
    )
  );
  
  // Transfer SOL fee to fee wallet
  transaction.add(
    SystemProgram.transfer({
      fromPubkey,
      toPubkey: feePubkey,
      lamports: solToLamports(feeSol),
    })
  );
  
  const signature = await transact(async (wallet: Web3MobileWallet) => {
    await wallet.authorize({
      cluster: APP_NETWORK,
      identity: APP_IDENTITY,
    });
    
    const signedTxs = await wallet.signAndSendTransactions({
      transactions: [transaction],
    });
    
    return signedTxs[0];
  });
  
  return signature;
};

// Get NFT info (basic check if account exists and has supply=1)
export const getNftInfo = async (mintAddress: string): Promise<{ exists: boolean; name?: string }> => {
  try {
    const connection = getConnection();
    const mintInfo = await connection.getParsedAccountInfo(new PublicKey(mintAddress));
    const data = mintInfo.value?.data;
    
    if (data && typeof data === 'object' && 'parsed' in data) {
      const info = data.parsed?.info;
      // NFTs typically have supply of 1 and decimals of 0
      if (info?.supply === '1' && info?.decimals === 0) {
        return { exists: true };
      }
    }
    return { exists: false };
  } catch {
    return { exists: false };
  }
};

// Check if wallet owns an NFT
export const ownsNft = async (walletAddress: string, nftMint: string): Promise<boolean> => {
  try {
    const connection = getConnection();
    const mint = new PublicKey(nftMint);
    const owner = new PublicKey(walletAddress);
    const ata = await getAssociatedTokenAddress(mint, owner);
    const account = await getAccount(connection, ata);
    return Number(account.amount) === 1;
  } catch {
    return false;
  }
};

// Detect error type from MWA/Solana errors
export const categorizeError = (error: any): { type: 'rejected' | 'network' | 'fee' | 'balance' | 'timeout' | 'general'; message: string } => {
  const raw = String(error?.message ?? error ?? '');
  const full = `${error?.name ?? ''} ${raw}`;  
  const message = full;

  if (message.includes('CancellationException') || message.includes('User rejected') || message.toLowerCase().includes('reject') || message.includes('cancelled') || message.includes('declined')) {
    return { type: 'rejected', message: 'Transaction cancelled' };
  }
  
  if (message.includes('timeout') || message.includes('Timeout')) {
    return { type: 'timeout', message: 'Transaction confirmation timed out' };
  }
  
  if (message.includes('insufficient') || message.includes('Insufficient')) {
    if (message.toLowerCase().includes('sol') || message.includes('lamport')) {
      return { type: 'fee', message: 'Insufficient SOL for transaction fees' };
    }
    return { type: 'balance', message: 'Insufficient balance' };
  }
  
  if (message.includes('network') || message.includes('fetch') || message.includes('Network') || message.includes('ECONNREFUSED')) {
    return { type: 'network', message: 'Network error. Please check your connection.' };
  }
  
  if (message.includes('0x1') || message.includes('custom program error')) {
    return { type: 'fee', message: 'Transaction failed: insufficient funds for fees' };
  }
  
  return { type: 'general', message: message || 'Transaction failed' };
};
