import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Clipboard,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useGroupStore } from '../../stores/groupStore';
import { Button } from '../../components/Button';
import { COLORS } from '../../lib/constants';
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
      const text = await Clipboard.getString();
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
      setError('Invalid Solana wallet address');
      return;
    }
    
    if (!groupId) {
      setError('Group not found');
      return;
    }
    
    // Check if already a member
    if (group?.members.some(m => m.wallet === trimmedWallet)) {
      setError('This wallet is already a member');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      await addMember(groupId, trimmedWallet, nickname.trim() || undefined);
      router.back();
    } catch (err) {
      setError('Failed to add member');
      setIsLoading(false);
    }
  };
  
  if (!group) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Group not found</Text>
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
          <Text style={styles.label}>Wallet Address *</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={wallet}
              onChangeText={(text) => {
                setWallet(text);
                setError('');
              }}
              placeholder="e.g., 7xKX..."
              placeholderTextColor={COLORS.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity 
              style={styles.pasteButton}
              onPress={handlePaste}
            >
              <Text style={styles.pasteButtonText}>Paste</Text>
            </TouchableOpacity>
          </View>
          
          {/* Nickname */}
          <Text style={styles.label}>Nickname (optional)</Text>
          <TextInput
            style={styles.inputFull}
            value={nickname}
            onChangeText={setNickname}
            placeholder="e.g., Alice, Bob"
            placeholderTextColor={COLORS.textSecondary}
            maxLength={30}
          />
          
          {error ? <Text style={styles.error}>{error}</Text> : null}
          
          <Text style={styles.hint}>
            Enter a Solana wallet address. The nickname helps you identify members easily.
          </Text>
        </View>
        
        <View style={styles.footer}>
          <Button
            title="Add Member"
            onPress={handleAdd}
            loading={isLoading}
            disabled={!wallet.trim()}
            size="large"
            style={styles.addButton}
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
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
    marginTop: 16,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
    fontFamily: 'monospace',
  },
  inputFull: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
  },
  pasteButton: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  pasteButtonText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 16,
  },
  error: {
    color: COLORS.error,
    fontSize: 14,
    marginTop: 12,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  hint: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 16,
  },
  footer: {
    padding: 20,
    paddingBottom: 40,
  },
  addButton: {
    width: '100%',
  },
});
