import { describe, expect, it } from "vitest";
import { resolvePillarCardStatus } from "./pillar-card-status";

describe("resolvePillarCardStatus", () => {
  it("returns not-started when assessmentId is missing (does not invent completion)", () => {
    expect(
      resolvePillarCardStatus({
        pillarSlug: "tax-exposure",
        assessmentId: null,
        scoredPillarIds: new Set(["tax-exposure"]),
        hasAnswers: true,
      }),
    ).toBe("not-started");
  });

  it("marks completed only when the assessment is loaded and the pillar has a score", () => {
    expect(
      resolvePillarCardStatus({
        pillarSlug: "tax-exposure",
        assessmentId: "asm-1",
        scoredPillarIds: new Set(["tax-exposure"]),
        hasAnswers: false,
      }),
    ).toBe("completed");
  });

  it("returns in-progress when the assessment exists and answers are present", () => {
    expect(
      resolvePillarCardStatus({
        pillarSlug: "governance",
        assessmentId: "asm-1",
        scoredPillarIds: new Set(),
        hasAnswers: true,
      }),
    ).toBe("in-progress");
  });

  it("returns not-started when the assessment exists but has no answers or score", () => {
    expect(
      resolvePillarCardStatus({
        pillarSlug: "estate-succession",
        assessmentId: "asm-1",
        scoredPillarIds: new Set(),
        hasAnswers: false,
      }),
    ).toBe("not-started");
  });
});
