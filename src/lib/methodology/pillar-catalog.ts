import { PLATFORM_PILLAR_CATALOG } from "@/lib/methodology/pillar-catalog-starter";
import type { Pillar } from "@/lib/assessment/types";

/** Platform pillar metadata for display, validation, and ordering. */
export type PillarCatalogEntry = {
  id: string;
  name: string;
  summary: string;
  displayOrder: number;
};

/** Starter catalog — tests and empty-DB bootstrap only; runtime should use DB. */
export function starterPillarCatalog(): PillarCatalogEntry[] {
  return PLATFORM_PILLAR_CATALOG.map((p) => ({
    id: p.slug,
    name: p.canonicalName,
    summary: p.description,
    displayOrder: p.defaultOrder,
  }));
}

export function pillarCatalogFromPlatformViews(
  pillars: Array<{
    slug: string;
    name: string;
    summary: string;
    defaultOrder: number;
  }>,
): PillarCatalogEntry[] {
  return pillars.map((p) => ({
    id: p.slug,
    name: p.name,
    summary: p.summary,
    displayOrder: p.defaultOrder,
  }));
}

export function sortPillarCatalog(
  catalog: readonly PillarCatalogEntry[],
): PillarCatalogEntry[] {
  return [...catalog].sort(
    (a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id),
  );
}

export function scopedPillarCatalog(
  catalog: readonly PillarCatalogEntry[],
  includedIds?: readonly string[],
): PillarCatalogEntry[] {
  const ordered = sortPillarCatalog(catalog);
  if (!includedIds?.length) return ordered;
  const allowed = new Set(includedIds);
  return ordered.filter((p) => allowed.has(p.id));
}

export function pillarCatalogSlugs(catalog: readonly PillarCatalogEntry[]): string[] {
  return sortPillarCatalog(catalog).map((p) => p.id);
}

export function pillarCatalogMap(
  catalog: readonly PillarCatalogEntry[],
): Map<string, PillarCatalogEntry> {
  return new Map(catalog.map((p) => [p.id, p]));
}

export function pillarCatalogDisplayName(
  catalog: readonly PillarCatalogEntry[],
  pillarId: string,
): string {
  return pillarCatalogMap(catalog).get(pillarId)?.name ?? pillarId;
}

export function isPillarInCatalog(
  catalog: readonly PillarCatalogEntry[],
  pillarId: string,
): boolean {
  return pillarCatalogMap(catalog).has(pillarId);
}

export function pillarDefinitionFromCatalog(entry: PillarCatalogEntry): Pillar {
  return {
    id: entry.id,
    name: entry.name,
    slug: entry.id,
    description: entry.summary,
    estimatedMinutes: 15,
    subCategories: [
      {
        id: entry.id,
        name: entry.name,
        description: entry.summary,
        weight: 1,
        questionIds: [],
      },
    ],
  };
}

export function assessmentPillarDefinitionsFromCatalog(
  catalog: readonly PillarCatalogEntry[],
): Pillar[] {
  return sortPillarCatalog(catalog).map(pillarDefinitionFromCatalog);
}
