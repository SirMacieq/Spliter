/**
 * Robust RPC Layer for Solana
 * 
 * Features:
 * - Configurable primary RPC via env
 * - Automatic fallback to backup RPCs
 * - Retry with exponential backoff
 * - Timeout on all calls
 * - Circuit breaker (simple)
 * - Handles 503, 403, 429, network errors
 */

import { Connection, BlockhashWithExpiryBlockHeight } from '@solana/web3.js';
import { getSolanaNetwork, getSolanaRpcUrl } from './constants';

// ============================================
// Configuration
// ============================================

const RPC_TIMEOUT_MS = 10000; // 10s timeout per RPC call
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_RESET_MS = 30000; // 30s

// Fallback RPC endpoints by network
const FALLBACK_RPCS: Record<string, string[]> = {
  'mainnet-beta': [
    'https://api.mainnet-beta.solana.com',
    'https://solana-mainnet.rpc.extrnode.com',
    'https://rpc.ankr.com/solana',
    'https://solana.public-rpc.com',
  ],
  'devnet': [
    'https://api.devnet.solana.com',
    'https://rpc.ankr.com/solana_devnet',
  ],
};

// ============================================
// Error Types
// ============================================

export type RpcErrorType = 
  | 'timeout'
  | 'rate_limited'
  | 'service_unavailable'
  | 'forbidden'
  | 'network'
  | 'unknown';

export class RpcError extends Error {
  type: RpcErrorType;
  rpcUrl?: string;
  
  constructor(type: RpcErrorType, message: string, rpcUrl?: string) {
    super(message);
    this.name = 'RpcError';
    this.type = type;
    this.rpcUrl = rpcUrl;
  }
  
  get isRetryable(): boolean {
    return ['timeout', 'rate_limited', 'service_unavailable', 'network'].includes(this.type);
  }
  
  get userMessage(): string {
    switch (this.type) {
      case 'timeout':
        return 'Network is slow. Please try again.';
      case 'rate_limited':
        return 'Too many requests. Please wait a moment.';
      case 'service_unavailable':
        return 'Solana network is temporarily unavailable.';
      case 'forbidden':
        return 'RPC access denied. Trying backup...';
      case 'network':
        return 'Network connection error. Check your internet.';
      default:
        return 'Connection error. Please try again.';
    }
  }
}

// ============================================
// Circuit Breaker State
// ============================================

interface CircuitState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

const circuitStates: Map<string, CircuitState> = new Map();

function getCircuitState(rpcUrl: string): CircuitState {
  if (!circuitStates.has(rpcUrl)) {
    circuitStates.set(rpcUrl, { failures: 0, lastFailure: 0, isOpen: false });
  }
  return circuitStates.get(rpcUrl)!;
}

function recordFailure(rpcUrl: string): void {
  const state = getCircuitState(rpcUrl);
  state.failures++;
  state.lastFailure = Date.now();
  if (state.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    state.isOpen = true;
  }
}

function recordSuccess(rpcUrl: string): void {
  const state = getCircuitState(rpcUrl);
  state.failures = 0;
  state.isOpen = false;
}

function isCircuitOpen(rpcUrl: string): boolean {
  const state = getCircuitState(rpcUrl);
  if (state.isOpen && Date.now() - state.lastFailure > CIRCUIT_BREAKER_RESET_MS) {
    // Reset circuit after timeout
    state.isOpen = false;
    state.failures = 0;
  }
  return state.isOpen;
}

// ============================================
// RPC URL Management
// ============================================

function getPrimaryRpcUrl(): string {
  // Use the centralized getter from constants.ts which already handles env
  return getSolanaRpcUrl();
}

function getRpcCandidates(): string[] {
  const network = getSolanaNetwork();
  const primary = getPrimaryRpcUrl();
  const fallbacks = FALLBACK_RPCS[network] ?? [];
  
  // Dedupe and filter out circuit-broken RPCs
  const all = Array.from(new Set([primary, ...fallbacks]));
  return all.filter(url => !isCircuitOpen(url));
}

// ============================================
// Error Classification
// ============================================

function classifyError(error: any): RpcErrorType {
  const message = String(error?.message ?? error ?? '').toLowerCase();
  const status = error?.status || error?.response?.status;
  
  // HTTP status codes
  if (status === 429 || message.includes('429') || message.includes('rate limit')) {
    return 'rate_limited';
  }
  if (status === 503 || message.includes('503') || message.includes('service unavailable')) {
    return 'service_unavailable';
  }
  if (status === 403 || message.includes('403') || message.includes('forbidden')) {
    return 'forbidden';
  }
  
  // Timeout
  if (message.includes('timeout') || message.includes('timed out') || message.includes('aborted')) {
    return 'timeout';
  }
  
  // Network errors
  if (message.includes('fetch') || message.includes('network') || 
      message.includes('econnrefused') || message.includes('enotfound') ||
      message.includes('socket') || message.includes('connection')) {
    return 'network';
  }
  
  return 'unknown';
}

