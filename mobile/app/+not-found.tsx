import React from 'react';
import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { palette } from '@/theme/colors';
import { fontSize, spacing } from '@/theme/spacing';

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn&apos;t exist.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to home</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: palette.background,
  },
  title: { color: palette.textPrimary, fontSize: fontSize.lg, fontWeight: '700' },
  link: { paddingVertical: spacing.sm },
  linkText: { color: palette.accent, fontSize: fontSize.md, fontWeight: '600' },
});
