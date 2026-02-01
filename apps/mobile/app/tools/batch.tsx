/**
 * Batch Payouts Screen
 * 
 * Part 1 of 2: Paste list + manual add
 * TODO (Part 2): CSV import, resume after restart, NFT batch
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { PublicKey } from '@solana/web3.js';
import { useWalletPublicKey } from '../../stores/walletStore';
import { useGroupStore } from '../../stores/groupStore';
import { Button, Card, NetworkBadge, SectionHeader } from '../../components';
import {
  COLORS,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  MIN_SOL_FOR_FEES,
  FEE_PERCENT,
  FEE_WALLET,
  calculateFee,
  isFeeConfigured,
  getCurrentUsdcMint,
  getFaucetUrl,
  getNetworkName,
} from '../../lib/constants';
import {
  getSolBalance,
  getTokenBalance,
  getTokenDecimals,
  sendSolTransferWithFee,
  sendSplTokenTransferWithFee,
  waitForConfirmation,
  checkTransactionStatus,
  getExplorerUrl,
  categorizeError,
} from '../../lib/solana';
import { isValidSolanaAddress, shortenAddress } from '../../lib/validation';

// ============================================
// Types
// ============================================

type PayoutAsset = 'SOL' | 'USDC' | 'CUSTOM';

type RowStatus = 'pending' | 'queued' | 'sending' | 'sent' | 'confirmed' | 'failed';

interface PayoutRow {
  id: string;
  recipient: string;
  amount: number;
  status: RowStatus;
  error?: string;
  signature?: string;
  isValid: boolean;
  validationError?: string;
}

type BatchPhase = 'input' | 'preview' | 'executing' | 'done';

// ============================================
// Component
// ============================================

export default function BatchPayoutScreen() {
  const router = useRouter();
  const publicKey = useWalletPublicKey();
  const addTxHistory = useGroupStore((state) => state.addTxHistory);
  const updateTxStatus = useGroupStore((state) => state.updateTxStatus);

  // Asset selection
  const [asset, setAsset] = useState<PayoutAsset>('USDC');
  const [customMint, setCustomMint] = useState('');
  const [tokenDecimals, setTokenDecimals] = useState(6);

  // Rows
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const [pasteInput, setPasteInput] = useState('');

  // Manual add
  const [manualRecipient, setManualRecipient] = useState('');
  const [manualAmount, setManualAmount] = useState('');

  // Balances
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);

  // Execution state
  const [phase, setPhase] = useState<BatchPhase>('input');
  const [currentRowIndex, setCurrentRowIndex] = useState(-1);
  const stopRequestedRef = useRef(false);
  const isExecutingRef = useRef(false);

  const feeConfigured = isFeeConfigured();
  const networkName = getNetworkName();
  const faucetUrl = getFaucetUrl();

  // Get mint address
  const getMintAddress = (): string => {
    if (asset === 'SOL') return '';
    if (asset === 'USDC') return getCurrentUsdcMint();
    return customMint;
  };

  // Load balances
  const loadBalances = useCallback(async () => {
    if (!publicKey) return;
    setIsLoadingBalances(true);
    try {
      const sol = await getSolBalance(publicKey);
      setSolBalance(sol);

      if (asset !== 'SOL') {
        const mint = getMintAddress();
        if (mint && isValidSolanaAddress(mint)) {
          const decimals = await getTokenDecimals(mint);
          setTokenDecimals(decimals);
          const balance = await getTokenBalance(publicKey, mint);
          setTokenBalance(balance);
        } else {
          setTokenBalance(null);
        }
      }
    } catch (err) {
      console.error('Failed to load balances:', err);
    }
    setIsLoadingBalances(false);
  }, [publicKey, asset, customMint]);

  useEffect(() => {
    loadBalances();
  }, [loadBalances]);

  // Validate a single row
  const validateRow = (recipient: string, amount: number): { isValid: boolean; error?: string } => {
    if (!recipient.trim()) {
      return { isValid: false, error: 'Missing recipient' };
    }
    if (!isValidSolanaAddress(recipient.trim())) {
      return { isValid: false, error: 'Invalid address' };
    }
    if (isNaN(amount) || amount <= 0) {
      return { isValid: false, error: 'Invalid amount' };
    }
    if (amount > 1000000) {
      return { isValid: false, error: 'Amount too large' };
    }
    return { isValid: true };
  };

  // Parse paste input
  const handleParsePaste = () => {
    const lines = pasteInput.split('\n').filter(line => line.trim());
    const newRows: PayoutRow[] = [];

    for (const line of lines) {
      const parts = line.split(/[,\t]/).map(p => p.trim());
      const recipient = parts[0] || '';
      const amount = parseFloat(parts[1] || '0');
      const validation = validateRow(recipient, amount);

      newRows.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        recipient: recipient.trim(),
        amount: isNaN(amount) ? 0 : amount,
        status: 'pending',
        isValid: validation.isValid,
        validationError: validation.error,
      });
    }

    setRows(prev => [...prev, ...newRows]);
    setPasteInput('');
  };

  // Add manual row
  const handleAddManual = () => {
    const amount = parseFloat(manualAmount);
    const validation = validateRow(manualRecipient, amount);

    const newRow: PayoutRow = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      recipient: manualRecipient.trim(),
      amount: isNaN(amount) ? 0 : amount,
      status: 'pending',
      isValid: validation.isValid,
      validationError: validation.error,
    };

    setRows(prev => [...prev, newRow]);
    setManualRecipient('');
    setManualAmount('');
  };

  // Remove row
  const handleRemoveRow = (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id));
  };

  // Clear all
  const handleClearAll = () => {
    setRows([]);
  };

  // Calculate totals
  const validRows = rows.filter(r => r.isValid);
  const invalidRows = rows.filter(r => !r.isValid);
  const totalAmount = validRows.reduce((sum, r) => sum + r.amount, 0);
  const totalFee = validRows.reduce((sum, r) => sum + calculateFee(r.amount), 0);
  const totalCost = totalAmount + totalFee;

  // Check if can proceed
  const canProceed = validRows.length > 0 && feeConfigured;

  // Proceed to preview
  const handleProceedToPreview = () => {
    if (!canProceed) return;
    // Mark valid rows as queued
    setRows(prev => prev.map(r => ({
      ...r,
      status: r.isValid ? 'queued' : 'pending',
    })));
    setPhase('preview');
  };

  // Back to input
  const handleBackToInput = () => {
    setRows(prev => prev.map(r => ({ ...r, status: 'pending', signature: undefined, error: undefined })));
    setPhase('input');
    stopRequestedRef.current = false;
  };

  // Update row status
  const updateRowStatus = (id: string, updates: Partial<PayoutRow>) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  // Execute single row
  const executeRow = async (row: PayoutRow): Promise<void> => {
    if (!publicKey || !row.isValid) return;

    const feeAmount = calculateFee(row.amount);

    updateRowStatus(row.id, { status: 'sending' });

    try {
      let signature: string;

      if (asset === 'SOL') {
        signature = await sendSolTransferWithFee(
          publicKey,
          row.recipient,
          row.amount,
          feeAmount
        );
      } else {
        const mint = getMintAddress();
        signature = await sendSplTokenTransferWithFee(
          publicKey,
          row.recipient,
          mint,
          row.amount,
          feeAmount,
          tokenDecimals
        );
      }

      updateRowStatus(row.id, { status: 'sent', signature });

      // Record in tx history
      await addTxHistory({
        signature,
        from: publicKey,
        to: row.recipient,
        amount: row.amount,
        currency: asset === 'SOL' ? 'SOL' : 'USDC',
        status: 'pending',
      });

      // Wait for confirmation
      const result = await waitForConfirmation(signature);

      if (result.status === 'confirmed') {
        updateRowStatus(row.id, { status: 'confirmed' });
        await updateTxStatus(signature, 'confirmed');
      } else if (result.status === 'failed') {
        updateRowStatus(row.id, { status: 'failed', error: result.error || 'Failed' });
        await updateTxStatus(signature, 'failed', result.error);
      } else {
        // Still pending after timeout - leave as sent
        updateRowStatus(row.id, { status: 'sent', error: 'Confirmation pending' });
      }
    } catch (err: any) {
      const { type, message } = categorizeError(err);
      if (type === 'rejected') {
        updateRowStatus(row.id, { status: 'queued', error: 'Cancelled' });
      } else {
        updateRowStatus(row.id, { status: 'failed', error: message });
      }
    }
  };

  // Execute all rows sequentially
  const handleStartExecution = async () => {
    if (isExecutingRef.current) return;
    isExecutingRef.current = true;
    stopRequestedRef.current = false;
    setPhase('executing');

    const queuedRows = rows.filter(r => r.status === 'queued');

    for (let i = 0; i < queuedRows.length; i++) {
      if (stopRequestedRef.current) break;

      const row = queuedRows[i];
      setCurrentRowIndex(i);
      await executeRow(row);

      // Small delay between txs
      if (i < queuedRows.length - 1 && !stopRequestedRef.current) {
        await new Promise(res => setTimeout(res, 500));
      }
    }

    setCurrentRowIndex(-1);
    isExecutingRef.current = false;
    setPhase('done');
  };

  // Stop execution
  const handleStop = () => {
    stopRequestedRef.current = true;
  };

  // Retry failed/queued rows
  const handleRetryFailed = async () => {
    // Reset failed rows to queued
    setRows(prev => prev.map(r => 
      (r.status === 'failed' || (r.status === 'queued' && r.error)) 
        ? { ...r, status: 'queued', error: undefined } 
        : r
    ));
    setPhase('preview');
  };

  // Check status of sent rows
  const handleCheckStatus = async (row: PayoutRow) => {
    if (!row.signature) return;

    updateRowStatus(row.id, { status: 'sending' });

    try {
      const result = await checkTransactionStatus(row.signature);
      if (result.status === 'confirmed') {
        updateRowStatus(row.id, { status: 'confirmed' });
        await updateTxStatus(row.signature, 'confirmed');
      } else if (result.status === 'failed') {
        updateRowStatus(row.id, { status: 'failed', error: result.error });
        await updateTxStatus(row.signature, 'failed', result.error);
      } else {
        updateRowStatus(row.id, { status: 'sent', error: 'Still pending' });
      }
    } catch {
      updateRowStatus(row.id, { status: 'sent', error: 'Check failed' });
    }
  };

  // Stats
  const confirmedCount = rows.filter(r => r.status === 'confirmed').length;
  const failedCount = rows.filter(r => r.status === 'failed').length;
  const queuedCount = rows.filter(r => r.status === 'queued').length;
  const sentCount = rows.filter(r => r.status === 'sent').length;

  // Render row item
  const renderRowItem = ({ item, index }: { item: PayoutRow; index: number }) => {
    const fee = calculateFee(item.amount);
    const statusColor = {
      pending: COLORS.textMuted,
      queued: COLORS.textSecondary,
      sending: COLORS.warning,
      sent: COLORS.warning,
      confirmed: COLORS.success,
      failed: COLORS.error,
    }[item.status];

    const statusIcon = {
      pending: '⏳',
      queued: '📋',
      sending: '⏳',
      sent: '📤',
      confirmed: '✅',
      failed: '❌',
    }[item.status];

    return (
      <Card style={StyleSheet.flatten([styles.rowCard, !item.isValid && styles.rowCardInvalid])}>
        <View style={styles.rowHeader}>
          <Text style={styles.rowIndex}>#{index + 1}</Text>
          <Text style={[styles.rowStatus, { color: statusColor }]}>
            {statusIcon} {item.status}
          </Text>
        </View>

        <View style={styles.rowContent}>
          <View style={styles.rowField}>
            <Text style={styles.rowLabel}>To</Text>
            <Text style={styles.rowValue} numberOfLines={1}>
              {shortenAddress(item.recipient, 6)}
            </Text>
          </View>
          <View style={styles.rowField}>
            <Text style={styles.rowLabel}>Amount</Text>
            <Text style={styles.rowValue}>
              {item.amount.toFixed(asset === 'SOL' ? 4 : 2)}
            </Text>
          </View>
          <View style={styles.rowField}>
            <Text style={styles.rowLabel}>Fee</Text>
            <Text style={styles.rowValueMuted}>
              {fee.toFixed(asset === 'SOL' ? 6 : 4)}
            </Text>
          </View>
        </View>

        {!item.isValid && (
          <Text style={styles.rowError}>⚠️ {item.validationError}</Text>
        )}

        {item.error && item.isValid && (
          <Text style={styles.rowError}>⚠️ {item.error}</Text>
        )}

        {item.signature && (
          <TouchableOpacity 
            style={styles.rowLink}
            onPress={() => {}}
          >
            <Text style={styles.rowLinkText}>
              Tx: {shortenAddress(item.signature, 8)}
            </Text>
          </TouchableOpacity>
        )}

        {phase === 'input' && (
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveRow(item.id)}
          >
            <Text style={styles.removeButtonText}>✕</Text>
          </TouchableOpacity>
        )}

        {item.status === 'sent' && phase === 'done' && (
          <TouchableOpacity
            style={styles.checkButton}
            onPress={() => handleCheckStatus(item)}
          >
            <Text style={styles.checkButtonText}>Check</Text>
          </TouchableOpacity>
        )}
      </Card>
    );
  };

  // ========== NOT CONNECTED ==========
  if (!publicKey) {
    return (
      <>
        <Stack.Screen options={{ title: 'Batch Payout' }} />
        <View style={styles.container}>
          <View style={styles.centerContent}>
            <Text style={styles.errorEmoji}>🔗</Text>
            <Text style={styles.errorTitle}>Wallet Not Connected</Text>
            <Button title="Go Home" onPress={() => router.replace('/home')} />
          </View>
        </View>
      </>
    );
  }

  // ========== FEE NOT CONFIGURED ==========
  if (!feeConfigured) {
    return (
      <>
        <Stack.Screen options={{ title: 'Batch Payout' }} />
        <View style={styles.container}>
          <View style={styles.centerContent}>
            <Text style={styles.errorEmoji}>⚙️</Text>
            <Text style={styles.errorTitle}>Unavailable</Text>
            <Text style={styles.errorMessage}>
              Fee wallet not configured. Batch payouts are temporarily unavailable.
            </Text>
            <Button title="Go Back" onPress={() => router.back()} variant="outline" />
          </View>
        </View>
      </>
    );
  }

  // ========== DONE PHASE ==========
  if (phase === 'done') {
    return (
      <>
        <Stack.Screen options={{ title: 'Batch Complete' }} />
        <View style={styles.container}>
          <ScrollView style={styles.scrollContent}>
            <View style={styles.doneHeader}>
              <Text style={styles.doneEmoji}>🎉</Text>
              <Text style={styles.doneTitle}>Batch Complete</Text>
            </View>

            <Card style={styles.statsCard}>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{confirmedCount}</Text>
                  <Text style={[styles.statLabel, { color: COLORS.success }]}>Confirmed</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{sentCount}</Text>
                  <Text style={[styles.statLabel, { color: COLORS.warning }]}>Pending</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{failedCount}</Text>
                  <Text style={[styles.statLabel, { color: COLORS.error }]}>Failed</Text>
                </View>
              </View>
            </Card>

            <FlatList
              data={rows.filter(r => r.isValid)}
              renderItem={renderRowItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.rowList}
            />
          </ScrollView>

          <View style={styles.footerRow}>
            {(failedCount > 0 || queuedCount > 0) && (
              <Button
                title="Retry Failed"
                onPress={handleRetryFailed}
                variant="outline"
                size="large"
                style={styles.flexButton}
              />
            )}
            <Button
              title="Done"
              onPress={() => router.back()}
              size="large"
              style={styles.flexButton}
            />
          </View>
        </View>
      </>
    );
  }

  // ========== EXECUTING PHASE ==========
  if (phase === 'executing') {
    return (
      <>
        <Stack.Screen options={{ title: 'Sending...' }} />
        <View style={styles.container}>
          <View style={styles.executingContent}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.executingTitle}>Sending Payouts</Text>
            <Text style={styles.executingProgress}>
              {currentRowIndex + 1} of {validRows.length}
            </Text>

            <Card style={styles.statsCard}>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{confirmedCount}</Text>
                  <Text style={[styles.statLabel, { color: COLORS.success }]}>Done</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{queuedCount}</Text>
                  <Text style={styles.statLabel}>Queued</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{failedCount}</Text>
                  <Text style={[styles.statLabel, { color: COLORS.error }]}>Failed</Text>
                </View>
              </View>
            </Card>

            <Button
              title="Stop"
              onPress={handleStop}
              variant="outline"
              size="large"
              style={styles.stopButton}
            />
          </View>
        </View>
      </>
    );
  }

  // ========== PREVIEW PHASE ==========
  if (phase === 'preview') {
    return (
      <>
        <Stack.Screen options={{ title: 'Confirm Batch' }} />
        <View style={styles.container}>
          <ScrollView style={styles.scrollContent}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>Review Batch</Text>
              <Text style={styles.previewSubtitle}>
                {validRows.length} payout{validRows.length !== 1 ? 's' : ''} ready
              </Text>
            </View>

            {/* Totals */}
            <Card style={styles.totalsCard}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Payouts</Text>
                <Text style={styles.totalValue}>
                  {totalAmount.toFixed(asset === 'SOL' ? 4 : 2)} {asset === 'CUSTOM' ? 'tokens' : asset}
                </Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Service Fee ({FEE_PERCENT}%)</Text>
                <Text style={styles.totalValueMuted}>
                  {totalFee.toFixed(asset === 'SOL' ? 6 : 4)} {asset === 'CUSTOM' ? 'tokens' : asset}
                </Text>
              </View>
              <View style={styles.totalDivider} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabelBold}>Total Cost</Text>
                <Text style={styles.totalValueBold}>
                  {totalCost.toFixed(asset === 'SOL' ? 4 : 2)} {asset === 'CUSTOM' ? 'tokens' : asset}
                </Text>
              </View>
              <Text style={styles.feeNote}>
                + network fees (~{(validRows.length * 0.00025).toFixed(5)} SOL)
              </Text>
              <Text style={styles.feeNote}>
                Fee wallet: {shortenAddress(FEE_WALLET, 4)}
              </Text>
            </Card>

            {/* Balance check */}
            <Card style={styles.balanceCard}>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>Your Balance</Text>
                <Text style={styles.balanceValue}>
                  {asset === 'SOL'
                    ? `${(solBalance ?? 0).toFixed(4)} SOL`
                    : `${(tokenBalance ?? 0).toFixed(2)} tokens`}
                </Text>
              </View>
              {solBalance !== null && solBalance < MIN_SOL_FOR_FEES * validRows.length && (
                <Text style={styles.warningText}>
                  ⚠️ Low SOL for network fees
                </Text>
              )}
            </Card>

            {/* Row list */}
            <SectionHeader title="Payouts" subtitle={`${validRows.length} recipients`} />
            <FlatList
              data={validRows}
              renderItem={renderRowItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.rowList}
            />

            <NetworkBadge style={styles.networkBadge} />
          </ScrollView>

          <View style={styles.footerRow}>
            <Button
              title="Back"
              onPress={handleBackToInput}
              variant="outline"
              size="large"
              style={styles.flexButton}
            />
            <Button
              title="Send All"
              onPress={handleStartExecution}
              size="large"
              style={styles.flexButton}
            />
          </View>
        </View>
      </>
    );
  }

  // ========== INPUT PHASE ==========
  return (
    <>
      <Stack.Screen options={{ title: 'Batch Payout' }} />
      <View style={styles.container}>
        <ScrollView style={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.inputHeader}>
            <Text style={styles.inputEmoji}>📦</Text>
            <Text style={styles.inputTitle}>Batch Payout</Text>
            <Text style={styles.inputSubtitle}>
              Send to multiple recipients at once
            </Text>
          </View>

          {/* Asset Selection */}
          <SectionHeader title="Asset" />
          <View style={styles.assetToggle}>
            {(['SOL', 'USDC', 'CUSTOM'] as PayoutAsset[]).map((a) => (
              <TouchableOpacity
                key={a}
                style={[styles.assetOption, asset === a && styles.assetOptionActive]}
                onPress={() => setAsset(a)}
              >
                <Text style={[styles.assetText, asset === a && styles.assetTextActive]}>
                  {a}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom Mint Input */}
          {asset === 'CUSTOM' && (
            <View style={styles.customMintSection}>
              <TextInput
                style={styles.customMintInput}
                value={customMint}
                onChangeText={setCustomMint}
                placeholder="Token mint address..."
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {customMint && !isValidSolanaAddress(customMint) && (
                <Text style={styles.inputError}>Invalid mint address</Text>
              )}
            </View>
          )}

          {/* Balance */}
          <View style={styles.balanceInfo}>
            {isLoadingBalances ? (
              <ActivityIndicator size="small" color={COLORS.textSecondary} />
            ) : (
              <>
                <Text style={styles.balanceInfoText}>
                  Balance: {asset === 'SOL'
                    ? `${(solBalance ?? 0).toFixed(4)} SOL`
                    : `${(tokenBalance ?? 0).toFixed(2)} ${asset === 'USDC' ? 'USDC' : 'tokens'}`}
                </Text>
                <TouchableOpacity onPress={loadBalances}>
                  <Text style={styles.refreshLink}>Refresh</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Paste Input */}
          <SectionHeader title="Paste Recipients" subtitle="recipient,amount (one per line)" />
          <TextInput
            style={styles.pasteInput}
            value={pasteInput}
            onChangeText={setPasteInput}
            placeholder={`address1,10\naddress2,25\naddress3,5.5`}
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={5}
          />
          {pasteInput.trim() && (
            <Button
              title="Parse & Add"
              onPress={handleParsePaste}
              size="small"
              style={styles.parseButton}
            />
          )}

          {/* Manual Add */}
          <SectionHeader title="Or Add Manually" />
          <View style={styles.manualRow}>
            <TextInput
              style={[styles.manualInput, styles.manualInputRecipient]}
              value={manualRecipient}
              onChangeText={setManualRecipient}
              placeholder="Recipient address"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.manualInput, styles.manualInputAmount]}
              value={manualAmount}
              onChangeText={setManualAmount}
              placeholder="Amount"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddManual}
              disabled={!manualRecipient.trim() || !manualAmount.trim()}
            >
              <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Row List */}
          {rows.length > 0 && (
            <>
              <View style={styles.rowListHeader}>
                <SectionHeader 
                  title="Recipients" 
                  subtitle={`${validRows.length} valid, ${invalidRows.length} invalid`}
                />
                <TouchableOpacity onPress={handleClearAll}>
                  <Text style={styles.clearAllText}>Clear All</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={rows}
                renderItem={renderRowItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                contentContainerStyle={styles.rowList}
              />

              {/* Summary */}
              <Card style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total Amount</Text>
                  <Text style={styles.summaryValue}>
                    {totalAmount.toFixed(asset === 'SOL' ? 4 : 2)}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total Fee ({FEE_PERCENT}%)</Text>
                  <Text style={styles.summaryValueMuted}>
                    {totalFee.toFixed(asset === 'SOL' ? 6 : 4)}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabelBold}>Total Cost</Text>
                  <Text style={styles.summaryValueBold}>
                    {totalCost.toFixed(asset === 'SOL' ? 4 : 2)} {asset === 'CUSTOM' ? 'tokens' : asset}
                  </Text>
                </View>
              </Card>
            </>
          )}

          {/* Low SOL Warning */}
          {solBalance !== null && solBalance < MIN_SOL_FOR_FEES && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningBannerText}>
                ⚠️ Low SOL! Need ~{MIN_SOL_FOR_FEES} SOL for fees.
              </Text>
              {faucetUrl && (
                <TouchableOpacity onPress={() => {}}>
                  <Text style={styles.warningLink}>Get {networkName} SOL →</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <NetworkBadge style={styles.networkBadge} />
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={`Continue (${validRows.length} payouts)`}
            onPress={handleProceedToPreview}
            disabled={!canProceed}
            size="large"
            fullWidth
          />
        </View>
      </View>
    </>
  );
}

