import "server-only";

import { prisma } from "@/lib/db";
import { ensureAdvisorDefaultsCloned } from "@/lib/methodology/snapshot";
import { loadPlatformPillars } from "@/lib/methodology/platform-pillars";

export async function loadAdvisorMethodologyPillars(advisorProfileId: string) {
  await ensureAdvisorDefaultsCloned(advisorProfileId);
  const pillars = await prisma.pillar.findMany({
    where: { archivedAt: null },
    orderBy: { defaultOrder: "asc" },
  });
  const overrides = await prisma.advisorPillarOverride.findMany({
    where: { advisorProfileId },
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
