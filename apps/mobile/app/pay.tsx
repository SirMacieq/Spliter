import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useWalletPublicKey, useIsConnected, useIsBooting } from '../stores/walletStore';
import { useWalletConnection } from '../hooks/useWalletConnection';
import { useGroupStore } from '../stores/groupStore';
import { Button, Card, NetworkBadge, SpliterLogo } from '../components';
import { 
  COLORS, 
  SPACING, 
  TYPOGRAPHY, 
  RADIUS, 
  MIN_SOL_FOR_FEES, 
  getFaucetUrl, 
  getNetworkName,
  getSolanaNetwork,
  getSolanaRpcUrl,
  FEE_PERCENT,
  FEE_WALLET,
  calculateFee,
  isFeeConfigured,
} from '../lib/constants';
import { 
  sendUsdcTransferWithFee,
  sendSolTransferWithFee,
  waitForConfirmation,
  checkTransactionStatus,
  getUsdcBalance, 
  getSolBalance,
  getExplorerUrl,
  checkRpcHealth,
  getRpcErrorMessage,
} from '../lib/solana';
import { validatePayLinkParams, PayLinkParams, shortenAddress } from '../lib/validation';
import { SettleStatus, SettleErrorType } from '../lib/types';
import { withTimeout, isTimeoutError } from '../lib/timeout';
import { categorizePaymentError, PaymentError, getErrorEmoji } from '../lib/errors';

