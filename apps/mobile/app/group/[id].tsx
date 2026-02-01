import React, { useMemo, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useGroupStore } from '../../stores/groupStore';
import { useWalletPublicKey } from '../../stores/walletStore';
import { Button, Card, EmptyState } from '../../components';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../../lib/constants';
import { Expense, Balance, Member } from '../../lib/types';

type TabType = 'expenses' | 'balances' | 'members';

const TABS: { key: TabType; label: string; icon: string }[] = [
  { key: 'expenses', label: 'Expenses', icon: '💸' },
  { key: 'balances', label: 'Balances', icon: '⚖️' },
  { key: 'members', label: 'Members', icon: '👥' },
];

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const publicKey = useWalletPublicKey();

  const groupId = typeof id === 'string' ? id : '';

  const group = useGroupStore((s) => s.getGroupById(groupId));
  const expenses = useGroupStore((s) => s.getExpensesByGroup(groupId));
  const settlements = useGroupStore((s) => s.getSettlementsByGroup(groupId));

  const balances = useMemo(() => {
    if (!groupId) return [];
    return useGroupStore.getState().getBalances(groupId);
  }, [groupId, group, expenses, settlements]);

  const [activeTab, setActiveTab] = useState<TabType>('expenses');

  if (!group) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorEmoji}>🔍</Text>
          <Text style={styles.errorTitle}>Group not found</Text>
          <Text style={styles.errorMessage}>This group may have been deleted or doesn't exist.</Text>
          <Button title="Go Back" onPress={() => router.back()} variant="outline" />
        </View>
      </View>
    );
  }
  
  const getMemberNickname = (wallet: string): string => {
    const member = group.members.find(m => m.wallet === wallet);
    if (member?.nickname) return member.nickname;
    if (wallet === publicKey) return 'You';
    return `${wallet.slice(0, 4)}···${wallet.slice(-4)}`;
  };
  
  const renderExpense = ({ item }: { item: Expense }) => (
    <Card style={styles.itemCard}>
      <View style={styles.itemRow}>
        <View style={styles.itemIcon}>
          <Text style={styles.itemIconText}>💰</Text>
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle} numberOfLines={1}>{item.description}</Text>
          <Text style={styles.itemSubtitle}>
            Paid by {getMemberNickname(item.paidBy)}
          </Text>
        </View>
        <Text style={styles.itemAmount}>${item.amount.toFixed(2)}</Text>
      </View>
    </Card>
  );
  
  const renderBalance = ({ item }: { item: Balance }) => {
    const isYouOwing = item.from === publicKey;
    const isYouOwed = item.to === publicKey;
    
    return (
      <Card style={styles.itemCard}>
        <View style={styles.balanceContent}>
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
                <Text style={styles.balanceArrow}> → </Text>
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
            <View style={styles.balanceActions}>
              {isYouOwing && (
                <TouchableOpacity 
                  style={styles.settleButton}
                  onPress={() => {
                    router.push(`/group/settle?groupId=${id}&to=${item.to}&amount=${item.amount}`);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.settleButtonText}>Pay</Text>
                </TouchableOpacity>
              )}
              {isYouOwed && (
                <TouchableOpacity 
                  style={styles.requestButton}
                  onPress={() => {
                    router.push(`/group/request?groupId=${id}&from=${item.from}&amount=${item.amount}&currency=USDC`);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.requestButtonText}>Request</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Card>
    );
  };
  
  const renderMember = ({ item }: { item: Member }) => {
    const isYou = item.wallet === publicKey;
    
    return (
      <Card style={styles.itemCard}>
        <View style={styles.itemRow}>
          <View style={[styles.memberAvatar, isYou && styles.memberAvatarYou]}>
            <Text style={[styles.memberAvatarText, isYou && styles.memberAvatarTextYou]}>
              {(item.nickname || item.wallet)[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.itemInfo}>
            <View style={styles.memberNameRow}>
              <Text style={styles.itemTitle}>
                {item.nickname || `${item.wallet.slice(0, 6)}···${item.wallet.slice(-4)}`}
              </Text>
              {isYou && (
                <View style={styles.youBadge}>
                  <Text style={styles.youBadgeText}>You</Text>
                </View>
              )}
            </View>
            <Text style={styles.memberWallet} numberOfLines={1}>
              {item.wallet}
            </Text>
          </View>
        </View>
      </Card>
    );
  };
  
  const renderTabContent = () => {
    if (activeTab === 'expenses') {
      if (expenses.length === 0) {
        return (
          <EmptyState
            emoji="📝"
            title="No expenses yet"
            message="Add your first expense to start tracking who owes what."
            compact
          />
        );
      }
      return (
        <FlatList
          data={expenses}
          renderItem={renderExpense}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      );
    }
    
    if (activeTab === 'balances') {
      if (balances.length === 0) {
        return (
          <EmptyState
            emoji="✨"
            title="All settled up!"
            message="No outstanding balances between members."
            compact
          />
        );
      }
      return (
        <FlatList
          data={balances}
          renderItem={renderBalance}
          keyExtractor={(item) => `${item.from}-${item.to}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      );
    }
    
    return (
      <FlatList
        data={group.members}
        renderItem={renderMember}
        keyExtractor={(item) => item.wallet}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    );
  };
  
  return (
    <>
      <Stack.Screen options={{ title: group.name }} />
      
      <View style={styles.container}>
        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <View style={styles.tabs}>
            {TABS.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <Text style={styles.tabIcon}>{tab.icon}</Text>
                <Text style={[
                  styles.tabText,
                  activeTab === tab.key && styles.tabTextActive,
                ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        {/* Content */}
        <View style={styles.content}>
          {renderTabContent()}
        </View>
        
        {/* Footer Action */}
        <View style={styles.footer}>
          {activeTab === 'expenses' && (
            <Button
              title="Add Expense"
              onPress={() => router.push(`/group/add-expense?groupId=${id}`)}
              size="large"
              fullWidth
              icon="➕"
            />
          )}
          {activeTab === 'members' && (
            <Button
              title="Add Member"
              onPress={() => router.push(`/group/add-member?groupId=${id}`)}
              size="large"
              fullWidth
              icon="👤"
            />
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
  
  // Error State
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING['4xl'],
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: SPACING.lg,
  },
  errorTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  errorMessage: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING['2xl'],
  },
  
  // Tabs
  tabsContainer: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.xs,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.sm,
    gap: SPACING.xs,
  },
  tabActive: {
    backgroundColor: COLORS.surfaceLight,
  },
  tabIcon: {
    fontSize: 14,
  },
  tabText: {
    ...TYPOGRAPHY.smallMedium,
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.text,
  },
  
  // Content
  content: {
    flex: 1,
  },
  listContent: {
    padding: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  
  // Item Cards
  itemCard: {
    marginBottom: SPACING.md,
    padding: SPACING.lg,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  itemIconText: {
    fontSize: 18,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  itemSubtitle: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
  },
  itemAmount: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
  },
  
  // Balance Cards
  balanceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balanceInfo: {
    flex: 1,
  },
  balanceText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
  },
  balanceName: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.text,
  },
  balanceArrow: {
    color: COLORS.textMuted,
  },
  balanceRight: {
    alignItems: 'flex-end',
  },
  balanceAmount: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  balancePositive: {
    color: COLORS.success,
  },
  balanceNegative: {
    color: COLORS.error,
  },
  balanceActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  settleButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  settleButtonText: {
    ...TYPOGRAPHY.smallMedium,
    color: COLORS.text,
  },
  requestButton: {
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  requestButtonText: {
    ...TYPOGRAPHY.smallMedium,
    color: COLORS.text,
  },
  
  // Member Cards
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  memberAvatarYou: {
    backgroundColor: COLORS.primaryMuted,
  },
  memberAvatarText: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textSecondary,
  },
  memberAvatarTextYou: {
    color: COLORS.primary,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  youBadge: {
    backgroundColor: COLORS.primaryMuted,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  youBadgeText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontWeight: '600',
  },
  memberWallet: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    fontFamily: 'monospace',
    marginTop: SPACING.xs,
  },
  
  // Footer
  footer: {
    padding: SPACING.xl,
    paddingBottom: SPACING['4xl'],
    minHeight: 100,
  },
});
