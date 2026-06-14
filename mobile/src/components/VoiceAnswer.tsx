import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAudioRecorder } from '@/audio/useAudioRecorder';
import { Button } from './Button';
import { palette } from '@/theme/colors';
import { fontSize, spacing } from '@/theme/spacing';

interface VoiceAnswerProps {
  /** Existing local audio uri for this question, if any. */
  initialUri: string | null;
  onSave: (uri: string) => Promise<void> | void;
}

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Record / playback / re-record lifecycle for a single voice answer (plan §4.2). */
export function VoiceAnswer({ initialUri, onSave }: VoiceAnswerProps) {
  const recorder = useAudioRecorder(initialUri);
  const [saving, setSaving] = React.useState(false);

  const handleSave = async () => {
    if (!recorder.uri) return;
    setSaving(true);
    try {
      await onSave(recorder.uri);
    } finally {
      setSaving(false);
    }
  };

  if (recorder.hasPermission === false) {
    return (
      <View style={styles.permission}>
        <Text style={styles.permissionText}>
          Microphone access is off. Enable it in Settings, or switch to Type mode.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.meter}>
        {recorder.state === 'recording' ? (
          <View style={styles.recordingRow}>
            <View style={styles.redDot} />
            <Text style={styles.timer}>{formatDuration(recorder.durationMillis)}</Text>
          </View>
        ) : recorder.uri ? (
          <Text style={styles.recorded}>
            Recorded {formatDuration(recorder.durationMillis)}
          </Text>
        ) : (
          <Text style={styles.hint}>Tap record and speak your answer.</Text>
        )}
      </View>

      {recorder.state === 'idle' ? (
        <Button label="● Record" onPress={recorder.start} />
      ) : null}

      {recorder.state === 'recording' ? (
        <Button label="■ Stop" variant="secondary" onPress={recorder.stop} />
      ) : null}

      {(recorder.state === 'recorded' || recorder.state === 'playing') && recorder.uri ? (
        <View style={styles.actions}>
          <Button
            label={recorder.state === 'playing' ? 'Playing…' : '▶ Play'}
            variant="secondary"
            onPress={recorder.play}
            disabled={recorder.state === 'playing'}
          />
          <Button label="Re-record" variant="ghost" onPress={recorder.reset} />
          <Button
            label={saving ? 'Saving…' : 'Save answer'}
            onPress={handleSave}
            loading={saving}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  meter: {
    minHeight: 56,
    borderRadius: 12,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  recordingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  redDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: palette.danger },
  timer: { color: palette.textPrimary, fontSize: fontSize.lg, fontWeight: '700' },
  recorded: { color: palette.success, fontSize: fontSize.sm, fontWeight: '600' },
  hint: { color: palette.textMuted, fontSize: fontSize.sm },
  actions: { gap: spacing.sm },
  permission: {
    padding: spacing.lg,
    borderRadius: 12,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  permissionText: { color: palette.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
});
