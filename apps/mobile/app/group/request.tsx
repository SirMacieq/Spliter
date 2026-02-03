import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { useWalletPublicKey } from '../../stores/walletStore';
import { Button, Card, SectionHeader, SpliterLogo } from '../../components';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, FEE_PERCENT, isFeeConfigured } from '../../lib/constants';
import { generatePayLink, shortenAddress, PayLinkCurrency } from '../../lib/validation';

type Currency = 'SOL' | 'USDC';

export default function RequestPaymentScreen() {
  const router = useRouter();
  const publicKey = useWalletPublicKey();
  const { groupId, amount: initialAmount, currency: initialCurrency } = useLocalSearchParams<{ 
    groupId?: string; 
    amount?: string;
    currency?: string;
  }>();
  
  const [amount, setAmount] = useState(initialAmount || '');
  const [currency, setCurrency] = useState<Currency>((initialCurrency?.toUpperCase() as Currency) || 'USDC');
  const [note, setNote] = useState('');
  const [linkGenerated, setLinkGenerated] = useState(false);
  const [payLink, setPayLink] = useState('');
  const [copied, setCopied] = useState(false);
  
  const feeConfigured = isFeeConfigured();
  const parsedAmount = parseFloat(amount) || 0;
  
  const handleAmountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (currency === 'USDC' && parts[1]?.length > 2) return;
    if (currency === 'SOL' && parts[1]?.length > 9) return;
    setAmount(cleaned);
  };
  
  const handleGenerateLink = () => {
    if (!publicKey || parsedAmount <= 0) return;
    
    const link = generatePayLink({
      to: publicKey, // Payment goes TO the requester (current user)
      amount: parsedAmount,
      currency: currency as PayLinkCurrency,
      groupId,
      note: note.trim() || undefined,
    });
    
    setPayLink(link);
    setLinkGenerated(true);
  };
  
  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(payLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleShare = async () => {
    try {
      await Share.share({
        message: `Pay me ${currency === 'USDC' ? '$' : ''}${parsedAmount.toFixed(currency === 'USDC' ? 2 : 4)} ${currency}${note ? ` for "${note}"` : ''}: ${payLink}`,
        url: payLink,
      });
    } catch (err) {
      console.error('Share error:', err);
    }
  };
  
  const handleOpenLink = () => {
    Linking.openURL(payLink);
  };
  
  const handleDone = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  };
  
  // Fee not configured
  if (!feeConfigured) {
    return (
      <>
        <Stack.Screen options={{ title: 'Request Payment' }} />
        <View style={styles.container}>
          <View style={styles.centerContent}>
            <Text style={styles.errorEmoji}>⚙️</Text>
            <Text style={styles.errorTitle}>Unavailable</Text>
            <Text style={styles.errorMessage}>
              Payment requests are temporarily unavailable.
            </Text>
            <Button title="Go Back" onPress={handleDone} variant="outline" />
          </View>
        </View>
      </>
    );
  }
  
  // Link Generated - Show QR and share options
  if (linkGenerated && payLink) {
    return (
      <>
        <Stack.Screen options={{ title: 'Payment Link' }} />
        <View style={styles.container}>
          <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
            <View style={styles.linkHeader}>
              <Text style={styles.linkTitle}>Share Payment Link</Text>
              <Text style={styles.linkSubtitle}>
                Anyone with this link can pay you
              </Text>
            </View>
            
            {/* QR Code */}
            <Card style={styles.qrCard}>
              <View style={styles.qrContainer}>
                <QRCode
                  value={payLink}
                  size={200}
                  backgroundColor={COLORS.surface}
                  color={COLORS.text}
                />
              </View>
              <Text style={styles.qrHint}>Scan to pay</Text>
            </Card>
            
            {/* Amount Summary */}
            <Card style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Amount</Text>
                <Text style={styles.summaryValue}>
                  {currency === 'USDC' ? '$' : ''}{parsedAmount.toFixed(currency === 'USDC' ? 2 : 4)} {currency}
                </Text>
              </View>
              {note && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Note</Text>
                  <Text style={styles.summaryValue} numberOfLines={1}>{note}</Text>
                </View>
              )}
              <Text style={styles.feeNote}>
                Payer will be charged {FEE_PERCENT}% service fee
              </Text>
            </Card>
            
            {/* Link Display */}
            <Card style={styles.linkCard}>
              <Text style={styles.linkLabel}>Payment Link</Text>
              <Text style={styles.linkText} numberOfLines={2}>{payLink}</Text>
            </Card>
            
            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleCopyLink}>
                <Text style={styles.actionBtnIcon}>📋</Text>
                <Text style={styles.actionBtnText}>
                  {copied ? 'Copied!' : 'Copy Link'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
                <Text style={styles.actionBtnIcon}>📤</Text>
                <Text style={styles.actionBtnText}>Share</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
          
          <View style={styles.footer}>
            <Button title="Done" onPress={handleDone} size="large" fullWidth />
          </View>
        </View>
      </>
    );
  }
  
  // Main Form
  return (
    <>
      <Stack.Screen options={{ title: 'Request Payment' }} />
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.formHeader}>
            <SpliterLogo size={64} style={styles.formLogo} />
            <Text style={styles.formTitle}>Request Payment</Text>
            <Text style={styles.formSubtitle}>
              Create a shareable pay link
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
          
          {/* Amount Input */}
          <SectionHeader title="Amount" />
          <View style={styles.amountInputRow}>
            {currency === 'USDC' && <Text style={styles.amountSymbol}>$</Text>}
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={handleAmountChange}
              placeholder="0.00"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="decimal-pad"
              autoFocus
            />
            <Text style={styles.amountCurrency}>{currency}</Text>
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
          
          {/* Note */}
          <View style={styles.noteSection}>
            <SectionHeader title="Note" subtitle="Optional (max 140 chars)" />
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={(text) => setNote(text.slice(0, 140))}
              placeholder="What's this for?"
              placeholderTextColor={COLORS.textMuted}
              multiline
              maxLength={140}
            />
            <Text style={styles.noteCounter}>{note.length}/140</Text>
          </View>
          
          {/* Fee Info */}
          <Card style={styles.feeInfoCard}>
            <Text style={styles.feeInfoText}>
              ℹ️ A {FEE_PERCENT}% service fee will be added to the payer's total.
            </Text>
          </Card>
        </ScrollView>
        
        <View style={styles.footer}>
          <Button
            title="Generate Payment Link"
            onPress={handleGenerateLink}
            disabled={parsedAmount <= 0 || !publicKey}
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
  scrollContentContainer: {
    paddingBottom: SPACING.xl,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  
  // Error State
  errorEmoji: {
    fontSize: 48,
    marginBottom: SPACING.lg,
  },
  errorTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.error,
    marginBottom: SPACING.sm,
  },
  errorMessage: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING['2xl'],
  },
  
  // Form Header
  formHeader: {
    alignItems: 'center',
    marginBottom: SPACING['2xl'],
  },
  formLogo: {
    marginBottom: SPACING.lg,
  },
  formTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  formSubtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
  },
  
  // Currency Toggle
  currencyToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.xs,
    marginBottom: SPACING['2xl'],
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
  
  // Amount Input
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
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
    marginBottom: SPACING['2xl'],
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
  
  // Note Section
  noteSection: {
    marginBottom: SPACING.lg,
  },
  noteInput: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  noteCounter: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    textAlign: 'right',
    marginTop: SPACING.xs,
  },
  
  // Fee Info
  feeInfoCard: {
    backgroundColor: COLORS.surfaceLight,
  },
  feeInfoText: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  
  // Link Generated Screen
  linkHeader: {
    alignItems: 'center',
    marginBottom: SPACING['2xl'],
  },
  linkTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  linkSubtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
  },
  
  // QR Card
  qrCard: {
    alignItems: 'center',
    paddingVertical: SPACING['2xl'],
    marginBottom: SPACING.lg,
  },
  qrContainer: {
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
  },
  qrHint: {
    ...TYPOGRAPHY.small,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
  },
  
  // Summary Card
  summaryCard: {
    marginBottom: SPACING.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  summaryLabel: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
  },
  summaryValue: {
    ...TYPOGRAPHY.smallMedium,
    color: COLORS.text,
    flex: 1,
    textAlign: 'right',
    marginLeft: SPACING.md,
  },
  feeNote: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  
  // Link Card
  linkCard: {
    marginBottom: SPACING.lg,
  },
  linkLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  linkText: {
    ...TYPOGRAPHY.small,
    color: COLORS.text,
    fontFamily: 'monospace',
  },
  
  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    gap: SPACING.sm,
  },
  actionBtnIcon: {
    fontSize: 20,
  },
  actionBtnText: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.primary,
  },
  
  // Footer
  footer: {
    padding: SPACING.xl,
    paddingBottom: SPACING['4xl'],
  },
});
