import React, { useMemo } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { useAssessment, useAssessments } from '@/hooks/useAssessments';
import { ScreenContainer } from '@/components/ScreenContainer';
import { PillarCard } from '@/components/PillarCard';
import { Card } from '@/components/Card';
import { RiskBadge } from '@/components/RiskBadge';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { PILLARS } from '@/constants/pillars';
import type { PillarScore, RiskLevel } from '@/types';
import { palette } from '@/theme/colors';
import { fontSize, spacing } from '@/theme/spacing';

const RISK_RANK: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

export default function DashboardScreen() {
  const { user } = useAuth();
  const list = useAssessments();

  // Most recent assessment drives the dashboard snapshot.
  const latest = useMemo(() => {
    const items = list.data ?? [];
    if (items.length === 0) return undefined;
    const completed = items.filter((a) => a.status === 'COMPLETED');
    return (completed[0] ?? items[0]);
  }, [list.data]);

  const detail = useAssessment(latest?.id);

  const scoresByPillar = useMemo(() => {
    const map: Record<string, PillarScore> = {};
    for (const s of detail.data?.scores ?? []) map[s.pillar] = s;
    return map;
  }, [detail.data]);

  const overall = useMemo(() => {
    const scores = detail.data?.scores ?? [];
    if (scores.length === 0) return null;
    const avg = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
    const worst = scores.reduce<RiskLevel>(
      (acc, s) => (RISK_RANK[s.riskLevel] > RISK_RANK[acc] ? s.riskLevel : acc),
      'LOW',
    );
    return { avg: Math.round(avg), worst };
  }, [detail.data]);

  if (list.isLoading) return <LoadingView label="Loading your risk profile…" />;
  if (list.isError) {
    return (
      <ErrorView
        message={(list.error as Error).message}
        onRetry={() => list.refetch()}
      />
    );
  }

  const greetingName = user?.firstName || user?.name || 'there';
  const refreshing = list.isRefetching || detail.isRefetching;

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            list.refetch();
            detail.refetch();
          }}
          tintColor={palette.accent}
        />
      }
    >
      <View>
        <Text style={styles.greeting}>Hi {greetingName} 👋</Text>
        <Text style={styles.subtitle}>Here&apos;s your family risk snapshot.</Text>
      </View>

      <Card>
        <Text style={styles.cardLabel}>Overall Risk Profile</Text>
        {overall ? (
          <View style={styles.overallRow}>
            <View>
              <Text style={styles.bigScore}>{overall.avg}</Text>
              <Text style={styles.scoreUnit}>composite score</Text>
            </View>
            <RiskBadge level={overall.worst} />
          </View>
        ) : (
          <Text style={styles.muted}>
            Complete an assessment to see your composite risk profile.
          </Text>
        )}
      </Card>

      <Text style={styles.sectionTitle}>Risk Pillars</Text>
      {PILLARS.map((p) => (
        <PillarCard
          key={p.key}
          pillarKey={p.key}
          score={scoresByPillar[p.key]}
          onPress={
            latest
              ? () => router.push({ pathname: '/assessment/[id]', params: { id: latest.id } })
              : undefined
          }
        />
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  greeting: { color: palette.textPrimary, fontSize: fontSize.xl, fontWeight: '800' },
  subtitle: { color: palette.textSecondary, fontSize: fontSize.sm, marginTop: 2 },
  cardLabel: { color: palette.textSecondary, fontSize: fontSize.sm, fontWeight: '600' },
  overallRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bigScore: { color: palette.textPrimary, fontSize: 44, fontWeight: '800' },
  scoreUnit: { color: palette.textMuted, fontSize: fontSize.xs },
  muted: { color: palette.textMuted, fontSize: fontSize.sm },
  sectionTitle: { color: palette.textPrimary, fontSize: fontSize.lg, fontWeight: '700' },
});
