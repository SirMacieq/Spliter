import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS, APP_NAME } from '../lib/constants';

export const SplashScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>💸</Text>
      <Text style={styles.title}>{APP_NAME}</Text>
      <ActivityIndicator 
        color={COLORS.primary} 
        size="large" 
        style={styles.loader}
      />
      <Text style={styles.loading}>Loading...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 32,
  },
  loader: {
    marginBottom: 16,
  },
  loading: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
});
