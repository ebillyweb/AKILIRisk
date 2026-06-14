import React from 'react';
import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import { LoadingView } from '@/components/StateViews';
import { palette } from '@/theme/colors';

/** Routes the user based on auth status and role (plan §4). */
export default function Index() {
  const { status, user } = useAuth();

  if (status === 'initializing') {
    return (
      <View style={{ flex: 1, backgroundColor: palette.background }}>
        <LoadingView label="Starting AkiliRisk…" />
      </View>
    );
  }

  if (status === 'signedOut') return <Redirect href="/(auth)/sign-in" />;
  if (status === 'locked') return <Redirect href="/(auth)/unlock" />;

  // Authenticated — route by role.
  if (user?.role === 'ADVISOR') return <Redirect href="/(advisor)/clients" />;
  return <Redirect href="/(client)/home" />;
}
