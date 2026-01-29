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
