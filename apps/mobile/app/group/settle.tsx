/**
 * TODO: Fee Model Bypass
 * 
 * This settle screen does NOT include the fee model that's used in Pay links.
 * Direct settlements (in-group) currently bypass fees.
 * 
 * Decision: Keep existing behavior for now (group settlements are fee-free).
 * If fees should apply to all transfers, refactor to use sendUsdcTransferWithFee/sendSolTransferWithFee.
 * 
 * @see /app/pay.tsx for fee-enabled payment flow
 * @see /lib/solana.ts for sendXxxTransferWithFee functions
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useGroupStore } from '../../stores/groupStore';
import { useWalletPublicKey } from '../../stores/walletStore';
import { Button, Card, NetworkBadge } from '../../components';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, MIN_SOL_FOR_FEES, getFaucetUrl, getNetworkName } from '../../lib/constants';
import { 
  sendUsdcTransfer,
  sendSolTransfer,
  waitForConfirmation,
  checkTransactionStatus,
  getUsdcBalance, 
  getSolBalance,
  getExplorerUrl,
  checkRpcHealth,
  getRpcErrorMessage,
} from '../../lib/solana';
import { SettleStatus, SettleErrorType } from '../../lib/types';
import { withTimeout, isTimeoutError } from '../../lib/timeout';
import { categorizePaymentError, PaymentError, getErrorEmoji } from '../../lib/errors';

type Currency = 'USDC' | 'SOL';

export default function SettleScreen() {
  const router = useRouter();
  const { groupId, to, amount: initialAmount } = useLocalSearchParams<{ 
    groupId: string; 
    to: string;
    amount: string;
  }>();
  
  const group = useGroupStore((state) => state.getGroupById(groupId || ''));
  const addSettlement = useGroupStore((state) => state.addSettlement);
  const addTxHistory = useGroupStore((state) => state.addTxHistory);
  const updateTxStatus = useGroupStore((state) => state.updateTxStatus);
  const publicKey = useWalletPublicKey();
  
  const [amount, setAmount] = useState(initialAmount || '');
  const [currency, setCurrency] = useState<Currency>('USDC');
  const [status, setStatus] = useState<SettleStatus>('idle');
  const [error, setError] = useState('');
  const [errorType, setErrorType] = useState<SettleErrorType | null>(null);
  const [paymentError, setPaymentError] = useState<PaymentError | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [copiedSignature, setCopiedSignature] = useState(false);
  
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [balanceFetchFailed, setBalanceFetchFailed] = useState(false);
  const [rpcAvailable, setRpcAvailable] = useState<boolean | null>(null);
  
  // Guards to prevent concurrent operations and infinite loops
  const isSendingRef = useRef(false);
  const isLoadingBalancesRef = useRef(false);
  
  const recipient = group?.members.find(m => m.wallet === to);
  const recipientDisplay = recipient?.nickname || 
    (to ? `${to.slice(0, 6)}···${to.slice(-4)}` : 'Unknown');
  
  const networkName = getNetworkName();
  const faucetUrl = getFaucetUrl();
  const parsedAmount = parseFloat(amount) || 0;
  
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
    
    console.log('[settle][balances] START', {
      payer: publicKey ? `${publicKey.slice(0, 8)}...${publicKey.slice(-4)}` : null,
      to: to ? `${to.slice(0, 8)}...${to.slice(-4)}` : null,
    });
    
    try {
      // First check RPC health
      const healthCheck = await checkRpcHealth();
      setRpcAvailable(healthCheck.available);
      
      if (!healthCheck.available) {
        console.warn('[settle][balances] RPC health check failed:', healthCheck.error);
        setBalanceFetchFailed(true);
        setError(healthCheck.error || 'Solana network unavailable');
        setErrorType('network');
        return;
      }
      
      const [usdc, sol] = await withTimeout(
        () => Promise.all([
          getUsdcBalance(publicKey),
          getSolBalance(publicKey),
        ]),
        15000,
        'Balance fetch timed out'
      );
      
      console.log('[settle][balances] RESULT', {
        payer: `${publicKey.slice(0, 8)}...`,
        usdc,
        sol,
      });
      
      setUsdcBalance(usdc);
      setSolBalance(sol);
      
      if (sol < MIN_SOL_FOR_FEES) {
        setError(`You need about ${MIN_SOL_FOR_FEES} SOL to cover transaction fees`);
        setErrorType('fee');
      }
    } catch (err: any) {
      console.error('[settle][balances] FAILED:', err);
      setBalanceFetchFailed(true);
      setRpcAvailable(false);
      
      const errMsg = getRpcErrorMessage(err);
      setError(errMsg + ' You can still try to settle.');
      setErrorType('network');
    } finally {
      isLoadingBalancesRef.current = false;
      setStatus('idle');
    }
  }, [publicKey, to]);
  
  // Track last loaded payer to detect actual changes
  const lastLoadedPayerRef = useRef<string | null>(null);
  
  // Effect to load balances when wallet connects or payer changes
  // IMPORTANT: Do NOT include loadBalances in deps - it causes loops
  useEffect(() => {
    const payerChanged = publicKey !== lastLoadedPayerRef.current;
    const shouldLoad = publicKey && payerChanged && !isLoadingBalancesRef.current;
    
    console.log('[settle][effect] Balance load check', {
      publicKey: publicKey ? `${publicKey.slice(0, 8)}...` : null,
      payerChanged,
      shouldLoad,
    });
    
    if (shouldLoad) {
      lastLoadedPayerRef.current = publicKey;
      loadBalances();
    }
  }, [publicKey]); // NOTE: loadBalances intentionally omitted
  
  // Reset on disconnect
  useEffect(() => {
    if (!publicKey) {
      lastLoadedPayerRef.current = null;
    }
  }, [publicKey]);
  
  const handleAmountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (currency === 'USDC' && parts[1]?.length > 2) return;
    if (currency === 'SOL' && parts[1]?.length > 9) return;
    setAmount(cleaned);
    setError('');
    setErrorType(null);
  };
  
  const validateAmount = (): boolean => {
    if (solBalance !== null && solBalance < MIN_SOL_FOR_FEES) {
      setError(`You need about ${MIN_SOL_FOR_FEES} SOL for transaction fees`);
      setErrorType('fee');
      return false;
    }
    
    if (parsedAmount <= 0) {
      setError('Please enter an amount greater than zero');
      setErrorType('general');
      return false;
    }
    
    if (currency === 'USDC') {
      if (usdcBalance === null || usdcBalance === 0) {
        setError('You don\'t have any USDC to send');
        setErrorType('balance');
        return false;
      }
      if (parsedAmount > usdcBalance) {
        setError(`You only have $${usdcBalance.toFixed(2)} USDC available`);
        setErrorType('balance');
        return false;
      }
    }
    
    if (currency === 'SOL') {
      const maxSendable = (solBalance ?? 0) - MIN_SOL_FOR_FEES;
      if (parsedAmount > maxSendable) {
        setError(`Maximum you can send: ${Math.max(0, maxSendable).toFixed(4)} SOL`);
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
    if (!validateAmount()) return;
    setStatus('confirming');
  };
  
  const handleSendTransaction = async () => {
    if (isSendingRef.current || txSignature) {
      console.warn('Prevented double-send');
      return;
    }
    
    if (!publicKey || !to || !groupId) return;
    if (!validateAmount()) {
      setStatus('idle');
      return;
    }
    
    isSendingRef.current = true;
    setStatus('signing');
    setError('');
    setErrorType(null);
    setPaymentError(null);
    
    try {
      const signature = currency === 'USDC'
        ? await sendUsdcTransfer(publicKey, to, parsedAmount)
        : await sendSolTransfer(publicKey, to, parsedAmount);
      
      setTxSignature(signature);
      
      await addTxHistory({
        signature,
        from: publicKey,
        to,
        amount: parsedAmount,
        currency,
        status: 'pending',
        groupId,
      });
      
      setStatus('pending');
      const result = await waitForConfirmation(signature);
      
      if (result.status === 'confirmed') {
        await addSettlement({
          groupId,
          from: publicKey,
          to,
          amount: parsedAmount,
          currency,
          txSignature: signature,
          status: 'confirmed',
        });
        await updateTxStatus(signature, 'confirmed');
        setStatus('success');
      } else if (result.status === 'failed') {
        await updateTxStatus(signature, 'failed', result.error);
        setError(result.error || 'Transaction failed');
        setErrorType('general');
        setStatus('error');
      } else {
        setError('Taking longer than expected. You can check the status below.');
        setErrorType('timeout');
      }
    } catch (err: any) {
      console.error('Settlement error:', err);
      
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
        if (publicKey && to && groupId) {
          await addSettlement({
            groupId,
            from: publicKey,
            to,
            amount: parsedAmount,
            currency,
            txSignature,
            status: 'confirmed',
          });
        }
        await updateTxStatus(txSignature, 'confirmed');
        setStatus('success');
      } else if (result.status === 'failed') {
        await updateTxStatus(txSignature, 'failed', result.error);
        setError(result.error || 'Transaction failed');
        setErrorType('general');
        setStatus('error');
      } else {
        setError('Still processing. Try again in a moment.');
        setErrorType('timeout');
        setStatus('pending');
      }
    } catch (err: any) {
      setError('Unable to check status');
      setErrorType('network');
      setStatus('pending');
    }
  };
  
  // Manual retry for balance loading
  const handleRetryBalances = useCallback(() => {
    console.log('[settle][retry] Manual balance refresh triggered');
    setBalanceFetchFailed(false);
    isLoadingBalancesRef.current = false;
    loadBalances();
  }, [loadBalances]);
  
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
  
  const handleDone = () => router.back();
  const handleCancel = () => {
    setStatus('idle');
    setError('');
    setPaymentError(null);
  };
  
  if (!group || !to) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorEmoji}>🔍</Text>
          <Text style={styles.errorTitle}>Invalid Settlement</Text>
          <Text style={styles.errorMessage}>Unable to find the payment details.</Text>
          <Button title="Go Back" onPress={handleDone} variant="outline" />
        </View>
      </View>
    );
  }
  
  // ========== SUCCESS SCREEN ==========
  if (status === 'success' && txSignature) {
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
              {currency === 'USDC' ? '$' : ''}{parsedAmount.toFixed(currency === 'USDC' ? 2 : 4)} {currency}
            </Text>
            <Text style={styles.successRecipient}>to {recipientDisplay}</Text>
            
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
            <Button title="Done" onPress={handleDone} size="large" fullWidth />
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
              Your payment has been sent and is being confirmed on the blockchain.
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
              onPress={handleDone} 
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
              onPress={paymentError?.recoverable || txSignature ? handleRetry : handleDone} 
              size="large"
              style={styles.flexButton}
            />
            <Button 
              title="Cancel" 
              onPress={handleDone} 
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
  if (status === 'confirming' || status === 'signing') {
    return (
      <>
        <Stack.Screen options={{ title: 'Confirm Payment' }} />
        <View style={styles.container}>
          <ScrollView style={styles.scrollContent}>
            <View style={styles.confirmHeader}>
              <Text style={styles.confirmTitle}>Review Payment</Text>
              <Text style={styles.confirmSubtitle}>Please confirm the details below</Text>
            </View>
            
            <Card style={styles.confirmCard}>
              <Text style={styles.confirmLabel}>Amount</Text>
              <Text style={styles.confirmAmount}>
                {currency === 'USDC' ? '$' : ''}{parsedAmount.toFixed(currency === 'USDC' ? 2 : 4)} {currency}
              </Text>
            </Card>
            
            <Card style={styles.confirmCard}>
              <Text style={styles.confirmLabel}>Recipient</Text>
              <Text style={styles.confirmValue}>{recipientDisplay}</Text>
              <Text style={styles.confirmAddress}>{to}</Text>
            </Card>
            
            <Card style={styles.confirmCard}>
              <View style={styles.confirmRow}>
                <View>
                  <Text style={styles.confirmLabel}>Network</Text>
                  <Text style={styles.confirmValue}>{networkName}</Text>
                </View>
                <View>
                  <Text style={styles.confirmLabel}>Est. Fee</Text>
                  <Text style={styles.confirmValue}>~0.00025 SOL</Text>
                </View>
              </View>
            </Card>
            
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
              title={status === 'signing' ? 'Sending...' : 'Send Payment'} 
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
  
  // ========== MAIN FORM ==========
  return (
    <>
      <Stack.Screen options={{ title: 'Settle Up' }} />
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Recipient */}
          <Card style={styles.recipientCard}>
            <Text style={styles.recipientLabel}>Paying</Text>
            <Text style={styles.recipientName}>{recipientDisplay}</Text>
            <Text style={styles.recipientAddress}>
              {to?.slice(0, 8)}···{to?.slice(-8)}
            </Text>
            <NetworkBadge style={styles.recipientBadge} />
          </Card>
          
          {/* Currency Toggle */}
          <View style={styles.currencyToggle}>
            <TouchableOpacity
              style={[styles.currencyOption, currency === 'USDC' && styles.currencyOptionActive]}
              onPress={() => setCurrency('USDC')}
            >
              <Text style={[styles.currencyText, currency === 'USDC' && styles.currencyTextActive]}>
                USDC
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.currencyOption, currency === 'SOL' && styles.currencyOptionActive]}
              onPress={() => setCurrency('SOL')}
            >
              <Text style={[styles.currencyText, currency === 'SOL' && styles.currencyTextActive]}>
                SOL
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Balance */}
          <View style={styles.balanceRow}>
            {status === 'loading-balance' ? (
              <ActivityIndicator color={COLORS.textSecondary} size="small" />
            ) : (
              <>
                <Text style={styles.balanceText}>
                  Balance: {currency === 'USDC' 
                    ? `$${(usdcBalance ?? 0).toFixed(2)}`
                    : `${(solBalance ?? 0).toFixed(4)} SOL`
                  }
                </Text>
                <TouchableOpacity onPress={handleRetryBalances}>
                  <Text style={styles.refreshText}>Refresh</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          
          {/* Fee Warning */}
          {solBalance !== null && solBalance < MIN_SOL_FOR_FEES && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningBannerText}>
                ⚠️ Low SOL balance! You need about {MIN_SOL_FOR_FEES} SOL for fees.
              </Text>
              {faucetUrl && (
                <TouchableOpacity onPress={handleOpenFaucet}>
                  <Text style={styles.warningLink}>Get {networkName} SOL →</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          
          {/* Amount Input */}
          <View style={styles.amountSection}>
            <View style={styles.amountInputRow}>
              {currency === 'USDC' && <Text style={styles.amountSymbol}>$</Text>}
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={handleAmountChange}
                placeholder="0.00"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="decimal-pad"
              />
              <Text style={styles.amountCurrency}>{currency}</Text>
            </View>
          </View>
          
          {/* Quick Amounts */}
          {currency === 'USDC' && (
            <View style={styles.quickAmounts}>
              {['5', '10', '25', '50'].map((qa) => (
                <TouchableOpacity
                  key={qa}
                  style={styles.quickAmountButton}
                  onPress={() => setAmount(qa)}
                >
                  <Text style={styles.quickAmountText}>${qa}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          
          {/* Max Button for SOL */}
          {currency === 'SOL' && solBalance !== null && solBalance > MIN_SOL_FOR_FEES && (
            <TouchableOpacity 
              style={styles.maxButton}
              onPress={() => setAmount(Math.max(0, solBalance - MIN_SOL_FOR_FEES).toFixed(4))}
            >
              <Text style={styles.maxButtonText}>
                Use Max ({(solBalance - MIN_SOL_FOR_FEES).toFixed(4)} SOL)
              </Text>
            </TouchableOpacity>
          )}
          
          {error && errorType !== 'fee' && (
            <Text style={styles.formError}>{error}</Text>
          )}
        </ScrollView>
        
        <View style={styles.footer}>
          <Button
            title="Continue"
            onPress={handleProceedToConfirm}
            disabled={parsedAmount <= 0 || (solBalance !== null && solBalance < MIN_SOL_FOR_FEES)}
            size="large"
            fullWidth
          />
        </View>
      </KeyboardAvoidingView>
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
  
  // Recipient Card
  recipientCard: { 
    alignItems: 'center', 
    marginBottom: SPACING['2xl'],
    paddingVertical: SPACING['2xl'],
  },
  recipientLabel: { 
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary, 
    marginBottom: SPACING.sm,
  },
  recipientName: { 
    ...TYPOGRAPHY.h2,
    color: COLORS.text, 
    marginBottom: SPACING.xs,
  },
  recipientAddress: { 
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted, 
    fontFamily: 'monospace',
    marginBottom: SPACING.md,
  },
  recipientBadge: {
    marginTop: SPACING.sm,
  },
  
  // Currency Toggle
  currencyToggle: { 
    flexDirection: 'row', 
    backgroundColor: COLORS.surface, 
    borderRadius: RADIUS.md, 
    padding: SPACING.xs, 
    marginBottom: SPACING.lg,
  },
  currencyOption: { 
    flex: 1, 
    paddingVertical: SPACING.md, 
    alignItems: 'center', 
    borderRadius: RADIUS.sm,
  },
  currencyOptionActive: { 
    backgroundColor: COLORS.primary,
  },
  currencyText: { 
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textSecondary,
  },
  currencyTextActive: { 
    color: COLORS.text,
  },
  
  // Balance
  balanceRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: SPACING.lg, 
    gap: SPACING.md,
  },
  balanceText: { 
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
  },
  refreshText: { 
    ...TYPOGRAPHY.smallMedium,
    color: COLORS.primary,
  },
  
  // Warnings
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
  
  // Amount Input
  amountSection: {
    marginBottom: SPACING.lg,
  },
  amountInputRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: COLORS.surface, 
    borderRadius: RADIUS.md, 
    paddingHorizontal: SPACING.lg,
  },
  amountSymbol: { 
    fontSize: 32, 
    color: COLORS.textMuted, 
    marginRight: SPACING.sm,
    fontWeight: '300',
  },
  amountInput: { 
    flex: 1, 
    fontSize: 32, 
    color: COLORS.text, 
    paddingVertical: SPACING.lg,
    fontWeight: '500',
  },
  amountCurrency: { 
    ...TYPOGRAPHY.body,
    color: COLORS.textMuted, 
    marginLeft: SPACING.sm,
  },
  
  // Quick Amounts
  quickAmounts: { 
    flexDirection: 'row', 
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  quickAmountButton: { 
    flex: 1, 
    backgroundColor: COLORS.surface, 
    borderRadius: RADIUS.sm, 
    paddingVertical: SPACING.md, 
    alignItems: 'center',
  },
  quickAmountText: { 
    ...TYPOGRAPHY.smallMedium,
    color: COLORS.text,
  },
  
  // Max Button
  maxButton: { 
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  maxButtonText: { 
    ...TYPOGRAPHY.smallMedium,
    color: COLORS.primary,
  },
  
  // Form Error
  formError: { 
    ...TYPOGRAPHY.small,
    color: COLORS.error, 
    textAlign: 'center',
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
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
});
