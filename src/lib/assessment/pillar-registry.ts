import { RISK_AREAS } from "@/lib/advisor/types";
import type { Pillar } from "@/lib/assessment/types";

/** Canonical six-pillar ids (BRD §4.1). */
export const ASSESSMENT_PILLAR_IDS = RISK_AREAS.map((a) => a.id);

/** Legacy slugs stored on older Assessment rows / PillarScore rows. */
const LEGACY_PILLAR_ALIASES: Record<string, string> = {
  "family-governance": "governance",
  "cyber-risk": "cyber-digital",
  "identity-risk": "governance",
};

export function normalizePillarSlug(slug: string): string {
  return LEGACY_PILLAR_ALIASES[slug] ?? slug;
}

export function normalizePillarScoreId(pillar: string): string {
  return normalizePillarSlug(pillar);
}

export function isAssessmentPillarId(id: string): boolean {
  const normalized = normalizePillarSlug(id);
  return (ASSESSMENT_PILLAR_IDS as readonly string[]).includes(normalized);
}

export function pillarDefinitionFor(riskAreaId: string): Pillar {
  const id = normalizePillarSlug(riskAreaId);
  const area = RISK_AREAS.find((a) => a.id === id);
  const name = area?.name ?? id;
  return {
    id,
    name,
    slug: id,
    description: area?.summary ?? "",
    estimatedMinutes: 15,
    subCategories: [
      {
        id,
        name,
        description: area?.summary ?? "",
        weight: 1,
        questionIds: [],
      },
    ],
  };
}

export function assessmentPillarDefinitions(): Pillar[] {
  return ASSESSMENT_PILLAR_IDS.map(pillarDefinitionFor);
}

export function pillarDisplayName(pillarId: string): string {
  const id = normalizePillarSlug(pillarId);
  return RISK_AREAS.find((a) => a.id === id)?.name ?? id;
}
