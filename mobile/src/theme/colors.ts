import type { RiskLevel } from '@/types';

/** Brand palette, aligned with the web platform (src/lib/branding/preview-hex.ts). */
export const palette = {
  primary: '#1a1a2e',
  primaryMuted: '#2a2a44',
  secondary: '#f5f5f5',
  accent: '#10b981',
  accentDark: '#059669',

  background: '#0f0f1e',
  surface: '#1a1a2e',
  surfaceElevated: '#23233d',
  border: '#33334d',

  textPrimary: '#f5f5f7',
  textSecondary: '#a9a9c2',
  textMuted: '#6f6f8a',

  white: '#ffffff',
  danger: '#ef4444',
  warning: '#f59e0b',
  success: '#10b981',
} as const;

/** Maps a backend RiskLevel to its display color. */
export const riskColor: Record<RiskLevel, string> = {
  LOW: '#10b981',
  MEDIUM: '#f59e0b',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
};

export const riskLabel: Record<RiskLevel, string> = {
  LOW: 'Low Risk',
  MEDIUM: 'Moderate Risk',
  HIGH: 'High Risk',
  CRITICAL: 'Critical Risk',
};
