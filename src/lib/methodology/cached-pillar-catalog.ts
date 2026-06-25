import "server-only";

import { cache } from "react";
import { loadPlatformPillars } from "@/lib/methodology/platform-pillars";
import {
  isPillarInCatalog,
  pillarCatalogFromPlatformViews,
  pillarCatalogSlugs,
  type PillarCatalogEntry,
} from "@/lib/methodology/pillar-catalog";

/** Cached platform pillar catalog from DB (starter fallback when empty). */
export const getPlatformPillarCatalog = cache(
  async (): Promise<PillarCatalogEntry[]> => {
    const pillars = await loadPlatformPillars();
    return pillarCatalogFromPlatformViews(pillars);
  },
);

export async function getPlatformPillarSlugs(): Promise<string[]> {
  return pillarCatalogSlugs(await getPlatformPillarCatalog());
}

export async function isPlatformRiskAreaSlug(slug: string): Promise<boolean> {
  const catalog = await getPlatformPillarCatalog();
  return isPillarInCatalog(catalog, slug);
}
