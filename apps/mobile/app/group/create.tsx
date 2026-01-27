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
import { Button } from '../../components/Button';
import { COLORS } from '../../lib/constants';

export default function CreateGroupScreen() {
  const router = useRouter();
  const createGroup = useGroupStore((state) => state.createGroup);
  const publicKey = useWalletPublicKey();
  
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Please enter a group name');
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
    } catch (err) {
      setError('Failed to create group');
      setIsLoading(false);
    }
  };
  
  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.label}>Group Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={(text) => {
            setName(text);
            setError('');
          }}
          placeholder="e.g., Trip to Bali, Roommates"
          placeholderTextColor={COLORS.textSecondary}
          autoFocus
          maxLength={50}
        />
        
        {error ? <Text style={styles.error}>{error}</Text> : null}
        
        <Text style={styles.hint}>
          You'll be able to add members after creating the group.
        </Text>
      </View>
      
      <View style={styles.footer}>
        <Button
          title="Create Group"
          onPress={handleCreate}
          loading={isLoading}
          disabled={!name.trim()}
          size="large"
          style={styles.createButton}
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
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: COLORS.text,
    marginBottom: 12,
  },
  error: {
    color: COLORS.error,
    fontSize: 14,
    marginBottom: 12,
  },
  hint: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    paddingBottom: 40,
  },
  createButton: {
    width: '100%',
  },
});
