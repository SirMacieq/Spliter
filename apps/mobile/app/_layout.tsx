import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { useGroupStore } from '../stores/groupStore';
import { COLORS } from '../lib/constants';

export default function RootLayout() {
  const loadData = useGroupStore((state) => state.loadData);
  
  useEffect(() => {
    // Load persisted data on app start
    loadData();
  }, [loadData]);
  
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
