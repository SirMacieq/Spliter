// ============================================
// App Constants
// ============================================

export const APP_NAME = 'Spliter';
export const APP_VERSION = '1.0.0';

// Solana Network
export const SOLANA_NETWORK = process.env.EXPO_PUBLIC_SOLANA_NETWORK || 'mainnet-beta';
export const SOLANA_RPC_URL = process.env.EXPO_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

// USDC Mint Addresses
export const USDC_MINT = {
  'mainnet-beta': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'devnet': '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  'testnet': '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
} as const;

export const USDC_DECIMALS = 6;

// Get current USDC mint based on network
export const getCurrentUsdcMint = (): string => {
  return USDC_MINT[SOLANA_NETWORK as keyof typeof USDC_MINT] || USDC_MINT['mainnet-beta'];
};

// Colors
export const COLORS = {
  primary: '#9945FF', // Solana purple
  secondary: '#14F195', // Solana green
  background: '#0D0D0D',
  surface: '#1A1A2E',
  surfaceLight: '#252542',
  text: '#FFFFFF',
  textSecondary: '#A0A0A0',
  error: '#FF4444',
  success: '#14F195',
  warning: '#FFB800',
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  GROUPS: 'spliter_groups',
  EXPENSES: 'spliter_expenses',
  SETTLEMENTS: 'spliter_settlements',
  SETTINGS: 'spliter_settings',
} as const;
