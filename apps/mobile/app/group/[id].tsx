import React, { useMemo, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useGroupStore } from '../../stores/groupStore';
import { useWalletPublicKey } from '../../stores/walletStore';
import { Button } from '../../components/Button';
import { COLORS } from '../../lib/constants';
import { Expense, Balance, Member } from '../../lib/types';

type TabType = 'expenses' | 'balances' | 'members';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const publicKey = useWalletPublicKey();

  const groupId = typeof id === 'string' ? id : '';

  // Te 3 linie subskrybują store -> UI odświeża się od razu po dodaniu expense
  const group = useGroupStore((s) => s.getGroupById(groupId));
  const expenses = useGroupStore((s) => s.getExpensesByGroup(groupId));
  const settlements = useGroupStore((s) => s.getSettlementsByGroup(groupId));

  // Balances liczymy stabilnie (bez pętli getSnapshot)
  const balances = useMemo(() => {
    if (!groupId) return [];
    return useGroupStore.getState().getBalances(groupId);
  }, [groupId, group, expenses, settlements]);

  const [activeTab, setActiveTab] = useState<TabType>('expenses');

  if (!group) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Group not found</Text>
      </View>
    );
  }
  
  const getMemberNickname = (wallet: string): string => {
    const member = group.members.find(m => m.wallet === wallet);
    if (member?.nickname) return member.nickname;
    if (wallet === publicKey) return 'You';
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
  };
  
  const renderExpense = ({ item }: { item: Expense }) => (
    <View style={styles.expenseCard}>
      <View style={styles.expenseInfo}>
        <Text style={styles.expenseDescription}>{item.description}</Text>
        <Text style={styles.expensePayer}>
          Paid by {getMemberNickname(item.paidBy)}
        </Text>
      </View>
      <Text style={styles.expenseAmount}>${item.amount.toFixed(2)}</Text>
    </View>
  );
  
  const renderBalance = ({ item }: { item: Balance }) => {
    const isYouOwing = item.from === publicKey;
    const isYouOwed = item.to === publicKey;
    
    return (
      <View style={styles.balanceCard}>
        <View style={styles.balanceInfo}>
          {isYouOwing ? (
            <Text style={styles.balanceText}>
              You owe <Text style={styles.balanceName}>{getMemberNickname(item.to)}</Text>
            </Text>
          ) : isYouOwed ? (
            <Text style={styles.balanceText}>
              <Text style={styles.balanceName}>{getMemberNickname(item.from)}</Text> owes you
            </Text>
          ) : (
            <Text style={styles.balanceText}>
              <Text style={styles.balanceName}>{getMemberNickname(item.from)}</Text>
              {' → '}
              <Text style={styles.balanceName}>{getMemberNickname(item.to)}</Text>
            </Text>
          )}
        </View>
        <View style={styles.balanceRight}>
          <Text style={[
            styles.balanceAmount,
            isYouOwing && styles.balanceNegative,
            isYouOwed && styles.balancePositive,
          ]}>
            ${item.amount.toFixed(2)}
          </Text>
          {(isYouOwing || isYouOwed) && (
            <TouchableOpacity 
              style={styles.settleButton}
              onPress={() => {
                const toWallet = isYouOwing ? item.to : item.from;
                router.push(`/group/settle?groupId=${id}&to=${toWallet}&amount=${item.amount}`);
              }}
            >
              <Text style={styles.settleButtonText}>Settle</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };
  
  const renderMember = ({ item }: { item: Member }) => (
    <View style={styles.memberCard}>
      <View style={styles.memberAvatar}>
        <Text style={styles.memberAvatarText}>
          {(item.nickname || item.wallet)[0].toUpperCase()}
        </Text>
      </View>
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>
          {item.nickname || `${item.wallet.slice(0, 4)}...${item.wallet.slice(-4)}`}
          {item.wallet === publicKey && ' (You)'}
        </Text>
        <Text style={styles.memberWallet}>
          {item.wallet.slice(0, 8)}...{item.wallet.slice(-8)}
        </Text>
      </View>
    </View>
  );
  
  return (
    <>
      <Stack.Screen options={{ title: group.name }} />
      
      <View style={styles.container}>
        {/* Tabs */}
        <View style={styles.tabs}>
          {(['expenses', 'balances', 'members'] as TabType[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[
                styles.tabText,
                activeTab === tab && styles.tabTextActive,
              ]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        {/* Content */}
        <View style={styles.content}>
          {activeTab === 'expenses' && (
            <>
              <FlatList
                data={expenses}
                renderItem={renderExpense}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No expenses yet</Text>
                  </View>
                }
              />
              <Button
                title="Add Expense"
                onPress={() => router.push(`/group/add-expense?groupId=${id}`)}
                style={styles.addButton}
              />
            </>
          )}
          
          {activeTab === 'balances' && (
            <FlatList
              data={balances}
              renderItem={renderBalance}
              keyExtractor={(item) => `${item.from}-${item.to}`}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyEmoji}>✨</Text>
                  <Text style={styles.emptyText}>All settled up!</Text>
                </View>
              }
            />
          )}
          
          {activeTab === 'members' && (
            <>
              <FlatList
                data={group.members}
                renderItem={renderMember}
                keyExtractor={(item) => item.wallet}
                contentContainerStyle={styles.listContent}
              />
              <Button
                title="Add Member"
                onPress={() => router.push(`/group/add-member?groupId=${id}`)}
                style={styles.addButton}
              />
            </>
          )}
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
  errorText: {
    color: COLORS.error,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  listContent: {
    padding: 20,
    flexGrow: 1,
  },
  
  // Expenses
  expenseCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expenseInfo: {
    flex: 1,
  },
  expenseDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  expensePayer: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  
  // Balances
  balanceCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balanceInfo: {
    flex: 1,
  },
  balanceText: {
    fontSize: 16,
    color: COLORS.text,
  },
  balanceName: {
    fontWeight: '600',
  },
  balanceRight: {
    alignItems: 'flex-end',
  },
  balanceAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  balancePositive: {
    color: COLORS.success,
  },
  balanceNegative: {
    color: COLORS.error,
  },
  settleButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  settleButtonText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 14,
  },
  
  // Members
  memberCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  memberAvatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  memberWallet: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: 'monospace',
  },
  
  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  
  // Add Button
  addButton: {
    margin: 20,
  },
});
