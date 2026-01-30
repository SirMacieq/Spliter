import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY } from '../lib/constants';
import { Button } from './Button';

interface EmptyStateProps {
  emoji?: string;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  emoji = '📭',
  title,
  message,
  actionLabel,
  onAction,
  style,
  compact = false,
}) => {
  return (
    <View style={[styles.container, compact && styles.compact, style]}>
      <Text style={[styles.emoji, compact && styles.emojiCompact]}>{emoji}</Text>
      <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
      {message && <Text style={styles.message}>{message}</Text>}
      {actionLabel && onAction && (
        <Button
          title={actionLabel}
          onPress={onAction}
          style={styles.button}
          size={compact ? 'medium' : 'large'}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING['4xl'],
  },
  compact: {
    flex: 0,
    paddingVertical: SPACING['3xl'],
  },
  emoji: {
    fontSize: 56,
    marginBottom: SPACING.lg,
  },
  emojiCompact: {
    fontSize: 40,
    marginBottom: SPACING.md,
  },
  title: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  titleCompact: {
    ...TYPOGRAPHY.h3,
  },
  message: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING['2xl'],
    maxWidth: 280,
  },
  button: {
    minWidth: 160,
  },
});
