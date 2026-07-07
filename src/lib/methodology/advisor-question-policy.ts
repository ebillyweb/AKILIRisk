import { AdvisorQuestionSource } from "@prisma/client";

/** Default 0–3 maturity score map for custom assessment questions. */
export const DEFAULT_MATURITY_SCORE_MAP: Record<string, number> = {
  "0": 0,
  "1": 1,
  "2": 2,
  "3": 3,
};

export function isPlatformAdvisorQuestion(sourceKind: AdvisorQuestionSource): boolean {
  return sourceKind === AdvisorQuestionSource.PLATFORM;
}

export function canDeleteAdvisorQuestion(sourceKind: AdvisorQuestionSource): boolean {
  return sourceKind === AdvisorQuestionSource.CUSTOM;
}

export function isEnterpriseAdvisorQuestion(sourceKind: AdvisorQuestionSource): boolean {
  return sourceKind === AdvisorQuestionSource.ENTERPRISE;
}

export function deleteAdvisorQuestionError(): string {
  return "Platform base questions cannot be deleted. Hide them instead.";
}

export function nextDisplayOrder(rows: { displayOrder: number }[]): number {
  if (rows.length === 0) return 0;
  return Math.max(...rows.map((r) => r.displayOrder)) + 1;
}
