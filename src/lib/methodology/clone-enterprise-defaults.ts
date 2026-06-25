import { AdvisorQuestionSource, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type CloneTx = Prisma.TransactionClient;

/**
 * Clone platform recommendation rules into an enterprise's rule set.
 * Idempotent — skips rules already cloned (matched by platformSourceId).
 */
export async function cloneEnterpriseDefaultsIfNeeded(
  enterpriseId: string,
): Promise<boolean> {
  const existing = await prisma.enterpriseRecommendationRule.count({
    where: { enterpriseId },
  });
  if (existing > 0) return false;

  const slugToPillarId = await buildSlugToPillarIdMap();

  await prisma.$transaction(
    async (tx) => {
      await cloneAllPlatformRulesToEnterprise(tx, enterpriseId, slugToPillarId);
    },
    { timeout: 60_000 },
  );

  return true;
}

/**
 * Backfill platform rules added after the enterprise's initial clone.
 * Returns count of new rules added.
 */
export async function syncMissingPlatformEnterpriseRules(
  enterpriseId: string,
): Promise<number> {
  const slugToPillarId = await buildSlugToPillarIdMap();

  return prisma.$transaction(
    async (tx) => {
      return syncMissingPlatformRulesToEnterprise(tx, enterpriseId, slugToPillarId);
    },
    { timeout: 60_000 },
  );
}

/**
 * Sync enterprise rule changes down to all member advisors.
 * Called after enterprise admin updates/creates/deletes rules.
 */
export async function syncEnterpriseRulesToMembers(
  enterpriseId: string,
): Promise<{ advisorsUpdated: number; rulesAdded: number; rulesDeactivated: number }> {
  const members = await prisma.enterpriseMembership.findMany({
    where: { enterpriseId, status: "ACTIVE", advisorProfileId: { not: null } },
    select: { advisorProfileId: true },
  });

  let advisorsUpdated = 0;
  let totalAdded = 0;
  let totalDeactivated = 0;

  for (const member of members) {
    if (!member.advisorProfileId) continue;
    const result = await syncEnterpriseRulesToAdvisor(
      enterpriseId,
      member.advisorProfileId,
    );
    if (result.added > 0 || result.deactivated > 0) advisorsUpdated++;
    totalAdded += result.added;
    totalDeactivated += result.deactivated;
  }

  return {
    advisorsUpdated,
    rulesAdded: totalAdded,
    rulesDeactivated: totalDeactivated,
  };
}

/**
 * Sync enterprise rules to a single advisor.
 * - Adds missing enterprise rules (enterprise active rules not yet on advisor)
 * - Deactivates advisor rules whose enterprise source was deactivated
 */
export async function syncEnterpriseRulesToAdvisor(
  enterpriseId: string,
  advisorProfileId: string,
): Promise<{ added: number; deactivated: number }> {
  const slugToPillarId = await buildSlugToPillarIdMap();

  return prisma.$transaction(async (tx) => {
    const enterpriseRules = await tx.enterpriseRecommendationRule.findMany({
      where: { enterpriseId },
      include: { pillar: true },
    });

    const advisorRules = await tx.advisorRecommendationRule.findMany({
      where: { advisorProfileId, enterpriseSourceId: { not: null } },
      select: { id: true, enterpriseSourceId: true, isActive: true },
    });
    const advisorByEntSource = new Map(
      advisorRules.map((r) => [r.enterpriseSourceId!, r]),
    );

    let added = 0;
    let deactivated = 0;

    for (const entRule of enterpriseRules) {
      const existing = advisorByEntSource.get(entRule.id);
      if (existing) {
        // Deactivate advisor rule if enterprise rule was deactivated
        if (!entRule.isActive && existing.isActive) {
          await tx.advisorRecommendationRule.update({
            where: { id: existing.id },
            data: { isActive: false, version: { increment: 1 } },
          });
          deactivated++;
        }
        continue;
      }

      // Only clone active enterprise rules
      if (!entRule.isActive) continue;

      await createEnterpriseRecommendationClone(
        tx,
        advisorProfileId,
        entRule,
        slugToPillarId,
      );
      added++;
    }

    return { added, deactivated };
  }, { timeout: 60_000 });
}

// --- Internal helpers ---

async function buildSlugToPillarIdMap(): Promise<Map<string, string>> {
  const pillars = await prisma.pillar.findMany({
    where: { archivedAt: null },
    select: { id: true, slug: true },
  });
  return new Map(pillars.map((p) => [p.slug, p.id]));
}

async function cloneAllPlatformRulesToEnterprise(
  tx: CloneTx,
  enterpriseId: string,
  slugToPillarId: Map<string, string>,
): Promise<void> {
  const platformRules = await tx.recommendationRule.findMany({
    where: { isActive: true },
    orderBy: { priority: "desc" },
  });
  for (const rule of platformRules) {
    await createPlatformEnterpriseClone(tx, enterpriseId, rule, slugToPillarId);
  }
}

async function syncMissingPlatformRulesToEnterprise(
  tx: CloneTx,
  enterpriseId: string,
  slugToPillarId: Map<string, string>,
): Promise<number> {
  const existing = await tx.enterpriseRecommendationRule.findMany({
    where: { enterpriseId, sourceKind: AdvisorQuestionSource.PLATFORM },
    select: { platformSourceId: true },
  });
  const known = new Set(
    existing.map((r) => r.platformSourceId).filter((id): id is string => id != null),
  );

  const platformRules = await tx.recommendationRule.findMany({
    where: { isActive: true },
    orderBy: { priority: "desc" },
  });

  let added = 0;
  for (const rule of platformRules) {
    if (known.has(rule.id)) continue;
    await createPlatformEnterpriseClone(tx, enterpriseId, rule, slugToPillarId);
    added++;
  }
  return added;
}

async function createPlatformEnterpriseClone(
  tx: CloneTx,
  enterpriseId: string,
  rule: {
    id: string;
    ruleName: string;
    triggerConditions: unknown;
    serviceRecommendationId: string;
    priority: number;
  },
  slugToPillarId: Map<string, string>,
): Promise<void> {
  const conditions = rule.triggerConditions as { pillarId?: string };
  const pillarSlug = conditions.pillarId;
  const pillarId = pillarSlug ? slugToPillarId.get(pillarSlug) : null;
  await tx.enterpriseRecommendationRule.create({
    data: {
      enterpriseId,
      pillarId: pillarId ?? null,
      sourceKind: AdvisorQuestionSource.PLATFORM,
      platformSourceId: rule.id,
      name: rule.ruleName,
      triggerConditions: rule.triggerConditions as Prisma.InputJsonValue,
      servicePayload: {
        serviceRecommendationId: rule.serviceRecommendationId,
        serviceId: rule.serviceRecommendationId,
      },
      priority: rule.priority,
      isActive: true,
    },
  });
}

async function createEnterpriseRecommendationClone(
  tx: CloneTx,
  advisorProfileId: string,
  entRule: {
    id: string;
    pillarId: string | null;
    sourceKind: AdvisorQuestionSource;
    platformSourceId: string | null;
    name: string;
    triggerConditions: unknown;
    servicePayload: unknown;
    priority: number;
  },
  _slugToPillarId: Map<string, string>,
): Promise<void> {
  const sourceKind =
    entRule.sourceKind === AdvisorQuestionSource.PLATFORM
      ? AdvisorQuestionSource.PLATFORM
      : AdvisorQuestionSource.ENTERPRISE;

  await tx.advisorRecommendationRule.create({
    data: {
      advisorProfileId,
      pillarId: entRule.pillarId,
      sourceKind,
      platformSourceId: entRule.platformSourceId,
      enterpriseSourceId: entRule.id,
      name: entRule.name,
      triggerConditions: entRule.triggerConditions as Prisma.InputJsonValue,
      servicePayload: entRule.servicePayload as Prisma.InputJsonValue,
      priority: entRule.priority,
      isActive: true,
    },
  });
}
