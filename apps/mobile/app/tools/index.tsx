import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Card, NetworkBadge } from '../../components';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../../lib/constants';

interface ToolItemProps {
  icon: string;
  title: string;
  description: string;
  onPress: () => void;
  badge?: string;
}

const ToolItem: React.FC<ToolItemProps> = ({ icon, title, description, onPress, badge }) => (
  <Card style={styles.toolCard} onPress={onPress}>
    <View style={styles.toolContent}>
      <View style={styles.toolIconContainer}>
        <Text style={styles.toolIcon}>{icon}</Text>
      </View>
      <View style={styles.toolInfo}>
        <View style={styles.toolHeader}>
          <Text style={styles.toolTitle}>{title}</Text>
          {badge && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
        <Text style={styles.toolDescription}>{description}</Text>
      </View>
      <Text style={styles.toolArrow}>›</Text>
    </View>
  </Card>
);

export default function ToolsHubScreen() {
  const router = useRouter();

  const handleBatchToken = () => {
    // Go to batch screen locked to TOKEN mode
    router.push('/tools/batch?mode=TOKEN' as any);
  };

  const handleBatchNft = () => {
    // Go to batch screen locked to NFT mode
    router.push('/tools/batch?mode=NFT' as any);
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Send in Bulk',
          headerBackTitle: 'Home',
        }} 
      />
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Bulk Send</Text>
          <Text style={styles.headerSubtitle}>
            Send tokens or NFTs to multiple recipients
          </Text>
        </View>

        {/* Token Batch */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tokens</Text>
          <ToolItem
            icon="💰"
            title="Batch Token Payout"
            description="Send SOL, USDC, or SPL tokens to multiple wallets"
            onPress={handleBatchToken}
            badge="CSV"
          />
        </View>

        {/* NFT Batch */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NFTs</Text>
          <ToolItem
            icon="🖼️"
            title="Batch NFT Transfer"
            description="Transfer multiple NFTs to different recipients"
            onPress={handleBatchNft}
          />
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            💡 Import recipients via CSV or paste them directly.{'\n'}
            Transfers are batched for minimal wallet approvals.
          </Text>
        </View>

        <NetworkBadge style={styles.networkBadge} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.xl,
    paddingBottom: SPACING['4xl'],
  },
  header: {
    marginBottom: SPACING['2xl'],
  },
  headerTitle: {
    ...TYPOGRAPHY.h1,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  headerSubtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
  },
  section: {
    marginBottom: SPACING['2xl'],
  },
  sectionTitle: {
    ...TYPOGRAPHY.captionMedium,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
  },
  toolCard: {
    marginBottom: SPACING.md,
    padding: SPACING.lg,
  },
  toolContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolIconContainer: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.lg,
  },
  toolIcon: {
    fontSize: 24,
  },
  toolInfo: {
    flex: 1,
  },
  toolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  toolTitle: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.text,
  },
  toolDescription: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
  },
  toolArrow: {
    fontSize: 24,
    color: COLORS.textMuted,
    fontWeight: '300',
    marginLeft: SPACING.sm,
  },
  badge: {
    backgroundColor: COLORS.primaryMuted,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  badgeText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  infoText: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
  },
  networkBadge: {
    alignSelf: 'center',
    marginTop: SPACING.md,
  },
});
