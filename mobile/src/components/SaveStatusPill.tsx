import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SyncState } from '@/types';
import { palette } from '@/theme/colors';
import { radius, spacing, fontSize } from '@/theme/spacing';

const META: Record<SyncState, { label: string; color: string }> = {
  SAVED_LOCAL: { label: 'Saved on device', color: palette.textMuted },
  QUEUED: { label: 'Queued', color: palette.warning },
  SYNCED: { label: 'Synced', color: palette.success },
  FAILED: { label: 'Failed', color: palette.danger },
};

export function SaveStatusPill({ state }: { state: SyncState }) {
  const { label, color } = META[state];
  return (
    <View style={[styles.pill, { borderColor: color, backgroundColor: `${color}1a` }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontSize: fontSize.xs, fontWeight: '700' },
});
