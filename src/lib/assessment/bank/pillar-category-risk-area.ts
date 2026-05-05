import { PillarCategoryKind } from "@prisma/client";

/**
 * Map BRD-source pillar DDL `categories.code` to `AssessmentBankQuestion.riskAreaId` / scoring pillar ids.
 * Intake script categories (`PillarCategoryKind.INTAKE`) are not risk areas — use
 * `riskAreaIdForPillarCategory` which returns `null` for them.
 */
export const PILLAR_CATEGORY_CODE_TO_RISK_AREA_ID: Record<string, string> = {
  "1_governance": "governance",
  "2_cybersecurity": "cybersecurity",
  "3_physical": "physical-security",
  "4_insurance": "financial-asset-protection",
  "5_geographic": "environmental-geographic-risk",
  "6_reputational": "lifestyle-behavioral-risk",
};

export function riskAreaIdForPillarCategory(category: {
  code: string;
  kind: PillarCategoryKind;
}): string | null {
  if (category.kind === PillarCategoryKind.INTAKE) return null;
  return PILLAR_CATEGORY_CODE_TO_RISK_AREA_ID[category.code] ?? category.code;
}
