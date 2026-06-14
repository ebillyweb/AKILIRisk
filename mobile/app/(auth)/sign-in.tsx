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
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    try {
      const user = await signIn(email.trim().toLowerCase(), password);
      if (user.mfaEnabled && !user.mfaVerified) {
        router.replace('/(auth)/mfa');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in. Try again.');
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
          <Text style={styles.tagline}>Family Risk Intelligence</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.heading}>Sign in</Text>

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
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={palette.textMuted}
              secureTextEntry
              autoComplete="password"
              style={styles.input}
              onSubmitEditing={handleSubmit}
              returnKeyType="go"
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button label="Sign in" onPress={handleSubmit} loading={submitting} />
        </View>

        <Text style={styles.footnote}>
          Don&apos;t have an account? Ask your advisor for an invitation link.
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
