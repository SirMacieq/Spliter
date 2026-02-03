/**
 * Batch Payouts Screen
 * 
 * Supports:
 * - Token batch (SOL/USDC/Custom SPL) with 2.5% fee
 * - NFT batch with flat SOL fee per transfer
 * - CSV import (recipient,amount for tokens; recipient,mint for NFTs)
 * - Paste input (same format)
 * - Manual add
 * - Batch persistence and resume after restart
 * - Export report / Copy summary
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, Stack } from 'expo-router';
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
  NFT_FEE_SOL,
  STORAGE_KEYS,
  BATCH_CHUNK_SIZE_SOL,
  BATCH_CHUNK_SIZE_SPL,
} from '../../lib/constants';
import {
  getSolBalance,
  getTokenBalance,
  getTokenDecimals,
  sendNftTransferWithFee,
  ownsNft,
  waitForConfirmation,
  checkTransactionStatus,
  getExplorerUrl,
  categorizeError,
  buildBatchSolTransaction,
  buildBatchSplTransaction,
  sendBatchTransactions,
  BatchSolTransfer,
  BatchSplTransfer,
} from '../../lib/solana';
import { isValidSolanaAddress, shortenAddress } from '../../lib/validation';

// ============================================
// Types
// ============================================

type BatchMode = 'TOKEN' | 'NFT';
type TokenAsset = 'SOL' | 'USDC' | 'CUSTOM';
type RowStatus = 'pending' | 'queued' | 'sending' | 'sent' | 'confirmed' | 'failed';
type BatchPhase = 'input' | 'preview' | 'executing' | 'done';

interface BaseRow {
  id: string;
  recipient: string;
  status: RowStatus;
  error?: string;
  signature?: string;
  isValid: boolean;
  validationError?: string;
}

interface TokenRow extends BaseRow {
  type: 'token';
  amount: number;
}

interface NftRow extends BaseRow {
  type: 'nft';
  nftMint: string;
}

type PayoutRow = TokenRow | NftRow;

interface BatchDraft {
  mode: BatchMode;
  tokenAsset?: TokenAsset;
  customMint?: string;
  rows: PayoutRow[];
  phase: BatchPhase;
  createdAt: number;
  walletAddress: string;
  /** Track which chunk we're on for resume */
  currentChunk?: number;
}

// Chunk info for UI display
interface ChunkInfo {
  totalChunks: number;
  chunkSize: number;
  reason: string; // e.g., "transaction size limit"
}

// ============================================
// Storage helpers
// ============================================

const saveBatchDraft = async (draft: BatchDraft): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.BATCH_DRAFT, JSON.stringify(draft));
  } catch (err) {
    console.error('Failed to save batch draft:', err);
  }
};

const loadBatchDraft = async (): Promise<BatchDraft | null> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.BATCH_DRAFT);
    if (data) {
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load batch draft:', err);
  }
  return null;
};

const clearBatchDraft = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.BATCH_DRAFT);
  } catch (err) {
    console.error('Failed to clear batch draft:', err);
  }
};

// ============================================
// Component
// ============================================

