import "server-only";

import { AdvisorQuestionSource } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  ensureEnterpriseTeamMemberProvisioned,
  resolveEnterpriseIdForAdvisorProfile,
} from "@/lib/enterprise/provision-team-member-content";
import { ensureAdvisorDefaultsCloned } from "@/lib/methodology/snapshot";
import { loadPlatformPillars } from "@/lib/methodology/platform-pillars";

export type AdvisorMethodologyPillar = {
  pillarId: string;
  slug: string;
  canonicalName: string;
  description: string | null;
  isActive: boolean;
  displayName: string | null;
  weight: number;
  threshold: unknown;
  emphasisMultiplier: number;
  displayOrder: number;
  version: number;
};

export function methodologyPillarDisplayName(pillar: {
  canonicalName: string;
  displayName: string | null;
}): string {
  return pillar.displayName?.trim() || pillar.canonicalName;
}

export async function loadAdvisorMethodologyPillars(
  advisorProfileId: string,
): Promise<AdvisorMethodologyPillar[]> {
  await ensureEnterpriseTeamMemberProvisioned(advisorProfileId);
  await ensureAdvisorDefaultsCloned(advisorProfileId);

  const enterpriseId = await resolveEnterpriseIdForAdvisorProfile(advisorProfileId);
  const [pillars, overrides, enterpriseOverrides] = await Promise.all([
    prisma.pillar.findMany({
      where: { archivedAt: null },
      orderBy: { defaultOrder: "asc" },
    }),
    prisma.advisorPillarOverride.findMany({
      where: { advisorProfileId },
      select: {
        pillarId: true,
        enterpriseSourceId: true,
        isActive: true,
        displayName: true,
        weight: true,
        threshold: true,
        emphasisMultiplier: true,
        displayOrder: true,
        version: true,
      },
    }),
    enterpriseId
      ? prisma.enterprisePillarOverride.findMany({ where: { enterpriseId } })
      : Promise.resolve([]),
  ]);
  const overrideByPillarId = new Map(overrides.map((o) => [o.pillarId, o]));
  const enterpriseByPillarId = new Map(
    enterpriseOverrides.map((o) => [o.pillarId, o]),
  );

  if (pillars.length === 0) {
    const starter = await loadPlatformPillars();
    return starter.map((pillar) => {
      const enterpriseOverride = enterpriseByPillarId.get(pillar.id);
      const defaultIsActive = enterpriseId
        ? (enterpriseOverride?.isActive ?? false)
        : true;
      return {
        pillarId: pillar.id,
        slug: pillar.slug,
        canonicalName: pillar.name,
        description: pillar.summary,
        isActive: defaultIsActive,
        displayName: enterpriseOverride?.displayName ?? null,
        weight: enterpriseOverride?.weight ?? 10,
        threshold: null,
        emphasisMultiplier: enterpriseOverride?.emphasisMultiplier ?? 1.5,
        displayOrder: enterpriseOverride?.displayOrder ?? pillar.defaultOrder,
        version: 1,
      };
    });
  }

  return pillars.map((pillar) => {
    const override = overrideByPillarId.get(pillar.id);
    const enterpriseOverride = enterpriseByPillarId.get(pillar.id);
    const defaultIsActive = enterpriseId
      ? (enterpriseOverride?.isActive ?? false)
      : true;

    return {
      pillarId: pillar.id,
      slug: pillar.slug,
      canonicalName: pillar.canonicalName,
      description: pillar.description,
      isActive: enterpriseId
        ? (enterpriseOverride?.isActive ?? false)
        : (override?.isActive ?? defaultIsActive),
      displayName:
        override?.displayName ?? enterpriseOverride?.displayName ?? null,
      weight: override?.weight ?? enterpriseOverride?.weight ?? 10,
      threshold: override?.threshold ?? enterpriseOverride?.threshold,
      emphasisMultiplier:
        override?.emphasisMultiplier ??
        enterpriseOverride?.emphasisMultiplier ??
        1.5,
      displayOrder:
        override?.displayOrder ??
        enterpriseOverride?.displayOrder ??
        pillar.defaultOrder,
      version: override?.version ?? 1,
    };
  });
}

