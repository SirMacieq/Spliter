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