export default function BatchPayoutScreen() {
  const router = useRouter();
  const publicKey = useWalletPublicKey();
  const addTxHistory = useGroupStore((state) => state.addTxHistory);
  const updateTxStatus = useGroupStore((state) => state.updateTxStatus);

  // Mode
  const [mode, setMode] = useState<BatchMode>('TOKEN');
  
  // Token settings
  const [tokenAsset, setTokenAsset] = useState<TokenAsset>('USDC');
  const [customMint, setCustomMint] = useState('');
  const [tokenDecimals, setTokenDecimals] = useState(6);

  // Rows
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const [pasteInput, setPasteInput] = useState('');

  // Manual add
  const [manualRecipient, setManualRecipient] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualNftMint, setManualNftMint] = useState('');

  // Balances
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);

  // Execution state
  const [phase, setPhase] = useState<BatchPhase>('input');
  const [currentRowIndex, setCurrentRowIndex] = useState(-1);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(-1);
  const stopRequestedRef = useRef(false);
  const isExecutingRef = useRef(false);
  
  // Chunk info for UI
  const [chunkInfo, setChunkInfo] = useState<ChunkInfo | null>(null);
  
  // Resume state
  const [hasDraft, setHasDraft] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  const feeConfigured = isFeeConfigured();
  const networkName = getNetworkName();
  const faucetUrl = getFaucetUrl();

  // Get mint address for tokens
  const getMintAddress = (): string => {
    if (tokenAsset === 'SOL') return '';
    if (tokenAsset === 'USDC') return getCurrentUsdcMint();
    return customMint;
  };

  // Calculate chunk info for display
  const calculateChunkInfo = useCallback((rowCount: number): ChunkInfo => {
    if (mode === 'NFT') {
      // NFTs still need individual transactions (each includes SPL transfer + SOL fee)
      return {
        totalChunks: rowCount,
        chunkSize: 1,
        reason: 'NFT transfers require individual transactions',
      };
    }

    const chunkSize = tokenAsset === 'SOL' ? BATCH_CHUNK_SIZE_SOL : BATCH_CHUNK_SIZE_SPL;
    const totalChunks = Math.ceil(rowCount / chunkSize);
    
    if (totalChunks === 1) {
      return {
        totalChunks: 1,
        chunkSize,
        reason: 'All transfers fit in one transaction',
      };
    }

    return {
      totalChunks,
      chunkSize,
      reason: tokenAsset === 'SOL' 
        ? 'Chunked due to transaction size limit'
        : 'Chunked due to SPL token transfer complexity',
    };
  }, [mode, tokenAsset]);

  // Check for saved draft on mount
  useEffect(() => {
    const checkDraft = async () => {
      const draft = await loadBatchDraft();
      if (draft && draft.walletAddress === publicKey) {
        // Has incomplete batch
        const hasIncomplete = draft.rows.some(r => 
          r.status === 'queued' || r.status === 'sent' || r.status === 'pending'
        );
        if (hasIncomplete && (draft.phase === 'preview' || draft.phase === 'executing' || draft.phase === 'done')) {
          setHasDraft(true);
        }
      }
      setDraftLoaded(true);
    };
    if (publicKey) {
      checkDraft();
    }
  }, [publicKey]);

  // Load draft
  const handleLoadDraft = async () => {
    const draft = await loadBatchDraft();
    if (draft) {
      setMode(draft.mode);
      if (draft.tokenAsset) setTokenAsset(draft.tokenAsset);
      if (draft.customMint) setCustomMint(draft.customMint);
      setRows(draft.rows);
      setPhase(draft.phase === 'executing' ? 'preview' : draft.phase);
      setHasDraft(false);
    }
  };

  // Discard draft
  const handleDiscardDraft = async () => {
    await clearBatchDraft();
    setHasDraft(false);
  };

  // Save draft on row/phase changes
  useEffect(() => {
    if (!publicKey || rows.length === 0) return;
    if (phase === 'input') return; // Don't save input phase
    
    const draft: BatchDraft = {
      mode,
      tokenAsset,
      customMint,
      rows,
      phase,
      createdAt: Date.now(),
      walletAddress: publicKey,
    };
    saveBatchDraft(draft);
  }, [rows, phase, mode, tokenAsset, customMint, publicKey]);

  // Load balances
  const loadBalances = useCallback(async () => {
    if (!publicKey) return;
    setIsLoadingBalances(true);
    try {
      const sol = await getSolBalance(publicKey);
      setSolBalance(sol);

      if (mode === 'TOKEN' && tokenAsset !== 'SOL') {
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
  }, [publicKey, mode, tokenAsset, customMint]);

  useEffect(() => {
    loadBalances();
  }, [loadBalances]);

  // Validate token row
  const validateTokenRow = (recipient: string, amount: number): { isValid: boolean; error?: string } => {
    if (!recipient.trim()) return { isValid: false, error: 'Missing recipient' };
    if (!isValidSolanaAddress(recipient.trim())) return { isValid: false, error: 'Invalid address' };
    if (isNaN(amount) || amount <= 0) return { isValid: false, error: 'Invalid amount' };
    if (amount > 1000000) return { isValid: false, error: 'Amount too large' };
    return { isValid: true };
  };

  // Validate NFT row
  const validateNftRow = (recipient: string, nftMint: string): { isValid: boolean; error?: string } => {
    if (!recipient.trim()) return { isValid: false, error: 'Missing recipient' };
    if (!isValidSolanaAddress(recipient.trim())) return { isValid: false, error: 'Invalid recipient' };
    if (!nftMint.trim()) return { isValid: false, error: 'Missing NFT mint' };
    if (!isValidSolanaAddress(nftMint.trim())) return { isValid: false, error: 'Invalid NFT mint' };
    return { isValid: true };
  };

  // Parse CSV/paste for tokens: recipient,amount[,mint]
  const parseTokenInput = (text: string): TokenRow[] => {
    const lines = text.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    return lines.map(line => {
      const parts = line.split(/[,\t]/).map(p => p.trim());
      const recipient = parts[0] || '';
      const amount = parseFloat(parts[1] || '0');
      const validation = validateTokenRow(recipient, amount);
      
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: 'token' as const,
        recipient: recipient.trim(),
        amount: isNaN(amount) ? 0 : amount,
        status: 'pending' as RowStatus,
        isValid: validation.isValid,
        validationError: validation.error,
      };
    });
  };

  // Parse CSV/paste for NFTs: recipient,mint
  const parseNftInput = (text: string): NftRow[] => {
    const lines = text.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    return lines.map(line => {
      const parts = line.split(/[,\t]/).map(p => p.trim());
      const recipient = parts[0] || '';
      const nftMint = parts[1] || '';
      const validation = validateNftRow(recipient, nftMint);
      
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: 'nft' as const,
        recipient: recipient.trim(),
        nftMint: nftMint.trim(),
        status: 'pending' as RowStatus,
        isValid: validation.isValid,
        validationError: validation.error,
      };
    });
  };

  // Handle paste parse
  const handleParsePaste = () => {
    if (!pasteInput.trim()) return;
    
    const newRows = mode === 'TOKEN' 
      ? parseTokenInput(pasteInput)
      : parseNftInput(pasteInput);
    
    setRows(prev => [...prev, ...newRows]);
    setPasteInput('');
  };

  // Handle CSV import
  const handleImportCsv = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/plain', 'text/comma-separated-values'],
        copyToCacheDirectory: true,
      });
      
      if (result.canceled || !result.assets?.[0]) return;
      
      const file = result.assets[0];
      const content = await FileSystem.readAsStringAsync(file.uri);
      
      const newRows = mode === 'TOKEN'
        ? parseTokenInput(content)
        : parseNftInput(content);
      
      setRows(prev => [...prev, ...newRows]);
    } catch (err) {
      console.error('CSV import failed:', err);
    }
  };

  // Add manual row
  const handleAddManual = () => {
    if (mode === 'TOKEN') {
      const amount = parseFloat(manualAmount);
      const validation = validateTokenRow(manualRecipient, amount);
      const newRow: TokenRow = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: 'token',
        recipient: manualRecipient.trim(),
        amount: isNaN(amount) ? 0 : amount,
        status: 'pending',
        isValid: validation.isValid,
        validationError: validation.error,
      };
      setRows(prev => [...prev, newRow]);
      setManualRecipient('');
      setManualAmount('');
    } else {
      const validation = validateNftRow(manualRecipient, manualNftMint);
      const newRow: NftRow = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: 'nft',
        recipient: manualRecipient.trim(),
        nftMint: manualNftMint.trim(),
        status: 'pending',
        isValid: validation.isValid,
        validationError: validation.error,
      };
      setRows(prev => [...prev, newRow]);
      setManualRecipient('');
      setManualNftMint('');
    }
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
  
  const tokenRows = validRows.filter((r): r is TokenRow => r.type === 'token');
  const nftRows = validRows.filter((r): r is NftRow => r.type === 'nft');
  
  const totalTokenAmount = tokenRows.reduce((sum, r) => sum + r.amount, 0);
  const totalTokenFee = tokenRows.reduce((sum, r) => sum + calculateFee(r.amount), 0);
  const totalTokenCost = totalTokenAmount + totalTokenFee;
  
  const totalNftFee = nftRows.length * NFT_FEE_SOL;

  // Check if can proceed
  const canProceed = validRows.length > 0 && feeConfigured;

  // Proceed to preview
  const handleProceedToPreview = () => {
    if (!canProceed) return;
    setRows(prev => prev.map(r => ({
      ...r,
      status: r.isValid ? 'queued' : 'pending',
    })));
    // Calculate chunk info for display
    setChunkInfo(calculateChunkInfo(validRows.length));
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
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...updates } as PayoutRow : r));
  };

  // Execute a single NFT row (NFTs still need individual transactions)
  const executeNftRow = async (row: NftRow): Promise<void> => {
    if (!publicKey || !row.isValid) return;

    updateRowStatus(row.id, { status: 'sending' });

    try {
      const signature = await sendNftTransferWithFee(publicKey, row.recipient, row.nftMint, NFT_FEE_SOL);

      updateRowStatus(row.id, { status: 'sent', signature });

      await addTxHistory({
        signature,
        from: publicKey,
        to: row.recipient,
        amount: 1,
        currency: 'SOL', // NFT, but fee is in SOL
        status: 'pending',
      });

      const result = await waitForConfirmation(signature);

      if (result.status === 'confirmed') {
        updateRowStatus(row.id, { status: 'confirmed' });
        await updateTxStatus(signature, 'confirmed');
      } else if (result.status === 'failed') {
        updateRowStatus(row.id, { status: 'failed', error: result.error || 'Failed' });
        await updateTxStatus(signature, 'failed', result.error);
      } else {
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

  // Chunk an array into smaller arrays
  const chunkArray = <T,>(arr: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  // Execute token batch with chunking (1 approval per chunk)
  const executeTokenBatch = async (tokenRowsToProcess: TokenRow[]) => {
    if (!publicKey) return;

    const chunkSize = tokenAsset === 'SOL' ? BATCH_CHUNK_SIZE_SOL : BATCH_CHUNK_SIZE_SPL;
    const chunks = chunkArray(tokenRowsToProcess, chunkSize);

    for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
      if (stopRequestedRef.current) break;

      const chunk = chunks[chunkIdx];
      setCurrentChunkIndex(chunkIdx);

      // Mark all rows in chunk as sending
      chunk.forEach(row => updateRowStatus(row.id, { status: 'sending' }));

      try {
        // Build transfers array
        const transfers = chunk.map(row => ({
          recipient: row.recipient,
          amount: row.amount,
          feeAmount: calculateFee(row.amount),
        }));

        // Build the transaction
        let transaction;
        if (tokenAsset === 'SOL') {
          transaction = await buildBatchSolTransaction(publicKey, transfers as BatchSolTransfer[]);
        } else {
          const mint = getMintAddress();
          transaction = await buildBatchSplTransaction(
            publicKey,
            mint,
            transfers as BatchSplTransfer[],
            tokenDecimals
          );
        }

        // Send (single approval for this chunk)
        const signatures = await sendBatchTransactions([transaction]);
        const signature = signatures[0];

        // Mark all rows as sent with the same signature
        chunk.forEach(row => updateRowStatus(row.id, { status: 'sent', signature }));

        // Add to tx history
        for (const row of chunk) {
          await addTxHistory({
            signature,
            from: publicKey,
            to: row.recipient,
            amount: row.amount,
            currency: tokenAsset === 'SOL' ? 'SOL' : 'USDC',
            status: 'pending',
          });
        }

        // Wait for confirmation
        const result = await waitForConfirmation(signature);

        if (result.status === 'confirmed') {
          chunk.forEach(row => {
            updateRowStatus(row.id, { status: 'confirmed' });
          });
          await updateTxStatus(signature, 'confirmed');
        } else if (result.status === 'failed') {
          chunk.forEach(row => {
            updateRowStatus(row.id, { status: 'failed', error: result.error || 'Failed' });
          });
          await updateTxStatus(signature, 'failed', result.error);
        } else {
          chunk.forEach(row => {
            updateRowStatus(row.id, { status: 'sent', error: 'Confirmation pending' });
          });
        }
      } catch (err: any) {
        const { type, message } = categorizeError(err);
        if (type === 'rejected') {
          // User cancelled - mark chunk as queued so they can retry
          chunk.forEach(row => updateRowStatus(row.id, { status: 'queued', error: 'Cancelled' }));
          // Stop processing remaining chunks
          break;
        } else {
          // Other error - mark as failed
          chunk.forEach(row => updateRowStatus(row.id, { status: 'failed', error: message }));
        }
      }

      // Small delay between chunks
      if (chunkIdx < chunks.length - 1 && !stopRequestedRef.current) {
        await new Promise(res => setTimeout(res, 500));
      }
    }
  };

  // Execute all rows
  const handleStartExecution = async () => {
    if (isExecutingRef.current) return;
    isExecutingRef.current = true;
    stopRequestedRef.current = false;
    setPhase('executing');
    setCurrentChunkIndex(0);

    const queuedRows = rows.filter(r => r.status === 'queued');

    if (mode === 'NFT') {
      // NFTs still process individually (each needs separate tx due to mixed SPL + SOL)
      const nftQueuedRows = queuedRows.filter((r): r is NftRow => r.type === 'nft');
      for (let i = 0; i < nftQueuedRows.length; i++) {
        if (stopRequestedRef.current) break;

        const row = nftQueuedRows[i];
        setCurrentRowIndex(i);
        setCurrentChunkIndex(i);
        await executeNftRow(row);

        if (i < nftQueuedRows.length - 1 && !stopRequestedRef.current) {
          await new Promise(res => setTimeout(res, 500));
        }
      }
    } else {
      // Token batch with chunking
      const tokenQueuedRows = queuedRows.filter((r): r is TokenRow => r.type === 'token');
      await executeTokenBatch(tokenQueuedRows);
    }

    setCurrentRowIndex(-1);
    setCurrentChunkIndex(-1);
    isExecutingRef.current = false;
    setPhase('done');
  };

  // Stop execution
  const handleStop = () => {
    stopRequestedRef.current = true;
  };

  // Retry failed/queued rows
  const handleRetryFailed = async () => {
    setRows(prev => prev.map(r => 
      (r.status === 'failed' || (r.status === 'queued' && r.error)) 
        ? { ...r, status: 'queued', error: undefined } as PayoutRow
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

  // Generate report text
  const generateReport = (): string => {
    const lines: string[] = [];
    lines.push(`Batch Payout Report - ${new Date().toISOString()}`);
    lines.push(`Mode: ${mode}`);
    if (mode === 'TOKEN') {
      lines.push(`Asset: ${tokenAsset}${tokenAsset === 'CUSTOM' ? ` (${customMint})` : ''}`);
    }
    lines.push(`Total rows: ${rows.length}`);
    lines.push(`Confirmed: ${rows.filter(r => r.status === 'confirmed').length}`);
    lines.push(`Failed: ${rows.filter(r => r.status === 'failed').length}`);
    lines.push(`Pending: ${rows.filter(r => r.status === 'sent').length}`);
    lines.push('');
    lines.push('--- Details ---');
    
    rows.forEach((row, i) => {
      if (row.type === 'token') {
        lines.push(`${i + 1}. ${shortenAddress(row.recipient, 6)} | ${row.amount} | ${row.status}${row.signature ? ` | ${row.signature}` : ''}${row.error ? ` | ${row.error}` : ''}`);
      } else {
        lines.push(`${i + 1}. ${shortenAddress(row.recipient, 6)} | NFT: ${shortenAddress(row.nftMint, 6)} | ${row.status}${row.signature ? ` | ${row.signature}` : ''}${row.error ? ` | ${row.error}` : ''}`);
      }
    });
    
    return lines.join('\n');
  };

  // Copy report
  const handleCopyReport = async () => {
    const report = generateReport();
    await Clipboard.setStringAsync(report);
  };

  // Share report
  const handleShareReport = async () => {
    const report = generateReport();
    await Share.share({ message: report });
  };

  // Finish and clear draft
  const handleFinish = async () => {
    await clearBatchDraft();
    router.back();
  };

  // Stats
  const confirmedCount = rows.filter(r => r.status === 'confirmed').length;
  const failedCount = rows.filter(r => r.status === 'failed').length;
  const queuedCount = rows.filter(r => r.status === 'queued').length;
  const sentCount = rows.filter(r => r.status === 'sent').length;

  // Render row item
  const renderRowItem = ({ item, index }: { item: PayoutRow; index: number }) => {
    const fee = item.type === 'token' ? calculateFee(item.amount) : NFT_FEE_SOL;
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
          {item.type === 'token' ? (
            <>
              <View style={styles.rowField}>
                <Text style={styles.rowLabel}>Amount</Text>
                <Text style={styles.rowValue}>
                  {item.amount.toFixed(tokenAsset === 'SOL' ? 4 : 2)}
                </Text>
              </View>
              <View style={styles.rowField}>
                <Text style={styles.rowLabel}>Fee</Text>
                <Text style={styles.rowValueMuted}>
                  {fee.toFixed(tokenAsset === 'SOL' ? 6 : 4)}
                </Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.rowField}>
                <Text style={styles.rowLabel}>NFT</Text>
                <Text style={styles.rowValue} numberOfLines={1}>
                  {shortenAddress(item.nftMint, 6)}
                </Text>
              </View>
              <View style={styles.rowField}>
                <Text style={styles.rowLabel}>Fee</Text>
                <Text style={styles.rowValueMuted}>
                  {NFT_FEE_SOL} SOL
                </Text>
              </View>
            </>
          )}
        </View>

        {!item.isValid && (
          <Text style={styles.rowError}>⚠️ {item.validationError}</Text>
        )}

        {item.error && item.isValid && (
          <Text style={styles.rowError}>⚠️ {item.error}</Text>
        )}

        {item.signature && (
          <TouchableOpacity style={styles.rowLink}>
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

  // ========== LOADING ==========
  if (!draftLoaded) {
    return (
      <>
        <Stack.Screen options={{ title: 'Batch Payout' }} />
        <View style={styles.container}>
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        </View>
      </>
    );
  }

  // ========== RESUME DRAFT PROMPT ==========
  if (hasDraft) {
    return (
      <>
        <Stack.Screen options={{ title: 'Resume Batch' }} />
        <View style={styles.container}>
          <View style={styles.centerContent}>
            <Text style={styles.resumeEmoji}>📦</Text>
            <Text style={styles.resumeTitle}>Incomplete Batch Found</Text>
            <Text style={styles.resumeMessage}>
              You have an unfinished batch payout. Would you like to continue where you left off?
            </Text>
            <View style={styles.resumeButtons}>
              <Button
                title="Continue"
                onPress={handleLoadDraft}
                size="large"
                style={styles.resumeButton}
              />
              <Button
                title="Start Fresh"
                onPress={handleDiscardDraft}
                variant="outline"
                size="large"
                style={styles.resumeButton}
              />
            </View>
          </View>
        </View>
      </>
    );
  }

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

            {/* Export options */}
            <View style={styles.exportSection}>
              <SectionHeader title="Export Report" />
              <View style={styles.exportButtons}>
                <TouchableOpacity style={styles.exportBtn} onPress={handleCopyReport}>
                  <Text style={styles.exportBtnIcon}>📋</Text>
                  <Text style={styles.exportBtnText}>Copy Summary</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.exportBtn} onPress={handleShareReport}>
                  <Text style={styles.exportBtnIcon}>📤</Text>
                  <Text style={styles.exportBtnText}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>

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
              onPress={handleFinish}
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
    const totalChunks = chunkInfo?.totalChunks ?? 1;
    const sendingCount = rows.filter(r => r.status === 'sending').length;
    
    return (
      <>
        <Stack.Screen options={{ title: 'Sending...' }} />
        <View style={styles.container}>
          <View style={styles.executingContent}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.executingTitle}>Sending Payouts</Text>
            {totalChunks > 1 ? (
              <Text style={styles.executingProgress}>
                Chunk {Math.min(currentChunkIndex + 1, totalChunks)} of {totalChunks}
              </Text>
            ) : (
              <Text style={styles.executingProgress}>
                Processing {sendingCount > 0 ? sendingCount : validRows.length} transfers...
              </Text>
            )}

            <Card style={styles.statsCard}>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{confirmedCount}</Text>
                  <Text style={[styles.statLabel, { color: COLORS.success }]}>Done</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{sendingCount}</Text>
                  <Text style={[styles.statLabel, { color: COLORS.warning }]}>Sending</Text>
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

            <Text style={styles.executingHint}>
              {totalChunks > 1 
                ? 'Stop will abort after current chunk completes'
                : 'Transaction will complete all transfers'}
            </Text>

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
                {validRows.length} {mode === 'TOKEN' ? 'payout' : 'NFT'}{validRows.length !== 1 ? 's' : ''} ready
              </Text>
            </View>

            {/* Totals */}
            <Card style={styles.totalsCard}>
              {mode === 'TOKEN' ? (
                <>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total Payouts</Text>
                    <Text style={styles.totalValue}>
                      {totalTokenAmount.toFixed(tokenAsset === 'SOL' ? 4 : 2)} {tokenAsset === 'CUSTOM' ? 'tokens' : tokenAsset}
                    </Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Service Fee ({FEE_PERCENT}%)</Text>
                    <Text style={styles.totalValueMuted}>
                      {totalTokenFee.toFixed(tokenAsset === 'SOL' ? 6 : 4)} {tokenAsset === 'CUSTOM' ? 'tokens' : tokenAsset}
                    </Text>
                  </View>
                  <View style={styles.totalDivider} />
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabelBold}>Total Cost</Text>
                    <Text style={styles.totalValueBold}>
                      {totalTokenCost.toFixed(tokenAsset === 'SOL' ? 4 : 2)} {tokenAsset === 'CUSTOM' ? 'tokens' : tokenAsset}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>NFTs to Transfer</Text>
                    <Text style={styles.totalValue}>{nftRows.length}</Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Fee ({NFT_FEE_SOL} SOL each)</Text>
                    <Text style={styles.totalValueMuted}>{totalNftFee.toFixed(4)} SOL</Text>
                  </View>
                </>
              )}
              <Text style={styles.feeNote}>
                + network fees (~{(validRows.length * 0.00025).toFixed(5)} SOL)
              </Text>
              <Text style={styles.feeNote}>
                Fee wallet: {shortenAddress(FEE_WALLET, 4)}
              </Text>
            </Card>

            {/* Approval info */}
            {chunkInfo && (
              <Card style={styles.approvalCard}>
                <View style={styles.approvalHeader}>
                  <Text style={styles.approvalIcon}>
                    {chunkInfo.totalChunks === 1 ? '✨' : '📦'}
                  </Text>
                  <Text style={styles.approvalTitle}>
                    {chunkInfo.totalChunks === 1 
                      ? 'Single Approval'
                      : `${chunkInfo.totalChunks} Approvals Required`}
                  </Text>
                </View>
                <Text style={styles.approvalReason}>{chunkInfo.reason}</Text>
                {chunkInfo.totalChunks > 1 && (
                  <Text style={styles.approvalDetail}>
                    {chunkInfo.chunkSize} transfers per transaction
                  </Text>
                )}
              </Card>
            )}

            {/* Balance check */}
            <Card style={styles.balanceCard}>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>SOL Balance</Text>
                <Text style={styles.balanceValue}>{(solBalance ?? 0).toFixed(4)} SOL</Text>
              </View>
              {mode === 'TOKEN' && tokenAsset !== 'SOL' && (
                <View style={styles.balanceRow}>
                  <Text style={styles.balanceLabel}>Token Balance</Text>
                  <Text style={styles.balanceValue}>{(tokenBalance ?? 0).toFixed(2)}</Text>
                </View>
              )}
              {solBalance !== null && solBalance < MIN_SOL_FOR_FEES * validRows.length && (
                <Text style={styles.warningText}>⚠️ Low SOL for network fees</Text>
              )}
            </Card>

            <SectionHeader title={mode === 'TOKEN' ? 'Payouts' : 'NFT Transfers'} subtitle={`${validRows.length} recipients`} />
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

          {/* Mode Toggle */}
          <SectionHeader title="Batch Type" />
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeOption, mode === 'TOKEN' && styles.modeOptionActive]}
              onPress={() => { setMode('TOKEN'); setRows([]); }}
            >
              <Text style={[styles.modeText, mode === 'TOKEN' && styles.modeTextActive]}>
                💰 Tokens
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeOption, mode === 'NFT' && styles.modeOptionActive]}
              onPress={() => { setMode('NFT'); setRows([]); }}
            >
              <Text style={[styles.modeText, mode === 'NFT' && styles.modeTextActive]}>
                🖼️ NFTs
              </Text>
            </TouchableOpacity>
          </View>

          {/* Token Asset Selection */}
          {mode === 'TOKEN' && (
            <>
              <SectionHeader title="Asset" />
              <View style={styles.assetToggle}>
                {(['SOL', 'USDC', 'CUSTOM'] as TokenAsset[]).map((a) => (
                  <TouchableOpacity
                    key={a}
                    style={[styles.assetOption, tokenAsset === a && styles.assetOptionActive]}
                    onPress={() => setTokenAsset(a)}
                  >
                    <Text style={[styles.assetText, tokenAsset === a && styles.assetTextActive]}>
                      {a}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {tokenAsset === 'CUSTOM' && (
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
            </>
          )}

          {/* Balance */}
          <View style={styles.balanceInfo}>
            {isLoadingBalances ? (
              <ActivityIndicator size="small" color={COLORS.textSecondary} />
            ) : (
              <>
                <Text style={styles.balanceInfoText}>
                  SOL: {(solBalance ?? 0).toFixed(4)}
                  {mode === 'TOKEN' && tokenAsset !== 'SOL' && tokenBalance !== null && 
                    ` | Token: ${tokenBalance.toFixed(2)}`}
                </Text>
                <TouchableOpacity onPress={loadBalances}>
                  <Text style={styles.refreshLink}>Refresh</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Import CSV */}
          <SectionHeader title="Import" />
          <TouchableOpacity style={styles.importButton} onPress={handleImportCsv}>
            <Text style={styles.importButtonIcon}>📄</Text>
            <Text style={styles.importButtonText}>Import CSV File</Text>
          </TouchableOpacity>
          <Text style={styles.importHint}>
            {mode === 'TOKEN' 
              ? 'Format: recipient,amount (one per line)'
              : 'Format: recipient,nft_mint (one per line)'}
          </Text>

          {/* Paste Input */}
          <SectionHeader title="Or Paste" subtitle={mode === 'TOKEN' ? 'recipient,amount' : 'recipient,mint'} />
          <TextInput
            style={styles.pasteInput}
            value={pasteInput}
            onChangeText={setPasteInput}
            placeholder={mode === 'TOKEN' 
              ? `address1,10\naddress2,25\naddress3,5.5`
              : `recipient1,nftMint1\nrecipient2,nftMint2`}
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
              placeholder="Recipient"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
            />
            {mode === 'TOKEN' ? (
              <TextInput
                style={[styles.manualInput, styles.manualInputAmount]}
                value={manualAmount}
                onChangeText={setManualAmount}
                placeholder="Amount"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="decimal-pad"
              />
            ) : (
              <TextInput
                style={[styles.manualInput, styles.manualInputAmount]}
                value={manualNftMint}
                onChangeText={setManualNftMint}
                placeholder="NFT Mint"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
              />
            )}
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddManual}
              disabled={!manualRecipient.trim() || (mode === 'TOKEN' ? !manualAmount.trim() : !manualNftMint.trim())}
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
                {mode === 'TOKEN' ? (
                  <>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Total Amount</Text>
                      <Text style={styles.summaryValue}>{totalTokenAmount.toFixed(tokenAsset === 'SOL' ? 4 : 2)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Total Fee ({FEE_PERCENT}%)</Text>
                      <Text style={styles.summaryValueMuted}>{totalTokenFee.toFixed(tokenAsset === 'SOL' ? 6 : 4)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabelBold}>Total Cost</Text>
                      <Text style={styles.summaryValueBold}>
                        {totalTokenCost.toFixed(tokenAsset === 'SOL' ? 4 : 2)} {tokenAsset === 'CUSTOM' ? 'tokens' : tokenAsset}
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>NFTs</Text>
                      <Text style={styles.summaryValue}>{nftRows.length}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Total Fee</Text>
                      <Text style={styles.summaryValueMuted}>{totalNftFee.toFixed(4)} SOL</Text>
                    </View>
                  </>
                )}
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
                <TouchableOpacity>
                  <Text style={styles.warningLink}>Get {networkName} SOL →</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <NetworkBadge style={styles.networkBadge} />
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={`Continue (${validRows.length} ${mode === 'TOKEN' ? 'payouts' : 'NFTs'})`}
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
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { flex: 1, padding: SPACING.xl },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },

  // Error states
  errorEmoji: { fontSize: 48, marginBottom: SPACING.lg },
  errorTitle: { ...TYPOGRAPHY.h2, color: COLORS.error, marginBottom: SPACING.sm },
  errorMessage: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, textAlign: 'center', marginBottom: SPACING['2xl'] },

  // Resume
  resumeEmoji: { fontSize: 48, marginBottom: SPACING.lg },
  resumeTitle: { ...TYPOGRAPHY.h2, color: COLORS.text, marginBottom: SPACING.sm },
  resumeMessage: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, textAlign: 'center', marginBottom: SPACING['2xl'], maxWidth: 280 },
  resumeButtons: { gap: SPACING.md, width: '100%', maxWidth: 280 },
  resumeButton: { width: '100%' },

  // Input phase
  inputHeader: { alignItems: 'center', marginBottom: SPACING['2xl'] },
  inputEmoji: { fontSize: 48, marginBottom: SPACING.md },
  inputTitle: { ...TYPOGRAPHY.h2, color: COLORS.text, marginBottom: SPACING.xs },
  inputSubtitle: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },

  // Mode toggle
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  modeOption: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
  },
  modeOptionActive: { backgroundColor: COLORS.primary },
  modeText: { ...TYPOGRAPHY.smallMedium, color: COLORS.textSecondary },
  modeTextActive: { color: COLORS.text },

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

  // Import
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  importButtonIcon: { fontSize: 20 },
  importButtonText: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text },
  importHint: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, textAlign: 'center', marginBottom: SPACING['2xl'] },

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
  manualRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING['2xl'] },
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
  rowListHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clearAllText: { ...TYPOGRAPHY.smallMedium, color: COLORS.error },
  rowList: { paddingBottom: SPACING.md },

  // Row card
  rowCard: { marginBottom: SPACING.sm, padding: SPACING.md, position: 'relative' },
  rowCardInvalid: { borderWidth: 1, borderColor: COLORS.error },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  rowIndex: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  rowStatus: { ...TYPOGRAPHY.caption },
  rowContent: { flexDirection: 'row', gap: SPACING.md },
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
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  balanceLabel: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },
  balanceValue: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text },

  // Executing phase
  executingContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  executingTitle: { ...TYPOGRAPHY.h2, color: COLORS.text, marginTop: SPACING.xl, marginBottom: SPACING.sm },
  executingProgress: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, marginBottom: SPACING.lg },
  executingHint: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.md },
  stopButton: { marginTop: SPACING['2xl'], minWidth: 150 },

  // Approval info card
  approvalCard: { marginBottom: SPACING.lg, backgroundColor: COLORS.primaryMuted, borderWidth: 1, borderColor: COLORS.primary },
  approvalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xs },
  approvalIcon: { fontSize: 18, marginRight: SPACING.sm },
  approvalTitle: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text },
  approvalReason: { ...TYPOGRAPHY.small, color: COLORS.textSecondary },
  approvalDetail: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: SPACING.xs },

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

  // Export section
  exportSection: { marginBottom: SPACING.lg },
  exportButtons: { flexDirection: 'row', gap: SPACING.md },
  exportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    gap: SPACING.sm,
  },
  exportBtnIcon: { fontSize: 18 },
  exportBtnText: { ...TYPOGRAPHY.smallMedium, color: COLORS.primary },
});
