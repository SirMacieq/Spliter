// ============================================
// Core Types for Spliter
// ============================================

export interface Member {
  wallet: string; // Base58 encoded public key
  nickname?: string;
  addedAt: number; // Unix timestamp
}

export interface Group {
  id: string;
  name: string;
  createdBy: string; // Wallet address
  createdAt: number;
  members: Member[];
}

export interface Expense {
  id: string;
  groupId: string;
  amount: number; // USDC amount (human readable, e.g., 25.50)
  description: string;
  paidBy: string; // Wallet address of payer
  splitBetween: string[]; // Wallet addresses
  createdAt: number;
}

export interface Settlement {
  id: string;
  groupId: string;
  from: string; // Wallet address
  to: string; // Wallet address
  amount: number;
  currency: 'USDC' | 'SOL';
  txSignature: string;
  settledAt: number;
  status: TxStatus; // Added for tracking
}

export interface Balance {
  from: string; // Who owes
  to: string; // Who is owed
  amount: number; // USDC
}

// Transaction status tracking
export type TxStatus = 'pending' | 'confirmed' | 'failed';

export interface TxHistoryEntry {
  id: string;
  signature: string;
  from: string;
  to: string;
  amount: number;
  currency: 'USDC' | 'SOL';
  status: TxStatus;
  createdAt: number;
  confirmedAt?: number;
  error?: string;
  groupId?: string;
}

// Wallet connection state - now includes 'booting'
export type WalletStatus = 'booting' | 'disconnected' | 'connecting' | 'connected' | 'error';

export type WalletState = 
  | { status: 'booting' }
  | { status: 'disconnected' }
  | { status: 'connecting' }
  | { status: 'connected'; publicKey: string }
  | { status: 'error'; error: string };

// App settings (persisted)
export interface AppSettings {
  network: 'mainnet-beta' | 'devnet';
  lastConnectedWallet?: string;
}

// Settlement flow state
export type SettleStatus = 
  | 'idle' 
  | 'loading-balance' 
  | 'confirming' 
  | 'signing' 
  | 'pending'      // tx sent, waiting confirmation
  | 'checking'     // re-checking existing tx
  | 'success' 
  | 'error';

export type SettleErrorType = 'fee' | 'balance' | 'network' | 'rejected' | 'timeout' | 'general';
