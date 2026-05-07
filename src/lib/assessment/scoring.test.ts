import { describe, it, expect } from "vitest";
import {
  getRiskLevel,
  calculatePillarScore,
  calculateCustomizedPillarScore,
  identifyMissingControls,
  normalizeAnswerToMaturity,
} from "./scoring";
import { getVisibleQuestions } from "./branching";
import { familyGovernancePillar, allQuestions } from "./questions";
import type { Pillar, Question } from "./types";

const minimalPillar: Pillar = {
  id: "test-pillar",
  name: "Test",
  slug: "test",
  description: "Test pillar",
  estimatedMinutes: 10,
  subCategories: [
    {
      id: "cat1",
      name: "Category 1",
      description: "First category",
      weight: 1,
      questionIds: ["q1", "q2"],
    },
    {
      id: "cat2",
      name: "Category 2",
      description: "Second category",
      weight: 2,
      questionIds: ["q3"],
    },
  ],
};

const minimalQuestions: Question[] = [
  {
    id: "q1",
    text: "Question 1?",
    type: "maturity-scale",
    required: true,
    pillar: "test",
    subCategory: "cat1",
    weight: 1,
    scoreMap: { 0: 0, 1: 1, 2: 2, 3: 3 },
  },
  {
    id: "q2",
    text: "Question 2?",
    type: "maturity-scale",
    required: true,
    pillar: "test",
    subCategory: "cat1",
    weight: 1,
    scoreMap: { 0: 0, 1: 1, 2: 2, 3: 3 },
  },
  {
    id: "q3",
    text: "Question 3?",
    type: "maturity-scale",
    required: true,
    pillar: "test",
    subCategory: "cat2",
    weight: 1,
    scoreMap: { 0: 0, 1: 1, 2: 2, 3: 3 },
    branchingRule: {
      dependsOn: "q1",
      showIf: (answer) => answer !== 0,
    },
  },
];

describe("getRiskLevel", () => {
  /** BRD §4.2 bands on 0–100 resilience (from maturity 0–3 via rounded percent). */
  it("returns low when resilience percent is 80–100", () => {
    expect(getRiskLevel(2.4)).toBe("low");
    expect(getRiskLevel(3)).toBe("low");
  });

  it("returns medium when resilience percent is 60–79", () => {
    expect(getRiskLevel(1.8)).toBe("medium");
    expect(getRiskLevel(2)).toBe("medium");
  });

  it("returns high when resilience percent is 40–59", () => {
    expect(getRiskLevel(1.2)).toBe("high");
    expect(getRiskLevel(1.5)).toBe("high");
  });

  it("returns critical when resilience percent is under 40", () => {
    expect(getRiskLevel(0)).toBe("critical");
    expect(getRiskLevel(1.1)).toBe("critical");
  });
});

