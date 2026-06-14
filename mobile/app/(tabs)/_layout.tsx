import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import { LoadingView } from '@/components/StateViews';
import { palette } from '@/theme/colors';

function TabGlyph({ glyph, color }: { glyph: string; color: string }) {
  return <Text style={{ fontSize: 20, color }}>{glyph}</Text>;
}

export default function TabsLayout() {
  const { initializing, isAuthenticated, needsMfa } = useAuth();

  if (initializing) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.background }}>
        <LoadingView />
      </View>
    );
  }
  if (!isAuthenticated) return <Redirect href="/(auth)/sign-in" />;
  if (needsMfa) return <Redirect href="/(auth)/mfa" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: palette.surface },
        headerTintColor: palette.textPrimary,
        headerTitleStyle: { fontWeight: '700' },
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
        },
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <TabGlyph glyph="📊" color={color} />,
        }}
      />
      <Tabs.Screen
        name="assessments"
        options={{
          title: 'Assessments',
          tabBarIcon: ({ color }) => <TabGlyph glyph="📋" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabGlyph glyph="👤" color={color} />,
        }}
      />
    </Tabs>
  );
}
