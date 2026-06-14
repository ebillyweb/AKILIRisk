import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { config } from '@/config';
import { palette } from '@/theme/colors';
import { fontSize, radius, spacing } from '@/theme/spacing';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/(auth)/sign-in');
    } finally {
      setSigningOut(false);
    }
  };

  const initials = (user?.firstName?.[0] ?? user?.email?.[0] ?? '?').toUpperCase();

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.name}>{user?.name || user?.firstName || 'Account'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <Card>
        <InfoRow label="Role" value={user?.role ?? 'USER'} />
        <View style={styles.divider} />
        <InfoRow label="Two-factor" value={user?.mfaEnabled ? 'Enabled' : 'Disabled'} />
        <View style={styles.divider} />
        <InfoRow label="Connected to" value={config.apiBaseUrl.replace(/^https?:\/\//, '')} />
      </Card>

      <Card>
        <Text style={styles.aboutTitle}>About AkiliRisk</Text>
        <Text style={styles.aboutText}>
          AkiliRisk helps families and their advisors understand and reduce risk across
          governance, cyber, identity, and intelligence — turning assessments into action.
        </Text>
      </Card>

      <Button label="Sign out" variant="secondary" onPress={handleSignOut} loading={signingOut} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: palette.white, fontSize: fontSize.xl, fontWeight: '800' },
  name: { color: palette.textPrimary, fontSize: fontSize.lg, fontWeight: '700' },
  email: { color: palette.textSecondary, fontSize: fontSize.sm },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { color: palette.textSecondary, fontSize: fontSize.sm },
  infoValue: { color: palette.textPrimary, fontSize: fontSize.sm, fontWeight: '600' },
  divider: { height: 1, backgroundColor: palette.border },
  aboutTitle: { color: palette.textPrimary, fontSize: fontSize.md, fontWeight: '700' },
  aboutText: { color: palette.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
});
