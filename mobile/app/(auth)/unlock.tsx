import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Button } from '@/components/Button';
import { palette } from '@/theme/colors';
import { fontSize, spacing } from '@/theme/spacing';

/** Biometric gate for a stored session on cold start (plan §7). */
export default function UnlockScreen() {
  const { unlock, signOut, user } = useAuth();
  const [failed, setFailed] = useState(false);

  const attempt = async () => {
    setFailed(false);
    const ok = await unlock();
    if (ok) router.replace('/');
    else setFailed(true);
  };

  // Prompt automatically when the screen appears.
  useEffect(() => {
    void attempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUseEmail = async () => {
    await signOut();
    router.replace('/(auth)/sign-in');
  };

  return (
    <ScreenContainer contentStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.emoji}>🔒</Text>
        <Text style={styles.heading}>Welcome back</Text>
        <Text style={styles.subtitle}>
          {user?.email ? `Signed in as ${user.email}.` : ''} Unlock to continue.
        </Text>
      </View>

      {failed ? (
        <Text style={styles.error}>Unlock cancelled or failed. Try again.</Text>
      ) : null}

      <Button label="Unlock" onPress={attempt} />
      <Button label="Use email instead" variant="ghost" onPress={handleUseEmail} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', gap: spacing.lg },
  header: { gap: spacing.sm, alignItems: 'center' },
  emoji: { fontSize: 40 },
  heading: { color: palette.textPrimary, fontSize: fontSize.xl, fontWeight: '700' },
  subtitle: { color: palette.textSecondary, fontSize: fontSize.sm, textAlign: 'center' },
  error: { color: palette.danger, fontSize: fontSize.sm, textAlign: 'center' },
});
