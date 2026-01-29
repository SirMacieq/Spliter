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
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useGroupStore } from '../../stores/groupStore';
import { useWalletPublicKey } from '../../stores/walletStore';
import { Button } from '../../components/Button';
import { COLORS } from '../../lib/constants';
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
    return `${member.wallet.slice(0, 4)}...${member.wallet.slice(-4)}`;
  };
  
  const toggleSplitMember = (wallet: string) => {
    const newSet = new Set(splitBetween);
    if (newSet.has(wallet)) {
      // Don't allow removing all members
      if (newSet.size > 1) {
        newSet.delete(wallet);
      }
    } else {
      newSet.add(wallet);
    }
    setSplitBetween(newSet);
  };
  
  const handleAmountChange = (text: string) => {
    // Only allow valid decimal numbers
    const cleaned = text.replace(/[^0-9.]/g, '');
    // Only allow one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    // Limit decimal places to 2
    if (parts[1]?.length > 2) return;
    setAmount(cleaned);
    setError('');
  };
  
  const handleAdd = async () => {
    if (!description.trim()) {
      setError('Please enter a description');
      return;
    }
    
    if (parsedAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    
    if (!paidBy) {
      setError('Please select who paid');
      return;
    }
    
    if (splitBetween.size === 0) {
      setError('Please select at least one person to split with');
      return;
    }
    
    if (!groupId) {
      setError('Group not found');
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
      setError('Failed to add expense');
      setIsLoading(false);
    }
  };
  
  if (!group) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Group not found</Text>
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
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Amount */}
          <Text style={styles.label}>Amount (USDC)</Text>
          <View style={styles.amountContainer}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={handleAmountChange}
              placeholder="0.00"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="decimal-pad"
              autoFocus
            />
          </View>
          
          {/* Description */}
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={styles.input}
            value={description}
            onChangeText={(text) => {
              setDescription(text);
              setError('');
            }}
            placeholder="e.g., Dinner, Uber, Groceries"
            placeholderTextColor={COLORS.textSecondary}
            maxLength={100}
          />
          
          {/* Paid By */}
          <Text style={styles.label}>Paid by</Text>
          <View style={styles.memberList}>
            {group.members.map((member) => (
              <TouchableOpacity
                key={member.wallet}
                style={[
                  styles.memberOption,
                  paidBy === member.wallet && styles.memberOptionSelected,
                ]}
                onPress={() => setPaidBy(member.wallet)}
              >
                <Text style={[
                  styles.memberOptionText,
                  paidBy === member.wallet && styles.memberOptionTextSelected,
                ]}>
                  {getMemberDisplay(member)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          {/* Split Between */}
          <Text style={styles.label}>Split between</Text>
          <View style={styles.memberList}>
            {group.members.map((member) => (
              <TouchableOpacity
                key={member.wallet}
                style={[
                  styles.memberOption,
                  splitBetween.has(member.wallet) && styles.memberOptionSelected,
                ]}
                onPress={() => toggleSplitMember(member.wallet)}
              >
                <Text style={[
                  styles.memberOptionText,
                  splitBetween.has(member.wallet) && styles.memberOptionTextSelected,
                ]}>
                  {getMemberDisplay(member)}
                </Text>
                {splitBetween.has(member.wallet) && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
          
          {/* Split Preview */}
          {parsedAmount > 0 && splitBetween.size > 0 && (
            <View style={styles.splitPreview}>
              <Text style={styles.splitPreviewText}>
                Split: ${perPersonAmount.toFixed(2)} per person
              </Text>
              <Text style={styles.splitPreviewSubtext}>
                ({splitBetween.size} {splitBetween.size === 1 ? 'person' : 'people'})
              </Text>
            </View>
          )}
          
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
        
        <View style={styles.footer}>
          <Button
            title="Add Expense"
            onPress={handleAdd}
            loading={isLoading}
            disabled={!amount || !description.trim()}
            size="large"
            style={styles.addButton}
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
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
    marginTop: 20,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 32,
    color: COLORS.textSecondary,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 32,
    color: COLORS.text,
    paddingVertical: 16,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
  },
  memberList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  memberOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  memberOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surfaceLight,
  },
  memberOptionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  memberOptionTextSelected: {
    color: COLORS.text,
    fontWeight: '600',
  },
  checkmark: {
    marginLeft: 6,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  splitPreview: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    alignItems: 'center',
  },
  splitPreviewText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  splitPreviewSubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  error: {
    color: COLORS.error,
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
  errorText: {
    color: COLORS.error,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  footer: {
    padding: 20,
    paddingBottom: 40,
  },
  addButton: {
    width: '100%',
  },
});
