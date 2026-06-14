import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from './Card';
import { RiskBadge } from './RiskBadge';
import { ScoreBar } from './ScoreBar';
import { pillarMeta } from '@/constants/pillars';
import type { PillarScore } from '@/types';
import { palette, riskColor } from '@/theme/colors';
import { fontSize, spacing } from '@/theme/spacing';

interface PillarCardProps {
  /** Backend pillar key (e.g. "cyber-risk"). */
  pillarKey: string;
  /** Score record if the pillar has been assessed. */
  score?: PillarScore;
  onPress?: () => void;
}

export function PillarCard({ pillarKey, score, onPress }: PillarCardProps) {
  const meta = pillarMeta(pillarKey);

  return (
    <Card onPress={onPress}>
      <View style={styles.header}>
        <Text style={styles.glyph}>{meta.glyph}</Text>
        <View style={styles.headerText}>
          <Text style={styles.label}>{meta.label}</Text>
          <Text style={styles.description} numberOfLines={2}>
            {meta.description}
          </Text>
        </View>
        {score ? <RiskBadge level={score.riskLevel} compact /> : null}
      </View>

      {score ? (
        <ScoreBar score={score.score} color={riskColor[score.riskLevel]} />
      ) : (
        <Text style={styles.pending}>Not yet assessed</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  glyph: { fontSize: 26 },
  headerText: { flex: 1, gap: 2 },
  label: { color: palette.textPrimary, fontSize: fontSize.md, fontWeight: '700' },
  description: { color: palette.textSecondary, fontSize: fontSize.xs, lineHeight: 16 },
  pending: { color: palette.textMuted, fontSize: fontSize.sm, fontStyle: 'italic' },
});
