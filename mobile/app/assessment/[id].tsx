import React, { useMemo } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useAssessment } from '@/hooks/useAssessments';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { RiskBadge } from '@/components/RiskBadge';
import { ScoreBar } from '@/components/ScoreBar';
import { EmptyView, ErrorView, LoadingView } from '@/components/StateViews';
import { pillarMeta } from '@/constants/pillars';
import type { PillarScore } from '@/types';
import { palette, riskColor } from '@/theme/colors';
import { fontSize, spacing } from '@/theme/spacing';

/** Best-effort extraction of a string list from the `missingControls` JSON blob. */
function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === 'string' ? v : typeof v === 'object' && v && 'label' in v ? String((v as { label: unknown }).label) : null))
      .filter((v): v is string => Boolean(v));
  }
  return [];
}

function PillarDetail({ score }: { score: PillarScore }) {
  const meta = pillarMeta(score.pillar);
  const missing = asStringList(score.missingControls);
  return (
    <Card>
      <View style={styles.pillarHeader}>
        <Text style={styles.glyph}>{meta.glyph}</Text>
        <Text style={styles.pillarLabel}>{meta.label}</Text>
        <RiskBadge level={score.riskLevel} compact />
      </View>
      <ScoreBar score={score.score} color={riskColor[score.riskLevel]} />
      {missing.length > 0 ? (
        <View style={styles.missingBlock}>
          <Text style={styles.missingTitle}>Recommended controls</Text>
          {missing.slice(0, 6).map((m, i) => (
            <Text key={i} style={styles.missingItem}>
              • {m}
            </Text>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

export default function AssessmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isError, error, refetch, isRefetching } = useAssessment(id);

  const scores = useMemo(() => data?.scores ?? [], [data]);

  if (isLoading) return <LoadingView label="Loading assessment…" />;
  if (isError) return <ErrorView message={(error as Error).message} onRetry={() => refetch()} />;
  if (!data) return <EmptyView title="Assessment not found" />;

  return (
    <>
      <Stack.Screen options={{ title: `Assessment v${data.version ?? 1}` }} />
      <ScreenContainer
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={palette.accent} />
        }
      >
        <Card>
          <Text style={styles.metaLabel}>Status</Text>
          <Text style={styles.metaValue}>{data.status.replace('_', ' ')}</Text>
        </Card>

        {scores.length === 0 ? (
          <EmptyView
            title="No scores yet"
            subtitle="Pillar scores appear once this assessment is completed and scored."
          />
        ) : (
          <>
            <Text style={styles.sectionTitle}>Pillar Breakdown</Text>
            {scores.map((s) => (
              <PillarDetail key={s.id} score={s} />
            ))}
          </>
        )}
      </ScreenContainer>
    </>
  );
}

const styles = StyleSheet.create({
  metaLabel: { color: palette.textSecondary, fontSize: fontSize.sm },
  metaValue: { color: palette.textPrimary, fontSize: fontSize.md, fontWeight: '700' },
  sectionTitle: { color: palette.textPrimary, fontSize: fontSize.lg, fontWeight: '700' },
  pillarHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  glyph: { fontSize: 22 },
  pillarLabel: { flex: 1, color: palette.textPrimary, fontSize: fontSize.md, fontWeight: '700' },
  missingBlock: { gap: spacing.xs, marginTop: spacing.sm },
  missingTitle: { color: palette.textSecondary, fontSize: fontSize.sm, fontWeight: '600' },
  missingItem: { color: palette.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
});