export default function PayScreen() {
  const router = useRouter();
  const rawParams = useLocalSearchParams<{ 
    to?: string; 
    amount?: string;
    currency?: string;
    groupId?: string;
    note?: string;
  }>();
  
  const publicKey = useWalletPublicKey();
  const isConnected = useIsConnected();
  const isBooting = useIsBooting();
  const { connect } = useWalletConnection();
  const addTxHistory = useGroupStore((state) => state.addTxHistory);
  const updateTxStatus = useGroupStore((state) => state.updateTxStatus);
  
  // Validate params
  const validation = validatePayLinkParams(rawParams);
  const params = validation.params;
  
  const [status, setStatus] = useState<SettleStatus>('idle');
  const [error, setError] = useState('');
  const [errorType, setErrorType] = useState<SettleErrorType | null>(null);
  const [paymentError, setPaymentError] = useState<PaymentError | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [copiedSignature, setCopiedSignature] = useState(false);
  
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [balanceFetchFailed, setBalanceFetchFailed] = useState(false);
  const [balanceLoaded, setBalanceLoaded] = useState(false);
  const [rpcAvailable, setRpcAvailable] = useState<boolean | null>(null);
  
  // Debug state for diagnosis
  const [debugInfo, setDebugInfo] = useState<{
    payerPubkey: string;
    toPubkey: string;
    rpcUrl: string;
    network: string;
    payerBalLamports: number | null;
    toBalLamports: number | null;
  } | null>(null);
  const [showDebug, setShowDebug] = useState(__DEV__);
  
  // Guards to prevent concurrent operations and infinite loops
  const isSendingRef = useRef(false);
  const isLoadingBalancesRef = useRef(false);
  const loadBalancesCalledRef = useRef(false);
  
  const networkName = getNetworkName();
  const faucetUrl = getFaucetUrl();
  const feeConfigured = isFeeConfigured();
  
  // Fee calculations
  const feeAmount = params ? calculateFee(params.amount) : 0;
  const totalAmount = params ? params.amount + feeAmount : 0;
  
  // Load balances - with in-flight guard to prevent concurrent calls
  const loadBalances = useCallback(async () => {
    // Guard: don't run if already loading or no publicKey
    if (isLoadingBalancesRef.current || !publicKey) {
      return;
    }
    
    isLoadingBalancesRef.current = true;
    setStatus('loading-balance');
    setError('');
    setErrorType(null);
    setPaymentError(null);
    setBalanceFetchFailed(false);
    
    // Capture diagnostic info
    const payerPubkey = publicKey;
    const toPubkey = params?.to || '';
    const rpcUrl = getSolanaRpcUrl();
    const network = getSolanaNetwork();
    
    console.log('[pay][balances] START', {
      payerPubkey,
      toPubkey,
      rpcUrl,
      network,
      envNetwork: process.env.EXPO_PUBLIC_SOLANA_NETWORK,
      envRpc: process.env.EXPO_PUBLIC_SOLANA_RPC_URL,
    });
    
    try {
      // First check RPC health
      const healthCheck = await checkRpcHealth();
      setRpcAvailable(healthCheck.available);
      
      if (!healthCheck.available) {
        console.warn('[pay][balances] RPC health check failed:', healthCheck.error);
        setBalanceFetchFailed(true);
        setBalanceLoaded(true);
        setError(healthCheck.error || 'Solana network unavailable');
        setErrorType('network');
        return;
      }
      
      // Fetch BOTH payer and recipient balance for debugging
      const { Connection, PublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
      const connection = new Connection(rpcUrl, 'confirmed');
      
      const [payerBalLamports, toBalLamports] = await withTimeout(
        () => Promise.all([
          connection.getBalance(new PublicKey(payerPubkey)),
          toPubkey ? connection.getBalance(new PublicKey(toPubkey)) : Promise.resolve(0),
        ]),
        15000,
        'Balance fetch timed out'
      );
      
      // Log detailed diagnostic info
      console.log('[pay][balances] RESULT', {
        payerPubkey,
        toPubkey,
        rpcUrl,
        network,
        payerBalLamports,
        payerBalSOL: payerBalLamports / LAMPORTS_PER_SOL,
        toBalLamports,
        toBalSOL: toBalLamports / LAMPORTS_PER_SOL,
      });
      
      // Update debug state for UI
      setDebugInfo({
        payerPubkey,
        toPubkey,
        rpcUrl,
        network,
        payerBalLamports,
        toBalLamports,
      });
      
      // Fetch USDC balance too
      const usdc = await getUsdcBalance(payerPubkey);
      const sol = payerBalLamports / LAMPORTS_PER_SOL;
      
      setUsdcBalance(usdc);
      setSolBalance(sol);
      setBalanceLoaded(true);
      
      if (sol < MIN_SOL_FOR_FEES) {
        setError(`You need about ${MIN_SOL_FOR_FEES} SOL for network fees`);
        setErrorType('fee');
      }
    } catch (err: any) {
      console.error('[pay][balances] FAILED:', err);
      setBalanceFetchFailed(true);
      setBalanceLoaded(true);
      setRpcAvailable(false);
      
      const errMsg = getRpcErrorMessage(err);
      setError(errMsg + ' You can still try to pay.');
      setErrorType('network');
    } finally {
      isLoadingBalancesRef.current = false;
      setStatus('idle');
    }
  }, [publicKey, params?.to]);
  
  // Effect to load balances ONCE when wallet connects
  // Uses refs to prevent infinite loops
  useEffect(() => {
    // Only load once when:
    // 1. Wallet is connected (publicKey exists)
    // 2. Params are valid
    // 3. Haven't already loaded/attempted
    if (publicKey && params && !loadBalancesCalledRef.current) {
      loadBalancesCalledRef.current = true;
      loadBalances();
    }
  }, [publicKey, params, loadBalances]);
  
  // Reset the "called" ref when publicKey changes (reconnect scenario)
  useEffect(() => {
    if (!publicKey) {
      loadBalancesCalledRef.current = false;
      setBalanceLoaded(false);
    }
  }, [publicKey]);
  
  const validatePayment = (): boolean => {
    if (!feeConfigured) {
      setError('Fee wallet not configured. Please contact support.');
      setErrorType('general');
      return false;
    }
    
    if (!params) return false;
    
    // If balance fetch failed, allow proceeding (user chose "Pay anyway")
    if (balanceFetchFailed) {
      return true;
    }
    
    // Balance checks only if we successfully fetched balances
    if (solBalance !== null && solBalance < MIN_SOL_FOR_FEES) {
      setError(`You need about ${MIN_SOL_FOR_FEES} SOL for network fees`);
      setErrorType('fee');
      return false;
    }
    
    if (params.currency === 'USDC') {
      if (usdcBalance === null || usdcBalance === 0) {
        setError('You don\'t have any USDC');
        setErrorType('balance');
        return false;
      }
      if (totalAmount > usdcBalance) {
        setError(`Insufficient USDC. Need $${totalAmount.toFixed(2)}, have $${usdcBalance.toFixed(2)}`);
        setErrorType('balance');
        return false;
      }
    }
    
    if (params.currency === 'SOL') {
      const maxSendable = (solBalance ?? 0) - MIN_SOL_FOR_FEES;
      if (totalAmount > maxSendable) {
        setError(`Insufficient SOL. Max: ${Math.max(0, maxSendable).toFixed(4)} SOL`);
        setErrorType('balance');
        return false;
      }
    }
    
    return true;
  };
  
  const handleOpenFaucet = () => {
    if (faucetUrl) Linking.openURL(faucetUrl);
  };
  
  const handleProceedToConfirm = () => {
    if (!validatePayment()) return;
    setStatus('confirming');
  };
  
  const handleSendTransaction = async () => {
    if (isSendingRef.current || txSignature) {
      console.warn('Prevented double-send');
      return;
    }
    
    if (!publicKey || !params) return;
    if (!validatePayment()) {
      setStatus('idle');
      return;
    }
    
    isSendingRef.current = true;
    setStatus('signing');
    setError('');
    setErrorType(null);
    setPaymentError(null);
    
    try {
      const signature = params.currency === 'USDC'
        ? await sendUsdcTransferWithFee(publicKey, params.to, params.amount, feeAmount)
        : await sendSolTransferWithFee(publicKey, params.to, params.amount, feeAmount);
      
      setTxSignature(signature);
      
      await addTxHistory({
        signature,
        from: publicKey,
        to: params.to,
        amount: params.amount,
        currency: params.currency,
        status: 'pending',
        groupId: params.groupId,
      });
      
      setStatus('pending');
      const result = await waitForConfirmation(signature);
      
      if (result.status === 'confirmed') {
        await updateTxStatus(signature, 'confirmed');
        setStatus('success');
      } else if (result.status === 'failed') {
        await updateTxStatus(signature, 'failed', result.error);
        setError(result.error || 'Transaction failed');
        setErrorType('general');
        setStatus('error');
      } else {
        setError('Taking longer than expected. Check status below.');
        setErrorType('timeout');
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      
      // Use new categorization system
      const payErr = categorizePaymentError(err);
      setPaymentError(payErr);
      setError(payErr.message);
      
      // Map to legacy errorType for UI compatibility
      const typeMap: Record<string, SettleErrorType> = {
        'wallet_rejected': 'rejected',
        'insufficient_sol': 'fee',
        'insufficient_balance': 'balance',
        'timeout': 'timeout',
        'network': 'network',
        'rpc_unavailable': 'network',
        'blockhash_failed': 'network',
      };
      setErrorType(typeMap[payErr.type] || 'general');
      
      if (payErr.type === 'wallet_rejected') {
        setTxSignature(null);
        setStatus('idle');
      } else {
        setStatus('error');
      }
    } finally {
      isSendingRef.current = false;
    }
  };
  
  const handleCheckStatus = async () => {
    if (!txSignature) return;
    
    setStatus('checking');
    setError('');
    
    try {
      const result = await checkTransactionStatus(txSignature);
      
      if (result.status === 'confirmed') {
        await updateTxStatus(txSignature, 'confirmed');
        setStatus('success');
      } else if (result.status === 'failed') {
        await updateTxStatus(txSignature, 'failed', result.error);
        setError(result.error || 'Transaction failed');
        setErrorType('general');
        setStatus('error');
      } else {
        setError('Still processing. Try again shortly.');
        setErrorType('timeout');
        setStatus('pending');
      }
    } catch (err: any) {
      setError('Unable to check status');
      setErrorType('network');
      setStatus('pending');
    }
  };
  
  // Retry balance fetch (manual user action)
  const handleRetryBalances = () => {
    loadBalancesCalledRef.current = false;
    setBalanceLoaded(false);
    setBalanceFetchFailed(false);
    loadBalances();
  };
  
  const handleRetry = () => {
    if (txSignature) {
      handleCheckStatus();
    } else {
      setStatus('idle');
      setError('');
      setErrorType(null);
      setPaymentError(null);
      setRpcAvailable(null);
      handleRetryBalances();
    }
  };
  
  const handleViewExplorer = () => {
    if (txSignature) Linking.openURL(getExplorerUrl(txSignature));
  };
  
  const handleCopySignature = async () => {
    if (txSignature) {
      await Clipboard.setStringAsync(txSignature);
      setCopiedSignature(true);
      setTimeout(() => setCopiedSignature(false), 2000);
    }
  };
  
  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  };
  
  const handleCancel = () => {
    setStatus('idle');
    setError('');
    setPaymentError(null);
  };
  
  // Handle connect wallet from pay screen
  const handleConnectWallet = async () => {
    await connect();
  };
  
  // ========== INVALID PARAMS ==========
  if (!validation.valid) {
    return (
      <>
        <Stack.Screen options={{ title: 'Invalid Link' }} />
        <View style={styles.container}>
          <View style={styles.centerContent}>
            <Text style={styles.errorEmoji}>⚠️</Text>
            <Text style={styles.errorTitle}>Invalid Payment Link</Text>
            <Text style={styles.errorMessage}>{validation.error}</Text>
            <Button title="Go Back" onPress={handleClose} variant="outline" />
          </View>
        </View>
      </>
    );
  }
  
  // ========== BOOTING (hydrating stores) ==========
  if (isBooting) {
    return (
      <>
        <Stack.Screen options={{ title: 'Loading...' }} />
        <View style={styles.container}>
          <View style={styles.centerContent}>
            <ActivityIndicator color={COLORS.primary} size="large" />
            <Text style={styles.checkingText}>Loading...</Text>
          </View>
        </View>
      </>
    );
  }
  
  // ========== NOT CONNECTED ==========
  if (!isConnected) {
    return (
      <>
        <Stack.Screen options={{ title: 'Connect Wallet' }} />
        <View style={styles.container}>
          <View style={styles.centerContent}>
            <SpliterLogo size={80} style={styles.connectLogo} />
            <Text style={styles.connectTitle}>Connect Wallet to Pay</Text>
            <Text style={styles.connectMessage}>
              Connect your wallet to complete this payment request.
            </Text>
            
            {/* Show payment preview */}
            {params && (
              <Card style={styles.previewCard}>
                <Text style={styles.previewLabel}>Payment Request</Text>
                <Text style={styles.previewAmount}>
                  {params.currency === 'USDC' ? '$' : ''}{params.amount.toFixed(params.currency === 'USDC' ? 2 : 4)} {params.currency}
                </Text>
                <Text style={styles.previewTo}>to {shortenAddress(params.to, 6)}</Text>
              </Card>
            )}
            
            <Button 
              title="Connect Wallet" 
              onPress={handleConnectWallet} 
              size="large"
              style={styles.connectButton}
            />
            <Button 
              title="Cancel" 
              onPress={handleClose} 
              variant="outline"
              style={styles.cancelButton}
            />
          </View>
        </View>
      </>
    );
  }
  
  // ========== FEE NOT CONFIGURED ==========
  if (!feeConfigured) {
    return (
      <>
        <Stack.Screen options={{ title: 'Unavailable' }} />
        <View style={styles.container}>
          <View style={styles.centerContent}>
            <Text style={styles.errorEmoji}>⚙️</Text>
            <Text style={styles.errorTitle}>Pay Unavailable</Text>
            <Text style={styles.errorMessage}>
              Fee wallet not configured. Payments via link are temporarily unavailable.
            </Text>
            <Button title="Go Back" onPress={handleClose} variant="outline" />
          </View>
        </View>
      </>
    );
  }
  
  // ========== SUCCESS SCREEN ==========
  if (status === 'success' && txSignature && params) {
    return (
      <>
        <Stack.Screen options={{ title: 'Payment Sent' }} />
        <View style={styles.container}>
          <View style={styles.centerContent}>
            <View style={styles.successIcon}>
              <Text style={styles.successIconText}>✓</Text>
            </View>
            <Text style={styles.successTitle}>Payment Sent!</Text>
            <Text style={styles.successAmount}>
              {params.currency === 'USDC' ? '$' : ''}{params.amount.toFixed(params.currency === 'USDC' ? 2 : 4)} {params.currency}
            </Text>
            <Text style={styles.successRecipient}>
              to {shortenAddress(params.to, 6)}
            </Text>
            
            {params.note && (
              <Card style={styles.noteCard}>
                <Text style={styles.noteLabel}>Note</Text>
                <Text style={styles.noteText}>{params.note}</Text>
              </Card>
            )}
            
            <Card style={styles.txCard}>
              <Text style={styles.txLabel}>Transaction ID</Text>
              <Text style={styles.txSignature} numberOfLines={1}>
                {txSignature.slice(0, 16)}···{txSignature.slice(-8)}
              </Text>
            </Card>
            
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionButton} onPress={handleViewExplorer}>
                <Text style={styles.actionButtonText}>View on Solscan</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={handleCopySignature}>
                <Text style={styles.actionButtonText}>
                  {copiedSignature ? '✓ Copied' : 'Copy ID'}
                </Text>
              </TouchableOpacity>
            </View>
            
            <NetworkBadge style={styles.badge} />
          </View>
          
          <View style={styles.footer}>
            <Button title="Done" onPress={handleClose} size="large" fullWidth />
          </View>
        </View>
      </>
    );
  }
  
  // ========== PENDING SCREEN ==========
  if (status === 'pending' && txSignature) {
    return (
      <>
        <Stack.Screen options={{ title: 'Processing...' }} />
        <View style={styles.container}>
          <View style={styles.centerContent}>
            <ActivityIndicator color={COLORS.warning} size="large" style={styles.spinner} />
            <Text style={styles.pendingTitle}>Processing Payment</Text>
            <Text style={styles.pendingMessage}>
              Your payment is being confirmed on the blockchain.
            </Text>
            
            <Card style={styles.txCard}>
              <Text style={styles.txLabel}>Transaction ID</Text>
              <Text style={styles.txSignature} numberOfLines={1}>
                {txSignature.slice(0, 16)}···{txSignature.slice(-8)}
              </Text>
            </Card>
            
            {error && <Text style={styles.warningText}>{error}</Text>}
            
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionButton} onPress={handleViewExplorer}>
                <Text style={styles.actionButtonText}>View on Solscan</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.footerRow}>
            <Button 
              title="Check Status" 
              onPress={handleCheckStatus} 
              size="large" 
              style={styles.flexButton}
            />
            <Button 
              title="Close" 
              onPress={handleClose} 
              variant="outline" 
              size="large"
              style={styles.flexButton}
            />
          </View>
        </View>
      </>
    );
  }
  
  // ========== ERROR SCREEN ==========
  if (status === 'error') {
    const errorEmoji = paymentError ? getErrorEmoji(paymentError.type) : '⚠️';
    const showFaucet = (errorType === 'fee' || paymentError?.type === 'insufficient_sol') && faucetUrl;
    const actionText = txSignature 
      ? "Check Status" 
      : (paymentError?.recoverable ? "Try Again" : "Go Back");
    
    return (
      <>
        <Stack.Screen options={{ title: 'Payment Failed' }} />
        <View style={styles.container}>
          <View style={styles.centerContent}>
            <Text style={styles.errorEmoji}>{errorEmoji}</Text>
            <Text style={styles.errorTitle}>Payment Failed</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            
            {paymentError?.userAction && (
              <Text style={styles.errorHint}>{paymentError.userAction}</Text>
            )}
            
            {txSignature && (
              <Card style={styles.txCard}>
                <Text style={styles.txLabel}>Transaction ID</Text>
                <Text style={styles.txSignature} numberOfLines={1}>
                  {txSignature.slice(0, 16)}···{txSignature.slice(-8)}
                </Text>
              </Card>
            )}
            
            {showFaucet && (
              <TouchableOpacity style={styles.helpLink} onPress={handleOpenFaucet}>
                <Text style={styles.helpLinkText}>Get {networkName} SOL →</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.footerRow}>
            <Button 
              title={actionText} 
              onPress={paymentError?.recoverable || txSignature ? handleRetry : handleClose} 
              size="large"
              style={styles.flexButton}
            />
            <Button 
              title="Cancel" 
              onPress={handleClose} 
              variant="outline" 
              size="large"
              style={styles.flexButton}
            />
          </View>
        </View>
      </>
    );
  }
  
  // ========== CHECKING STATUS ==========
  if (status === 'checking') {
    return (
      <>
        <Stack.Screen options={{ title: 'Checking...' }} />
        <View style={styles.container}>
          <View style={styles.centerContent}>
            <ActivityIndicator color={COLORS.primary} size="large" />
            <Text style={styles.checkingText}>Checking transaction status...</Text>
          </View>
        </View>
      </>
    );
  }
  
  // ========== CONFIRMATION SCREEN ==========
  if ((status === 'confirming' || status === 'signing') && params) {
    return (
      <>
        <Stack.Screen options={{ title: 'Confirm Payment' }} />
        <View style={styles.container}>
          <ScrollView style={styles.scrollContent}>
            <View style={styles.confirmHeader}>
              <Text style={styles.confirmTitle}>Confirm Payment</Text>
              <Text style={styles.confirmSubtitle}>Review the details below</Text>
            </View>
            
            <Card style={styles.confirmCard}>
              <Text style={styles.confirmLabel}>Recipient Receives</Text>
              <Text style={styles.confirmAmount}>
                {params.currency === 'USDC' ? '$' : ''}{params.amount.toFixed(params.currency === 'USDC' ? 2 : 4)} {params.currency}
              </Text>
            </Card>
            
            <Card style={styles.confirmCard}>
              <Text style={styles.confirmLabel}>Recipient</Text>
              <Text style={styles.confirmValue}>{shortenAddress(params.to, 8)}</Text>
              <Text style={styles.confirmAddress}>{params.to}</Text>
            </Card>
            
            {params.note && (
              <Card style={styles.confirmCard}>
                <Text style={styles.confirmLabel}>Note</Text>
                <Text style={styles.confirmValue}>{params.note}</Text>
              </Card>
            )}
            
            <Card style={StyleSheet.flatten([styles.confirmCard, styles.feeCard])}>
              <View style={styles.feeRow}>
                <Text style={styles.feeLabel}>Service Fee ({FEE_PERCENT}%)</Text>
                <Text style={styles.feeValue}>
                  {params.currency === 'USDC' ? '$' : ''}{feeAmount.toFixed(params.currency === 'USDC' ? 2 : 6)} {params.currency}
                </Text>
              </View>
              <Text style={styles.feeNote}>
                Fee goes to: {shortenAddress(FEE_WALLET, 4)}
              </Text>
            </Card>
            
            <Card style={styles.totalCard}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>You Pay (+ network fees)</Text>
                <Text style={styles.totalValue}>
                  {params.currency === 'USDC' ? '$' : ''}{totalAmount.toFixed(params.currency === 'USDC' ? 2 : 4)} {params.currency}
                </Text>
              </View>
            </Card>
            
            <View style={styles.networkRow}>
              <Text style={styles.networkLabel}>Network</Text>
              <NetworkBadge />
            </View>
            
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            )}
            
            {status === 'signing' && (
              <View style={styles.signingState}>
                <ActivityIndicator color={COLORS.primary} size="large" />
                <Text style={styles.signingText}>Approve in your wallet...</Text>
              </View>
            )}
          </ScrollView>
          
          <View style={styles.footerRow}>
            <Button 
              title="Cancel" 
              onPress={handleCancel} 
              variant="outline" 
              size="large"
              style={styles.flexButton}
              disabled={status === 'signing'}
            />
            <Button 
              title={status === 'signing' ? 'Sending...' : 'Pay Now'} 
              onPress={handleSendTransaction} 
              size="large"
              style={styles.flexButton}
              loading={status === 'signing'}
              disabled={status === 'signing'}
            />
          </View>
        </View>
      </>
    );
  }
  
  // ========== MAIN SCREEN ==========
  if (!params) {
    return null; // TypeScript guard - should never reach here
  }
  
  // Determine CTA state
  const isLoadingBalance = status === 'loading-balance';
  const canProceed = balanceFetchFailed || (balanceLoaded && solBalance !== null && solBalance >= MIN_SOL_FOR_FEES);
  
  return (
    <>
      <Stack.Screen options={{ title: 'Payment Request' }} />
      <View style={styles.container}>
        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.requestHeader}>
            <SpliterLogo size={64} style={styles.requestLogo} />
            <Text style={styles.requestTitle}>Payment Request</Text>
          </View>
          
          {/* Amount */}
          <Card style={styles.amountCard}>
            <Text style={styles.amountLabel}>Amount Requested</Text>
            <Text style={styles.amountValue}>
              {params.currency === 'USDC' ? '$' : ''}{params.amount.toFixed(params.currency === 'USDC' ? 2 : 4)}
            </Text>
            <Text style={styles.amountCurrency}>{params.currency}</Text>
          </Card>
          
          {/* Recipient */}
          <Card style={styles.detailCard}>
            <Text style={styles.detailLabel}>To</Text>
            <Text style={styles.detailValue}>{shortenAddress(params.to, 8)}</Text>
            <Text style={styles.detailAddress}>{params.to}</Text>
          </Card>
          
          {/* Note */}
          {params.note && (
            <Card style={styles.detailCard}>
              <Text style={styles.detailLabel}>Note</Text>
              <Text style={styles.detailValue}>{params.note}</Text>
            </Card>
          )}
          
          {/* Fee Info */}
          <Card style={styles.feeInfoCard}>
            <Text style={styles.feeInfoTitle}>Fee Breakdown</Text>
            <View style={styles.feeInfoRow}>
              <Text style={styles.feeInfoLabel}>Recipient gets</Text>
              <Text style={styles.feeInfoValue}>
                {params.currency === 'USDC' ? '$' : ''}{params.amount.toFixed(params.currency === 'USDC' ? 2 : 4)} {params.currency}
              </Text>
            </View>
            <View style={styles.feeInfoRow}>
              <Text style={styles.feeInfoLabel}>Service fee ({FEE_PERCENT}%)</Text>
              <Text style={styles.feeInfoValue}>
                {params.currency === 'USDC' ? '$' : ''}{feeAmount.toFixed(params.currency === 'USDC' ? 2 : 6)} {params.currency}
              </Text>
            </View>
            <View style={styles.feeInfoDivider} />
            <View style={styles.feeInfoRow}>
              <Text style={styles.feeInfoLabelBold}>You pay</Text>
              <Text style={styles.feeInfoValueBold}>
                {params.currency === 'USDC' ? '$' : ''}{totalAmount.toFixed(params.currency === 'USDC' ? 2 : 4)} {params.currency}
              </Text>
            </View>
            <Text style={styles.feeInfoNote}>+ network fees (~0.00025 SOL)</Text>
          </Card>
          
          {/* Balance */}
          <View style={styles.balanceRow}>
            {isLoadingBalance ? (
              <>
                <ActivityIndicator color={COLORS.textSecondary} size="small" />
                <Text style={styles.balanceText}>Loading balance...</Text>
              </>
            ) : balanceFetchFailed ? (
              <>
                <Text style={styles.balanceTextError}>Balance unavailable</Text>
                <TouchableOpacity onPress={handleRetryBalances}>
                  <Text style={styles.refreshText}>Retry</Text>
                </TouchableOpacity>
              </>
            ) : balanceLoaded ? (
              <>
                <Text style={styles.balanceText}>
                  Your Balance: {params.currency === 'USDC' 
                    ? `$${(usdcBalance ?? 0).toFixed(2)}`
                    : `${(solBalance ?? 0).toFixed(4)} SOL`
                  }
                </Text>
                <TouchableOpacity onPress={handleRetryBalances}>
                  <Text style={styles.refreshText}>Refresh</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
          
          {/* Balance fetch error - show warning but allow proceed */}
          {balanceFetchFailed && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningBannerText}>
                {rpcAvailable === false 
                  ? '📡 Solana network temporarily unavailable. You can still try to pay.'
                  : '⚠️ Couldn\'t verify your balance. You can still try to pay.'}
              </Text>
            </View>
          )}
          
          {/* Low SOL Warning - only show if balances loaded successfully */}
          {!balanceFetchFailed && balanceLoaded && solBalance !== null && solBalance < MIN_SOL_FOR_FEES && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningBannerText}>
                ⚠️ Low SOL! You need ~{MIN_SOL_FOR_FEES} SOL for fees.
              </Text>
              {faucetUrl && (
                <TouchableOpacity onPress={handleOpenFaucet}>
                  <Text style={styles.warningLink}>Get {networkName} SOL →</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          
          {error && errorType !== 'fee' && errorType !== 'network' && (
            <Text style={styles.formError}>{error}</Text>
          )}
          
          <NetworkBadge style={styles.networkBadgeCenter} />
          
          {/* Debug Section (dev builds only) */}
          {showDebug && debugInfo && (
            <TouchableOpacity 
              style={styles.debugSection}
              onPress={() => setShowDebug(!showDebug)}
            >
              <Text style={styles.debugTitle}>🔍 Debug Info (tap to hide)</Text>
              <Text style={styles.debugText}>
                Payer: {debugInfo.payerPubkey.slice(0, 8)}...{debugInfo.payerPubkey.slice(-4)}
              </Text>
              <Text style={styles.debugText}>
                To: {debugInfo.toPubkey.slice(0, 8)}...{debugInfo.toPubkey.slice(-4)}
              </Text>
              <Text style={styles.debugText}>
                Network: {debugInfo.network}
              </Text>
              <Text style={styles.debugText}>
                RPC: {new URL(debugInfo.rpcUrl).hostname}
              </Text>
              <Text style={styles.debugText}>
                Payer Balance: {(debugInfo.payerBalLamports ?? 0) / 1e9} SOL ({debugInfo.payerBalLamports} lamports)
              </Text>
              <Text style={styles.debugText}>
                To Balance: {(debugInfo.toBalLamports ?? 0) / 1e9} SOL ({debugInfo.toBalLamports} lamports)
              </Text>
              <Text style={styles.debugTextMuted}>
                ENV_NETWORK: {process.env.EXPO_PUBLIC_SOLANA_NETWORK || 'not set'}
              </Text>
              <Text style={styles.debugTextMuted}>
                ENV_RPC: {process.env.EXPO_PUBLIC_SOLANA_RPC_URL?.slice(0, 30) || 'not set'}...
              </Text>
            </TouchableOpacity>
          )}
          
          {showDebug && !debugInfo && (
            <TouchableOpacity 
              style={styles.debugSection}
              onPress={() => setShowDebug(!showDebug)}
            >
              <Text style={styles.debugTitle}>🔍 Debug: Waiting for balance fetch...</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
        
        <View style={styles.footer}>
          <Button
            title={
              isLoadingBalance 
                ? 'Loading...' 
                : balanceFetchFailed 
                  ? 'Pay Anyway' 
                  : 'Continue to Pay'
            }
            onPress={handleProceedToConfirm}
            disabled={isLoadingBalance || !canProceed}
            loading={isLoadingBalance}
            size="large"
            fullWidth
          />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.background,
  },
  scrollContent: { 
    flex: 1, 
    padding: SPACING.xl,
  },
  centerContent: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: SPACING.xl,
  },
  
  // Connect Wallet Screen
  connectLogo: {
    marginBottom: SPACING.xl,
  },
  connectTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  connectMessage: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING['2xl'],
    maxWidth: 280,
  },
  previewCard: {
    width: '100%',
    alignItems: 'center',
    marginBottom: SPACING['2xl'],
    paddingVertical: SPACING.xl,
  },
  previewLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  previewAmount: {
    ...TYPOGRAPHY.h1,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  previewTo: {
    ...TYPOGRAPHY.small,
    color: COLORS.textMuted,
  },
  connectButton: {
    width: '100%',
    marginBottom: SPACING.md,
  },
  cancelButton: {
    width: '100%',
  },
  
  // Request Header
  requestHeader: {
    alignItems: 'center',
    marginBottom: SPACING['2xl'],
  },
  requestLogo: {
    marginBottom: SPACING.lg,
  },
  requestTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
  },
  
  // Amount Card
  amountCard: {
    alignItems: 'center',
    paddingVertical: SPACING['2xl'],
    marginBottom: SPACING.lg,
  },
  amountLabel: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  amountValue: {
    fontSize: 40,
    fontWeight: '700',
    color: COLORS.text,
  },
  amountCurrency: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  
  // Detail Card
  detailCard: {
    marginBottom: SPACING.md,
  },
  detailLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  detailValue: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.text,
  },
  detailAddress: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    fontFamily: 'monospace',
    marginTop: SPACING.xs,
  },
  
  // Fee Info Card
  feeInfoCard: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.surfaceLight,
  },
  feeInfoTitle: {
    ...TYPOGRAPHY.smallMedium,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  feeInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  feeInfoLabel: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
  },
  feeInfoValue: {
    ...TYPOGRAPHY.small,
    color: COLORS.text,
  },
  feeInfoLabelBold: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.text,
  },
  feeInfoValueBold: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.primary,
  },
  feeInfoDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  feeInfoNote: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  
  // Balance
  balanceRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: SPACING.lg, 
    gap: SPACING.md,
    minHeight: 24,
  },
  balanceText: { 
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
  },
  balanceTextError: { 
    ...TYPOGRAPHY.small,
    color: COLORS.warning,
  },
  refreshText: { 
    ...TYPOGRAPHY.smallMedium,
    color: COLORS.primary,
  },
  
  // Warning
  warningBanner: { 
    backgroundColor: COLORS.warningMuted, 
    borderRadius: RADIUS.md, 
    padding: SPACING.lg, 
    marginBottom: SPACING.lg,
  },
  warningBannerText: { 
    ...TYPOGRAPHY.small,
    color: COLORS.warning,
  },
  warningLink: { 
    ...TYPOGRAPHY.smallMedium,
    color: COLORS.primary, 
    marginTop: SPACING.sm,
  },
  warningText: { 
    ...TYPOGRAPHY.small,
    color: COLORS.warning, 
    textAlign: 'center', 
    marginTop: SPACING.md,
  },
  
  formError: { 
    ...TYPOGRAPHY.small,
    color: COLORS.error, 
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  
  networkBadgeCenter: {
    alignSelf: 'center',
    marginTop: SPACING.md,
  },
  
  // Footer
  footer: { 
    padding: SPACING.xl, 
    paddingBottom: SPACING['4xl'],
  },
  footerRow: { 
    padding: SPACING.xl, 
    paddingBottom: SPACING['4xl'], 
    flexDirection: 'row', 
    gap: SPACING.md,
  },
  flexButton: { 
    flex: 1,
  },
  
  // Confirm Screen
  confirmHeader: {
    alignItems: 'center',
    marginBottom: SPACING['2xl'],
  },
  confirmTitle: { 
    ...TYPOGRAPHY.h2,
    color: COLORS.text, 
    marginBottom: SPACING.xs,
  },
  confirmSubtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
  },
  confirmCard: { 
    marginBottom: SPACING.md,
  },
  confirmLabel: { 
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary, 
    marginBottom: SPACING.xs,
  },
  confirmValue: { 
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.text,
  },
  confirmAmount: {
    ...TYPOGRAPHY.h1,
    color: COLORS.text,
  },
  confirmAddress: { 
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted, 
    fontFamily: 'monospace', 
    marginTop: SPACING.xs,
  },
  
  // Fee Card
  feeCard: {
    backgroundColor: COLORS.surfaceLight,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeLabel: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
  },
  feeValue: {
    ...TYPOGRAPHY.smallMedium,
    color: COLORS.text,
  },
  feeNote: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
  },
  
  // Total Card
  totalCard: {
    backgroundColor: COLORS.primaryMuted,
    marginBottom: SPACING.lg,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.text,
  },
  totalValue: {
    ...TYPOGRAPHY.h3,
    color: COLORS.primary,
  },
  
  networkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  networkLabel: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
  },
  
  // Error Banner
  errorBanner: { 
    backgroundColor: COLORS.errorMuted, 
    borderRadius: RADIUS.md, 
    padding: SPACING.lg, 
    marginTop: SPACING.md,
  },
  errorBannerText: { 
    ...TYPOGRAPHY.small,
    color: COLORS.error, 
    textAlign: 'center',
  },
  
  // Signing
  signingState: { 
    alignItems: 'center', 
    marginTop: SPACING['3xl'],
  },
  signingText: { 
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary, 
    marginTop: SPACING.lg,
  },
  checkingText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    marginTop: SPACING.lg,
  },
  
  // Success Screen
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.successMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  successIconText: {
    fontSize: 36,
    color: COLORS.success,
    fontWeight: '600',
  },
  successTitle: { 
    ...TYPOGRAPHY.h1,
    color: COLORS.text, 
    marginBottom: SPACING.md,
  },
  successAmount: { 
    fontSize: 36, 
    fontWeight: '700', 
    color: COLORS.success, 
    marginBottom: SPACING.sm,
  },
  successRecipient: { 
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary, 
    marginBottom: SPACING['2xl'],
  },
  
  // Note Card
  noteCard: {
    width: '100%',
    marginBottom: SPACING.lg,
  },
  noteLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  noteText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  
  // Pending Screen
  spinner: {
    marginBottom: SPACING.xl,
  },
  pendingTitle: { 
    ...TYPOGRAPHY.h2,
    color: COLORS.warning, 
    marginBottom: SPACING.sm,
  },
  pendingMessage: { 
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary, 
    textAlign: 'center', 
    marginBottom: SPACING['2xl'],
    maxWidth: 280,
  },
  
  // Error Screen
  errorIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.errorMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  errorIconText: {
    fontSize: 36,
    color: COLORS.error,
    fontWeight: '600',
  },
  errorTitle: { 
    ...TYPOGRAPHY.h2,
    color: COLORS.error, 
    marginBottom: SPACING.md,
  },
  errorMessage: { 
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary, 
    textAlign: 'center', 
    marginBottom: SPACING.md,
    maxWidth: 280,
  },
  errorHint: {
    ...TYPOGRAPHY.small,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING['2xl'],
    maxWidth: 280,
  },
  errorEmoji: { 
    fontSize: 48, 
    marginBottom: SPACING.lg,
  },
  
  // Transaction Card
  txCard: { 
    width: '100%', 
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.surface,
  },
  txLabel: { 
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary, 
    marginBottom: SPACING.xs,
  },
  txSignature: { 
    ...TYPOGRAPHY.small,
    color: COLORS.text, 
    fontFamily: 'monospace',
  },
  
  // Action Buttons
  actionRow: { 
    flexDirection: 'row', 
    gap: SPACING.md, 
    marginBottom: SPACING.lg,
  },
  actionButton: { 
    backgroundColor: COLORS.surface, 
    paddingVertical: SPACING.md, 
    paddingHorizontal: SPACING.xl, 
    borderRadius: RADIUS.sm,
  },
  actionButtonText: { 
    ...TYPOGRAPHY.smallMedium,
    color: COLORS.primary,
  },
  
  // Help Link
  helpLink: { 
    backgroundColor: COLORS.surface, 
    paddingVertical: SPACING.md, 
    paddingHorizontal: SPACING['2xl'], 
    borderRadius: RADIUS.sm, 
    marginBottom: SPACING.lg,
  },
  helpLinkText: { 
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.primary,
  },
  
  // Badge
  badge: { 
    marginTop: SPACING.lg,
  },
  
  // Debug Section
  debugSection: {
    marginTop: SPACING.xl,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  debugTitle: {
    ...TYPOGRAPHY.smallMedium,
    color: COLORS.warning,
    marginBottom: SPACING.sm,
  },
  debugText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text,
    fontFamily: 'monospace',
    marginBottom: SPACING.xs,
  },
  debugTextMuted: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    fontFamily: 'monospace',
    marginBottom: SPACING.xs,
  },
});
