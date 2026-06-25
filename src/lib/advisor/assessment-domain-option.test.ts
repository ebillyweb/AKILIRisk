import { describe, expect, it } from "vitest";
import { resolveDefaultAssessmentDomainSelection } from "@/lib/advisor/assessment-domain-option";

describe("resolveDefaultAssessmentDomainSelection", () => {
  const available = ["governance", "cyber-digital", "insurance"];

  it("prefers existing included when still available", () => {
    expect(
      resolveDefaultAssessmentDomainSelection({
        availableDomainIds: available,
        existingIncluded: ["cyber-digital"],
        suggestedIds: ["governance"],
      }),
    ).toEqual(["cyber-digital"]);
  });

  it("falls back to suggested ids intersected with available", () => {
    expect(
      resolveDefaultAssessmentDomainSelection({
        availableDomainIds: available,
        suggestedIds: ["governance", "physical-security"],
      }),
    ).toEqual(["governance"]);
  });

  it("defaults to all available domains", () => {
    expect(
      resolveDefaultAssessmentDomainSelection({
        availableDomainIds: available,
      }),
    ).toEqual(available);
  });
});
