import React, { useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useGroupStore } from '../../stores/groupStore';
import { useWalletPublicKey } from '../../stores/walletStore';
import { Button, Card, SectionHeader } from '../../components';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../../lib/constants';
import { Member } from '../../lib/types';

export default function AddExpenseScreen() {
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const addExpense = useGroupStore((state) => state.addExpense);
  const group = useGroupStore((state) => state.getGroupById(groupId || ''));
  const publicKey = useWalletPublicKey();
  
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paidBy, setPaidBy] = useState<string>(publicKey || '');
  const [splitBetween, setSplitBetween] = useState<Set<string>>(
    new Set(group?.members.map(m => m.wallet) || [])
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const parsedAmount = useMemo(() => {
    const parsed = parseFloat(amount);
    return isNaN(parsed) ? 0 : parsed;
  }, [amount]);
  
  const perPersonAmount = useMemo(() => {
    if (splitBetween.size === 0) return 0;
    return parsedAmount / splitBetween.size;
  }, [parsedAmount, splitBetween.size]);
  
  const getMemberDisplay = (member: Member): string => {
    if (member.nickname) return member.nickname;
    if (member.wallet === publicKey) return 'You';
    return `${member.wallet.slice(0, 4)}···${member.wallet.slice(-4)}`;
  };
  
  const toggleSplitMember = (wallet: string) => {
    const newSet = new Set(splitBetween);
    if (newSet.has(wallet)) {
      if (newSet.size > 1) {
        newSet.delete(wallet);
      }
    } else {
      newSet.add(wallet);
    }
    setSplitBetween(newSet);
  };
  
  const handleAmountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1]?.length > 2) return;
    setAmount(cleaned);
    setError('');
  };
  
  const handleAdd = async () => {
    if (!description.trim()) {
      setError('Please add a description for this expense');
      return;
    }
    
    if (parsedAmount <= 0) {
      setError('Please enter an amount greater than zero');
      return;
    }
    
    if (!paidBy) {
      setError('Please select who paid for this expense');
      return;
    }
    
    if (splitBetween.size === 0) {
      setError('Please select at least one person to split with');
      return;
    }
    
    if (!groupId) {
      setError('Unable to find the group');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      await addExpense(groupId, {
        groupId,
        amount: parsedAmount,
        description: description.trim(),
        paidBy,
        splitBetween: Array.from(splitBetween),
      });
      router.back();
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setIsLoading(false);
    }
  };
  
  if (!group) {
    return (
      <View style={styles.container}>
        <View style={styles.errorState}>
          <Text style={styles.errorEmoji}>🔍</Text>
          <Text style={styles.errorText}>Group not found</Text>
          <Button title="Go Back" onPress={() => router.back()} variant="outline" />
        </View>
      </View>
    );
  }
  
  return (
    <>
      <Stack.Screen options={{ title: 'Add Expense' }} />
      
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Amount Input */}
          <View style={styles.amountSection}>
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={handleAmountChange}
                placeholder="0.00"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>
            <Text style={styles.amountLabel}>Amount (USDC)</Text>
          </View>
          
          {/* Description */}
          <View style={styles.section}>
            <SectionHeader title="What's this for?" />
            <TextInput
              style={styles.descriptionInput}
              value={description}
              onChangeText={(text) => {
                setDescription(text);
                setError('');
              }}
              placeholder="e.g., Dinner, Uber, Groceries..."
              placeholderTextColor={COLORS.textMuted}
              maxLength={100}
            />
          </View>
          
          {/* Paid By */}
          <View style={styles.section}>
            <SectionHeader title="Paid by" />
            <View style={styles.chipContainer}>
              {group.members.map((member) => {
                const isSelected = paidBy === member.wallet;
                return (
                  <TouchableOpacity
                    key={member.wallet}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => setPaidBy(member.wallet)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {getMemberDisplay(member)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          
          {/* Split Between */}
          <View style={styles.section}>
            <SectionHeader 
              title="Split between" 
              subtitle={`${splitBetween.size} of ${group.members.length} selected`}
            />
            <View style={styles.chipContainer}>
              {group.members.map((member) => {
                const isSelected = splitBetween.has(member.wallet);
                return (
                  <TouchableOpacity
                    key={member.wallet}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => toggleSplitMember(member.wallet)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {getMemberDisplay(member)}
                    </Text>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          
          {/* Split Preview */}
          {parsedAmount > 0 && splitBetween.size > 0 && (
            <Card style={styles.previewCard}>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Per person</Text>
                <Text style={styles.previewAmount}>${perPersonAmount.toFixed(2)}</Text>
              </View>
              <View style={styles.previewDivider} />
              <Text style={styles.previewNote}>
                Split equally among {splitBetween.size} {splitBetween.size === 1 ? 'person' : 'people'}
              </Text>
            </Card>
          )}
          
          {/* Error Message */}
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>
        
        <View style={styles.footer}>
          <Button
            title="Add Expense"
            onPress={handleAdd}
            loading={isLoading}
            disabled={!amount || !description.trim()}
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
  content: {
    flex: 1,
    padding: SPACING.xl,
  },
  
  // Amount Section
  amountSection: {
    alignItems: 'center',
    paddingVertical: SPACING['2xl'],
    marginBottom: SPACING.lg,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 40,
    color: COLORS.textMuted,
    marginRight: SPACING.sm,
    fontWeight: '300',
  },
  amountInput: {
    fontSize: 48,
    color: COLORS.text,
    fontWeight: '600',
    minWidth: 120,
    textAlign: 'center',
  },
  amountLabel: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
  
  // Sections
  section: {
    marginBottom: SPACING['2xl'],
  },
  descriptionInput: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  
  // Chips
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryMuted,
  },
  chipText: {
    ...TYPOGRAPHY.smallMedium,
    color: COLORS.textSecondary,
  },
  chipTextSelected: {
    color: COLORS.text,
  },
  checkmark: {
    marginLeft: SPACING.sm,
    color: COLORS.primary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  
  // Preview Card
  previewCard: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.surfaceLight,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewLabel: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
  },
  previewAmount: {
    ...TYPOGRAPHY.h2,
    color: COLORS.success,
  },
  previewDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  previewNote: {
    ...TYPOGRAPHY.small,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  
  // Error States
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING['4xl'],
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: SPACING.lg,
  },
  errorText: {
    ...TYPOGRAPHY.h3,
    color: COLORS.error,
    marginBottom: SPACING['2xl'],
  },
  errorBanner: {
    backgroundColor: COLORS.errorMuted,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    marginTop: SPACING.lg,
  },
  errorBannerText: {
    ...TYPOGRAPHY.small,
    color: COLORS.error,
    textAlign: 'center',
  },
  
  // Footer
  footer: {
    padding: SPACING.xl,
    paddingBottom: SPACING['4xl'],
  },
});
