import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useGroupStore } from '../stores/groupStore';
import { useWalletPublicKey } from '../stores/walletStore';
import { Button } from '../components/Button';
import { COLORS } from '../lib/constants';
import { Group } from '../lib/types';

export default function HomeScreen() {
  const router = useRouter();
  const groups = useGroupStore((state) => state.groups);
  const loadData = useGroupStore((state) => state.loadData);
  const isLoading = useGroupStore((state) => state.isLoading);
  const publicKey = useWalletPublicKey();
  
  const handleCreateGroup = () => {
    router.push('/group/create');
  };
  
  const handleGroupPress = (group: Group) => {
    router.push(`/group/${group.id}`);
  };
  
  const renderGroup = ({ item }: { item: Group }) => (
    <TouchableOpacity 
      style={styles.groupCard}
      onPress={() => handleGroupPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.groupInfo}>
        <Text style={styles.groupName}>{item.name}</Text>
        <Text style={styles.groupMembers}>
          {item.members.length} member{item.members.length !== 1 ? 's' : ''}
        </Text>
      </View>
      <Text style={styles.groupArrow}>→</Text>
    </TouchableOpacity>
  );
  
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>👋</Text>
      <Text style={styles.emptyTitle}>No groups yet</Text>
      <Text style={styles.emptyText}>
        Create your first group to start splitting expenses with friends.
      </Text>
      <Button
        title="Create Group"
        onPress={handleCreateGroup}
        style={styles.emptyButton}
      />
    </View>
  );
  
  return (
    <View style={styles.container}>
      {/* Header with wallet info */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Connected Wallet</Text>
        <Text style={styles.walletAddress}>
          {publicKey ? `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}` : 'Not connected'}
        </Text>
      </View>
      
      {/* Groups List */}
      <FlatList
        data={groups}
        renderItem={renderGroup}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={loadData}
            tintColor={COLORS.primary}
          />
        }
      />
      
      {/* FAB for creating group */}
      {groups.length > 0 && (
        <TouchableOpacity 
          style={styles.fab}
          onPress={handleCreateGroup}
          activeOpacity={0.8}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  headerLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  walletAddress: {
    fontSize: 16,
    color: COLORS.text,
    fontFamily: 'monospace',
  },
  listContent: {
    padding: 20,
    flexGrow: 1,
  },
  groupCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  groupMembers: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  groupArrow: {
    fontSize: 20,
    color: COLORS.textSecondary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  emptyButton: {
    paddingHorizontal: 32,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: 32,
    color: COLORS.text,
    fontWeight: '300',
    marginTop: -2,
  },
});