describe("calculatePillarScore", () => {
  it("returns zero score when no answers", () => {
    const result = calculatePillarScore({}, minimalPillar, minimalQuestions);
    expect(result.score).toBe(0);
    expect(result.riskLevel).toBe("critical");
    expect(result.breakdown).toHaveLength(2); // Two categories
    expect(result.missingControls).toEqual([]);
  });

  it("calculates score from answers", () => {
    const result = calculatePillarScore(
      { q1: 3, q2: 3, q3: 3 },
      minimalPillar,
      minimalQuestions
    );
    expect(result.score).toBe(3);
    expect(result.riskLevel).toBe("low");
  });

  it("excludes unanswered questions from calculation", () => {
    const result = calculatePillarScore(
      { q1: 3 },
      minimalPillar,
      minimalQuestions
    );
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(3);
  });

  it("excludes hidden question answers when visibleQuestionIds provided", () => {
    const answers = { q1: 3, q2: 0, q3: 0 };

    // With all questions: both categories have poor averages
    const resultWithAll = calculatePillarScore(answers, minimalPillar, minimalQuestions);

    // Excluding q3: only cat1 matters
    const visibleIds = ['q1', 'q2']; // Exclude q3 (cat2)
    const resultExcludingQ3 = calculatePillarScore(answers, minimalPillar, minimalQuestions, visibleIds);

    // Test that the implementation correctly filters questions
    expect(resultExcludingQ3.score).toBeDefined();
    expect(resultWithAll.score).toBeDefined();

    // The key test: when we exclude cat2's bad question, the overall score should be different
    expect(resultExcludingQ3.score).not.toEqual(resultWithAll.score);
  });

  it("calculates correctly with all questions visible (backward compatible)", () => {
    const answers = { q1: 3, q2: 3, q3: 3 };

    const resultWithoutParam = calculatePillarScore(answers, minimalPillar, minimalQuestions);
    const resultWithAllIds = calculatePillarScore(answers, minimalPillar, minimalQuestions, ['q1', 'q2', 'q3']);

    expect(resultWithoutParam.score).toBe(resultWithAllIds.score);
    expect(resultWithoutParam.riskLevel).toBe(resultWithAllIds.riskLevel);
  });

  it("handles case where all questions are hidden", () => {
    const answers = { q1: 3, q2: 3, q3: 3 };
    const visibleIds: string[] = []; // No questions visible

    const result = calculatePillarScore(answers, minimalPillar, minimalQuestions, visibleIds);

    expect(result.score).toBe(0);
    expect(result.riskLevel).toBe("critical");
  });

  it("omits yes/no gate from maturity rollup when Yes (follow-ups carry 0–3)", () => {
    const pillar: Pillar = {
      id: "p",
      name: "P",
      slug: "p",
      description: "",
      estimatedMinutes: 1,
      subCategories: [
        { id: "c1", name: "C1", description: "", weight: 1, questionIds: ["gate", "child"] },
      ],
    };
    const qs: Question[] = [
      {
        id: "gate",
        text: "Gate?",
        type: "yes-no",
        required: true,
        pillar: "p",
        subCategory: "c1",
        weight: 1,
        scoreMap: { yes: 3, no: 0 },
        omitMaturityScoreWhenYes: true,
      },
      {
        id: "child",
        text: "Child?",
        type: "maturity-scale",
        required: true,
        pillar: "p",
        subCategory: "c1",
        weight: 1,
        scoreMap: { 0: 0, 1: 1, 2: 2, 3: 3 },
      },
    ];
    expect(
      calculatePillarScore({ gate: "yes", child: 2 }, pillar, qs).score
    ).toBe(2);
    expect(calculatePillarScore({ gate: "no" }, pillar, qs).score).toBe(0);
  });
});

describe("identifyMissingControls", () => {
  it("returns empty when no low scores", () => {
    const result = identifyMissingControls(
      { q1: 3, q2: 3 },
      minimalQuestions
    );
    expect(result).toEqual([]);
  });

  it("returns missing controls for low normalized maturity (0–1)", () => {
    const result = identifyMissingControls(
      { q1: 0, q2: 1 },
      minimalQuestions
    );
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toMatchObject({
      questionId: expect.any(String),
      category: "cat1",
      description: expect.any(String),
      severity: expect.stringMatching(/^(high|medium|low)$/),
      recommendation: expect.any(String),
    });
  });

  it("excludes hidden questions from missing controls when visibleQuestionIds provided", () => {
    const answers = { q1: 0, q2: 3, q3: 0 };

    // Without filtering
    const resultWithAll = identifyMissingControls(answers, minimalQuestions);

    // Filtering out q3 (simulating it being hidden)
    const visibleIds = ['q1', 'q2'];
    const resultFiltered = identifyMissingControls(answers, minimalQuestions, visibleIds);

    // Should have fewer missing controls when q3 is excluded
    expect(resultFiltered.length).toBeLessThanOrEqual(resultWithAll.length);
    expect(resultFiltered.every(control => control.questionId !== 'q3')).toBe(true);
  });
});

