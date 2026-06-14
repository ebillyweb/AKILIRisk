import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { ApiError } from '@/api/client';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Button } from '@/components/Button';
import { palette } from '@/theme/colors';
import { fontSize, radius, spacing } from '@/theme/spacing';

export default function MfaScreen() {
  const { verifyMfa, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleVerify = async () => {
    setError(null);
    if (code.trim().length < 6) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setSubmitting(true);
    try {
      await verifyMfa(code.trim());
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid code. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    await signOut();
    router.replace('/(auth)/sign-in');
  };

  return (
    <ScreenContainer contentStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.heading}>Two-factor verification</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code from your authenticator app to continue.
        </Text>
      </View>

      <TextInput
        value={code}
        onChangeText={(t) => setCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
        placeholder="123456"
        placeholderTextColor={palette.textMuted}
        keyboardType="number-pad"
        style={styles.codeInput}
        maxLength={6}
        onSubmitEditing={handleVerify}
        autoFocus
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label="Verify" onPress={handleVerify} loading={submitting} />
      <Button label="Cancel" variant="ghost" onPress={handleCancel} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', gap: spacing.lg },
  header: { gap: spacing.sm, alignItems: 'center' },
  heading: { color: palette.textPrimary, fontSize: fontSize.xl, fontWeight: '700' },
  subtitle: { color: palette.textSecondary, fontSize: fontSize.sm, textAlign: 'center' },
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
