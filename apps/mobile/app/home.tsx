import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useWalletPublicKey } from '../stores/walletStore';
import { NetworkBadge, SpliterLogo } from '../components';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../lib/constants';

// Primary action card component
interface PrimaryActionProps {
  icon: React.ReactNode;
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
      {icon}
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
  const publicKey = useWalletPublicKey();
  
  const handleSettings = () => {
    router.push('/settings');
  };

  const handleSplitRequest = () => {
    // Go directly to request payment (create pay link)
    router.push('/group/request' as any);
  };

  const handleBulkSend = () => {
    router.push('/tools' as any);
  };
  
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
    
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
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
            icon={<SpliterLogo size={28} />}
            title="Split & Request"
            description="Create payment links & QR codes to request money"
            accentColor={COLORS.primary}
            onPress={handleSplitRequest}
          />
          <PrimaryAction
            icon={<Text style={styles.primaryIconEmoji}>📦</Text>}
            title="Send in Bulk"
            description="Send tokens & NFTs to multiple wallets at once"
            accentColor={COLORS.secondary}
            onPress={handleBulkSend}
          />
        </View>

        {/* Quick Info */}
        <View style={styles.infoSection}>
          <Text style={styles.infoText}>
            All payments settle instantly on Solana with a {'\n'}2.5% service fee
          </Text>
        </View>
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
    gap: SPACING.lg,
    marginBottom: SPACING['3xl'],
  },
  primaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1,
  },
  primaryIconContainer: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  primaryIconEmoji: {
    fontSize: 26,
  },
  primaryTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  primaryDescription: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  primaryArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  primaryArrowText: {
    color: COLORS.background,
    fontSize: 18,
    fontWeight: '600',
  },

  // Info Section
  infoSection: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  infoText: {
    ...TYPOGRAPHY.small,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
