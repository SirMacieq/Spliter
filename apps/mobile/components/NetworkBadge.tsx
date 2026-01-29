import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../lib/constants';
import { useNetwork } from '../stores/settingsStore';

interface NetworkBadgeProps {
  style?: object;
}

export const NetworkBadge: React.FC<NetworkBadgeProps> = ({ style }) => {
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
      <Text style={styles.text}>
        {isDevnet ? 'Devnet' : 'Mainnet'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeDevnet: {
    backgroundColor: COLORS.warning + '25',
  },
  badgeMainnet: {
    backgroundColor: COLORS.success + '25',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  dotDevnet: {
    backgroundColor: COLORS.warning,
  },
  dotMainnet: {
    backgroundColor: COLORS.success,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
});
