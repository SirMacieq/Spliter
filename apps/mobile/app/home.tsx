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
import { Button, NetworkBadge, EmptyState, Card } from '../components';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../lib/constants';
import { Group } from '../lib/types';

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
    <View style={styles.walletCard}>
      <View style={styles.walletInfo}>
        <Text style={styles.walletLabel}>Connected Wallet</Text>
        <Text style={styles.walletAddress}>
          {publicKey ? `${publicKey.slice(0, 6)}···${publicKey.slice(-4)}` : 'Not connected'}
        </Text>
      </View>
      <NetworkBadge />
    </View>
  );
  
  return (
    <>
      <Stack.Screen 
        options={{
          title: 'Spliter',
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
      
        {groups.length > 0 && (
          <TouchableOpacity 
            style={styles.fab}
            onPress={handleCreateGroup}
            activeOpacity={0.85}
          >
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
  
  // Wallet Card
  walletCard: {
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
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  walletAddress: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.text,
    fontFamily: 'monospace',
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
    width: 44,
    height: 44,
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
  
  // FAB
  fab: {
    position: 'absolute',
    right: SPACING.xl,
    bottom: SPACING['3xl'],
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  fabText: {
    fontSize: 28,
    color: COLORS.text,
    fontWeight: '400',
    marginTop: -2,
  },
});
