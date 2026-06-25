import {
  assessmentPillarDefinitionsFromCatalog,
  isPillarInCatalog,
  pillarCatalogDisplayName,
  pillarDefinitionFromCatalog,
  pillarCatalogMap,
  scopedPillarCatalog,
  sortPillarCatalog,
  starterPillarCatalog,
  type PillarCatalogEntry,
} from "@/lib/methodology/pillar-catalog";
import type { Pillar } from "@/lib/assessment/types";

export type { PillarCatalogEntry };

/** @deprecated Prefer getPlatformPillarSlugs() — starter slugs for tests only. */
export const ASSESSMENT_PILLAR_IDS = starterPillarCatalog().map((p) => p.id);

export function normalizePillarSlug(slug: string): string {
  return slug;
}

export function normalizePillarScoreId(pillar: string): string {
  return normalizePillarSlug(pillar);
}

export function isAssessmentPillarId(
  id: string,
  catalog: readonly PillarCatalogEntry[],
): boolean {
  const normalized = normalizePillarSlug(id);
  return isPillarInCatalog(catalog, normalized);
}

export function pillarDefinitionFor(
  riskAreaId: string,
  catalog: readonly PillarCatalogEntry[],
): Pillar {
  const id = normalizePillarSlug(riskAreaId);
  const entry = pillarCatalogMap(catalog).get(id);
  if (entry) return pillarDefinitionFromCatalog(entry);
  return {
    id,
    name: id,
    slug: id,
    description: "",
    estimatedMinutes: 15,
    subCategories: [
      {
        id,
        name: id,
        description: "",
        weight: 1,
        questionIds: [],
      },
    ],
  };
}

export function assessmentPillarDefinitions(
  catalog: readonly PillarCatalogEntry[],
): Pillar[] {
  return assessmentPillarDefinitionsFromCatalog(catalog);
}

export function pillarDisplayName(
  pillarId: string,
  catalog: readonly PillarCatalogEntry[],
): string {
  return pillarCatalogDisplayName(catalog, normalizePillarSlug(pillarId));
}

export { scopedPillarCatalog };
