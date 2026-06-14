/**
 * Canonical risk pillars, matching the backend pillar identifiers
 * (see src/lib/assessment + src/lib/{family,cyber-risk,identity-risk,intelligence}).
 */

export type PillarKey =
  | 'family-governance'
  | 'cyber-risk'
  | 'identity-risk'
  | 'intelligence';

export interface PillarMeta {
  key: PillarKey;
  label: string;
  short: string;
  description: string;
  /** lucide-style / emoji glyph used as a lightweight icon. */
  glyph: string;
}

export const PILLARS: PillarMeta[] = [
  {
    key: 'family-governance',
    label: 'Family Governance',
    short: 'Governance',
    description: 'Household structure, succession, and decision-making controls.',
    glyph: '🏛️',
  },
  {
    key: 'cyber-risk',
    label: 'Cyber Risk',
    short: 'Cyber',
    description: 'Digital security posture across devices, accounts, and networks.',
    glyph: '🛡️',
  },
  {
    key: 'identity-risk',
    label: 'Identity Risk',
    short: 'Identity',
    description: 'Exposure of personal information and digital footprint.',
    glyph: '🪪',
  },
  {
    key: 'intelligence',
    label: 'Risk Intelligence',
    short: 'Intel',
    description: 'Threat intelligence and situational awareness for the family.',
    glyph: '🔎',
  },
];

export const PILLAR_BY_KEY: Record<string, PillarMeta> = Object.fromEntries(
  PILLARS.map((p) => [p.key, p]),
);

export function pillarMeta(key: string): PillarMeta {
  return (
    PILLAR_BY_KEY[key] ?? {
      key: key as PillarKey,
      label: key,
      short: key,
      description: '',
      glyph: '📊',
    }
  );
}
