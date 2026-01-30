import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../lib/constants';
import { useNetwork } from '../stores/settingsStore';

interface NetworkBadgeProps {
  style?: ViewStyle;
  showLabel?: boolean;
}

export const NetworkBadge: React.FC<NetworkBadgeProps> = ({ 
  style,
  showLabel = true,
}) => {
  const network = useNetwork();
  const isDevnet = network === 'devnet';
  
  return (
    <View style={[
      styles.badge,
      isDevnet ? styles.badgeDevnet : styles.badgeMainnet,
      style,
    ]}>
      <View style={[
        styles.dot,
        isDevnet ? styles.dotDevnet : styles.dotMainnet,
      ]} />
      {showLabel && (
        <Text style={[
          styles.text,
          isDevnet ? styles.textDevnet : styles.textMainnet,
        ]}>
          {isDevnet ? 'Devnet' : 'Mainnet'}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
  },
  badgeDevnet: {
    backgroundColor: COLORS.warningMuted,
  },
  badgeMainnet: {
    backgroundColor: COLORS.successMuted,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotDevnet: {
    backgroundColor: COLORS.warning,
  },
  dotMainnet: {
    backgroundColor: COLORS.success,
  },
  text: {
    marginLeft: SPACING.sm,
    ...TYPOGRAPHY.captionMedium,
  },
  textDevnet: {
    color: COLORS.warning,
  },
  textMainnet: {
    color: COLORS.success,
  },
});
