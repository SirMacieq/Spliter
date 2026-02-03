import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { useWalletStore, useIsConnected, useIsBooting } from '../stores/walletStore';
import { useWalletConnection } from '../hooks/useWalletConnection';
import { Button, NetworkBadge, SplashScreen, SpliterLogo } from '../components';
import { COLORS, APP_NAME, SPACING, TYPOGRAPHY, RADIUS } from '../lib/constants';

export default function WelcomeScreen() {
  const router = useRouter();
  const navState = useRootNavigationState();
  const wallet = useWalletStore((state) => state.wallet);
  const isConnected = useIsConnected();
  const isBooting = useIsBooting();
  const { connect } = useWalletConnection();
  
  useEffect(() => {
    if (!navState?.key) return;
    if (isBooting) return;
    
    if (isConnected) {
      router.replace('/home');
    }
  }, [isConnected, navState?.key, isBooting, router]);
  
  // Show splash while booting
  if (isBooting) {
    return <SplashScreen />;
  }
  
  const handleConnect = async () => {
    await connect();
  };
  
  return (
    <View style={styles.container}>
      {/* Network Badge - subtle at top */}
      <View style={styles.header}>
        <NetworkBadge />
      </View>
      
      {/* Main Content - centered */}
      <View style={styles.content}>
        {/* Brand Logo */}
        <SpliterLogo size={140} style={styles.logo} />
        
        {/* App Name */}
        <Text style={styles.title}>{APP_NAME}</Text>
        
        {/* Tagline */}
        <Text style={styles.tagline}>
          Split, request & send — on Solana
        </Text>
      </View>
      
      {/* Footer - CTA */}
      <View style={styles.footer}>
        {wallet.status === 'error' && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{wallet.error}</Text>
          </View>
        )}
        
        <Button
          title={wallet.status === 'connecting' ? 'Connecting...' : 'Connect Wallet'}
          onPress={handleConnect}
          loading={wallet.status === 'connecting'}
          disabled={wallet.status === 'connecting'}
          size="large"
          fullWidth
        />
        
        <Text style={styles.footerHint}>
          Works with Phantom, Solflare & Seeker
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING['2xl'],
    paddingTop: SPACING['4xl'],
    paddingBottom: SPACING['4xl'],
  },
  header: {
    alignItems: 'flex-end',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: SPACING['4xl'],
  },
  logo: {
    marginBottom: SPACING['2xl'],
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.5,
    marginBottom: SPACING.md,
  },
  tagline: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  footer: {
    gap: SPACING.lg,
  },
  errorBanner: {
    backgroundColor: COLORS.errorMuted,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
  },
  errorText: {
    ...TYPOGRAPHY.small,
    color: COLORS.error,
    textAlign: 'center',
  },
  footerHint: {
    ...TYPOGRAPHY.small,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});
