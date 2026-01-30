import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useGroupStore } from '../../stores/groupStore';
import { useWalletPublicKey } from '../../stores/walletStore';
import { Button } from '../../components';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../../lib/constants';

export default function CreateGroupScreen() {
  const router = useRouter();
  const createGroup = useGroupStore((state) => state.createGroup);
  const publicKey = useWalletPublicKey();
  
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Please enter a name for your group');
      return;
    }
    
    if (!publicKey) {
      setError('Wallet not connected');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const group = await createGroup(name.trim(), publicKey);
      router.replace(`/group/${group.id}`);
    } catch (err: any) {
      console.error('Create group error:', err);
      setError(err?.message || 'Something went wrong. Please try again.');
      setIsLoading(false);
    }
  };
  
  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.emoji}>🎉</Text>
          <Text style={styles.title}>Create a Group</Text>
          <Text style={styles.subtitle}>
            Start splitting expenses with friends, roommates, or travel buddies.
          </Text>
        </View>
        
        <View style={styles.inputSection}>
          <Text style={styles.label}>Group Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={(text) => {
              setName(text);
              setError('');
            }}
            placeholder="e.g., Trip to Bali, Roommates"
            placeholderTextColor={COLORS.textMuted}
            autoFocus
            maxLength={50}
          />
          
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : (
            <Text style={styles.hint}>
              You'll be added as the first member automatically.
            </Text>
          )}
        </View>
      </View>
      
      <View style={styles.footer}>
        <Button
          title="Create Group"
          onPress={handleCreate}
          loading={isLoading}
          disabled={!name.trim()}
          size="large"
          fullWidth
        />
      </View>
    </KeyboardAvoidingView>
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
  header: {
    alignItems: 'center',
    marginBottom: SPACING['3xl'],
    marginTop: SPACING.xl,
  },
  emoji: {
    fontSize: 56,
    marginBottom: SPACING.lg,
  },
  title: {
    ...TYPOGRAPHY.h1,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  inputSection: {
    marginTop: SPACING.lg,
  },
  label: {
    ...TYPOGRAPHY.smallMedium,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
  },
  errorContainer: {
    backgroundColor: COLORS.errorMuted,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    marginTop: SPACING.md,
  },
  error: {
    ...TYPOGRAPHY.small,
    color: COLORS.error,
  },
  hint: {
    ...TYPOGRAPHY.small,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
  },
  footer: {
    padding: SPACING.xl,
    paddingBottom: SPACING['4xl'],
  },
});
