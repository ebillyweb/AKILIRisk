import "server-only";

import type { AssessmentDomainOption } from "@/lib/advisor/assessment-domain-option";
import { loadAdvisorMethodologyPillars } from "@/lib/methodology/methodology-queries";

/**
 * Assessment domain options for client-scope pickers: platform pillars from DB
 * merged with advisor methodology overrides. By default only active pillars.
 */
export async function loadAdvisorAssessmentDomainOptions(
  advisorProfileId: string,
  options?: { activeOnly?: boolean },
): Promise<AssessmentDomainOption[]> {
  const activeOnly = options?.activeOnly !== false;
  const pillars = await loadAdvisorMethodologyPillars(advisorProfileId);

  return pillars
    .filter((pillar) => !activeOnly || pillar.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((pillar) => ({
      id: pillar.slug,
      name: pillar.displayName?.trim() || pillar.canonicalName,
      summary: pillar.description?.trim() ?? "",
    }));
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
