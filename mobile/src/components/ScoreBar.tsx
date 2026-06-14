import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '@/theme/colors';
import { radius, spacing, fontSize } from '@/theme/spacing';

/** Horizontal score meter (0-100). */
export function ScoreBar({ score, color }: { score: number; color: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <View style={styles.row}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.value}>{clamped}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  track: {
    flex: 1,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceElevated,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill },
  value: {
    width: 34,
    textAlign: 'right',
    color: palette.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
});
