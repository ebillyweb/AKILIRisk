import { ASSESSMENT_PILLAR_IDS } from "@/lib/assessment/pillar-registry";
import type { Pillar } from "@/lib/assessment/types";

/**
 * Legacy combined assessment pillar metadata (questions always load from the DB bank).
 */
export const familyGovernancePillar: Pillar = {
  id: "family-governance",
  name: "Comprehensive Risk Assessment",
  slug: "family-governance",
  description:
    "Governance, cyber security, physical security, insurance, geographic, and reputational & social risk.",
  estimatedMinutes: 32,
  subCategories: ASSESSMENT_PILLAR_IDS.map((id) => ({
    id,
    name: id,
    description: id,
    weight: 1,
    questionIds: [],
  })),
};
