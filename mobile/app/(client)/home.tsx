import React from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { useIntakeScript } from '@/hooks/useIntake';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { StatusPill } from '@/components/StatusPill';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { palette } from '@/theme/colors';
import { fontSize, spacing } from '@/theme/spacing';

export default function ClientHome() {
  const { user, signOut } = useAuth();
  const { data, isLoading, isError, error, refetch, isRefetching } = useIntakeScript();

  if (isLoading) return <LoadingView label="Loading your intake…" />;
  if (isError) return <ErrorView message={(error as Error).message} onRetry={() => refetch()} />;

  const status = data?.status ?? 'NOT_STARTED';
  const total = data?.questions.length ?? 0;
  const submitted = status === 'SUBMITTED' || status === 'IN_REVIEW' || status === 'APPROVED';
  const ctaLabel =
    status === 'IN_PROGRESS' ? 'Resume intake' : submitted ? 'View intake' : 'Begin intake';

  return (
    <ScreenContainer
      contentStyle={{ paddingHorizontal: 0 }}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={palette.accent} />
      }
    >
      <OfflineBanner />

      <View style={styles.body}>
        <View>
          <Text style={styles.greeting}>
            Hi {user?.firstName || user?.name || 'there'} 👋
          </Text>
          {user?.advisorFirmName ? (
            <Text style={styles.firm}>Invited by {user.advisorFirmName}</Text>
          ) : null}
        </View>

        <Card>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Household risk intake</Text>
            <StatusPill status={status} />
          </View>
          <Text style={styles.cardBody}>
            {submitted
              ? 'Your intake has been submitted. Your advisor will review it and follow up.'
              : `${total} questions · about ${Math.max(5, Math.round(total * 0.75))} minutes. You can answer by typing or speaking, online or offline.`}
          </Text>
          <Button
            label={ctaLabel}
            onPress={() => router.push('/(client)/intake')}
            disabled={total === 0}
          />
        </Card>

        <Button label="Sign out" variant="ghost" onPress={signOut} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  greeting: { color: palette.textPrimary, fontSize: fontSize.xl, fontWeight: '800' },
  firm: { color: palette.textSecondary, fontSize: fontSize.sm, marginTop: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: palette.textPrimary, fontSize: fontSize.md, fontWeight: '700' },
  cardBody: { color: palette.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
});