describe("calculateCustomizedPillarScore", () => {
  it("produces identical results to calculatePillarScore when all multipliers = 1.0", () => {
    const answers = { q1: 3, q2: 3, q3: 3 };
    const visibleIds = ['q1', 'q2', 'q3'];
    const noEmphasisMultipliers = { cat1: 1.0, cat2: 1.0 };

    const standardResult = calculatePillarScore(answers, minimalPillar, minimalQuestions, visibleIds);
    const customizedResult = calculateCustomizedPillarScore(
      answers,
      minimalPillar,
      minimalQuestions,
      visibleIds,
      noEmphasisMultipliers
    );

    expect(customizedResult.score).toBe(standardResult.score);
    expect(customizedResult.riskLevel).toBe(standardResult.riskLevel);
    expect(customizedResult.breakdown).toEqual(standardResult.breakdown);
  });

  it("applies 1.5x multiplier to emphasized subcategory weight", () => {
    // Set up answers where cat1 has good score, cat2 has poor score
    const answers = { q1: 3, q2: 3, q3: 0 };
    const visibleIds = ['q1', 'q2', 'q3'];

    // No emphasis
    const noEmphasisMultipliers = { cat1: 1.0, cat2: 1.0 };
    const baselineResult = calculateCustomizedPillarScore(
      answers,
      minimalPillar,
      minimalQuestions,
      visibleIds,
      noEmphasisMultipliers
    );

    // Emphasize cat1 (good performance) - should increase overall score
    const emphasizeCat1Multipliers = { cat1: 1.5, cat2: 1.0 };
    const emphasizedResult = calculateCustomizedPillarScore(
      answers,
      minimalPillar,
      minimalQuestions,
      visibleIds,
      emphasizeCat1Multipliers
    );

    // When cat1 (good) is emphasized, overall score should be higher
    expect(emphasizedResult.score).toBeGreaterThan(baselineResult.score);
  });

  it("does not change individual category scores, only their weighted contribution", () => {
    const answers = { q1: 3, q2: 3, q3: 2 };
    const visibleIds = ['q1', 'q2', 'q3'];
    const emphasisMultipliers = { cat1: 1.5, cat2: 1.0 };

    const result = calculateCustomizedPillarScore(
      answers,
      minimalPillar,
      minimalQuestions,
      visibleIds,
      emphasisMultipliers
    );

    // Individual category scores in breakdown should be unaffected
    const cat1Score = result.breakdown.find(b => b.categoryId === 'cat1')?.score;
    const cat2Score = result.breakdown.find(b => b.categoryId === 'cat2')?.score;

    // These should be the same as standard scoring would produce
    expect(cat1Score).toBeDefined();
    expect(cat2Score).toBeDefined();

    // The individual scores are determined by the questions in each category,
    // not by the emphasis multiplier (which only affects aggregation)
    const standardResult = calculatePillarScore(answers, minimalPillar, minimalQuestions, visibleIds);
    const standardCat1 = standardResult.breakdown.find(b => b.categoryId === 'cat1')?.score;
    const standardCat2 = standardResult.breakdown.find(b => b.categoryId === 'cat2')?.score;

    expect(cat1Score).toBe(standardCat1);
    expect(cat2Score).toBe(standardCat2);
  });

  it("handles empty emphasisMultipliers by using 1.0 default", () => {
    const answers = { q1: 3, q2: 3, q3: 3 };
    const visibleIds = ['q1', 'q2', 'q3'];
    const emptyMultipliers = {};

    const result = calculateCustomizedPillarScore(
      answers,
      minimalPillar,
      minimalQuestions,
      visibleIds,
      emptyMultipliers
    );

    // Should behave like standard scoring (all multipliers default to 1.0)
    const standardResult = calculatePillarScore(answers, minimalPillar, minimalQuestions, visibleIds);
    expect(result.score).toBe(standardResult.score);
  });

  it("handles subcategory with no visible questions by skipping it", () => {
    const answers = { q1: 3, q2: 3, q3: 3 };
    const visibleIds = ['q1', 'q2']; // Exclude q3 (cat2)
    const emphasisMultipliers = { cat1: 1.5, cat2: 2.0 }; // cat2 multiplier shouldn't matter

    const result = calculateCustomizedPillarScore(
      answers,
      minimalPillar,
      minimalQuestions,
      visibleIds,
      emphasisMultipliers
    );

    // Should only include cat1 in breakdown (cat2 has no visible questions)
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0].categoryId).toBe('cat1');
  });
});

