import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ResponseMode } from '@/types';
import { palette } from '@/theme/colors';
import { radius, spacing, fontSize } from '@/theme/spacing';

interface ModeTabsProps {
  mode: ResponseMode;
  onChange: (mode: ResponseMode) => void;
  voiceDisabled?: boolean;
}

export function ModeTabs({ mode, onChange, voiceDisabled }: ModeTabsProps) {
  return (
    <View style={styles.row}>
      <Tab label="Type" active={mode === 'TYPE'} onPress={() => onChange('TYPE')} />
      <Tab
        label="Voice"
        active={mode === 'VOICE'}
        disabled={voiceDisabled}
        onPress={() => onChange('VOICE')}
      />
    </View>
  );
}

function Tab({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.tab, active && styles.tabActive, disabled && styles.tabDisabled]}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: palette.surfaceElevated,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: palette.accent },
  tabDisabled: { opacity: 0.4 },
  tabText: { color: palette.textSecondary, fontSize: fontSize.sm, fontWeight: '700' },
  tabTextActive: { color: palette.white },
});
