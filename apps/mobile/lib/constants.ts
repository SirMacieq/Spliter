// ============================================
// App Constants
// ============================================

export const APP_NAME = 'Spliter';
export const APP_VERSION = '1.0.0';

// Solana Network Configuration
export type SolanaNetwork = 'mainnet-beta' | 'devnet';

// Network config - can be toggled in settings
// Default to devnet for safety during development
let currentNetwork: SolanaNetwork = 'devnet';

export const NETWORK_CONFIG = {
  'mainnet-beta': {
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    usdcMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    explorerUrl: 'https://solscan.io',
    faucetUrl: null,
    name: 'Mainnet',
  },
  'devnet': {
    rpcUrl: 'https://api.devnet.solana.com',
    usdcMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    explorerUrl: 'https://solscan.io',
    faucetUrl: 'https://faucet.solana.com',
    name: 'Devnet',
  },
} as const;

// Getters for current network config
export const getSolanaNetwork = (): SolanaNetwork => currentNetwork;
export const setSolanaNetwork = (network: SolanaNetwork) => { currentNetwork = network; };

export const getNetworkConfig = () => NETWORK_CONFIG[currentNetwork];
export const getSolanaRpcUrl = () => getNetworkConfig().rpcUrl;
export const getCurrentUsdcMint = () => getNetworkConfig().usdcMint;
export const getExplorerBaseUrl = () => getNetworkConfig().explorerUrl;
export const getFaucetUrl = () => getNetworkConfig().faucetUrl;
export const getNetworkName = () => getNetworkConfig().name;

// Legacy exports for compatibility
export const SOLANA_NETWORK = currentNetwork;
export const SOLANA_RPC_URL = getSolanaRpcUrl();

export const USDC_DECIMALS = 6;

// Minimum SOL required for fees (with buffer)
export const MIN_SOL_FOR_FEES = 0.005;

// Transaction timeout (30 seconds)
export const TX_CONFIRMATION_TIMEOUT = 30000;

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
  TX_HISTORY: 'spliter_tx_history',
  WALLET: 'spliter_wallet',
  APP_HYDRATED: 'spliter_hydrated',
} as const;
