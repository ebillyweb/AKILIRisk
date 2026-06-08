import { describe, expect, it } from "vitest";
import {
  evaluateClientAssessmentSummaryAccess,
  isAssessmentSummaryUnlockedFromStatus,
} from "@/lib/client/assessment-summary-gate";
import { ASSESSMENT_PILLAR_IDS } from "@/lib/assessment/pillar-registry";

function allPillarScores() {
  return ASSESSMENT_PILLAR_IDS.map((pillar) => ({ pillar }));
}

describe("evaluateClientAssessmentSummaryAccess", () => {
  it("denies summary when pillars are incomplete", () => {
    const result = evaluateClientAssessmentSummaryAccess({
      pillarScores: [{ pillar: "governance" }],
      deliverablePhase: "PROFILE",
    });

    expect(result.allPillarsComplete).toBe(false);
    expect(result.canViewRiskPreview).toBe(false);
    expect(result.canViewSummary).toBe(false);
  });

  it("allows risk preview but not full summary when all pillars scored in PREVIEW", () => {
    const result = evaluateClientAssessmentSummaryAccess({
      pillarScores: allPillarScores(),
      deliverablePhase: "PREVIEW",
    });

    expect(result.allPillarsComplete).toBe(true);
    expect(result.advisorPublishedProfile).toBe(false);
    expect(result.canViewRiskPreview).toBe(true);
    expect(result.canViewSummary).toBe(false);
  });

  it("allows summary when all pillars scored and profile published", () => {
    const result = evaluateClientAssessmentSummaryAccess({
      pillarScores: allPillarScores(),
      deliverablePhase: "PROFILE",
    });

    expect(result.canViewSummary).toBe(true);
  });

  it("allows summary in PORTFOLIO phase", () => {
    const result = evaluateClientAssessmentSummaryAccess({
      pillarScores: allPillarScores(),
      deliverablePhase: "PORTFOLIO",
    });

    expect(result.canViewSummary).toBe(true);
  });
});

describe("isAssessmentSummaryUnlockedFromStatus", () => {
  it("requires COMPLETED status and PROFILE phase", () => {
    expect(
      isAssessmentSummaryUnlockedFromStatus({
        status: "COMPLETED",
        deliverablePhase: "PROFILE",
      }),
    ).toBe(true);
    expect(
      isAssessmentSummaryUnlockedFromStatus({
        status: "COMPLETED",
        deliverablePhase: "PREVIEW",
      }),
    ).toBe(false);
    expect(
      isAssessmentSummaryUnlockedFromStatus({
        status: "IN_PROGRESS",
        deliverablePhase: "PROFILE",
      }),
    ).toBe(false);
  });
});
