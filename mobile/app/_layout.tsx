import React, { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { SyncProvider } from '@/sync/SyncContext';
import { queryClient } from '@/api/queryClient';
import { verifyToken } from '@/api/auth';
import { palette } from '@/theme/colors';

/**
 * Captures the magic-link deep link (akilirisk:// or https://app.akilirisk.com/auth/...)
 * and exchanges the embedded token for a session (plan §7).
 */
function DeepLinkHandler() {
  const { completeSignIn } = useAuth();
  const url = Linking.useURL();

  useEffect(() => {
    if (!url) return;
    const { queryParams } = Linking.parse(url);
    const token = typeof queryParams?.token === 'string' ? queryParams.token : null;
    if (!token) return;
    (async () => {
      try {
        const result = await verifyToken(token);
        await completeSignIn(result);
        router.replace('/');
      } catch {
        router.replace('/(auth)/sign-in');
      }
    })();
  }, [url, completeSignIn]);

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SyncProvider>
            <StatusBar style="light" />
            <DeepLinkHandler />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: palette.surface },
                headerTintColor: palette.textPrimary,
                headerTitleStyle: { fontWeight: '700' },
                contentStyle: { backgroundColor: palette.background },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(client)" options={{ headerShown: false }} />
              <Stack.Screen name="(advisor)" options={{ headerShown: false }} />
              <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
            </Stack>
          </SyncProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
