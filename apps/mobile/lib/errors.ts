/**
 * Unified Error Handling for Spliter
 * 
 * Provides consistent error types and categorization
 * for user-facing error messages.
 */

import { APP_NETWORK } from './constants';

// ============================================
// Error Types
// ============================================

export type PaymentErrorType =
  | 'rpc_unavailable'      // All RPCs down
  | 'blockhash_failed'     // Couldn't get blockhash
  | 'insufficient_sol'     // Not enough SOL for fees
  | 'insufficient_balance' // Not enough USDC/SOL
  | 'wallet_rejected'      // User rejected in wallet
  | 'wallet_unavailable'   // Wallet app not responding
  | 'wallet_network_mismatch' // Wallet on wrong network (e.g., devnet vs mainnet)
  | 'timeout'              // Operation timed out
  | 'network'              // Network/connectivity issue
  | 'tx_failed'            // Transaction failed on-chain
  | 'unknown';             // Catch-all

export interface PaymentError {
  type: PaymentErrorType;
  message: string;
  recoverable: boolean;
  userAction?: string;
  /** For network mismatch: expected network */
  expectedNetwork?: string;
  /** For network mismatch: detected wallet network (if known) */
  walletNetwork?: string;
}

// ============================================
// Network Mismatch Detection
// ============================================

/**
 * Check if error is a timeout from wallet (not network mismatch)
 */
function isWalletTimeout(error: any): boolean {
  const message = String(error?.message ?? error ?? '').toLowerCase();
  return message.includes('timeoutexception') || 
         (message.includes('timeout') && message.includes('wallet'));
}

/**
 * Heuristics to detect if error might be caused by wallet network mismatch.
 * 
 * IMPORTANT: We now require STRONG evidence of mismatch, not just CancellationException.
 * CancellationException alone could just mean user dismissed the wallet.
 * 
 * Strong indicators:
 * - Account doesn't exist on this cluster (devnet account queried on mainnet)
 * - Simulation fails with specific account errors
 * - Blockhash from wrong chain
 */
function isLikelyNetworkMismatch(error: any): boolean {
  const message = String(error?.message ?? error ?? '').toLowerCase();
  
  // Timeout is NOT network mismatch
  if (isWalletTimeout(error)) {
    return false;
  }
  
  // Account doesn't exist on this cluster - STRONG indicator
  if (message.includes('account not found') || 
      message.includes('could not find account') ||
      message.includes('invalid account data')) {
    return true;
  }
  
  // Simulation with wrong accounts - STRONG indicator
  if (message.includes('simulation failed') && 
      (message.includes('account') || message.includes('owner'))) {
    return true;
  }
  
  // Blockhash issues could indicate wrong chain
  if (message.includes('blockhash not found') && 
      !message.includes('expired')) {
    return true;
  }
  
  // CancellationException ALONE is NOT enough - could be user dismissal
  // Only treat as mismatch if combined with network-related keywords
  if (message.includes('cancellationexception') && 
      (message.includes('network') || message.includes('cluster'))) {
    return true;
  }
  
  return false;
}

/**
 * Create a network mismatch error with helpful instructions
 */
export function createNetworkMismatchError(expectedNetwork: string, walletNetwork?: string): PaymentError {
  const networkName = expectedNetwork === 'mainnet-beta' ? 'Mainnet' : 'Devnet';
  const walletNetworkName = walletNetwork === 'devnet' ? 'Devnet' : 
                           walletNetwork === 'mainnet-beta' ? 'Mainnet' : 'a different network';
  
  return {
    type: 'wallet_network_mismatch',
    message: walletNetwork 
      ? `Your wallet is set to ${walletNetworkName}, but this app requires ${networkName}.`
      : `Please make sure your wallet is set to ${networkName}.`,
    recoverable: true,
    userAction: `Open your wallet app → Settings → Network → Select ${networkName}`,
    expectedNetwork,
    walletNetwork,
  };
}

// ============================================
// Error Classification
// ============================================

/**
 * Categorize any error into a PaymentError
 */
