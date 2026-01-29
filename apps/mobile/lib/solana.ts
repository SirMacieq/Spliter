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
  getSolanaNetwork,
  getCurrentUsdcMint, 
  getExplorerBaseUrl,
  USDC_DECIMALS,
  APP_NAME,
  MIN_SOL_FOR_FEES,
  TX_CONFIRMATION_TIMEOUT,
} from './constants';

const APP_IDENTITY = {
  name: APP_NAME,
  uri: 'https://spliter.app',
  icon: 'favicon.ico',
};

// Get Solana connection
export const getConnection = (): Connection => {
  return new Connection(getSolanaRpcUrl(), 'confirmed');
};

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
  const connection = getConnection();
  const balance = await connection.getBalance(new PublicKey(publicKey));
  return balance / LAMPORTS_PER_SOL;
};

// Get USDC balance
export const getUsdcBalance = async (publicKey: string): Promise<number> => {
  try {
    const connection = getConnection();
    const usdcMint = new PublicKey(getCurrentUsdcMint());
    const owner = new PublicKey(publicKey);
    
    const ata = await getAssociatedTokenAddress(usdcMint, owner);
    const account = await getAccount(connection, ata);
    
    return Number(account.amount) / Math.pow(10, USDC_DECIMALS);
  } catch (error) {
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
      cluster: getSolanaNetwork(),
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
      cluster: getSolanaNetwork(),
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
  const cluster = getSolanaNetwork() === 'devnet' ? '?cluster=devnet' : '';
  return `${baseUrl}/tx/${signature}${cluster}`;
};

// Get explorer URL for account
export const getAccountExplorerUrl = (address: string): string => {
  const baseUrl = getExplorerBaseUrl();
  const cluster = getSolanaNetwork() === 'devnet' ? '?cluster=devnet' : '';
  return `${baseUrl}/account/${address}${cluster}`;
};

// Check if user has enough SOL for fees
export const hasEnoughSolForFees = async (publicKey: string): Promise<boolean> => {
  const balance = await getSolBalance(publicKey);
  return balance >= MIN_SOL_FOR_FEES;
};

// Detect error type from MWA/Solana errors
export const categorizeError = (error: any): { type: 'rejected' | 'network' | 'fee' | 'balance' | 'timeout' | 'general'; message: string } => {
  const message = error?.message || String(error);
  
  if (message.includes('User rejected') || message.includes('cancelled') || message.includes('declined')) {
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
