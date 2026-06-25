import { format } from 'date-fns';

/**
 * Formats ISO date string to "MMM yyyy" format for chart axes
 */
export function formatChartDate(dateString: string): string {
  return format(new Date(dateString), 'MMM yyyy');
}

/**
 * Formats score to 1 decimal place
 */
export function formatScore(score: number): string {
  return score.toFixed(1);
}

/**
 * Maps pillar subcategory IDs to display names for chart labels
 */
export const CATEGORY_LABELS: Record<string, string> = {
  governance: 'Governance & Decision-Making',
  "cyber-digital": 'Cyber & Digital Security',
  'physical-security': 'Physical Security',
  'insurance': 'Protection & Risk Transfer',
  'geographic-environmental': 'Geographic & Environmental',
  'reputational-social': 'Reputation & Social Risk',
  'liquidity-cash': 'Liquidity & Cash Management',
  'tax-exposure': 'Tax Exposure',
  'estate-succession': 'Estate & Succession',
  'family-governance-behavioral': 'Behavioral Resilience',
  /** Historical breakdown rows */
  'health-medical-preparedness': 'Protection & Risk Transfer (prior medical section)',
  // Legacy governance subcategory IDs (scores stored before six-pillar taxonomy)
  'decision-making-authority': 'Governance & Decision-Making',
  'access-controls': 'Cyber & Digital Security',
  'trust-estate-governance': 'Protection & Risk Transfer',
  'marriage-relationship-risk': 'Protection & Risk Transfer',
  'succession-planning': 'Protection & Risk Transfer',
  'behavior-standards': 'Reputation & Social Risk',
  'business-involvement': 'Protection & Risk Transfer',
  'documentation-communication': 'Governance & Decision-Making',
};

/**
 * Distinct colors for category chart series plus primary color for overall score
 */
export const CHART_COLORS: Record<string, string> = {
  primary: '#3b82f6',
  governance: '#78350f',
  "cyber-digital": '#7c3aed',
  'physical-security': '#64748b',
  'insurance': '#ca8a04',
  'geographic-environmental': '#0d9488',
  'reputational-social': '#2563eb',
  'liquidity-cash': '#059669',
  'tax-exposure': '#dc2626',
  'estate-succession': '#9333ea',
  'family-governance-behavioral': '#0891b2',
  'health-medical-preparedness': '#e11d48',
  'decision-making-authority': '#78350f',
  'access-controls': '#7c3aed',
  'trust-estate-governance': '#ca8a04',
  'marriage-relationship-risk': '#ca8a04',
  'succession-planning': '#ca8a04',
  'behavior-standards': '#2563eb',
  'business-involvement': '#ca8a04',
  'documentation-communication': '#78350f',
};
