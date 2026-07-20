import { describe, expect, it } from "vitest";
import { resolveAdvisorAssessmentNextStep } from "./advisor-next-step";

describe("resolveAdvisorAssessmentNextStep", () => {
  it("points advisors to publish when assessment is complete but still in PREVIEW", () => {
    const step = resolveAdvisorAssessmentNextStep({
      clientId: "c1",
      assessmentStatus: "COMPLETED",
      deliverablePhase: "PREVIEW",
    });
    expect(step?.title).toMatch(/publish/i);
    expect(step?.href).toBe("/advisor/pipeline/c1/report");
    expect(step?.tone).toBe("primary");
  });

  it("points to guidance after the profile is published", () => {
    const step = resolveAdvisorAssessmentNextStep({
      clientId: "c1",
      assessmentStatus: "COMPLETED",
      deliverablePhase: "PROFILE",
      actionPlanEnabled: true,
    });
    expect(step?.title).toMatch(/full results/i);
    expect(step?.href).toBe("/advisor/clients/c1/guidance");
    expect(step?.tone).toBe("success");
  });

  it("prefers document collection when mandatory docs remain after publish", () => {
    const step = resolveAdvisorAssessmentNextStep({
      clientId: "c1",
      assessmentStatus: "COMPLETED",
      deliverablePhase: "PROFILE",
      documentsNeeded: true,
    });
    expect(step?.title).toMatch(/documents/i);
    expect(step?.href).toBe("/advisor/pipeline/c1");
  });

  it("links in-progress assessments to answer review when an id is present", () => {
    const step = resolveAdvisorAssessmentNextStep({
      clientId: "c1",
      assessmentId: "asmt-1",
      assessmentStatus: "IN_PROGRESS",
      deliverablePhase: "PREVIEW",
    });
    expect(step?.href).toBe("/advisor/pipeline/c1/assessment/asmt-1");
    expect(step?.ctaLabel).toMatch(/in-progress/i);
  });

  it("returns null when there is no assessment", () => {
    expect(
      resolveAdvisorAssessmentNextStep({
        clientId: "c1",
        assessmentStatus: null,
        deliverablePhase: null,
      }),
    ).toBeNull();
  });
});
