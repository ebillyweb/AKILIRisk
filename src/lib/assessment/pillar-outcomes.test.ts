import { describe, it, expect } from "vitest";
import {
  normalizeScoreRiskLevel,
  pillarNarrativeRecommendations,
} from "./pillar-outcomes";
import { GOVERNANCE_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS } from "./pillar-outcome-expectations";
import {
  buildAllNoVisiblePillarAnswers,
  buildHighestMaturityAnswers,
  scorePillar,
} from "./engines/recommendation-test-helpers";

describe("normalizeScoreRiskLevel", () => {
  it("maps Prisma enum strings to scoring risk levels", () => {
    expect(normalizeScoreRiskLevel("CRITICAL")).toBe("critical");
    expect(normalizeScoreRiskLevel("LOW")).toBe("low");
  });
});

describe("pillarNarrativeRecommendations — mixed maturity", () => {
  it("returns no narratives when answers are not uniformly lowest or highest", () => {
    const { answers, visibleIds, questions } = buildAllNoVisiblePillarAnswers("governance");
    const highest = buildHighestMaturityAnswers(questions, visibleIds);
    const mixed = { ...answers, [visibleIds[0]]: highest[visibleIds[0]] };
    const score = scorePillar("governance", mixed, visibleIds, questions);

    const narratives = pillarNarrativeRecommendations(
      "governance",
      score,
      mixed,
      questions
    );

    expect(narratives).toEqual([]);
    expect(score.riskLevel).not.toBe("low");
  });

  it("returns all-negative governance narrative when risk is CRITICAL (Prisma casing)", () => {
    const { answers, visibleIds, questions } = buildAllNoVisiblePillarAnswers("governance");
    const score = scorePillar("governance", answers, visibleIds, questions);

    const narratives = pillarNarrativeRecommendations(
      "governance",
      { ...score, riskLevel: "CRITICAL" },
      answers,
      questions
    );

    expect(narratives).toEqual([...GOVERNANCE_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS]);
  });
});
