import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { IntakeStatus } from '@/types';
import { palette } from '@/theme/colors';
import { radius, spacing, fontSize } from '@/theme/spacing';

const META: Record<IntakeStatus, { label: string; color: string }> = {
  NOT_STARTED: { label: 'Not started', color: palette.textMuted },
  IN_PROGRESS: { label: 'In progress', color: palette.warning },
  SUBMITTED: { label: 'Submitted', color: palette.accent },
  IN_REVIEW: { label: 'In review', color: '#3b82f6' },
  APPROVED: { label: 'Approved', color: palette.success },
};

export function StatusPill({ status }: { status: IntakeStatus }) {
  const { label, color } = META[status];
  return (
    <View style={[styles.pill, { borderColor: color, backgroundColor: `${color}1a` }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
  },
  text: { fontSize: fontSize.xs, fontWeight: '700' },
});
