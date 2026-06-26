import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { palette } from '@/theme/colors';
import { fontSize, spacing } from '@/theme/spacing';

export default function IntakeConfirm() {
  const { referenceId, answered, total } = useLocalSearchParams<{
    referenceId?: string;
    answered?: string;
    total?: string;
  }>();

  return (
    <ScreenContainer contentStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.emoji}>✅</Text>
        <Text style={styles.heading}>Intake submitted</Text>
        <Text style={styles.subtitle}>
          Thank you. Your advisor has been notified and will review your responses.
        </Text>
      </View>

      <Card>
        <Row label="Answered" value={`${answered ?? '—'} of ${total ?? '—'} questions`} />
        <View style={styles.divider} />
        <Row label="Reference ID" value={referenceId ?? '—'} mono />
      </Card>

      <Button label="Back to home" onPress={() => router.replace('/(client)/home')} />
    </ScreenContainer>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono && styles.mono]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', gap: spacing.xl },
  header: { alignItems: 'center', gap: spacing.sm },
  emoji: { fontSize: 48 },
  heading: { color: palette.textPrimary, fontSize: fontSize.xl, fontWeight: '800' },
  subtitle: { color: palette.textSecondary, fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { color: palette.textSecondary, fontSize: fontSize.sm },
  rowValue: { color: palette.textPrimary, fontSize: fontSize.sm, fontWeight: '700' },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) },
  divider: { height: 1, backgroundColor: palette.border },
});
