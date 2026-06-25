import "server-only";

import type {
  AdvisorAssessmentDomainPickerData,
  AssessmentDomainOption,
} from "@/lib/advisor/assessment-domain-option";
import { loadAdvisorMethodologyPillars } from "@/lib/methodology/methodology-queries";

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
