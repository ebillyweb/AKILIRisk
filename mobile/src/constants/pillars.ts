/**
 * Pillar tags preserved from the web intake script. The intake question bank
 * tags each question with a pillar; the mobile app only displays it as a chip,
 * so this is a presentation helper rather than scoring logic.
 */

const PILLAR_LABELS: Record<string, string> = {
  'family-governance': 'Governance',
  governance: 'Governance',
  'cyber-risk': 'Cyber',
  cyber: 'Cyber',
  'identity-risk': 'Identity',
  identity: 'Identity',
  physical: 'Physical',
  'physical-security': 'Physical',
  intelligence: 'Intel',
};

const PILLAR_COLORS: Record<string, string> = {
  Governance: '#8b5cf6',
  Cyber: '#10b981',
  Identity: '#3b82f6',
  Physical: '#f59e0b',
  Intel: '#ec4899',
};

export function pillarLabel(pillar: string): string {
  const key = pillar.trim().toLowerCase();
  if (PILLAR_LABELS[key]) return PILLAR_LABELS[key];
  // Title-case an unknown pillar slug as a fallback.
  return key
    .split(/[-_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function pillarColor(pillar: string): string {
  return PILLAR_COLORS[pillarLabel(pillar)] ?? '#6f6f8a';
}
