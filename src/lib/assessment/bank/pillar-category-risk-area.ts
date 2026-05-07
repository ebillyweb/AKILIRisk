import { PillarCategoryKind } from "@prisma/client";

/**
 * Map BRD-source pillar DDL `categories.code` to `AssessmentBankQuestion.riskAreaId` / scoring pillar ids.
 * Intake script categories (`PillarCategoryKind.INTAKE`) are not risk areas — use
 * `riskAreaIdForPillarCategory` which returns `null` for them.
 */
// F2 / BRD §4.1 — risk-area IDs renamed to match BRD-domain wording.
// Workbook category codes (left) keep their numeric prefix because they
// trace to the source spreadsheet. Right-hand IDs are the BRD-aligned
// values (also reflected in DB rows via migration 20260521120000).
export const PILLAR_CATEGORY_CODE_TO_RISK_AREA_ID: Record<string, string> = {
  "1_governance": "governance",
  "2_cybersecurity": "cyber-digital",
  "3_physical": "physical-security",
  "4_insurance": "insurance",
  "5_geographic": "geographic-environmental",
  "6_reputational": "reputational-social",
};

export function riskAreaIdForPillarCategory(category: {
  code: string;
  kind: PillarCategoryKind;
}): string | null {
  if (category.kind === PillarCategoryKind.INTAKE) return null;
  return PILLAR_CATEGORY_CODE_TO_RISK_AREA_ID[category.code] ?? category.code;
}
