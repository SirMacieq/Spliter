import 'react-native-get-random-values';
import { Buffer } from 'buffer';
import process from 'process';

(globalThis as any).Buffer = Buffer;
(globalThis as any).process = process;

import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { useWalletStore, useIsConnected, useIsBooting } from '../stores/walletStore';
import { useGroupStore } from '../stores/groupStore';
import { useSettingsStore } from '../stores/settingsStore';
import { SplashScreen } from '../components/SplashScreen';
import { COLORS, SPACING, TYPOGRAPHY } from '../lib/constants';

// Hydration hook - loads all stores before rendering
function useHydration() {
  const [isReady, setIsReady] = useState(false);
  
  const hydrateWallet = useWalletStore((state) => state.hydrate);
  const hydrateGroups = useGroupStore((state) => state.hydrate);
  const hydrateSettings = useSettingsStore((state) => state.hydrate);
  
  useEffect(() => {
    const hydrate = async () => {
      try {
        // Hydrate all stores in parallel
        await Promise.all([
          hydrateSettings(), // Settings first (sets network)
          hydrateWallet(),
          hydrateGroups(),
        ]);
      } catch (error) {
        console.error('Hydration error:', error);
      } finally {
        setIsReady(true);
      }
    };
    
    hydrate();
  }, [hydrateWallet, hydrateGroups, hydrateSettings]);
  
  return isReady;
}

// Route guard hook
function useProtectedRoute() {
  const segments = useSegments();
  const router = useRouter();
  const isConnected = useIsConnected();
  const isBooting = useIsBooting();
  
  useEffect(() => {
    // Don't redirect while booting
    if (isBooting) return;
    
    const firstSegment = segments[0] as string | undefined;
    const inProtectedRoute = firstSegment === 'home' || firstSegment === 'group' || firstSegment === 'settings';
    
    if (!isConnected && inProtectedRoute) {
      // Redirect to welcome if trying to access protected route without connection
      router.replace('/');
    }
  }, [isConnected, segments, isBooting, router]);
}

export default function RootLayout() {
  const isHydrated = useHydration();
  
  // Show splash while hydrating
  if (!isHydrated) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <SplashScreen />
      </View>
    );
  }
  
  return <RootLayoutNav />;
}

function RootLayoutNav() {
  // Apply route protection
  useProtectedRoute();
  
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: COLORS.background,
          },
          headerTintColor: COLORS.text,
          headerTitleStyle: {
            fontWeight: '600',
          },
          contentStyle: {
            backgroundColor: COLORS.background,
          },
          animation: 'fade',
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="home" 
          options={{ 
            title: 'Spliter',
            headerShown: true,
            headerBackVisible: false,
          }} 
        />
        <Stack.Screen 
          name="group/create" 
          options={{ 
            title: 'Create Group',
            presentation: 'modal',
          }} 
        />
        <Stack.Screen 
          name="group/[id]" 
          options={{ 
            title: 'Group',
          }} 
        />
        <Stack.Screen 
          name="group/add-member" 
          options={{ 
            title: 'Add Member',
            presentation: 'modal',
          }} 
        />
        <Stack.Screen 
          name="group/add-expense" 
          options={{ 
            title: 'Add Expense',
            presentation: 'modal',
          }} 
        />
        <Stack.Screen 
          name="group/settle" 
          options={{ 
            title: 'Settle Up',
            presentation: 'modal',
          }} 
        />
        <Stack.Screen 
          name="settings" 
          options={{ 
            title: 'Settings',
          }} 
        />
        <Stack.Screen 
          name="pay" 
          options={{ 
            title: 'Payment',
            presentation: 'modal',
          }} 
        />
        <Stack.Screen 
          name="group/request" 
          options={{ 
            title: 'Request Payment',
            presentation: 'modal',
          }} 
        />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});
