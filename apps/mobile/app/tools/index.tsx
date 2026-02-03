import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
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

  const handlePayRequest = () => {
    router.push('/group/request' as any);
  };

  const handleSendToken = () => {
    // For v1, redirect to batch with hint for single transfer
    // In future: dedicated single-send screen
    router.push('/tools/batch' as any);
  };

  const handleSendNft = () => {
    // For v1, redirect to batch in NFT mode
    router.push('/tools/batch' as any);
  };

  const handleBatch = () => {
    router.push('/tools/batch' as any);
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Tools',
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
          <Text style={styles.headerTitle}>Send & Request</Text>
          <Text style={styles.headerSubtitle}>
            All the tools you need for payments
          </Text>
        </View>

        {/* Pay Requests */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Request Payments</Text>
          <ToolItem
            icon="🔗"
            title="Pay Link & QR"
            description="Create shareable payment requests"
            onPress={handlePayRequest}
          />
        </View>

        {/* Send */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Send Assets</Text>
          <ToolItem
            icon="💸"
            title="Send Token"
            description="SOL, USDC, or any SPL token"
            onPress={handleSendToken}
          />
          <ToolItem
            icon="🖼️"
            title="Send NFT"
            description="Transfer NFTs to another wallet"
            onPress={handleSendNft}
          />
        </View>

        {/* Batch */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bulk Operations</Text>
          <ToolItem
            icon="📦"
            title="Batch Payout"
            description="Send to multiple recipients at once"
            onPress={handleBatch}
            badge="CSV"
          />
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
  networkBadge: {
    alignSelf: 'center',
    marginTop: SPACING.xl,
  },
});
