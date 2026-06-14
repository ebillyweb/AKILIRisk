import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { View } from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import { LoadingView } from '@/components/StateViews';
import { palette } from '@/theme/colors';

export default function ClientLayout() {
  const { status } = useAuth();

  if (status === 'initializing') {
    return (
      <View style={{ flex: 1, backgroundColor: palette.background }}>
        <LoadingView />
      </View>
    );
  }
  if (status === 'signedOut') return <Redirect href="/(auth)/sign-in" />;
  if (status === 'locked') return <Redirect href="/(auth)/unlock" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: palette.surface },
        headerTintColor: palette.textPrimary,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: palette.background },
      }}
    >
      <Stack.Screen name="home" options={{ title: 'AkiliRisk' }} />
      <Stack.Screen name="intake/index" options={{ title: 'Your intake' }} />
      <Stack.Screen name="intake/wizard" options={{ title: 'Intake' }} />
      <Stack.Screen name="intake/confirm" options={{ title: 'Submitted', headerBackVisible: false }} />
    </Stack>
  );
}