export function categorizePaymentError(error: any): PaymentError {
  const message = String(error?.message ?? error ?? '').toLowerCase();
  const expectedNetwork = APP_NETWORK;
  
  // Check for RpcError (from our rpc.ts)
  if (error?.name === 'RpcError') {
    return handleRpcError(error);
  }
  
  // Check for wallet timeout FIRST (before mismatch or cancelled)
  if (isWalletTimeout(error)) {
    return {
      type: 'wallet_unavailable',
      message: 'Wallet didn\'t respond in time',
      recoverable: true,
      userAction: 'Re-open your wallet app and try again',
    };
  }
  
  // Check for likely network mismatch (before generic cancelled check)
  if (isLikelyNetworkMismatch(error)) {
    return createNetworkMismatchError(expectedNetwork);
  }
  
  // CancellationException without network evidence = user dismissed
  if (message.includes('cancellationexception')) {
    return {
      type: 'wallet_rejected',
      message: 'Wallet request was dismissed',
      recoverable: true,
      userAction: 'Re-open wallet and approve the transaction',
    };
  }
  
  // Wallet rejected / cancelled
  if (message.includes('user rejected') || 
      message.includes('rejected by user') ||
      message.includes('user declined') ||
      message.includes('declined') ||
      message.includes('cancelled') ||
      message.includes('canceled')) {
    return {
      type: 'wallet_rejected',
      message: 'Transaction cancelled',
      recoverable: true,
      userAction: 'Tap "Pay Now" to try again',
    };
  }
  
  // Wallet unavailable
  if (message.includes('no wallet') || 
      message.includes('wallet not found') ||
      message.includes('session not connected') ||
      message.includes('no mwa session') ||
      message.includes('wallet session')) {
    return {
      type: 'wallet_unavailable',
      message: 'Wallet not responding',
      recoverable: true,
      userAction: 'Open your wallet app and try again',
    };
  }
  
  // Insufficient SOL for fees
  if (message.includes('insufficient funds for rent') ||
      message.includes('insufficient lamports') ||
      message.includes('not enough sol')) {
    return {
      type: 'insufficient_sol',
      message: 'Not enough SOL for network fees',
      recoverable: true,
      userAction: 'Add SOL to your wallet',
    };
  }
  
  // Insufficient balance
  if (message.includes('insufficient') && 
      (message.includes('balance') || message.includes('funds'))) {
    return {
      type: 'insufficient_balance',
      message: 'Insufficient balance',
      recoverable: false,
    };
  }
  
  // Blockhash errors
  if (message.includes('blockhash') || 
      message.includes('block height exceeded') ||
      message.includes('blockhash not found')) {
    return {
      type: 'blockhash_failed',
      message: 'Network sync issue. Please try again.',
      recoverable: true,
    };
  }
  
  // Timeout
  if (message.includes('timeout') || 
      message.includes('timed out') ||
      message.includes('aborted')) {
    return {
      type: 'timeout',
      message: 'Request timed out. Network may be slow.',
      recoverable: true,
    };
  }
  
  // Network errors
  if (message.includes('network') || 
      message.includes('fetch') ||
      message.includes('connection') ||
      message.includes('socket')) {
    return {
      type: 'network',
      message: 'Network connection error',
      recoverable: true,
      userAction: 'Check your internet connection',
    };
  }
  
  // Transaction simulation failed
  if (message.includes('simulation failed') ||
      message.includes('transaction failed') ||
      message.includes('program error')) {
    return {
      type: 'tx_failed',
      message: extractSimulationError(message) || 'Transaction failed',
      recoverable: true,
    };
  }
  
  // RPC specific errors
  if (message.includes('503') || message.includes('service unavailable')) {
    return {
      type: 'rpc_unavailable',
      message: 'Solana network temporarily unavailable',
      recoverable: true,
      userAction: 'Try again in a moment',
    };
  }
  
  if (message.includes('429') || message.includes('rate limit')) {
    return {
      type: 'network',
      message: 'Too many requests. Please wait.',
      recoverable: true,
      userAction: 'Wait a moment and try again',
    };
  }
  
  // Unknown
  return {
    type: 'unknown',
    message: error?.message || 'An unexpected error occurred',
    recoverable: true,
  };
}

/**
 * Handle RpcError from our rpc.ts
 */
function handleRpcError(error: any): PaymentError {
  switch (error.type) {
    case 'timeout':
      return {
        type: 'timeout',
        message: error.userMessage || 'Network is slow',
        recoverable: true,
      };
    case 'service_unavailable':
      return {
        type: 'rpc_unavailable',
        message: error.userMessage || 'Solana network unavailable',
        recoverable: true,
      };
    case 'rate_limited':
      return {
        type: 'network',
        message: error.userMessage || 'Too many requests',
        recoverable: true,
      };
    case 'network':
      return {
        type: 'network',
        message: error.userMessage || 'Connection error',
        recoverable: true,
      };
    default:
      return {
        type: 'unknown',
        message: error.userMessage || error.message,
        recoverable: true,
      };
  }
}

/**
 * Extract meaningful error from simulation failure
 */
function extractSimulationError(message: string): string | null {
  // Common program errors
  if (message.includes('0x1')) return 'Insufficient funds';
  if (message.includes('0x0')) return 'Program execution failed';
  if (message.includes('custom program error')) {
    const match = message.match(/custom program error: (0x[0-9a-f]+)/);
    if (match) return `Transaction error: ${match[1]}`;
  }
  return null;
}

// ============================================
// Error State Helpers
// ============================================

/**
 * Should we show a retry button?
 */
export function shouldShowRetry(error: PaymentError): boolean {
  return error.recoverable && error.type !== 'wallet_rejected';
}

/**
 * Should we show a "check status" option?
 * (For when tx might have been sent)
 */
export function shouldShowCheckStatus(error: PaymentError, hasTxSignature: boolean): boolean {
  return hasTxSignature && ['timeout', 'network', 'unknown'].includes(error.type);
}

/**
 * Get the appropriate emoji for error type
 */
export function getErrorEmoji(type: PaymentErrorType): string {
  switch (type) {
    case 'rpc_unavailable':
    case 'network':
      return '📡';
    case 'insufficient_sol':
    case 'insufficient_balance':
      return '💰';
    case 'wallet_rejected':
      return '✋';
    case 'wallet_unavailable':
      return '📱';
    case 'wallet_network_mismatch':
      return '🔀';
    case 'timeout':
      return '⏱️';
    case 'tx_failed':
      return '❌';
    default:
      return '⚠️';
  }
}

/**
 * Get action button text for error
 */
export function getErrorActionText(error: PaymentError, hasTxSignature: boolean): string {
  if (hasTxSignature && error.type === 'timeout') {
    return 'Check Status';
  }
  if (error.type === 'wallet_rejected') {
    return 'Try Again';
  }
  if (error.type === 'wallet_network_mismatch') {
    return 'I Fixed It - Retry';
  }
  if (error.recoverable) {
    return 'Retry';
  }
  return 'Go Back';
}

/**
 * Should we show "Open Wallet" button?
 */
export function shouldShowOpenWallet(error: PaymentError): boolean {
  return error.type === 'wallet_network_mismatch' || 
         error.type === 'wallet_unavailable';
}
