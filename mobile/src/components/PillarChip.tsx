import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { pillarColor, pillarLabel } from '@/constants/pillars';
import { radius, spacing, fontSize } from '@/theme/spacing';

export function PillarChip({ pillar }: { pillar: string }) {
  const color = pillarColor(pillar);
  return (
    <View style={[styles.chip, { borderColor: color, backgroundColor: `${color}1a` }]}>
      <Text style={[styles.text, { color }]}>{pillarLabel(pillar)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  text: { fontSize: fontSize.xs, fontWeight: '700', letterSpacing: 0.3 },
});
