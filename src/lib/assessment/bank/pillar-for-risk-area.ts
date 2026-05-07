import type { Pillar } from "@/lib/assessment/types";

const DEFAULT_LABELS: Record<string, string> = {
  governance: "Governance",
  "cyber-digital": "Cybersecurity",
  "physical-security": "Physical Security",
  insurance: "Insurance & Asset Protection",
  "geographic-environmental": "Geographic Risk",
  "reputational-social": "Reputational & Social Risk",
};

/**
 * Minimal pillar tree for bank-driven scoring: `wireQuestionToQuestion` sets
 * `question.subCategory` to the bank row's `riskAreaId`, so the rollup is one
 * weighted bucket per risk area.
 */
export function pillarForBankRiskArea(riskAreaId: string, displayName?: string): Pillar {
  const name = displayName ?? DEFAULT_LABELS[riskAreaId] ?? riskAreaId;
  return {
    id: riskAreaId,
    name,
    slug: riskAreaId,
    description: "",
    estimatedMinutes: 30,
    subCategories: [
      {
        id: riskAreaId,
        name,
        description: "",
        weight: 1,
        questionIds: [],
      },
    ],
  };
}
