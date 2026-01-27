import { PublicKey } from '@solana/web3.js';

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
}

export interface Balance {
  from: string; // Who owes
  to: string; // Who is owed
  amount: number; // USDC
}

// Wallet connection state
export type WalletState = 
  | { status: 'disconnected' }
  | { status: 'connecting' }
  | { status: 'connected'; publicKey: string; }
  | { status: 'error'; error: string };
