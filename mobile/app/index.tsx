import React from 'react';
import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import { LoadingView } from '@/components/StateViews';
import { palette } from '@/theme/colors';

/** Entry route: decides where to send the user based on auth state. */
export default function Index() {
  const { initializing, isAuthenticated, needsMfa } = useAuth();

  if (initializing) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.background }}>
        <LoadingView label="Restoring your session…" />
      </View>
    );
  }

  if (!isAuthenticated) return <Redirect href="/(auth)/sign-in" />;
  if (needsMfa) return <Redirect href="/(auth)/mfa" />;
  return <Redirect href="/(tabs)" />;
}
