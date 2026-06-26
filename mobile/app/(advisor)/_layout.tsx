import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { View } from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import { LoadingView } from '@/components/StateViews';
import { palette } from '@/theme/colors';

export default function AdvisorLayout() {
  const { status, user } = useAuth();

  if (status === 'initializing') {
    return (
      <View style={{ flex: 1, backgroundColor: palette.background }}>
        <LoadingView />
      </View>
    );
  }
  if (status === 'signedOut') return <Redirect href="/(auth)/sign-in" />;
  if (status === 'locked') return <Redirect href="/(auth)/unlock" />;
  if (user?.role !== 'ADVISOR') return <Redirect href="/(client)/home" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: palette.surface },
        headerTintColor: palette.textPrimary,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: palette.background },
      }}
    >
      <Stack.Screen name="clients" options={{ title: 'Clients' }} />
      <Stack.Screen name="client/[id]" options={{ title: 'Intake' }} />
    </Stack>
  );
}
