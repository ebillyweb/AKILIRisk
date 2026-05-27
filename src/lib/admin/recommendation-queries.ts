import "server-only";

/**
 * C1 (BRD §4.4): list + filter helpers for the admin recommendations
 * editor. Server-rendered pages call these once per request to populate
 * the catalog + rule list views.
 *
 * Type returns are intentionally permissive (`Record<string, unknown>`)
 * so the page components don't need the regenerated Prisma client types
 * for the new tier/complexity/implementationType fields. Casts at the
 * page level pick up the proper types once `npx prisma generate` is rerun.
 */

import { prisma } from "@/lib/db";

export interface ServiceRecommendationListFilter {
  category?: string;
  tier?: "BASELINE" | "ENHANCED";
  complexity?: "LOW" | "MEDIUM" | "HIGH";
  implementationType?: "DIY" | "ADVISORY" | "HYBRID";
  /** "all" → ignore isActive filter; default = active only. */
  active?: "active" | "inactive" | "all";
  /** Free-text search across name + description (case-insensitive). */
  q?: string;
}

export async function listServiceRecommendations(
  filter: ServiceRecommendationListFilter = {}
): Promise<Record<string, unknown>[]> {
  const where: Record<string, unknown> = {};
  if (filter.category) where.category = filter.category;
  if (filter.tier) where.tier = filter.tier;
  if (filter.complexity) where.complexity = filter.complexity;
  if (filter.implementationType) where.implementationType = filter.implementationType;
  if (filter.active !== "all") {
    where.isActive = filter.active !== "inactive";
  }
  if (filter.q) {
    where.OR = [
      { name: { contains: filter.q, mode: "insensitive" } },
      { description: { contains: filter.q, mode: "insensitive" } },
    ];
  }
   
  return prisma.serviceRecommendation.findMany({
    where: where as any,
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { recommendationRules: true, assessmentRecommendations: true } },
    },
  }) as unknown as Promise<Record<string, unknown>[]>;
}

export async function getServiceRecommendation(
  id: string
): Promise<Record<string, unknown> | null> {
  return prisma.serviceRecommendation.findUnique({
    where: { id },
    include: {
      _count: { select: { recommendationRules: true, assessmentRecommendations: true } },
    },
  }) as unknown as Promise<Record<string, unknown> | null>;
}

export interface RecommendationRuleListFilter {
  serviceRecommendationId?: string;
  active?: "active" | "inactive" | "all";
}

export async function listRecommendationRules(
  filter: RecommendationRuleListFilter = {}
): Promise<Record<string, unknown>[]> {
  const where: Record<string, unknown> = {};
  if (filter.serviceRecommendationId) where.serviceRecommendationId = filter.serviceRecommendationId;
  if (filter.active !== "all") {
    where.isActive = filter.active !== "inactive";
  }
  return prisma.recommendationRule.findMany({
    where,
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    include: {
      serviceRecommendation: {
        select: { id: true, name: true, category: true, isActive: true },
      },
    },
  }) as unknown as Promise<Record<string, unknown>[]>;
}

export async function getRecommendationRule(
  id: string
): Promise<Record<string, unknown> | null> {
  return prisma.recommendationRule.findUnique({
    where: { id },
    include: {
      serviceRecommendation: {
        select: { id: true, name: true, category: true, isActive: true },
      },
    },
  }) as unknown as Promise<Record<string, unknown> | null>;
}

/** Active service recommendations the rule form picks from in its
 *  serviceRecommendationId dropdown. Excludes inactive so admins don't
 *  accidentally bind a new rule to a soft-deleted service. */
export async function listServiceRecommendationsForRulePicker(): Promise<
  Array<{ id: string; name: string; category: string }>
> {
  const rows = await prisma.serviceRecommendation.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { id: true, name: true, category: true },
  });
  return rows;
}

/** Distinct category values for the catalog filter datalist. Cheap query —
 *  the catalog is in the low hundreds of rows. */
export async function listDistinctCategories(): Promise<string[]> {
  const rows = await prisma.serviceRecommendation.findMany({
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
  });
  return rows.map((r) => r.category);
}
