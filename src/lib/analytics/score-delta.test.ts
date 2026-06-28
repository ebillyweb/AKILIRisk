/**
 * Tests for score delta computation (pure function).
 *
 * Coverage:
 *   - Improved, regressed, and unchanged pillar directions
 *   - New pillar (exists in current but not previous)
 *   - Attribution from completed recommendations
 *   - "No new planning activity" attribution for inactive pillars (D-06)
 *   - Delta rounding to 2 decimal places
 *   - Direction threshold boundary (0.01)
 */

import { describe, it, expect } from "vitest";
import { computePillarDeltas, type PillarScoreRow } from "./score-delta";

const makeScore = (
  pillar: string,
  score: number,
  riskLevel = "medium",
): PillarScoreRow => ({
  pillar,
  score,
  riskLevel,
});

describe("computePillarDeltas", () => {
  it("returns improved direction when score increases", () => {
    const previous = [makeScore("governance", 5.0, "medium")];
    const current = [makeScore("governance", 7.5, "low")];

    const deltas = computePillarDeltas(previous, current, []);

    expect(deltas).toHaveLength(1);
    expect(deltas[0].direction).toBe("improved");
    expect(deltas[0].delta).toBe(2.5);
    expect(deltas[0].previousScore).toBe(5.0);
    expect(deltas[0].currentScore).toBe(7.5);
    expect(deltas[0].previousRiskLevel).toBe("medium");
    expect(deltas[0].currentRiskLevel).toBe("low");
  });

  it("returns regressed direction when score decreases", () => {
    const previous = [makeScore("cyber-digital", 8.0, "low")];
    const current = [makeScore("cyber-digital", 6.0, "medium")];

    const deltas = computePillarDeltas(previous, current, []);

    expect(deltas[0].direction).toBe("regressed");
    expect(deltas[0].delta).toBe(-2.0);
  });

  it("returns unchanged direction when delta is within threshold", () => {
    const previous = [makeScore("insurance", 7.0)];
    const current = [makeScore("insurance", 7.005)];

    const deltas = computePillarDeltas(previous, current, []);

    expect(deltas[0].direction).toBe("unchanged");
    // 7.005 - 7.0 rounds to 0.01 or 0 depending on floating point;
    // what matters is direction is "unchanged" (delta <= 0.01).
    expect(Math.abs(deltas[0].delta)).toBeLessThanOrEqual(0.01);
  });

  it("handles new pillar (exists in current but not previous)", () => {
    const previous: PillarScoreRow[] = [];
    const current = [makeScore("estate-succession", 6.5, "medium")];

    const deltas = computePillarDeltas(previous, current, []);

    expect(deltas[0].direction).toBe("improved");
    expect(deltas[0].previousScore).toBe(0);
    expect(deltas[0].currentScore).toBe(6.5);
    expect(deltas[0].previousRiskLevel).toBe("unknown");
    expect(deltas[0].delta).toBe(6.5);
  });

  it("attributes completed recommendations to correct pillar", () => {
    const previous = [makeScore("governance", 5.0)];
    const current = [makeScore("governance", 8.0)];
    const recs = [
      { pillar: "governance", name: "Governance Charter" },
      { pillar: "governance", name: "Family Council" },
    ];

    const deltas = computePillarDeltas(previous, current, recs);

    expect(deltas[0].attribution).toEqual([
      "Governance Charter",
      "Family Council",
    ]);
  });

  it("shows 'No new planning activity' for pillars without completed recommendations (D-06)", () => {
    const previous = [makeScore("insurance", 7.0)];
    const current = [makeScore("insurance", 7.0)];

    const deltas = computePillarDeltas(previous, current, []);

    expect(deltas[0].attribution).toEqual(["No new planning activity"]);
  });

  it("rounds delta to 2 decimal places", () => {
    const previous = [makeScore("governance", 3.333)];
    const current = [makeScore("governance", 5.777)];

    const deltas = computePillarDeltas(previous, current, []);

    expect(deltas[0].delta).toBe(2.44); // 5.777 - 3.333 = 2.444 -> 2.44
  });

  it("treats delta of exactly 0.01 as unchanged (boundary)", () => {
    const previous = [makeScore("governance", 5.0)];
    const current = [makeScore("governance", 5.01)];

    const deltas = computePillarDeltas(previous, current, []);

    expect(deltas[0].direction).toBe("unchanged");
    expect(deltas[0].delta).toBe(0.01);
  });

  it("treats delta just above 0.01 as improved", () => {
    const previous = [makeScore("governance", 5.0)];
    const current = [makeScore("governance", 5.02)];

    const deltas = computePillarDeltas(previous, current, []);

    expect(deltas[0].direction).toBe("improved");
    expect(deltas[0].delta).toBe(0.02);
  });

  it("handles multiple pillars correctly", () => {
    const previous = [
      makeScore("governance", 5.0, "medium"),
      makeScore("cyber-digital", 8.0, "low"),
    ];
    const current = [
      makeScore("governance", 7.0, "low"),
      makeScore("cyber-digital", 6.0, "medium"),
      makeScore("estate-succession", 4.0, "high"),
    ];
    const recs = [
      { pillar: "governance", name: "Governance Charter" },
    ];

    const deltas = computePillarDeltas(previous, current, recs);

    expect(deltas).toHaveLength(3);
    expect(deltas[0].pillar).toBe("governance");
    expect(deltas[0].direction).toBe("improved");
    expect(deltas[0].attribution).toEqual(["Governance Charter"]);

    expect(deltas[1].pillar).toBe("cyber-digital");
    expect(deltas[1].direction).toBe("regressed");
    expect(deltas[1].attribution).toEqual(["No new planning activity"]);

    expect(deltas[2].pillar).toBe("estate-succession");
    expect(deltas[2].direction).toBe("improved");
    expect(deltas[2].previousScore).toBe(0);
  });
});