// ============================================
// Styles
// ============================================

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

  // Error states
  errorEmoji: { fontSize: 48, marginBottom: SPACING.lg },
  errorTitle: { ...TYPOGRAPHY.h2, color: COLORS.error, marginBottom: SPACING.sm },
  errorMessage: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, textAlign: 'center', marginBottom: SPACING['2xl'] },

  // Input phase
  inputHeader: { alignItems: 'center', marginBottom: SPACING['2xl'] },
  inputEmoji: { fontSize: 48, marginBottom: SPACING.md },
  inputTitle: { ...TYPOGRAPHY.h2, color: COLORS.text, marginBottom: SPACING.xs },
  inputSubtitle: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },

  // Asset toggle
  assetToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  assetOption: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
  },
  assetOptionActive: { backgroundColor: COLORS.primary },
  assetText: { ...TYPOGRAPHY.smallMedium, color: COLORS.textSecondary },
  assetTextActive: { color: COLORS.text },

  // Custom mint
  customMintSection: { marginBottom: SPACING.lg },
  customMintInput: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    ...TYPOGRAPHY.small,
    color: COLORS.text,
    fontFamily: 'monospace',
  },
  inputError: { ...TYPOGRAPHY.caption, color: COLORS.error, marginTop: SPACING.xs },

  // Balance info
  balanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING['2xl'],
    gap: SPACING.md,
  },
  balanceInfoText: { ...TYPOGRAPHY.small, color: COLORS.textSecondary },
  refreshLink: { ...TYPOGRAPHY.smallMedium, color: COLORS.primary },

  // Paste input
  pasteInput: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    ...TYPOGRAPHY.small,
    color: COLORS.text,
    fontFamily: 'monospace',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: SPACING.sm,
  },
  parseButton: { alignSelf: 'flex-end', marginBottom: SPACING['2xl'] },

  // Manual add
  manualRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING['2xl'],
  },
  manualInput: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    ...TYPOGRAPHY.small,
    color: COLORS.text,
  },
  manualInputRecipient: { flex: 2, fontFamily: 'monospace' },
  manualInputAmount: { flex: 1 },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { fontSize: 24, color: COLORS.text, fontWeight: '300' },

  // Row list
  rowListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clearAllText: { ...TYPOGRAPHY.smallMedium, color: COLORS.error },
  rowList: { paddingBottom: SPACING.md },

  // Row card
  rowCard: {
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    position: 'relative',
  },
  rowCardInvalid: {
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  rowIndex: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  rowStatus: { ...TYPOGRAPHY.caption },
  rowContent: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  rowField: { flex: 1 },
  rowLabel: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginBottom: 2 },
  rowValue: { ...TYPOGRAPHY.small, color: COLORS.text },
  rowValueMuted: { ...TYPOGRAPHY.small, color: COLORS.textMuted },
  rowError: { ...TYPOGRAPHY.caption, color: COLORS.error, marginTop: SPACING.sm },
  rowLink: { marginTop: SPACING.sm },
  rowLinkText: { ...TYPOGRAPHY.caption, color: COLORS.primary, fontFamily: 'monospace' },
  removeButton: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: { fontSize: 12, color: COLORS.textMuted },
  checkButton: {
    position: 'absolute',
    bottom: SPACING.sm,
    right: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.sm,
  },
  checkButtonText: { ...TYPOGRAPHY.caption, color: COLORS.primary },

  // Summary card
  summaryCard: { marginTop: SPACING.md, marginBottom: SPACING.lg },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.xs },
  summaryLabel: { ...TYPOGRAPHY.small, color: COLORS.textSecondary },
  summaryValue: { ...TYPOGRAPHY.small, color: COLORS.text },
  summaryValueMuted: { ...TYPOGRAPHY.small, color: COLORS.textMuted },
  summaryLabelBold: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text },
  summaryValueBold: { ...TYPOGRAPHY.bodyMedium, color: COLORS.primary },

  // Warning
  warningBanner: {
    backgroundColor: COLORS.warningMuted,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  warningBannerText: { ...TYPOGRAPHY.small, color: COLORS.warning },
  warningLink: { ...TYPOGRAPHY.smallMedium, color: COLORS.primary, marginTop: SPACING.sm },
  warningText: { ...TYPOGRAPHY.small, color: COLORS.warning, marginTop: SPACING.sm },

  // Network badge
  networkBadge: { alignSelf: 'center', marginTop: SPACING.lg, marginBottom: SPACING.lg },

  // Footer
  footer: { padding: SPACING.xl, paddingBottom: SPACING['4xl'] },
  footerRow: { padding: SPACING.xl, paddingBottom: SPACING['4xl'], flexDirection: 'row', gap: SPACING.md },
  flexButton: { flex: 1 },

  // Preview phase
  previewHeader: { alignItems: 'center', marginBottom: SPACING['2xl'] },
  previewTitle: { ...TYPOGRAPHY.h2, color: COLORS.text, marginBottom: SPACING.xs },
  previewSubtitle: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },

  // Totals card
  totalsCard: { marginBottom: SPACING.lg, backgroundColor: COLORS.surfaceLight },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  totalLabel: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },
  totalValue: { ...TYPOGRAPHY.body, color: COLORS.text },
  totalValueMuted: { ...TYPOGRAPHY.small, color: COLORS.textMuted },
  totalDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.md },
  totalLabelBold: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text },
  totalValueBold: { ...TYPOGRAPHY.h3, color: COLORS.primary },
  feeNote: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.xs },

  // Balance card
  balanceCard: { marginBottom: SPACING.lg },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  balanceLabel: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },
  balanceValue: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text },

  // Executing phase
  executingContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  executingTitle: { ...TYPOGRAPHY.h2, color: COLORS.text, marginTop: SPACING.xl, marginBottom: SPACING.sm },
  executingProgress: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, marginBottom: SPACING['2xl'] },
  stopButton: { marginTop: SPACING['2xl'], minWidth: 150 },

  // Stats card
  statsCard: { marginBottom: SPACING.lg, width: '100%' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { ...TYPOGRAPHY.h2, color: COLORS.text },
  statLabel: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary },

  // Done phase
  doneHeader: { alignItems: 'center', marginBottom: SPACING['2xl'] },
  doneEmoji: { fontSize: 48, marginBottom: SPACING.md },
  doneTitle: { ...TYPOGRAPHY.h2, color: COLORS.text },
});
