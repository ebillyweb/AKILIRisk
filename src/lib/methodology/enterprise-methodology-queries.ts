import "server-only";

import { AdvisorQuestionSource } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ensureEnterprisePlatformMethodologyInTx } from "@/lib/methodology/clone-enterprise-methodology";
import { loadPlatformPillars } from "@/lib/methodology/platform-pillars";

async function ensureEnterpriseMethodologyCloned(enterpriseId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await ensureEnterprisePlatformMethodologyInTx(tx, enterpriseId);
  });
}

export async function loadEnterpriseMethodologyPillars(enterpriseId: string) {
  await ensureEnterpriseMethodologyCloned(enterpriseId);
  const pillars = await prisma.pillar.findMany({
    where: { archivedAt: null },
    orderBy: { defaultOrder: "asc" },
  });
  const overrides = await prisma.enterprisePillarOverride.findMany({
    where: { enterpriseId },
  });
  const overrideByPillarId = new Map(overrides.map((o) => [o.pillarId, o]));

  if (pillars.length === 0) {
    const starter = await loadPlatformPillars();
    return starter.map((pillar) => ({
      pillarId: pillar.id,
      slug: pillar.slug,
      canonicalName: pillar.name,
      description: pillar.summary,
      isActive: true,
      displayName: null as string | null,
      weight: 10,
      threshold: null,
      emphasisMultiplier: 1.5,
      displayOrder: pillar.defaultOrder,
      version: 1,
    }));
  }

  return pillars.map((pillar) => {
    const override = overrideByPillarId.get(pillar.id);
    return {
      pillarId: pillar.id,
      slug: pillar.slug,
      canonicalName: pillar.canonicalName,
      description: pillar.description,
      isActive: override?.isActive ?? true,
      displayName: override?.displayName ?? null,
      weight: override?.weight ?? 10,
      threshold: override?.threshold,
      emphasisMultiplier: override?.emphasisMultiplier ?? 1.5,
      displayOrder: override?.displayOrder ?? pillar.defaultOrder,
      version: override?.version ?? 1,
    };
  });
}

export async function loadActiveEnterpriseMethodologyPillars(enterpriseId: string) {
  const pillars = await loadEnterpriseMethodologyPillars(enterpriseId);
  return pillars.filter((pillar) => pillar.isActive);
}

export async function loadEnterpriseAssessmentQuestions(
  enterpriseId: string,
  pillarSlug: string,
) {
  await ensureEnterpriseMethodologyCloned(enterpriseId);
  const pillar = await prisma.pillar.findUnique({ where: { slug: pillarSlug } });
  if (!pillar) return [];

  return prisma.enterprisePillarQuestion.findMany({
    where: { enterpriseId, pillarId: pillar.id },
    orderBy: { displayOrder: "asc" },
  });
}

export async function loadEnterpriseIntakeQuestions(enterpriseId: string) {
  await ensureEnterpriseMethodologyCloned(enterpriseId);
  return prisma.enterpriseIntakeQuestion.findMany({
    where: { enterpriseId },
    orderBy: { displayOrder: "asc" },
  });
}

export async function countEnterpriseCustomAssessmentQuestions(enterpriseId: string) {
  await ensureEnterpriseMethodologyCloned(enterpriseId);
  return prisma.enterprisePillarQuestion.count({
    where: {
      enterpriseId,
      sourceKind: { in: [AdvisorQuestionSource.CUSTOM, AdvisorQuestionSource.ENTERPRISE] },
    },
  });
}

export async function countEnterpriseCustomIntakeQuestions(enterpriseId: string) {
  await ensureEnterpriseMethodologyCloned(enterpriseId);
  return prisma.enterpriseIntakeQuestion.count({
    where: {
      enterpriseId,
      sourceKind: { in: [AdvisorQuestionSource.CUSTOM, AdvisorQuestionSource.ENTERPRISE] },
    },
  });
}

export async function loadEnterprisePillarNarrative(
  enterpriseId: string,
  pillarSlug: string,
) {
  await ensureEnterpriseMethodologyCloned(enterpriseId);
  const pillar = await prisma.pillar.findUnique({ where: { slug: pillarSlug } });
  if (!pillar) return null;

  return prisma.enterprisePillarNarrative.findUnique({
    where: {
      enterpriseId_pillarId: {
        enterpriseId,
        pillarId: pillar.id,
      },
    },
  });
}
