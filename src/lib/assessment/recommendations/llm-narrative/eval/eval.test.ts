import { describe, it, expect } from "vitest";
import type { NarrativeOutput } from "../shape-a-prompt";
import { GOLDEN_CASES } from "./golden-set";
import {
  evaluateNarrative,
  scoreDeterministic,
  type JudgeScores,
  type NarrativeJudge,
} from "./rubric";
import { runEval, formatScorecard } from "./run-eval";

const aiCase = GOLDEN_CASES.find((c) => c.id === "ai-critical-two-services")!;

const highJudge: NarrativeJudge = async () =>
  ({
    scores: { faithfulness: 5, specificity: 5, tone: 5, actionability: 4 },
    reasons: {},
  }) as JudgeScores;

const lowJudge: NarrativeJudge = async () =>
  ({
    scores: { faithfulness: 2, specificity: 1, tone: 3, actionability: 2 },
    reasons: {},
  }) as JudgeScores;

describe("deterministic scoring", () => {
  it("rewards a grounded, specific reference output", () => {
    const d = scoreDeterministic(aiCase.input, aiCase.referenceGood);
    expect(d.grounded).toBe(true);
    expect(d.coverage).toBe(1);
    expect(d.structureOk).toBe(true);
    expect(d.specificity).toBe(1); // both rationales echo their cited findings
  });

  it("drops specificity for generic rationales that ignore the findings", () => {
    const generic: NarrativeOutput = {
      ...aiCase.referenceGood,
      recommendations: aiCase.referenceGood.recommendations.map((r) => ({
        ...r,
        rationale: "This is a prudent measure that many families choose to adopt over time.",
      })),
    };
    const d = scoreDeterministic(aiCase.input, generic);
    expect(d.grounded).toBe(true); // still cites real findings + covers services
    expect(d.specificity).toBe(0); // but the prose echoes nothing specific
  });
});

describe("evaluateNarrative", () => {
  it("passes a strong reference output (deterministic only)", async () => {
    const res = await evaluateNarrative(aiCase.input, aiCase.referenceGood);
    expect(res.passedHardGate).toBe(true);
    expect(res.verdict).toBe("pass");
    expect(res.score).toBeGreaterThanOrEqual(75);
  });

  it("fails the hard gate on a hallucinated service id", async () => {
    const bad: NarrativeOutput = {
      ...aiCase.referenceGood,
      recommendations: [
        { ...aiCase.referenceGood.recommendations[0], serviceId: "ai_made_up" },
        aiCase.referenceGood.recommendations[1],
      ],
    };
    const res = await evaluateNarrative(aiCase.input, bad);
    expect(res.passedHardGate).toBe(false);
    expect(res.verdict).toBe("fail");
    expect(res.reasons.some((r) => r.includes("Hallucinated serviceId"))).toBe(true);
  });

  it("fails the hard gate when a selected service is uncovered", async () => {
    const bad: NarrativeOutput = {
      ...aiCase.referenceGood,
      recommendations: [aiCase.referenceGood.recommendations[0]],
    };
    const res = await evaluateNarrative(aiCase.input, bad);
    expect(res.deterministic.coverage).toBeLessThan(1);
    expect(res.passedHardGate).toBe(false);
    expect(res.verdict).toBe("fail");
  });

  it("folds a judge into the score", async () => {
    const withHigh = await evaluateNarrative(aiCase.input, aiCase.referenceGood, { judge: highJudge });
    const withLow = await evaluateNarrative(aiCase.input, aiCase.referenceGood, { judge: lowJudge });
    expect(withHigh.judge).toBeDefined();
    expect(withHigh.score).toBeGreaterThan(withLow.score);
    // A grounded output with a scathing judge drops to warn/fail, not pass.
    expect(withLow.verdict).not.toBe("pass");
  });
});

describe("runEval over the golden set", () => {
  it("scores every reference output as a pass and aggregates", async () => {
    const { results, summary } = await runEval({
      cases: GOLDEN_CASES.map((c) => ({ id: c.id, input: c.input })),
      generate: async (input) => GOLDEN_CASES.find((c) => c.input === input)!.referenceGood,
    });
    expect(summary.total).toBe(GOLDEN_CASES.length);
    expect(summary.pass).toBe(GOLDEN_CASES.length);
    expect(summary.hardGateFailures).toBe(0);
    expect(summary.avgCoverage).toBe(1);
    expect(formatScorecard(results, summary)).toContain("pass");
  });

  it("counts a throwing generator as errored, not a crash", async () => {
    const { summary } = await runEval({
      cases: [{ id: "boom", input: aiCase.input }],
      generate: async () => {
        throw new Error("model timeout");
      },
    });
    expect(summary.errored).toBe(1);
    expect(summary.pass).toBe(0);
  });
});
