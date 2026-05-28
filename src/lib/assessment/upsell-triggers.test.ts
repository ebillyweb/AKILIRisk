import { describe, it, expect } from "vitest";

import {
  DEFAULT_UPSELL_TRIGGER_THRESHOLDS,
  evaluateUpsellTriggers,
  hasFiredUpsellTrigger,
} from "./upsell-triggers";

describe("evaluateUpsellTriggers", () => {
  it("returns no triggers when every signal is healthy", () => {
    const fired = evaluateUpsellTriggers({
      overallResilience: 85,
      pillarScores: {
        governance: { resilience: 80, riskLevel: "low" },
        "cyber-digital": { resilience: 75, riskLevel: "low" },
      },
      kriHits: [],
    });
    expect(fired).toEqual([]);
    expect(hasFiredUpsellTrigger(fired)).toBe(false);
  });

  it("fires score_threshold:overall when overall resilience is below the cutoff", () => {
    const fired = evaluateUpsellTriggers({
      overallResilience: 55,
      pillarScores: {
        governance: { resilience: 80, riskLevel: "low" },
      },
      kriHits: [],
    });
    expect(fired).toContain("score_threshold:overall");
  });

  it("fires per-pillar score_threshold and domain_flag for a critical pillar", () => {
    const fired = evaluateUpsellTriggers({
      pillarScores: {
        governance: { resilience: 80, riskLevel: "low" },
        "cyber-digital": { resilience: 25, riskLevel: "critical" },
      },
      kriHits: [],
    });
    expect(fired).toContain("score_threshold:cyber-digital");
    expect(fired).toContain("domain_flag:cyber-digital");
    expect(fired).not.toContain("domain_flag:governance");
  });

  it("fires kri:<questionId> for every KRI hit", () => {
    const fired = evaluateUpsellTriggers({
      pillarScores: { governance: { resilience: 80, riskLevel: "low" } },
      kriHits: ["q-1", "q-2"],
    });
    expect(fired).toContain("kri:q-1");
    expect(fired).toContain("kri:q-2");
  });

  it("returns a stable sorted list with no duplicates", () => {
    const fired = evaluateUpsellTriggers({
      pillarScores: {
        governance: { resilience: 20, riskLevel: "critical" },
        "cyber-digital": { resilience: 25, riskLevel: "critical" },
      },
      kriHits: ["q-a", "q-b"],
    });
    const sorted = [...fired].sort();
    expect(fired).toEqual(sorted);
    expect(new Set(fired).size).toBe(fired.length);
  });

  it("honours custom thresholds passed by the caller", () => {
    const strict = evaluateUpsellTriggers(
      {
        overallResilience: 70,
        pillarScores: { governance: { resilience: 70, riskLevel: "medium" } },
        kriHits: [],
      },
      { overallResilienceMax: 75, pillarResilienceMax: 75 }
    );
    expect(strict).toContain("score_threshold:overall");
    expect(strict).toContain("score_threshold:governance");

    const lenient = evaluateUpsellTriggers(
      {
        overallResilience: 70,
        pillarScores: { governance: { resilience: 70, riskLevel: "medium" } },
        kriHits: [],
      },
      DEFAULT_UPSELL_TRIGGER_THRESHOLDS
    );
    expect(lenient).toEqual([]);
  });
});

describe("hasFiredUpsellTrigger", () => {
  it("returns false for null, undefined, and empty arrays", () => {
    expect(hasFiredUpsellTrigger(null)).toBe(false);
    expect(hasFiredUpsellTrigger(undefined)).toBe(false);
    expect(hasFiredUpsellTrigger([])).toBe(false);
  });
  it("returns true when at least one trigger is present", () => {
    expect(hasFiredUpsellTrigger(["domain_flag:cyber-digital"])).toBe(true);
  });
});
