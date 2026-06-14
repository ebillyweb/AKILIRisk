import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RiskLevel } from '@/types';
import { riskColor, riskLabel } from '@/theme/colors';
import { radius, spacing, fontSize } from '@/theme/spacing';

export function RiskBadge({ level, compact = false }: { level: RiskLevel; compact?: boolean }) {
  const color = riskColor[level];
  return (
    <View style={[styles.badge, { backgroundColor: `${color}22`, borderColor: color }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{compact ? level : riskLabel[level]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: fontSize.xs, fontWeight: '700', letterSpacing: 0.3 },
});
