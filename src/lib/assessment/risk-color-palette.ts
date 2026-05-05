import type { RiskLevel } from "@/lib/assessment/types";

/**
 * Canonical risk-level color palette. Single source of truth for every
 * risk-coloring surface in the codebase: the round-10 web + PDF heat maps,
 * the existing PDF report cover, the dashboard ScoreBadge, the family
 * EmphasisIndicator, and the pipeline ClientDetailView pillar cards.
 *
 * Why this exists: pre-round-10, four separate color helpers (PDF
 * `getRiskColor`, pipeline `getRiskLevelColor`, dashboard
 * `getRiskColorClasses`, family `EmphasisIndicator` inline) used
 * subtly different hex/Tailwind values for the same risk levels —
 * "low" was sometimes emerald, sometimes green; "high" was sometimes
 * red, sometimes orange. The heat map's whole job is showing risk by
 * domain at a glance, so having two different "high" colors next to
 * each other on the same page would look like a bug.
 *
 * Design intent for the canonical values (resolved when consolidating):
 *
 *   LOW       emerald  — distinct from MEDIUM amber; "certified safe" feel
 *   MEDIUM    amber    — universal warning yellow
 *   HIGH      orange   — clearly distinct from CRITICAL red (pre-round-10
 *                        the PDF + pipeline used red for HIGH, which made
 *                        HIGH and CRITICAL hard to distinguish at a glance)
 *   CRITICAL  red      — escalated, deepest hue
 *   unassessed grey    — explicitly muted; never confused with "low"
 *
 * Adopted from the dashboard ScoreBadge + family EmphasisIndicator's
 * orange-for-HIGH palette. PDF + pipeline previously used red for HIGH
 * — those surfaces will visually shift toward orange post-refactor (see
 * commit message for the surfaces affected).
 */

/** Internal RiskLevel union plus the "unassessed" cell state for heat maps. */
export type HeatMapLevel = RiskLevel | "unassessed";

export interface RiskLevelPalette {
  /** Hex (for PDF, SVG, dynamic inline styles). */
  hex: string;
  /** Tailwind background utility class. */
  bg: string;
  /** Tailwind text utility class for body text on the bg. */
  text: string;
  /** Tailwind border utility class. */
  border: string;
  /** Display label for the cell + aria-label. */
  label: string;
}

export const RISK_LEVEL_PALETTE: Record<HeatMapLevel, RiskLevelPalette> = {
  low: {
    hex: "#10b981",
    bg: "bg-emerald-100",
    text: "text-emerald-900",
    border: "border-emerald-300",
    label: "Low risk",
  },
  medium: {
    hex: "#f59e0b",
    bg: "bg-amber-100",
    text: "text-amber-900",
    border: "border-amber-300",
    label: "Medium risk",
  },
  high: {
    hex: "#f97316",
    bg: "bg-orange-100",
    text: "text-orange-900",
    border: "border-orange-300",
    label: "High risk",
  },
  critical: {
    hex: "#dc2626",
    bg: "bg-red-200",
    text: "text-red-900",
    border: "border-red-400",
    label: "Critical risk",
  },
  unassessed: {
    hex: "#9ca3af",
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
    label: "Not assessed",
  },
};

/**
 * Strongly-typed accessor that normalizes case + handles the persisted
 * Prisma enum values (UPPERCASE) and the in-app TypeScript enum (lowercase).
 *
 * Returns the `unassessed` palette entry for null/undefined/unknown inputs
 * so callers don't have to handle a potential undefined return.
 */
export function paletteForRiskLevel(
  level: string | null | undefined
): RiskLevelPalette {
  if (!level) return RISK_LEVEL_PALETTE.unassessed;
  const normalized = level.toLowerCase();
  switch (normalized) {
    case "low":
      return RISK_LEVEL_PALETTE.low;
    case "medium":
      return RISK_LEVEL_PALETTE.medium;
    case "high":
      return RISK_LEVEL_PALETTE.high;
    case "critical":
      return RISK_LEVEL_PALETTE.critical;
    default:
      return RISK_LEVEL_PALETTE.unassessed;
  }
}
