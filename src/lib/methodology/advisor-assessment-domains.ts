import "server-only";

import { Prisma } from "@prisma/client";
import type {
  AdvisorAssessmentDomainPickerData,
  AssessmentDomainOption,
} from "@/lib/advisor/assessment-domain-option";
import { DEFAULT_RISK_THRESHOLDS } from "@/lib/assessment/governance-rubric";
import { prisma } from "@/lib/db";
import { loadAdvisorMethodologyPillars } from "@/lib/methodology/methodology-queries";
import { PLATFORM_PILLAR_CATALOG } from "@/lib/methodology/pillar-catalog-starter";
import { ensureAdvisorDefaultsCloned } from "@/lib/methodology/snapshot";

function pillarToDomainOption(pillar: {
  slug: string;
  canonicalName: string;
  description: string | null;
  displayName: string | null;
}): AssessmentDomainOption {
  return {
    id: pillar.slug,
    name: pillar.displayName?.trim() || pillar.canonicalName,
    summary: pillar.description?.trim() ?? "",
  };
}

/**
 * Ensure every non-archived platform pillar has an active advisor override.
 * New pillars added after the advisor's initial clone otherwise stay missing
 * or inactive and cannot be used in default full-catalog engagement scope.
 */
export async function ensureAllPlatformPillarsActiveForAdvisor(
  advisorProfileId: string,
): Promise<void> {
  await ensureAdvisorDefaultsCloned(advisorProfileId);

  const pillars = await prisma.pillar.findMany({
    where: { archivedAt: null },
    orderBy: { defaultOrder: "asc" },
  });

  for (const pillar of pillars) {
    const starter = PLATFORM_PILLAR_CATALOG.find((p) => p.slug === pillar.slug);
    const weight = starter?.defaultWeight ?? 10;
    await prisma.advisorPillarOverride.upsert({
      where: {
        advisorProfileId_pillarId: {
          advisorProfileId,
          pillarId: pillar.id,
        },
      },
      create: {
        advisorProfileId,
        pillarId: pillar.id,
        isActive: true,
        weight,
        threshold: DEFAULT_RISK_THRESHOLDS as unknown as Prisma.InputJsonValue,
        emphasisMultiplier: 1.5,
        displayOrder: pillar.defaultOrder,
      },
      update: {
        isActive: true,
      },
    });
  }
}

/**
 * Assessment domain options for client-scope pickers: platform pillars from DB
 * merged with advisor methodology overrides. By default only active pillars.
 */
export async function loadAdvisorAssessmentDomainPickerData(
  advisorProfileId: string,
  options?: { activeOnly?: boolean },
): Promise<AdvisorAssessmentDomainPickerData> {
  const activeOnly = options?.activeOnly !== false;
  const pillars = await loadAdvisorMethodologyPillars(advisorProfileId);
  const sorted = [...pillars].sort(
    (a, b) => a.displayOrder - b.displayOrder || a.slug.localeCompare(b.slug),
  );

  const inactiveDomains = sorted.filter((p) => !p.isActive).map(pillarToDomainOption);
  const domains = sorted
    .filter((pillar) => !activeOnly || pillar.isActive)
    .map(pillarToDomainOption);

  return {
    domains,
    platformTotal: sorted.length,
    inactiveDomains,
  };
}

export async function loadAdvisorAssessmentDomainOptions(
  advisorProfileId: string,
  options?: { activeOnly?: boolean },
): Promise<AssessmentDomainOption[]> {
  return (await loadAdvisorAssessmentDomainPickerData(advisorProfileId, options))
    .domains;
}

/** Validate advisor-selected scope is a subset of their offered (active) domains. */
export async function assertAdvisorAssessmentDomainSelection(
  advisorProfileId: string,
  includedPillars: string[],
): Promise<void> {
  const offered = new Set(
    (await loadAdvisorAssessmentDomainOptions(advisorProfileId)).map((d) => d.id),
  );
  for (const id of includedPillars) {
    if (!offered.has(id)) {
      throw new Error(
        `Pillar "${id}" is not active in your methodology. Enable it under Methodology → Pillars or remove it from the selection.`,
      );
    }
  }
}