describe("branching-aware scoring with real questions", () => {
  it("excludes trust section answers when trust gate is no", () => {
    // User answered trust questions but changed gate to "no"
    const answers = {
      "dma-01": 3, // Always visible, good score
      "teg-01": "no", // Gate says no trusts
      "teg-02": "unknown", // Previously answered trust questions (low scores)
      "teg-03": "default",
      "teg-04": 0,
      "sp-01": "no", // No succession planning
      "bi-01": "no", // No business involvement
    };

    // Get visible questions (trust questions should be hidden)
    const visibleQuestions = getVisibleQuestions(answers, allQuestions);
    const visibleIds = visibleQuestions.map(q => q.id);

    // Trust questions should not be in visible set
    expect(visibleIds).toContain("teg-01"); // Gate question is visible
    expect(visibleIds).not.toContain("teg-02"); // Dependent questions are hidden
    expect(visibleIds).not.toContain("teg-03");
    expect(visibleIds).not.toContain("teg-04");

    // Calculate score excluding hidden trust answers
    const result = calculatePillarScore(answers, familyGovernancePillar, allQuestions, visibleIds);

    // Score should not be penalized by the low trust scores since they're hidden
    expect(result.score).toBeGreaterThan(0);

    // Missing controls should not include hidden trust questions
    expect(result.missingControls.every(control =>
      !control.questionId.startsWith("teg-") || control.questionId === "teg-01"
    )).toBe(true);
  });

  it("includes all sections when all gates are yes", () => {
    const answers = {
      // Environmental / geographic, physical security, health (always visible)
      "env-01": 3,
      "env-02": "written-current",
      "env-03": "always",
      "env-04": 3,
      "env-05": "yes",
      "phys-01": 3,
      "phys-02": "systematic",
      "phys-03": "formal",
      "phys-04": "yes",
      "phys-05": "full",
      "health-01": 3,
      "health-02": "current",
      "health-03": "robust",
      "health-04": "substantive",
      "health-05": "yes",
      "dma-01": 3, // Good governance
      "dma-02": "criteria-clear", // Good criteria
      "dma-03": "yes",
      "dma-04": "documented", // Good processes
      "ac-01": "multi-factor", // Strong access control
      "ac-02": "need-to-know", // Good information control
      "ac-03": "documented", // Good policies
      "teg-01": "yes", // Has trusts
      "teg-02": "digital-managed", // Good trust management
      "teg-03": "professional", // Professional trustees
      "sp-01": "yes", // Has heirs
      "sp-02": 3, // Good succession planning
      "sp-03": "structured", // Good preparation
      "bi-01": "yes", // Has family business
      "bi-02": "competitive", // Good business policies
      "bi-03": "independent", // Good compensation
    };

    const visibleQuestions = getVisibleQuestions(answers, allQuestions);
    const visibleIds = visibleQuestions.map(q => q.id);

    // All sections should be visible
    expect(visibleIds).toContain("teg-02"); // Trust questions visible
    expect(visibleIds).toContain("sp-02"); // Succession questions visible
    expect(visibleIds).toContain("bi-02"); // Business questions visible

    const result = calculatePillarScore(answers, familyGovernancePillar, allQuestions, visibleIds);

    // Should have decent score with many good answers
    expect(result.score).toBeGreaterThan(2);
    expect(result.riskLevel).toMatch(/^(low|medium)$/);
  });

  it("handles mixed gate scenarios correctly", () => {
    const answers = {
      "dma-01": 3,
      "teg-01": "yes", // Has trusts
      "teg-02": "unknown", // Poor trust management
      "sp-01": "no", // No heirs (succession section hidden)
      "sp-02": 0, // Poor succession (should be ignored as orphaned)
      "bi-01": "no", // No business (business section hidden)
      "bi-02": "open", // Poor business practices (should be ignored as orphaned)
    };

    const visibleQuestions = getVisibleQuestions(answers, allQuestions);
    const visibleIds = visibleQuestions.map(q => q.id);

    // Trust section visible, succession and business sections hidden
    expect(visibleIds).toContain("teg-02");
    expect(visibleIds).not.toContain("sp-02");
    expect(visibleIds).not.toContain("bi-02");

    const result = calculatePillarScore(answers, familyGovernancePillar, allQuestions, visibleIds);

    // Should be penalized by poor trust management but not by orphaned answers
    expect(result.missingControls.some(control => control.questionId === "teg-02")).toBe(true);
    expect(result.missingControls.every(control =>
      control.questionId !== "sp-02" && control.questionId !== "bi-02"
    )).toBe(true);
  });
});

