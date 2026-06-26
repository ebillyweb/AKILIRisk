import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { useAdvisorClients } from '@/hooks/useAdvisor';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { StatusPill } from '@/components/StatusPill';
import { EmptyView, ErrorView, LoadingView } from '@/components/StateViews';
import type { AdvisorClient, IntakeStatus } from '@/types';
import { palette } from '@/theme/colors';
import { fontSize, radius, spacing } from '@/theme/spacing';

type Filter = 'ALL' | 'IN_REVIEW' | 'SUBMITTED' | 'APPROVED';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'IN_REVIEW', label: 'In review' },
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'APPROVED', label: 'Approved' },
];

function matchesFilter(status: IntakeStatus, filter: Filter): boolean {
  if (filter === 'ALL') return true;
  return status === filter;
}

export default function AdvisorClients() {
  const { user, signOut } = useAuth();
  const { data, isLoading, isError, error, refetch, isRefetching } = useAdvisorClients();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data ?? []).filter((c) => {
      if (!matchesFilter(c.intakeStatus, filter)) return false;
      if (!term) return true;
      return (
        (c.name ?? '').toLowerCase().includes(term) || c.email.toLowerCase().includes(term)
      );
    });
  }, [data, search, filter]);

  if (isLoading) return <LoadingView label="Loading your clients…" />;
  if (isError) return <ErrorView message={(error as Error).message} onRetry={() => refetch()} />;

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={palette.accent} />
      }
    >
      <Text style={styles.greeting}>{user?.firstName || 'Advisor'}&apos;s clients</Text>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name or email"
        placeholderTextColor={palette.textMuted}
        autoCapitalize="none"
        style={styles.search}
      />

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {filtered.length === 0 ? (
        <EmptyView title="No clients match" subtitle="Try a different search or filter." />
      ) : (
        filtered.map((client) => <ClientRow key={client.id} client={client} />)
      )}

      <Button label="Sign out" variant="ghost" onPress={signOut} />
    </ScreenContainer>
  );
}

function ClientRow({ client }: { client: AdvisorClient }) {
  return (
    <Card onPress={() => router.push({ pathname: '/(advisor)/client/[id]', params: { id: client.id } })}>
      <View style={styles.rowHeader}>
        <Text style={styles.name}>{client.name || client.email}</Text>
        <StatusPill status={client.intakeStatus} />
      </View>
      <Text style={styles.email}>{client.email}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  greeting: { color: palette.textPrimary, fontSize: fontSize.xl, fontWeight: '800' },
  search: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 48,
    color: palette.textPrimary,
    fontSize: fontSize.md,
  },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  filterChip: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  filterChipActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  filterText: { color: palette.textSecondary, fontSize: fontSize.sm, fontWeight: '600' },
  filterTextActive: { color: palette.white },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: palette.textPrimary, fontSize: fontSize.md, fontWeight: '700', flex: 1 },
  email: { color: palette.textSecondary, fontSize: fontSize.xs },
});
