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
import { Button, NetworkBadge } from '../../components';
import { COLORS, MIN_SOL_FOR_FEES, getFaucetUrl, getNetworkName } from '../../lib/constants';
import { 
  sendUsdcTransfer,
  sendSolTransfer,
  waitForConfirmation,
  checkTransactionStatus,
  getUsdcBalance, 
  getSolBalance,
  getExplorerUrl,
  categorizeError,
} from '../../lib/solana';
import { SettleStatus, SettleErrorType } from '../../lib/types';

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
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [copiedSignature, setCopiedSignature] = useState(false);
  
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  
  // Guard against double-send
  const isSendingRef = useRef(false);
  
  const recipient = group?.members.find(m => m.wallet === to);
  const recipientDisplay = recipient?.nickname || 
    (to ? `${to.slice(0, 4)}...${to.slice(-4)}` : 'Unknown');
  
  const networkName = getNetworkName();
  const faucetUrl = getFaucetUrl();
  const parsedAmount = parseFloat(amount) || 0;
  
  // Load balances
  const loadBalances = useCallback(async () => {
    if (!publicKey) return;
    
    setStatus('loading-balance');
    setError('');
    setErrorType(null);
    
    try {
      const [usdc, sol] = await Promise.all([
        getUsdcBalance(publicKey),
        getSolBalance(publicKey),
      ]);
      setUsdcBalance(usdc);
      setSolBalance(sol);
      
      if (sol < MIN_SOL_FOR_FEES) {
        setError(`Low SOL balance! You need ~${MIN_SOL_FOR_FEES} SOL for fees.`);
        setErrorType('fee');
      }
    } catch (err) {
      console.error('Failed to load balances:', err);
      setError('Failed to load balances. Check connection.');
      setErrorType('network');
    }
    setStatus('idle');
  }, [publicKey]);
  
  useEffect(() => {
    loadBalances();
  }, [loadBalances]);
  
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
      setError(`Insufficient SOL for fees. Need ~${MIN_SOL_FOR_FEES} SOL.`);
      setErrorType('fee');
      return false;
    }
    
    if (parsedAmount <= 0) {
      setError('Please enter a valid amount');
      setErrorType('general');
      return false;
    }
    
    if (currency === 'USDC') {
      if (usdcBalance === null || usdcBalance === 0) {
        setError('You don\'t have any USDC.');
        setErrorType('balance');
        return false;
      }
      if (parsedAmount > usdcBalance) {
        setError(`Insufficient USDC. Have $${usdcBalance.toFixed(2)}`);
        setErrorType('balance');
        return false;
      }
    }
    
    if (currency === 'SOL') {
      const maxSendable = (solBalance ?? 0) - MIN_SOL_FOR_FEES;
      if (parsedAmount > maxSendable) {
        setError(`Max sendable: ${Math.max(0, maxSendable).toFixed(4)} SOL`);
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
  
  // Send transaction
  const handleSendTransaction = async () => {
    // Double-send guard
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
    
    try {
      // Send transaction (doesn't wait for confirmation)
      const signature = currency === 'USDC'
        ? await sendUsdcTransfer(publicKey, to, parsedAmount)
        : await sendSolTransfer(publicKey, to, parsedAmount);
      
      setTxSignature(signature);
      
      // Record pending tx
      await addTxHistory({
        signature,
        from: publicKey,
        to,
        amount: parsedAmount,
        currency,
        status: 'pending',
        groupId,
      });
      
      // Now wait for confirmation
      setStatus('pending');
      const result = await waitForConfirmation(signature);
      
      if (result.status === 'confirmed') {
        // Record settlement
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
        // Still pending after timeout
        setError('Confirmation taking longer than expected');
        setErrorType('timeout');
        // Keep status as 'pending' to allow "Check status"
      }
    } catch (err: any) {
      console.error('Settlement error:', err);
      const { type, message } = categorizeError(err);
      setError(message);
      setErrorType(type);
      
      if (type === 'rejected') {
        // User cancelled - reset to idle, allow retry
        setTxSignature(null);
        setStatus('idle');
      } else {
        setStatus('error');
      }
    } finally {
      isSendingRef.current = false;
    }
  };
  
  // Check status of existing transaction (no re-send)
  const handleCheckStatus = async () => {
    if (!txSignature) return;
    
    setStatus('checking');
    setError('');
    
    try {
      const result = await checkTransactionStatus(txSignature);
      
      if (result.status === 'confirmed') {
        // Record settlement if not already
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
        setError('Still pending. Try again in a moment.');
        setErrorType('timeout');
        setStatus('pending');
      }
    } catch (err: any) {
      setError('Failed to check status');
      setErrorType('network');
      setStatus('pending');
    }
  };
  
  // Retry: if no signature, allow new send; if signature exists, only check status
  const handleRetry = () => {
    if (txSignature) {
      handleCheckStatus();
    } else {
      setStatus('idle');
      setError('');
      setErrorType(null);
      loadBalances();
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
  };
  
  if (!group || !to) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Invalid settlement</Text>
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
            <Text style={styles.successEmoji}>✅</Text>
            <Text style={styles.successTitle}>Payment Sent!</Text>
            <Text style={styles.successAmount}>
              {currency === 'USDC' ? '$' : ''}{parsedAmount.toFixed(currency === 'USDC' ? 2 : 4)} {currency}
            </Text>
            <Text style={styles.successRecipient}>to {recipientDisplay}</Text>
            
            <View style={styles.signatureBox}>
              <Text style={styles.signatureLabel}>Transaction</Text>
              <Text style={styles.signatureText} numberOfLines={1}>
                {txSignature.slice(0, 20)}...{txSignature.slice(-8)}
              </Text>
            </View>
            
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleViewExplorer}>
                <Text style={styles.actionBtnText}>View on Solscan</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={handleCopySignature}>
                <Text style={styles.actionBtnText}>
                  {copiedSignature ? '✓ Copied' : 'Copy Signature'}
                </Text>
              </TouchableOpacity>
            </View>
            
            <NetworkBadge style={styles.networkBadge} />
          </View>
          
          <View style={styles.footerSingle}>
            <Button title="Done" onPress={handleDone} size="large" />
          </View>
        </View>
      </>
    );
  }
  
  // ========== PENDING SCREEN (timeout, waiting) ==========
  if (status === 'pending' && txSignature) {
    return (
      <>
        <Stack.Screen options={{ title: 'Pending...' }} />
        <View style={styles.container}>
          <View style={styles.centerContent}>
            <ActivityIndicator color={COLORS.warning} size="large" />
            <Text style={styles.pendingTitle}>Transaction Pending</Text>
            <Text style={styles.pendingText}>
              Your transaction was sent but confirmation is taking longer than expected.
            </Text>
            
            <View style={styles.signatureBox}>
              <Text style={styles.signatureLabel}>Transaction</Text>
              <Text style={styles.signatureText} numberOfLines={1}>
                {txSignature.slice(0, 20)}...{txSignature.slice(-8)}
              </Text>
            </View>
            
            {error && <Text style={styles.warningText}>{error}</Text>}
            
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleViewExplorer}>
                <Text style={styles.actionBtnText}>View on Solscan</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={handleCopySignature}>
                <Text style={styles.actionBtnText}>
                  {copiedSignature ? '✓ Copied' : 'Copy Signature'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.footerRow}>
            <Button 
              title="Check Status" 
              onPress={handleCheckStatus} 
              size="large" 
              style={styles.flexBtn}
            />
            <Button 
              title="Close" 
              onPress={handleDone} 
              variant="outline" 
              size="large"
              style={styles.flexBtn}
            />
          </View>
        </View>
      </>
    );
  }
  
  // ========== ERROR SCREEN ==========
  if (status === 'error') {
    return (
      <>
        <Stack.Screen options={{ title: 'Error' }} />
        <View style={styles.container}>
          <View style={styles.centerContent}>
            <Text style={styles.errorEmoji}>❌</Text>
            <Text style={styles.errorTitle}>Transaction Failed</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            
            {txSignature && (
              <View style={styles.signatureBox}>
                <Text style={styles.signatureLabel}>Transaction</Text>
                <Text style={styles.signatureText} numberOfLines={1}>
                  {txSignature.slice(0, 20)}...{txSignature.slice(-8)}
                </Text>
              </View>
            )}
            
            {errorType === 'fee' && faucetUrl && (
              <TouchableOpacity style={styles.helpBtn} onPress={handleOpenFaucet}>
                <Text style={styles.helpBtnText}>Get {networkName} SOL →</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.footerRow}>
            <Button 
              title={txSignature ? "Check Status" : "Try Again"} 
              onPress={handleRetry} 
              size="large"
              style={styles.flexBtn}
            />
            <Button 
              title="Cancel" 
              onPress={handleDone} 
              variant="outline" 
              size="large"
              style={styles.flexBtn}
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
            <Text style={styles.signingText}>Checking transaction status...</Text>
          </View>
        </View>
      </>
    );
  }
  
  // ========== CONFIRMATION / SIGNING SCREEN ==========
  if (status === 'confirming' || status === 'signing') {
    return (
      <>
        <Stack.Screen options={{ title: 'Confirm Payment' }} />
        <View style={styles.container}>
          <ScrollView style={styles.content}>
            <Text style={styles.confirmTitle}>Confirm Payment</Text>
            
            <View style={styles.confirmCard}>
              <Text style={styles.confirmLabel}>Amount</Text>
              <Text style={styles.confirmValue}>
                {currency === 'USDC' ? '$' : ''}{parsedAmount.toFixed(currency === 'USDC' ? 2 : 4)} {currency}
              </Text>
            </View>
            
            <View style={styles.confirmCard}>
              <Text style={styles.confirmLabel}>To</Text>
              <Text style={styles.confirmValue}>{recipientDisplay}</Text>
              <Text style={styles.confirmAddress}>{to}</Text>
            </View>
            
            <View style={styles.confirmCard}>
              <Text style={styles.confirmLabel}>Network</Text>
              <Text style={styles.confirmValue}>{networkName}</Text>
            </View>
            
            <View style={styles.confirmCard}>
              <Text style={styles.confirmLabel}>Estimated Fee</Text>
              <Text style={styles.confirmValue}>~0.00025 SOL</Text>
            </View>
            
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            )}
            
            {status === 'signing' && (
              <View style={styles.signingBox}>
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
              style={styles.flexBtn}
              disabled={status === 'signing'}
            />
            <Button 
              title={status === 'signing' ? 'Sending...' : 'Send Payment'} 
              onPress={handleSendTransaction} 
              size="large"
              style={styles.flexBtn}
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
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <NetworkBadge style={styles.networkBadgeCenter} />
          
          {/* Recipient */}
          <View style={styles.recipientCard}>
            <Text style={styles.recipientLabel}>Paying</Text>
            <Text style={styles.recipientName}>{recipientDisplay}</Text>
            <Text style={styles.recipientAddress}>
              {to?.slice(0, 8)}...{to?.slice(-8)}
            </Text>
          </View>
          
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
                <TouchableOpacity onPress={loadBalances}>
                  <Text style={styles.refreshText}>Refresh</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          
          {/* Fee Warning */}
          {solBalance !== null && solBalance < MIN_SOL_FOR_FEES && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningBannerText}>
                ⚠️ Low SOL! Need ~{MIN_SOL_FOR_FEES} SOL for fees.
              </Text>
              {faucetUrl && (
                <TouchableOpacity onPress={handleOpenFaucet}>
                  <Text style={styles.warningLink}>Get {networkName} SOL →</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          
          {/* Amount Input */}
          <Text style={styles.label}>Amount</Text>
          <View style={styles.amountContainer}>
            {currency === 'USDC' && <Text style={styles.currencySymbol}>$</Text>}
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={handleAmountChange}
              placeholder="0.00"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="decimal-pad"
            />
            <Text style={styles.currencyLabel}>{currency}</Text>
          </View>
          
          {/* Quick amounts */}
          {currency === 'USDC' && (
            <View style={styles.quickAmounts}>
              {['5', '10', '25', '50'].map((qa) => (
                <TouchableOpacity
                  key={qa}
                  style={styles.quickAmountBtn}
                  onPress={() => setAmount(qa)}
                >
                  <Text style={styles.quickAmountText}>${qa}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          
          {/* Max button for SOL */}
          {currency === 'SOL' && solBalance !== null && solBalance > MIN_SOL_FOR_FEES && (
            <TouchableOpacity 
              style={styles.maxBtn}
              onPress={() => setAmount(Math.max(0, solBalance - MIN_SOL_FOR_FEES).toFixed(4))}
            >
              <Text style={styles.maxBtnText}>
                Use Max ({(solBalance - MIN_SOL_FOR_FEES).toFixed(4)} SOL)
              </Text>
            </TouchableOpacity>
          )}
          
          {error && errorType !== 'fee' && (
            <Text style={styles.formError}>{error}</Text>
          )}
        </ScrollView>
        
        <View style={styles.footerSingle}>
          <Button
            title="Continue"
            onPress={handleProceedToConfirm}
            disabled={parsedAmount <= 0 || (solBalance !== null && solBalance < MIN_SOL_FOR_FEES)}
            size="large"
          />
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, padding: 20 },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  
  // Network badge
  networkBadge: { marginTop: 16 },
  networkBadgeCenter: { alignSelf: 'center', marginBottom: 20 },
  
  // Recipient
  recipientCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 20 },
  recipientLabel: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 8 },
  recipientName: { fontSize: 24, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  recipientAddress: { fontSize: 12, color: COLORS.textSecondary, fontFamily: 'monospace' },
  
  // Currency toggle
  currencyToggle: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: 12, padding: 4, marginBottom: 16 },
  currencyOption: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  currencyOptionActive: { backgroundColor: COLORS.primary },
  currencyText: { fontSize: 16, color: COLORS.textSecondary, fontWeight: '600' },
  currencyTextActive: { color: COLORS.text },
  
  // Balance
  balanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16, gap: 12 },
  balanceText: { fontSize: 14, color: COLORS.textSecondary },
  refreshText: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  
  // Warnings
  warningBanner: { backgroundColor: COLORS.warning + '20', borderRadius: 12, padding: 12, marginBottom: 16 },
  warningBannerText: { fontSize: 14, color: COLORS.warning },
  warningLink: { fontSize: 14, color: COLORS.primary, fontWeight: '600', marginTop: 8 },
  warningText: { fontSize: 14, color: COLORS.warning, textAlign: 'center', marginTop: 12 },
  
  // Amount input
  label: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  amountContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 12, paddingHorizontal: 16 },
  currencySymbol: { fontSize: 32, color: COLORS.textSecondary, marginRight: 8 },
  amountInput: { flex: 1, fontSize: 32, color: COLORS.text, paddingVertical: 16 },
  currencyLabel: { fontSize: 18, color: COLORS.textSecondary, marginLeft: 8 },
  
  // Quick amounts
  quickAmounts: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, gap: 8 },
  quickAmountBtn: { flex: 1, backgroundColor: COLORS.surfaceLight, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  quickAmountText: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  
  // Max button
  maxBtn: { marginTop: 16, alignItems: 'center' },
  maxBtnText: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  
  // Form error
  formError: { color: COLORS.error, fontSize: 14, marginTop: 16, textAlign: 'center' },
  
  // Footer
  footerSingle: { padding: 20, paddingBottom: 40 },
  footerRow: { padding: 20, paddingBottom: 40, flexDirection: 'row', gap: 12 },
  flexBtn: { flex: 1 },
  
  // Confirm screen
  confirmTitle: { fontSize: 24, fontWeight: '600', color: COLORS.text, textAlign: 'center', marginBottom: 24 },
  confirmCard: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, marginBottom: 12 },
  confirmLabel: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 4 },
  confirmValue: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  confirmAddress: { fontSize: 12, color: COLORS.textSecondary, fontFamily: 'monospace', marginTop: 4 },
  
  // Error banner
  errorBanner: { backgroundColor: COLORS.error + '20', borderRadius: 12, padding: 12, marginTop: 12 },
  errorBannerText: { fontSize: 14, color: COLORS.error, textAlign: 'center' },
  
  // Signing
  signingBox: { alignItems: 'center', marginTop: 32 },
  signingText: { fontSize: 16, color: COLORS.textSecondary, marginTop: 16 },
  
  // Success
  successEmoji: { fontSize: 64, marginBottom: 16 },
  successTitle: { fontSize: 28, fontWeight: '600', color: COLORS.text, marginBottom: 16 },
  successAmount: { fontSize: 36, fontWeight: '700', color: COLORS.success, marginBottom: 8 },
  successRecipient: { fontSize: 18, color: COLORS.textSecondary, marginBottom: 24 },
  
  // Pending
  pendingTitle: { fontSize: 24, fontWeight: '600', color: COLORS.warning, marginTop: 16, marginBottom: 8 },
  pendingText: { fontSize: 16, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 24 },
  
  // Error screen
  errorEmoji: { fontSize: 64, marginBottom: 16 },
  errorTitle: { fontSize: 24, fontWeight: '600', color: COLORS.error, marginBottom: 12 },
  errorMessage: { fontSize: 16, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 24 },
  errorText: { color: COLORS.error, fontSize: 16, textAlign: 'center', marginTop: 40 },
  
  // Signature box
  signatureBox: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, marginBottom: 16, width: '100%' },
  signatureLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 },
  signatureText: { fontSize: 14, color: COLORS.text, fontFamily: 'monospace' },
  
  // Action buttons
  actionButtons: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  actionBtn: { backgroundColor: COLORS.surface, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  actionBtnText: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  
  // Help button
  helpBtn: { backgroundColor: COLORS.surface, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, marginBottom: 16 },
  helpBtnText: { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
});
