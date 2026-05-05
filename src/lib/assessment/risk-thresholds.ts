import "server-only";

import { prisma } from "@/lib/db";
import {
  DEFAULT_RISK_THRESHOLDS,
  type RiskThresholds,
} from "@/lib/assessment/governance-rubric";

/**
 * Read the active risk-tier thresholds from PlatformSettings.
 *
 * Returns DEFAULT_RISK_THRESHOLDS (80/60/40) when:
 *  - The PlatformSettings singleton row doesn't exist yet (fresh install).
 *  - The DB read fails for any reason.
 *
 * Defensive against bad data: clamps each value into [0, 100] and applies
 * the hardcoded default for any column that's null/missing/out-of-range.
 * Doesn't enforce monotonicity here (admin server action does that on
 * write); a misconfigured row degrades gracefully because
 * `riskLevelFromResiliencePercent` cascades top-down.
 *
 * Caching: not done. Score writes happen on assessment-completion paths
 * which already do multi-step DB work; one extra row read is negligible.
 * If perf matters later, wrap with a short TTL.
 */
export async function getActiveRiskThresholds(): Promise<RiskThresholds> {
  try {
    const row = await prisma.platformSettings.findUnique({
      where: { id: "default" },
      select: {
        riskThresholdLow: true,
        riskThresholdMedium: true,
        riskThresholdHigh: true,
      },
    });
    if (!row) return DEFAULT_RISK_THRESHOLDS;
    return {
      lowMin: clamp(row.riskThresholdLow, DEFAULT_RISK_THRESHOLDS.lowMin),
      mediumMin: clamp(row.riskThresholdMedium, DEFAULT_RISK_THRESHOLDS.mediumMin),
      highMin: clamp(row.riskThresholdHigh, DEFAULT_RISK_THRESHOLDS.highMin),
    };
  } catch (err) {
    console.error("[risk-thresholds] read failed; falling back to defaults:", err);
    return DEFAULT_RISK_THRESHOLDS;
  }
}

function clamp(value: number | null | undefined, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  if (value < 0 || value > 100) return fallback;
  return Math.floor(value);
}
