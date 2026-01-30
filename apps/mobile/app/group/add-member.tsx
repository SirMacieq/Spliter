import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useGroupStore } from '../../stores/groupStore';
import { Button, SectionHeader } from '../../components';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../../lib/constants';
import { PublicKey } from '@solana/web3.js';

export default function AddMemberScreen() {
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const addMember = useGroupStore((state) => state.addMember);
  const group = useGroupStore((state) => state.getGroupById(groupId || ''));
  
  const [wallet, setWallet] = useState('');
  const [nickname, setNickname] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const validateWalletAddress = (address: string): boolean => {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  };
  
  const handlePaste = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setWallet(text.trim());
        setError('');
      }
    } catch (err) {
      console.error('Failed to paste:', err);
    }
  };
  
  const handleAdd = async () => {
    const trimmedWallet = wallet.trim();
    
    if (!trimmedWallet) {
      setError('Please enter a wallet address');
      return;
    }
    
    if (!validateWalletAddress(trimmedWallet)) {
      setError('This doesn\'t look like a valid Solana address');
      return;
    }
    
    if (!groupId) {
      setError('Unable to find the group');
      return;
    }
    
    if (group?.members.some(m => m.wallet === trimmedWallet)) {
      setError('This wallet is already a member of the group');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      await addMember(groupId, trimmedWallet, nickname.trim() || undefined);
      router.back();
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setIsLoading(false);
    }
  };
  
  if (!group) {
    return (
      <View style={styles.container}>
        <View style={styles.errorState}>
          <Text style={styles.errorEmoji}>🔍</Text>
          <Text style={styles.errorTitle}>Group not found</Text>
          <Button title="Go Back" onPress={() => router.back()} variant="outline" />
        </View>
      </View>
    );
  }
  
  return (
    <>
      <Stack.Screen options={{ title: 'Add Member' }} />
      
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          {/* Wallet Address */}
          <View style={styles.section}>
            <SectionHeader title="Wallet Address" />
            <View style={styles.inputRow}>
              <TextInput
                style={styles.walletInput}
                value={wallet}
                onChangeText={(text) => {
                  setWallet(text);
                  setError('');
                }}
                placeholder="Solana wallet address..."
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
              <TouchableOpacity 
                style={styles.pasteButton}
                onPress={handlePaste}
                activeOpacity={0.7}
              >
                <Text style={styles.pasteButtonText}>Paste</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Nickname */}
          <View style={styles.section}>
            <SectionHeader title="Nickname" subtitle="Optional" />
            <TextInput
              style={styles.input}
              value={nickname}
              onChangeText={setNickname}
              placeholder="e.g., Alice, Bob, Mom..."
              placeholderTextColor={COLORS.textMuted}
              maxLength={30}
            />
            <Text style={styles.hint}>
              Makes it easier to identify members in the group.
            </Text>
          </View>
          
          {/* Error */}
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </View>
        
        <View style={styles.footer}>
          <Button
            title="Add Member"
            onPress={handleAdd}
            loading={isLoading}
            disabled={!wallet.trim()}
            size="large"
            fullWidth
          />
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    padding: SPACING.xl,
  },
  section: {
    marginBottom: SPACING['2xl'],
  },
  inputRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  walletInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontFamily: 'monospace',
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  pasteButton: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl,
    justifyContent: 'center',
  },
  pasteButtonText: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.primary,
  },
  hint: {
    ...TYPOGRAPHY.small,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
  },
  errorState: {
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
    ...TYPOGRAPHY.h3,
    color: COLORS.error,
    marginBottom: SPACING['2xl'],
  },
  errorContainer: {
    backgroundColor: COLORS.errorMuted,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
  },
  errorText: {
    ...TYPOGRAPHY.small,
    color: COLORS.error,
    textAlign: 'center',
  },
  footer: {
    padding: SPACING.xl,
    paddingBottom: SPACING['4xl'],
  },
});
