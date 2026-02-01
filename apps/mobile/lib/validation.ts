import { PublicKey } from '@solana/web3.js';

/**
 * Validate a Solana wallet address
 */
export const isValidSolanaAddress = (address: string): boolean => {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate expense amount
 */
export const isValidAmount = (amount: string | number): boolean => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return !isNaN(num) && num > 0 && num < 1000000; // Max 1M USDC
};

/**
 * Parse amount string to number
 */
export const parseAmount = (amount: string): number => {
  const num = parseFloat(amount);
  return isNaN(num) ? 0 : num;
};

/**
 * Format amount for display
 */
export const formatAmount = (amount: number, decimals: number = 2): string => {
  return amount.toFixed(decimals);
};

/**
 * Format USDC amount
 */
export const formatUsdc = (amount: number): string => {
  return `$${formatAmount(amount, 2)}`;
};

/**
 * Format SOL amount
 */
export const formatSol = (amount: number): string => {
  return `${formatAmount(amount, 4)} SOL`;
};

/**
 * Shorten wallet address for display
 */
export const shortenAddress = (address: string, chars: number = 4): string => {
  if (!address) return '';
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};

/**
 * Validate group name
 */
export const isValidGroupName = (name: string): boolean => {
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= 50;
};

/**
 * Validate expense description
 */
export const isValidDescription = (description: string): boolean => {
  const trimmed = description.trim();
  return trimmed.length >= 1 && trimmed.length <= 200;
};

/**
 * Check if two addresses are the same (case-insensitive for safety)
 */
export const isSameAddress = (a: string, b: string): boolean => {
  try {
    return new PublicKey(a).equals(new PublicKey(b));
  } catch {
    return a === b;
  }
};

// ============================================
// Pay Link Validation
// ============================================

export type PayLinkCurrency = 'SOL' | 'USDC';

export interface PayLinkParams {
  to: string;
  amount: number;
  currency: PayLinkCurrency;
  groupId?: string;
  note?: string;
}

export interface PayLinkValidationResult {
  valid: boolean;
  params?: PayLinkParams;
  error?: string;
}

/**
 * Validate and parse pay link query params
 */
export const validatePayLinkParams = (params: {
  to?: string;
  amount?: string;
  currency?: string;
  groupId?: string;
  note?: string;
}): PayLinkValidationResult => {
  // Required: to (base58 pubkey)
  if (!params.to) {
    return { valid: false, error: 'Missing recipient address' };
  }
  if (!isValidSolanaAddress(params.to)) {
    return { valid: false, error: 'Invalid recipient address' };
  }

  // Required: amount (positive decimal)
  if (!params.amount) {
    return { valid: false, error: 'Missing payment amount' };
  }
  const amount = parseFloat(params.amount);
  if (isNaN(amount) || amount <= 0) {
    return { valid: false, error: 'Invalid payment amount' };
  }
  if (amount > 1000000) {
    return { valid: false, error: 'Amount exceeds maximum (1,000,000)' };
  }

  // Required: currency (SOL|USDC)
  if (!params.currency) {
    return { valid: false, error: 'Missing currency type' };
  }
  const currencyUpper = params.currency.toUpperCase();
  if (currencyUpper !== 'SOL' && currencyUpper !== 'USDC') {
    return { valid: false, error: 'Invalid currency (must be SOL or USDC)' };
  }

  // Optional: note (max 140 chars)
  let note = params.note;
  if (note && note.length > 140) {
    note = note.slice(0, 140);
  }

  return {
    valid: true,
    params: {
      to: params.to,
      amount,
      currency: currencyUpper as PayLinkCurrency,
      groupId: params.groupId,
      note,
    },
  };
};

/**
 * Generate a pay link URL
 */
export const generatePayLink = (params: PayLinkParams): string => {
  const base = 'spliter://pay';
  const searchParams = new URLSearchParams();
  
  searchParams.set('to', params.to);
  searchParams.set('amount', params.amount.toString());
  searchParams.set('currency', params.currency);
  
  if (params.groupId) {
    searchParams.set('groupId', params.groupId);
  }
  if (params.note) {
    searchParams.set('note', params.note);
  }
  
  return `${base}?${searchParams.toString()}`;
};
