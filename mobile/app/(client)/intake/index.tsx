import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useIntakeScript } from '@/hooks/useIntake';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { palette } from '@/theme/colors';
import { fontSize, spacing } from '@/theme/spacing';

export default function IntakeLanding() {
  const { data, isLoading, isError, error, refetch } = useIntakeScript();

  if (isLoading) return <LoadingView />;
  if (isError) return <ErrorView message={(error as Error).message} onRetry={() => refetch()} />;

  const total = data?.questions.length ?? 0;
  const minutes = Math.max(5, Math.round(total * 0.75));
  const submitted =
    data?.status === 'SUBMITTED' || data?.status === 'IN_REVIEW' || data?.status === 'APPROVED';

  return (
    <ScreenContainer contentStyle={{ paddingHorizontal: 0 }}>
      <OfflineBanner />
      <View style={styles.body}>
        <Text style={styles.title}>Household risk intake</Text>

        <Card>
          <Row label="Questions" value={`${total}`} />
          <View style={styles.divider} />
          <Row label="Estimated time" value={`~${minutes} min`} />
          <View style={styles.divider} />
          <Row label="Answer modes" value="Type or Voice" />
        </Card>

        <Card>
          <Text style={styles.privacyTitle}>🔒 Your answers are private</Text>
          <Text style={styles.privacyBody}>
            Answers save to this device first and sync securely to your advisor&apos;s
            workspace. You can pause anytime — nothing is lost if you lose connection.
          </Text>
        </Card>

        <Button
          label={submitted ? 'Review answers' : data?.status === 'IN_PROGRESS' ? 'Resume' : 'Start intake'}
          onPress={() => router.push('/(client)/intake/wizard')}
          disabled={total === 0}
        />
      </View>
    </ScreenContainer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  title: { color: palette.textPrimary, fontSize: fontSize.lg, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { color: palette.textSecondary, fontSize: fontSize.sm },
  rowValue: { color: palette.textPrimary, fontSize: fontSize.sm, fontWeight: '700' },
  divider: { height: 1, backgroundColor: palette.border },
  privacyTitle: { color: palette.textPrimary, fontSize: fontSize.md, fontWeight: '700' },
  privacyBody: { color: palette.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
});
