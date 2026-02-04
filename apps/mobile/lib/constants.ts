// ============================================
// App Constants
// ============================================

export const APP_NAME = 'Spliter';
export const APP_VERSION = '1.0.0';

// ============================================
// NETWORK CONFIGURATION - SINGLE SOURCE OF TRUTH
// ============================================

export type SolanaNetwork = 'mainnet-beta' | 'devnet';

/**
 * APP_NETWORK: The ONLY network this build uses.
 * 
 * This is determined at build time from env and NEVER changes at runtime.
 * All MWA authorize calls and RPC calls MUST use this value.
 * 
 * To build for devnet: set EXPO_PUBLIC_SOLANA_NETWORK=devnet in .env
 * Default: mainnet-beta (safe for production)
 */
const ENV_NETWORK = process.env.EXPO_PUBLIC_SOLANA_NETWORK;
export const APP_NETWORK: SolanaNetwork = 
  ENV_NETWORK === 'devnet' ? 'devnet' : 'mainnet-beta';

// Log once at module load - this should NEVER change after this
console.log('[constants] APP_NETWORK (immutable):', APP_NETWORK, '| env:', ENV_NETWORK);

// ============================================
// Network Configuration
// ============================================

export const NETWORK_CONFIG = {
  'mainnet-beta': {
    rpcUrl: process.env.EXPO_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    usdcMint: process.env.EXPO_PUBLIC_USDC_MINT || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    explorerUrl: 'https://solscan.io',
    faucetUrl: null,
    name: 'Mainnet',
  },
  'devnet': {
    rpcUrl: process.env.EXPO_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    usdcMint: process.env.EXPO_PUBLIC_USDC_MINT || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    explorerUrl: 'https://solscan.io',
    faucetUrl: 'https://faucet.solana.com',
    name: 'Devnet',
  },
} as const;

// ============================================
// Network Getters - ALL use APP_NETWORK
// ============================================

/**
 * Get the app's network. ALWAYS returns APP_NETWORK.
 * This is the ONLY function that should be used for network selection.
 */
export const getAppNetwork = (): SolanaNetwork => APP_NETWORK;

/**
 * @deprecated Use getAppNetwork() instead. This exists for backwards compatibility.
 */
export const getSolanaNetwork = (): SolanaNetwork => APP_NETWORK;

/**
 * Get network config for APP_NETWORK.
 */
export const getNetworkConfig = () => NETWORK_CONFIG[APP_NETWORK];

/**
 * Get RPC URL for APP_NETWORK.
 * Prefers explicit env RPC URL over network default.
 */
export const getSolanaRpcUrl = (): string => {
  const envRpc = process.env.EXPO_PUBLIC_SOLANA_RPC_URL;
  if (envRpc && envRpc.startsWith('http')) {
    return envRpc;
  }
  return getNetworkConfig().rpcUrl;
};

export const getCurrentUsdcMint = () => getNetworkConfig().usdcMint;
export const getExplorerBaseUrl = () => getNetworkConfig().explorerUrl;
export const getFaucetUrl = () => getNetworkConfig().faucetUrl;
export const getNetworkName = () => getNetworkConfig().name;

// ============================================
// DEPRECATED - Network mutation is disabled
// ============================================

/**
 * @deprecated Network switching is DISABLED in this build.
 * The app uses APP_NETWORK exclusively.
 * This function logs a warning and does nothing.
 */
export const setSolanaNetwork = (network: SolanaNetwork) => {
  console.warn('[constants] setSolanaNetwork() called but IGNORED - app is locked to:', APP_NETWORK, '| attempted:', network);
  // DO NOT CHANGE currentNetwork - it's locked to APP_NETWORK
};

// Legacy export for compatibility - always returns APP_NETWORK
export const SOLANA_NETWORK = APP_NETWORK;

// ============================================
// Other Constants
// ============================================

export const USDC_DECIMALS = 6;

// Minimum SOL required for fees (with buffer)
export const MIN_SOL_FOR_FEES = 0.005;

// Transaction timeout (30 seconds)
export const TX_CONFIRMATION_TIMEOUT = 30000;

// ============================================
// Fee Configuration (Pay Link)
// ============================================
export const FEE_BPS = parseInt(process.env.EXPO_PUBLIC_FEE_BPS || '250', 10); // 2.5% default
export const FEE_WALLET = process.env.EXPO_PUBLIC_FEE_WALLET || '';
export const FEE_PERCENT = FEE_BPS / 100; // For display (e.g., 2.5)

// Fee calculation helpers
export const calculateFee = (amount: number): number => {
  return (amount * FEE_BPS) / 10000;
};

export const isFeeConfigured = (): boolean => {
  return !!FEE_WALLET && FEE_WALLET.length >= 32;
};

// NFT Fee Configuration (flat SOL fee per NFT)
export const NFT_FEE_SOL = parseFloat(process.env.EXPO_PUBLIC_NFT_FEE_SOL || '0.002');

// Deep link scheme
export const APP_SCHEME = 'spliter';

// Colors
export const COLORS = {
  primary: '#9945FF', // Solana purple
  primaryMuted: '#9945FF40',
  secondary: '#14F195', // Solana green
  background: '#0D0D0D',
  surface: '#1A1A2E',
  surfaceLight: '#252542',
  border: '#2A2A4A',
  text: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textMuted: '#6B6B8A',
  error: '#FF6B6B',
  errorMuted: '#FF6B6B20',
  success: '#14F195',
  successMuted: '#14F19520',
  warning: '#FFB800',
  warningMuted: '#FFB80020',
} as const;

// Spacing scale (4px base)
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
} as const;

// Typography
export const TYPOGRAPHY = {
  h1: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
  h2: { fontSize: 22, fontWeight: '600' as const, lineHeight: 28 },
  h3: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 22 },
  bodyMedium: { fontSize: 16, fontWeight: '500' as const, lineHeight: 22 },
  small: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  smallMedium: { fontSize: 14, fontWeight: '500' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  captionMedium: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
} as const;

// Border radius
export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
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
  BATCH_DRAFT: 'spliter_batch_draft',
} as const;