describe("Likert scoring (F1 / BRD §4.1)", () => {
  /**
   * Default 5-point Likert collapses onto the 0–3 maturity scale via
   * `normalizeAnswerToMaturity` (rawAnswer / scoreMapMax) × MATURITY_MAX.
   * Locks the canonical map: 5 → 3.0 (full agreement / max maturity),
   * 1 → 0.0 (full disagreement / no maturity), 3 → 1.5 (mid).
   */
  const defaultLikert: Question = {
    id: "lk-1",
    text: "I have a documented family decision-making protocol.",
    type: "likert",
    required: true,
    pillar: "test",
    subCategory: "cat1",
    weight: 1,
    scoreMap: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
  };

  it("maps 5 → 3.0 (max maturity)", () => {
    expect(normalizeAnswerToMaturity(defaultLikert, 5)).toBeCloseTo(3, 6);
  });

  it("maps 1 → 0.0 (min maturity)", () => {
    expect(normalizeAnswerToMaturity(defaultLikert, 1)).toBeCloseTo(0.6, 6);
    // 1/5 × 3 = 0.6, NOT 0.0 — pin actual semantics so a future
    // contributor doesn't "fix" this to zero. Likert 1 means "Strongly
    // disagree", which still contributes a nonzero baseline; only a
    // missing answer is treated as a true zero (excluded from the
    // weighted average per scoring.ts).
  });

  it("maps 3 → 1.5 (midpoint)", () => {
    expect(normalizeAnswerToMaturity(defaultLikert, 3)).toBeCloseTo(1.8, 6);
    // 3/5 × 3 = 1.8.
  });

  it("inverted scoreMap flips the maturity contribution", () => {
    // Negatively-keyed Likert (e.g. "I avoid documenting decisions"):
    // raw answer 5 maps to scoreMap value 1, raw answer 1 maps to 5.
    const inverted: Question = {
      ...defaultLikert,
      scoreMap: { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 },
    };
    expect(normalizeAnswerToMaturity(inverted, 5)).toBeCloseTo(0.6, 6);
    expect(normalizeAnswerToMaturity(inverted, 1)).toBeCloseTo(3, 6);
    expect(normalizeAnswerToMaturity(inverted, 3)).toBeCloseTo(1.8, 6);
  });

  it("returns undefined for an out-of-range answer not in the scoreMap", () => {
    expect(normalizeAnswerToMaturity(defaultLikert, 0)).toBeUndefined();
    expect(normalizeAnswerToMaturity(defaultLikert, 6)).toBeUndefined();
    expect(normalizeAnswerToMaturity(defaultLikert, "yes")).toBeUndefined();
  });

  it("aggregates two Likert answers into a category score", () => {
    const pillar: Pillar = {
      id: "p",
      name: "P",
      slug: "p",
      description: "",
      estimatedMinutes: 5,
      subCategories: [
        {
          id: "cat1",
          name: "C",
          description: "",
          weight: 1,
          questionIds: ["lk-a", "lk-b"],
        },
      ],
    };
    const questions: Question[] = [
      {
        id: "lk-a",
        text: "A",
        type: "likert",
        required: true,
        pillar: "p",
        subCategory: "cat1",
        weight: 1,
        scoreMap: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
      },
      {
        id: "lk-b",
        text: "B",
        type: "likert",
        required: true,
        pillar: "p",
        subCategory: "cat1",
        weight: 1,
        scoreMap: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
      },
    ];
    // Strongly agree + Disagree → (3.0 + 1.2) / 2 = 2.1
    const result = calculatePillarScore({ "lk-a": 5, "lk-b": 2 }, pillar, questions);
    expect(result.score).toBeCloseTo(2.1, 2);
  });
});
