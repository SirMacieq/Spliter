import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useGroupStore, useGroups, useIsGroupsLoading } from '../stores/groupStore';
import { useWalletPublicKey } from '../stores/walletStore';
import { Button, NetworkBadge, EmptyState, Card, SpliterLogo } from '../components';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../lib/constants';
import { Group } from '../lib/types';

// Primary action card component
interface PrimaryActionProps {
  icon: string;
  title: string;
  description: string;
  accentColor: string;
  onPress: () => void;
}

const PrimaryAction: React.FC<PrimaryActionProps> = ({ 
  icon, title, description, accentColor, onPress 
}) => (
  <TouchableOpacity 
    style={[styles.primaryCard, { borderColor: accentColor }]} 
    onPress={onPress}
    activeOpacity={0.85}
  >
    <View style={[styles.primaryIconContainer, { backgroundColor: `${accentColor}20` }]}>
      <Text style={styles.primaryIcon}>{icon}</Text>
    </View>
    <Text style={styles.primaryTitle}>{title}</Text>
    <Text style={styles.primaryDescription}>{description}</Text>
    <View style={[styles.primaryArrow, { backgroundColor: accentColor }]}>
      <Text style={styles.primaryArrowText}>→</Text>
    </View>
  </TouchableOpacity>
);

export default function HomeScreen() {
  const router = useRouter();
  const groups = useGroups();
  const hydrate = useGroupStore((state) => state.hydrate);
  const isLoading = useIsGroupsLoading();
  const publicKey = useWalletPublicKey();
  
  const handleSettings = () => {
    router.push('/settings');
  };
  
  const handleCreateGroup = () => {
    router.push('/group/create');
  };
  
  const handleGroupPress = (group: Group) => {
    router.push(`/group/${group.id}`);
  };

  const handleSplitRequest = () => {
    if (groups.length > 0) {
      // If has groups, go to first group's request flow
      router.push('/group/request' as any);
    } else {
      // Otherwise create a group first
      router.push('/group/create');
    }
  };

  const handleBulkSend = () => {
    router.push('/tools' as any);
  };
  
  const renderGroup = ({ item }: { item: Group }) => (
    <Card 
      style={styles.groupCard}
      onPress={() => handleGroupPress(item)}
    >
      <View style={styles.groupContent}>
        <View style={styles.groupAvatar}>
          <Text style={styles.groupAvatarText}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.groupInfo}>
          <Text style={styles.groupName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.groupMembers}>
            {item.members.length} member{item.members.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.groupArrowContainer}>
          <Text style={styles.groupArrow}>›</Text>
        </View>
      </View>
    </Card>
  );
  
  const renderEmptyState = () => (
    <EmptyState
      emoji="👋"
      title="No groups yet"
      message="Create your first group to start splitting expenses with friends."
      actionLabel="Create Group"
      onAction={handleCreateGroup}
    />
  );

  const renderHeader = () => (
    <>
      {/* Wallet Info Bar */}
      <View style={styles.walletBar}>
        <View style={styles.walletInfo}>
          <Text style={styles.walletLabel}>Wallet</Text>
          <Text style={styles.walletAddress}>
            {publicKey ? `${publicKey.slice(0, 6)}···${publicKey.slice(-4)}` : '—'}
          </Text>
        </View>
        <NetworkBadge />
      </View>
      
      {/* Primary Actions */}
      <View style={styles.primaryActions}>
        <PrimaryAction
          icon="💸"
          title="Split & Request"
          description="Settle expenses with friends via links & QR"
          accentColor={COLORS.primary}
          onPress={handleSplitRequest}
        />
        <PrimaryAction
          icon="📦"
          title="Send in Bulk"
          description="Send tokens & NFTs to multiple wallets"
          accentColor={COLORS.secondary}
          onPress={handleBulkSend}
        />
      </View>
      
      {/* Groups Section Title */}
      {groups.length > 0 && (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Groups</Text>
          <TouchableOpacity onPress={handleCreateGroup}>
            <Text style={styles.sectionAction}>+ New</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
  
  return (
    <>
      <Stack.Screen 
        options={{
          headerTitle: () => (
            <View style={styles.headerBrand}>
              <SpliterLogo size={28} />
              <Text style={styles.headerTitle}>Spliter</Text>
            </View>
          ),
          headerRight: () => (
            <TouchableOpacity 
              onPress={handleSettings}
              style={styles.settingsButton}
              activeOpacity={0.7}
            >
              <Text style={styles.settingsIcon}>⚙️</Text>
            </TouchableOpacity>
          ),
        }}
      />
    
      <View style={styles.container}>
        <FlatList
          data={groups}
          renderItem={renderGroup}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={hydrate}
              tintColor={COLORS.primary}
            />
          }
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  
  // Header
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    fontWeight: '700',
  },
  settingsButton: {
    padding: SPACING.sm,
    marginRight: SPACING.xs,
  },
  settingsIcon: {
    fontSize: 22,
  },
  
  listContent: {
    padding: SPACING.xl,
    paddingBottom: 100,
    flexGrow: 1,
  },
  
  // Wallet Bar
  walletBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING['2xl'],
  },
  walletInfo: {
    flex: 1,
  },
  walletLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  walletAddress: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.text,
    fontFamily: 'monospace',
  },
  
  // Primary Actions
  primaryActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING['3xl'],
  },
  primaryCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    minHeight: 180,
  },
  primaryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  primaryIcon: {
    fontSize: 24,
  },
  primaryTitle: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  primaryDescription: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
    lineHeight: 18,
    flex: 1,
  },
  primaryArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    marginTop: SPACING.md,
  },
  primaryArrowText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    ...TYPOGRAPHY.captionMedium,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionAction: {
    ...TYPOGRAPHY.smallMedium,
    color: COLORS.primary,
  },
  
  // Group Cards
  groupCard: {
    marginBottom: SPACING.md,
    padding: SPACING.lg,
  },
  groupContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupAvatar: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  groupAvatarText: {
    ...TYPOGRAPHY.h3,
    color: COLORS.primary,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  groupMembers: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
  },
  groupArrowContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupArrow: {
    fontSize: 24,
    color: COLORS.textMuted,
    fontWeight: '300',
  },
});
