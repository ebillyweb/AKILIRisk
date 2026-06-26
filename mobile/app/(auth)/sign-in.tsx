import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { ApiError } from '@/api/client';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Button } from '@/components/Button';
import { palette } from '@/theme/colors';
import { fontSize, radius, spacing } from '@/theme/spacing';

export default function SignInScreen() {
  const { requestMagicLink, pendingEmail } = useAuth();
  const [email, setEmail] = useState(pendingEmail ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    const trimmed = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    setSubmitting(true);
    try {
      await requestMagicLink(trimmed);
      router.push('/(auth)/check-email');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send your sign-in link.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenContainer contentStyle={styles.content}>
        <View style={styles.brand}>
          <Text style={styles.logo}>AkiliRisk</Text>
          <Text style={styles.tagline}>Intake & Assessment</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.heading}>Sign in</Text>
          <Text style={styles.subtitle}>
            Enter your email and we&apos;ll send you a secure sign-in link.
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={palette.textMuted}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              style={styles.input}
              onSubmitEditing={handleSubmit}
              returnKeyType="go"
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button label="Email me a sign-in link" onPress={handleSubmit} loading={submitting} />
        </View>

        <Text style={styles.footnote}>
          No account? Ask your advisor for an invitation.
        </Text>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: palette.background },
  content: { flexGrow: 1, justifyContent: 'center', gap: spacing.xxl },
  brand: { alignItems: 'center', gap: spacing.xs },
  logo: { color: palette.textPrimary, fontSize: fontSize.xxl, fontWeight: '800', letterSpacing: 0.5 },
  tagline: { color: palette.accent, fontSize: fontSize.sm, fontWeight: '600' },
  form: { gap: spacing.lg },
  heading: { color: palette.textPrimary, fontSize: fontSize.xl, fontWeight: '700' },
  subtitle: { color: palette.textSecondary, fontSize: fontSize.sm },
  field: { gap: spacing.xs },
  label: { color: palette.textSecondary, fontSize: fontSize.sm, fontWeight: '600' },
  input: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 52,
    color: palette.textPrimary,
    fontSize: fontSize.md,
  },
  error: { color: palette.danger, fontSize: fontSize.sm },
  footnote: { color: palette.textMuted, fontSize: fontSize.xs, textAlign: 'center' },
});