// ============================================
// Timeout Wrapper
// ============================================

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new RpcError('timeout', `${operation} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

// ============================================
// Core RPC Execution
// ============================================

export interface RpcResult<T> {
  data: T;
  rpcUrl: string;
}

/**
 * Execute an RPC call with automatic retry and fallback
 */
export async function executeRpc<T>(
  operation: string,
  fn: (connection: Connection) => Promise<T>,
  options: {
    timeout?: number;
    maxRetries?: number;
    retryDelay?: number;
  } = {}
): Promise<RpcResult<T>> {
  const {
    timeout = RPC_TIMEOUT_MS,
    maxRetries = MAX_RETRIES,
    retryDelay = RETRY_DELAY_MS,
  } = options;
  
  const candidates = getRpcCandidates();
  
  if (candidates.length === 0) {
    throw new RpcError('service_unavailable', 'All RPC endpoints are unavailable');
  }
  
  let lastError: RpcError | null = null;
  
  for (const rpcUrl of candidates) {
    let retries = 0;
    
    while (retries <= maxRetries) {
      try {
        const connection = new Connection(rpcUrl, 'confirmed');
        const data = await withTimeout(fn(connection), timeout, operation);
        
        // Success! Record it and return
        recordSuccess(rpcUrl);
        return { data, rpcUrl };
      } catch (error: any) {
        const errorType = classifyError(error);
        lastError = new RpcError(
          errorType,
          error?.message || `${operation} failed`,
          rpcUrl
        );
        
        // Record failure for circuit breaker
        recordFailure(rpcUrl);
        
        // Should we retry on this RPC?
        if (lastError.isRetryable && retries < maxRetries) {
          retries++;
          await new Promise(r => setTimeout(r, retryDelay * retries)); // Exponential backoff
          continue;
        }
        
        // Move to next RPC
        break;
      }
    }
  }
  
  // All RPCs failed
  throw lastError || new RpcError('unknown', `${operation} failed on all RPCs`);
}

// ============================================
// Convenience Methods
// ============================================

/**
 * Get a connection that's been health-checked
 */
export async function getHealthyConnection(): Promise<{ connection: Connection; rpcUrl: string }> {
  const result = await executeRpc(
    'health check',
    async (conn) => {
      // Simple health check - get slot
      await conn.getSlot();
      return true;
    },
    { timeout: 5000, maxRetries: 1 }
  );
  
  return {
    connection: new Connection(result.rpcUrl, 'confirmed'),
    rpcUrl: result.rpcUrl,
  };
}

/**
 * Quick RPC health check - returns status without throwing
 */
export async function checkRpcHealth(): Promise<{
  available: boolean;
  rpcUrl?: string;
  error?: string;
}> {
  try {
    const { rpcUrl } = await getHealthyConnection();
    return { available: true, rpcUrl };
  } catch (error: any) {
    return {
      available: false,
      error: error instanceof RpcError ? error.userMessage : 'RPC unavailable',
    };
  }
}

/**
 * Get latest blockhash with retry and fallback
 */
export async function getBlockhashWithRetry(): Promise<{
  blockhash: BlockhashWithExpiryBlockHeight;
  rpcUrl: string;
}> {
  const result = await executeRpc(
    'getLatestBlockhash',
    (conn) => conn.getLatestBlockhash('confirmed'),
    { timeout: 8000, maxRetries: 2 }
  );
  
  return {
    blockhash: result.data,
    rpcUrl: result.rpcUrl,
  };
}

/**
 * Get SOL balance with retry
 */
export async function getSolBalanceRobust(publicKey: string): Promise<number> {
  const { PublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
  
  const result = await executeRpc(
    'getBalance',
    (conn) => conn.getBalance(new PublicKey(publicKey)),
    { timeout: 8000, maxRetries: 2 }
  );
  
  return result.data / LAMPORTS_PER_SOL;
}

/**
 * Get account info with retry
 */
export async function getAccountInfoRobust(address: string): Promise<any> {
  const { PublicKey } = await import('@solana/web3.js');
  
  const result = await executeRpc(
    'getAccountInfo',
    (conn) => conn.getAccountInfo(new PublicKey(address)),
    { timeout: 8000, maxRetries: 2 }
  );
  
  return result.data;
}

/**
 * Check if RPC error is something user should be shown
 */
export function isUserFacingRpcError(error: any): error is RpcError {
  return error instanceof RpcError;
}

/**
 * Get user-friendly error message from any error
 */
export function getRpcErrorMessage(error: any): string {
  if (error instanceof RpcError) {
    return error.userMessage;
  }
  
  const type = classifyError(error);
  const rpcError = new RpcError(type, error?.message ?? 'Unknown error');
  return rpcError.userMessage;
}
