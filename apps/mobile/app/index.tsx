import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useWalletStore, useIsConnected } from '../stores/walletStore';
import { useWalletConnection } from '../hooks/useWalletConnection';
import { Button } from '../components/Button';
import { COLORS, APP_NAME } from '../lib/constants';

export default function WelcomeScreen() {
  const router = useRouter();
  const wallet = useWalletStore((state) => state.wallet);
  const isConnected = useIsConnected();
  const { connect } = useWalletConnection();
  
  React.useEffect(() => {
    // Auto-navigate to home when connected
    if (isConnected) {
      router.replace('/home');
    }
  }, [isConnected, router]);
  
  const handleConnect = async () => {
    await connect();
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoEmoji}>💸</Text>
          <Text style={styles.logoText}>{APP_NAME}</Text>
        </View>
        
        {/* Tagline */}
        <Text style={styles.tagline}>
          Split expenses with friends.{'\n'}
          Settle instantly on Solana.
        </Text>
        
        {/* Features */}
        <View style={styles.features}>
          <FeatureItem emoji="👥" text="Create groups with friends" />
          <FeatureItem emoji="📝" text="Track shared expenses" />
          <FeatureItem emoji="⚡" text="Settle up in USDC instantly" />
        </View>
      </View>
      
      {/* Connect Button */}
      <View style={styles.footer}>
        {wallet.status === 'error' && (
          <Text style={styles.errorText}>{wallet.error}</Text>
        )}
        
        <Button
          title={wallet.status === 'connecting' ? 'Connecting...' : 'Connect Wallet'}
          onPress={handleConnect}
          loading={wallet.status === 'connecting'}
          size="large"
          style={styles.connectButton}
        />
        
        <Text style={styles.footerText}>
          Works with Phantom, Solflare, and Seeker
        </Text>
      </View>
    </View>
  );
}

const FeatureItem = ({ emoji, text }: { emoji: string; text: string }) => (
  <View style={styles.featureItem}>
    <Text style={styles.featureEmoji}>{emoji}</Text>
    <Text style={styles.featureText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoEmoji: {
    fontSize: 64,
    marginBottom: 12,
  },
  logoText: {
    fontSize: 42,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  tagline: {
    fontSize: 20,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 48,
  },
  features: {
    width: '100%',
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 12,
  },
  featureEmoji: {
    fontSize: 24,
    marginRight: 16,
  },
  featureText: {
    fontSize: 16,
    color: COLORS.text,
  },
  footer: {
    alignItems: 'center',
    gap: 16,
  },
  connectButton: {
    width: '100%',
  },
  footerText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.error,
    textAlign: 'center',
  },
});
