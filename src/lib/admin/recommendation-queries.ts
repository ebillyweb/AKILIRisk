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
import { formatQuestionTextForDisplay } from "@/lib/assessment/bank/question-bank-display";
import { loadGovernanceQuestionWires } from "@/lib/assessment/bank/load-bank";
import type { RulePickerQuestion } from "@/lib/admin/recommendation-rule-ui";
import { getPlatformPillarCatalog } from "@/lib/methodology/cached-pillar-catalog";

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

/** All assessment questions for the recommendation rule form picker. */
export async function listQuestionsForRulePicker(): Promise<RulePickerQuestion[]> {
  const [wires, catalog] = await Promise.all([
    loadGovernanceQuestionWires({ onlyVisible: false }),
    getPlatformPillarCatalog(),
  ]);
  const pillarNames = new Map(catalog.map((pillar) => [pillar.id, pillar.name]));

  return wires
    .filter((wire): wire is typeof wire & { riskAreaId: string } => Boolean(wire.riskAreaId))
    .map((wire) => ({
      questionId: wire.questionId,
      text: formatQuestionTextForDisplay(wire.text),
      pillarId: wire.riskAreaId,
      pillarName: pillarNames.get(wire.riskAreaId) ?? wire.riskAreaId,
      type: wire.type,
      answerOptions: answerOptionsFromWire(wire),
    }))
    .sort((a, b) => {
      const byPillar = a.pillarName.localeCompare(b.pillarName);
      if (byPillar !== 0) return byPillar;
      return a.text.localeCompare(b.text);
    });
}

function answerOptionsFromWire(
  wire: {
    type: string;
    options: unknown;
    scoreMap: Record<string, unknown>;
  },
): Array<{ value: string; label: string }> {
  if (Array.isArray(wire.options) && wire.options.length > 0) {
    return wire.options
      .map((option) => {
        if (!option || typeof option !== "object") return null;
        const row = option as { value?: unknown; label?: unknown };
        if (row.value === undefined || row.value === null) return null;
        return {
          value: String(row.value),
          label:
            typeof row.label === "string" && row.label.trim()
              ? row.label.trim()
              : String(row.value),
        };
      })
      .filter((option): option is { value: string; label: string } => option !== null);
  }

  if (wire.type === "yes-no") {
    return [
      { value: "no", label: "No" },
      { value: "yes", label: "Yes" },
    ];
  }

  return Object.keys(wire.scoreMap ?? {}).map((value) => ({
    value,
    label: value,
  }));
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
