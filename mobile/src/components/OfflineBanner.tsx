import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSync } from '@/sync/SyncContext';
import { palette } from '@/theme/colors';
import { spacing, fontSize } from '@/theme/spacing';

/**
 * Renders when the device is offline or has pending/failed writes (plan §4.2).
 * Nothing shows when online and fully synced.
 */
export function OfflineBanner() {
  const { isOnline, isSyncing, pendingCount, deadLetters } = useSync();
  const failed = deadLetters.length;

  if (isOnline && pendingCount === 0 && failed === 0) return null;

  let text: string;
  let color: string = palette.warning;
  if (!isOnline) {
    text =
      pendingCount > 0
        ? `Offline — ${pendingCount} answer${pendingCount === 1 ? '' : 's'} saved on device, will sync when you're back online.`
        : 'Offline — your answers are saved on this device.';
  } else if (failed > 0) {
    color = palette.danger;
    text = `${failed} answer${failed === 1 ? '' : 's'} failed to upload. Tap to retry from the queue.`;
  } else {
    color = palette.accent;
    text = isSyncing
      ? `Syncing ${pendingCount} answer${pendingCount === 1 ? '' : 's'}…`
      : `${pendingCount} answer${pendingCount === 1 ? '' : 's'} waiting to sync.`;
  }

  return (
    <View style={[styles.banner, { backgroundColor: `${color}22`, borderColor: color }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { flex: 1, color: palette.textPrimary, fontSize: fontSize.xs, lineHeight: 16 },
});