export async function loadActiveAdvisorMethodologyPillars(
  advisorProfileId: string,
): Promise<AdvisorMethodologyPillar[]> {
  const pillars = await loadAdvisorMethodologyPillars(advisorProfileId);
  return pillars.filter((pillar) => pillar.isActive);
}

export async function loadAdvisorAssessmentQuestions(
  advisorProfileId: string,
  pillarSlug: string,
) {
  await ensureAdvisorDefaultsCloned(advisorProfileId);
  const pillar = await prisma.pillar.findUnique({ where: { slug: pillarSlug } });
  if (!pillar) return [];

  return prisma.advisorPillarQuestion.findMany({
    where: { advisorProfileId, pillarId: pillar.id },
    orderBy: { displayOrder: "asc" },
  });
}

export async function loadAdvisorIntakeQuestions(advisorProfileId: string) {
  await ensureAdvisorDefaultsCloned(advisorProfileId);
  return prisma.advisorIntakeQuestion.findMany({
    where: { advisorProfileId },
    orderBy: { displayOrder: "asc" },
  });
}

export async function countAdvisorCustomAssessmentQuestions(advisorProfileId: string) {
  await ensureAdvisorDefaultsCloned(advisorProfileId);
  return prisma.advisorPillarQuestion.count({
    where: {
      advisorProfileId,
      sourceKind: { in: [AdvisorQuestionSource.CUSTOM, AdvisorQuestionSource.ENTERPRISE] },
    },
  });
}

export async function countAdvisorCustomIntakeQuestions(advisorProfileId: string) {
  await ensureAdvisorDefaultsCloned(advisorProfileId);
  return prisma.advisorIntakeQuestion.count({
    where: {
      advisorProfileId,
      sourceKind: { in: [AdvisorQuestionSource.CUSTOM, AdvisorQuestionSource.ENTERPRISE] },
    },
  });
}

export async function loadAdvisorPillarNarrative(
  advisorProfileId: string,
  pillarSlug: string,
) {
  await ensureAdvisorDefaultsCloned(advisorProfileId);
  const pillar = await prisma.pillar.findUnique({ where: { slug: pillarSlug } });
  if (!pillar) return null;

  return prisma.advisorPillarNarrative.findUnique({
    where: {
      advisorProfileId_pillarId: {
        advisorProfileId,
        pillarId: pillar.id,
      },
    },
  });
}

export async function loadAdvisorRecommendationRules(
  advisorProfileId: string,
  pillarSlug?: string,
) {
  await ensureEnterpriseTeamMemberProvisioned(advisorProfileId);
  await ensureAdvisorDefaultsCloned(advisorProfileId);
  const pillar = pillarSlug
    ? await prisma.pillar.findUnique({ where: { slug: pillarSlug } })
    : null;

  return prisma.advisorRecommendationRule.findMany({
    where: {
      advisorProfileId,
      ...(pillar ? { pillarId: pillar.id } : {}),
    },
    include: { pillar: true },
    orderBy: { priority: "desc" },
  });
}

export async function loadActiveServiceRecommendations() {
  return prisma.serviceRecommendation.findMany({
    where: { isActive: true },
    orderBy: [{ priority: "desc" }, { name: "asc" }],
    select: { id: true, name: true, category: true, priority: true },
  });
}

export async function loadAdvisorSnapshots(advisorProfileId: string) {
  return prisma.intakeSnapshot.findMany({
    where: { advisorProfileId },
    orderBy: { takenAt: "desc" },
    take: 50,
    include: {
      intakeInterview: {
        select: {
          id: true,
          status: true,
          user: { select: { name: true, emailCiphertext: true } },
        },
      },
    },
  });
}
