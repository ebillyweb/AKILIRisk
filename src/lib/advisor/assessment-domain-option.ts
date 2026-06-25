/** Client-safe pillar option for assessment domain pickers (sourced from DB). */
export type AssessmentDomainOption = {
  id: string;
  name: string;
  summary: string;
};

/** Default client scope: existing → suggested ∩ available → all available. */
export function resolveDefaultAssessmentDomainSelection(input: {
  availableDomainIds: readonly string[];
  suggestedIds?: readonly string[];
  existingIncluded?: readonly string[];
}): string[] {
  const available = new Set(input.availableDomainIds);

  if (input.existingIncluded?.length) {
    const kept = input.existingIncluded.filter((id) => available.has(id));
    if (kept.length > 0) return kept;
  }

  if (input.suggestedIds?.length) {
    const suggested = input.suggestedIds.filter((id) => available.has(id));
    if (suggested.length > 0) return [...new Set(suggested)];
  }

  return [...input.availableDomainIds];
}

export function assessmentDomainLabel(
  domains: readonly AssessmentDomainOption[],
  id: string,
): string {
  return domains.find((d) => d.id === id)?.name ?? id;
}
