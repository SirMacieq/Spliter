import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY } from '../lib/constants';

interface LoadingProps {
  message?: string;
  size?: 'small' | 'large';
  style?: ViewStyle;
  fullScreen?: boolean;
  color?: string;
}

export const Loading: React.FC<LoadingProps> = ({
  message,
  size = 'large',
  style,
  fullScreen = false,
  color = COLORS.primary,
}) => {
  const content = (
    <>
      <ActivityIndicator color={color} size={size} />
      {message && <Text style={styles.message}>{message}</Text>}
    </>
  );
  
  if (fullScreen) {
    return (
      <View style={[styles.fullScreen, style]}>
        {content}
      </View>
    );
  }
  
  return (
    <View style={[styles.container, style]}>
      {content}
    </View>
  );
};

// Skeleton loading placeholder
interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%' as const,
  height = 20,
  borderRadius = 8,
  style,
}) => {
  return (
    <View 
      style={[
        styles.skeleton, 
        { width: width as any, height, borderRadius },
        style,
      ]} 
    />
  );
};

const styles = StyleSheet.create({
  container: {
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  message: {
    marginTop: SPACING.md,
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  skeleton: {
    backgroundColor: COLORS.surface,
  },
});
