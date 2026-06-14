import React from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAssessments } from '@/hooks/useAssessments';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { EmptyView, ErrorView, LoadingView } from '@/components/StateViews';
import type { Assessment, AssessmentStatus } from '@/types';
import { palette } from '@/theme/colors';
import { fontSize, radius, spacing } from '@/theme/spacing';

const STATUS_META: Record<AssessmentStatus, { label: string; color: string }> = {
  IN_PROGRESS: { label: 'In progress', color: palette.warning },
  COMPLETED: { label: 'Completed', color: palette.success },
  ARCHIVED: { label: 'Archived', color: palette.textMuted },
};

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function AssessmentRow({ item }: { item: Assessment }) {
  const status = STATUS_META[item.status];
  return (
    <Card
      onPress={() => router.push({ pathname: '/assessment/[id]', params: { id: item.id } })}
    >
      <View style={styles.row}>
        <Text style={styles.title}>Assessment v{item.version ?? 1}</Text>
        <View style={[styles.statusPill, { borderColor: status.color }]}>
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>
      <Text style={styles.meta}>
        {item._count?.responses ?? 0} responses · Updated {formatDate(item.updatedAt)}
      </Text>
    </Card>
  );
}

export default function AssessmentsScreen() {
  const { data, isLoading, isError, error, refetch, isRefetching } = useAssessments();

  if (isLoading) return <LoadingView label="Loading assessments…" />;
  if (isError) return <ErrorView message={(error as Error).message} onRetry={() => refetch()} />;

  const items = data ?? [];

  if (items.length === 0) {
    return (
      <EmptyView
        title="No assessments yet"
        subtitle="Your advisor will share an assessment, or you can start one from the AkiliRisk web app."
      />
    );
  }

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={palette.accent} />
      }
    >
      <Text style={styles.heading}>Your assessments</Text>
      {items.map((item) => (
        <AssessmentRow key={item.id} item={item} />
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: { color: palette.textPrimary, fontSize: fontSize.lg, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: palette.textPrimary, fontSize: fontSize.md, fontWeight: '700' },
  meta: { color: palette.textSecondary, fontSize: fontSize.xs },
  statusPill: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusText: { fontSize: fontSize.xs, fontWeight: '700' },
});
