import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { verifyCode } from '@/api/auth';
import { ApiError } from '@/api/client';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Button } from '@/components/Button';
import { palette } from '@/theme/colors';
import { fontSize, radius, spacing } from '@/theme/spacing';

/**
 * Shown after a magic link is requested. The user can tap the link in their
 * email (handled by the deep-link handler) or paste the 6-digit fallback code.
 */
export default function CheckEmailScreen() {
  const { pendingEmail, completeSignIn } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleVerify = async () => {
    setError(null);
    if (!pendingEmail) {
      router.replace('/(auth)/sign-in');
      return;
    }
    if (code.trim().length < 6) {
      setError('Enter the 6-digit code from the email.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await verifyCode(pendingEmail, code.trim());
      await completeSignIn(result);
      router.replace('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That code did not work. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer contentStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.emoji}>📬</Text>
        <Text style={styles.heading}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent a sign-in link{pendingEmail ? ` to ${pendingEmail}` : ''}. Tap it on this
          device to continue. If it doesn&apos;t open the app, paste the 6-digit code below.
        </Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Paste code</Text>
        <TextInput
          value={code}
          onChangeText={(t) => setCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
          placeholder="123456"
          placeholderTextColor={palette.textMuted}
          keyboardType="number-pad"
          style={styles.codeInput}
          maxLength={6}
          onSubmitEditing={handleVerify}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label="Verify code" onPress={handleVerify} loading={submitting} />
      <Button
        label="Use a different email"
        variant="ghost"
        onPress={() => router.replace('/(auth)/sign-in')}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', gap: spacing.lg },
  header: { gap: spacing.sm, alignItems: 'center' },
  emoji: { fontSize: 40 },
  heading: { color: palette.textPrimary, fontSize: fontSize.xl, fontWeight: '700' },
  subtitle: { color: palette.textSecondary, fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20 },
  field: { gap: spacing.xs },
  label: { color: palette.textSecondary, fontSize: fontSize.sm, fontWeight: '600' },
  codeInput: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    height: 64,
    color: palette.textPrimary,
    fontSize: fontSize.xxl,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 8,
  },
  error: { color: palette.danger, fontSize: fontSize.sm, textAlign: 'center' },
});
