import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
  Switch,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useWalletPublicKey } from '../stores/walletStore';
import { useSettingsStore, useNetwork } from '../stores/settingsStore';
import { useWalletConnection } from '../hooks/useWalletConnection';
import { Button, NetworkBadge } from '../components';
import { 
  COLORS, 
  APP_VERSION, 
  getNetworkName,
  getFaucetUrl,
  SolanaNetwork,
} from '../lib/constants';
import { getSolBalance, getUsdcBalance, getAccountExplorerUrl } from '../lib/solana';
import { withTimeout } from '../lib/timeout';

export default function SettingsScreen() {
  const router = useRouter();
  const publicKey = useWalletPublicKey();
  const { disconnect } = useWalletConnection();
  
  const network = useNetwork();
  const setNetwork = useSettingsStore((state) => state.setNetwork);
  
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  
  const isDevnet = network === 'devnet';
  const faucetUrl = getFaucetUrl();
  
  const loadBalances = useCallback(async () => {
    if (!publicKey) return;
    
    setIsLoadingBalance(true);
    try {
      const [sol, usdc] = await withTimeout(
        () => Promise.all([
          getSolBalance(publicKey),
          getUsdcBalance(publicKey),
        ]),
        15000,
        'Balance fetch timed out'
      );
      setSolBalance(sol);
      setUsdcBalance(usdc);
    } catch (err) {
      console.error('Failed to load balances:', err);
      // Don't block UI - just show null balances
    } finally {
      setIsLoadingBalance(false);
    }
  }, [publicKey]);
  
  useEffect(() => {
    loadBalances();
  }, [loadBalances, network]);
  
  const handleNetworkToggle = (value: boolean) => {
    // Network switching is DISABLED in this build
    Alert.alert(
      'Network Locked',
      `This build is configured for ${getNetworkName()} only.\n\nNetwork switching is disabled for stability.`,
      [{ text: 'OK' }]
    );
  };
  
  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect Wallet',
      'Are you sure you want to disconnect?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Disconnect', 
          style: 'destructive',
          onPress: () => {
            disconnect();
            router.replace('/');
          },
        },
      ]
    );
  };
  
  const handleViewOnExplorer = () => {
    if (publicKey) {
      Linking.openURL(getAccountExplorerUrl(publicKey));
    }
  };
  
  const handleOpenFaucet = () => {
    if (faucetUrl) {
      Linking.openURL(faucetUrl);
    }
  };
  
  const copyAddress = async () => {
    if (publicKey) {
      await Clipboard.setStringAsync(publicKey);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };
  
  return (
    <ScrollView style={styles.container}>
      {/* Wallet Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Wallet</Text>
        
        <View style={styles.card}>
          <View style={styles.walletHeader}>
            <View style={styles.walletIcon}>
              <Text style={styles.walletIconText}>👛</Text>
            </View>
            <View style={styles.walletInfo}>
              <Text style={styles.walletLabel}>Connected</Text>
              <TouchableOpacity onPress={copyAddress}>
                <Text style={styles.walletAddress}>
                  {publicKey ? `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}` : '-'}
                  {copiedAddress && ' ✓'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Balances */}
          <View style={styles.balances}>
            {isLoadingBalance ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <>
                <View style={styles.balanceRow}>
                  <Text style={styles.balanceLabel}>SOL</Text>
                  <Text style={styles.balanceValue}>
                    {solBalance !== null ? solBalance.toFixed(4) : '-'}
                  </Text>
                </View>
                <View style={styles.balanceRow}>
                  <Text style={styles.balanceLabel}>USDC</Text>
                  <Text style={styles.balanceValue}>
                    ${usdcBalance !== null ? usdcBalance.toFixed(2) : '-'}
                  </Text>
                </View>
              </>
            )}
          </View>
          
          {/* Actions */}
          <View style={styles.walletActions}>
            <TouchableOpacity 
              style={styles.walletAction}
              onPress={loadBalances}
            >
              <Text style={styles.walletActionText}>Refresh</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.walletAction}
              onPress={handleViewOnExplorer}
            >
              <Text style={styles.walletActionText}>View on Solscan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      {/* Network Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Network</Text>
        
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Network</Text>
            <NetworkBadge />
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Currency</Text>
            <Text style={styles.infoValue}>USDC / SOL</Text>
          </View>
          
          {isDevnet && faucetUrl && (
            <TouchableOpacity 
              style={styles.faucetButton}
              onPress={handleOpenFaucet}
            >
              <Text style={styles.faucetButtonText}>🚰 Get Devnet SOL</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {/* Advanced Section */}
      <View style={styles.section}>
        <TouchableOpacity 
          style={styles.advancedToggle}
          onPress={() => setShowAdvanced(!showAdvanced)}
        >
          <Text style={styles.sectionTitle}>Advanced</Text>
          <Text style={styles.advancedArrow}>{showAdvanced ? '▼' : '▶'}</Text>
        </TouchableOpacity>
        
        {showAdvanced && (
          <View style={styles.card}>
            <View style={styles.switchRow}>
              <View>
                <Text style={styles.infoLabel}>Use Devnet</Text>
                <Text style={styles.switchHint}>For testing only</Text>
              </View>
              <Switch
                value={isDevnet}
                onValueChange={handleNetworkToggle}
                trackColor={{ false: COLORS.surface, true: COLORS.primary }}
                thumbColor={COLORS.text}
              />
            </View>
          </View>
        )}
      </View>
      
      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>{APP_VERSION}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Built for</Text>
            <Text style={styles.infoValue}>Solana Seeker</Text>
          </View>
        </View>
      </View>
      
      {/* Disconnect Button */}
      <View style={styles.disconnectSection}>
        <Button
          title="Disconnect Wallet"
          onPress={handleDisconnect}
          variant="outline"
          style={styles.disconnectButton}
        />
      </View>
      
      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          💸 Spliter - Split expenses, settle on Solana
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  section: {
    padding: 20,
    paddingBottom: 0,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
  },
  
  // Wallet
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  walletIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  walletIconText: {
    fontSize: 24,
  },
  walletInfo: {
    flex: 1,
  },
  walletLabel: {
    fontSize: 14,
    color: COLORS.success,
    marginBottom: 2,
  },
  walletAddress: {
    fontSize: 16,
    color: COLORS.text,
    fontFamily: 'monospace',
  },
  balances: {
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceLight,
    paddingTop: 16,
    marginBottom: 16,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  balanceValue: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '600',
  },
  walletActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceLight,
    paddingTop: 16,
  },
  walletAction: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  walletActionText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  
  // Info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: 16,
    color: COLORS.text,
  },
  
  // Faucet button
  faucetButton: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  faucetButtonText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  
  // Advanced
  advancedToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  advancedArrow: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  
  // Disconnect
  disconnectSection: {
    padding: 20,
    paddingTop: 32,
  },
  disconnectButton: {
    borderColor: COLORS.error,
  },
  
  // Footer
  footer: {
    padding: 20,
    paddingTop: 0,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});
