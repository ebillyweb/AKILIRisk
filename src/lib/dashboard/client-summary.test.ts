/**
 * §4.3 close-out (BRD) — client-summary helper tests.
 *
 * Coverage:
 *   • resolveOverallRisk: returns null when no scored pillar; populates
 *     palette when scored.
 *   • resolveTopRisks: sort order (severity DESC, score ASC tiebreaker,
 *     pillarId final fallback); excludes unassessed; respects limit;
 *     handles empty input gracefully; ignores unknown pillar ids.
 */

import { describe, it, expect } from "vitest";
import {
  resolveOverallRisk,
  resolveTopRisks,
} from "./client-summary";

describe("resolveOverallRisk", () => {
  it("returns null when no score yet", () => {
    expect(resolveOverallRisk({ score: null, riskLevel: null })).toBeNull();
  });

  it("returns null when score is set but riskLevel is missing", () => {
    expect(resolveOverallRisk({ score: 6.5, riskLevel: null })).toBeNull();
  });

  it("returns the score + riskLevel + palette when scored", () => {
    const result = resolveOverallRisk({ score: 6.5, riskLevel: "MEDIUM" });
    expect(result).not.toBeNull();
    expect(result!.score).toBe(6.5);
    expect(result!.riskLevel).toBe("MEDIUM");
    // Palette resolution is delegated to paletteForRiskLevel; we just
    // confirm the field is populated.
    expect(result!.palette).toBeDefined();
    expect(result!.palette.label).toBeTruthy();
  });
});

describe("resolveTopRisks", () => {
  it("returns an empty array when no pillar scores exist", () => {
    expect(resolveTopRisks([])).toEqual([]);
  });

  it("excludes unassessed pillars (riskLevel null)", () => {
    const result = resolveTopRisks([
      { pillar: "governance", score: 7, riskLevel: "LOW" },
      { pillar: "cyber-digital", score: null, riskLevel: null },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].pillarId).toBe("governance");
  });

  it("excludes pillars whose score is null even if riskLevel is set", () => {
    // Defensive: this combination shouldn't happen in real data, but
    // the helper should drop the row rather than render NaN.
    const result = resolveTopRisks([
      { pillar: "governance", score: null, riskLevel: "LOW" },
    ]);
    expect(result).toEqual([]);
  });

  it("ignores pillar ids that aren't in RISK_AREAS", () => {
    const result = resolveTopRisks([
      { pillar: "made-up-pillar", score: 1, riskLevel: "CRITICAL" },
    ]);
    expect(result).toEqual([]);
  });

  it("sorts by severity DESC then score ASC then pillarId ASC", () => {
    const result = resolveTopRisks([
      { pillar: "governance", score: 7, riskLevel: "LOW" },
      { pillar: "cyber-digital", score: 3, riskLevel: "HIGH" },
      { pillar: "physical-security", score: 5, riskLevel: "HIGH" },
      { pillar: "insurance", score: 2, riskLevel: "CRITICAL" },
      { pillar: "geographic-environmental", score: 4, riskLevel: "MEDIUM" },
      { pillar: "reputational-social", score: 4, riskLevel: "MEDIUM" },
    ]);
    expect(result.map((r) => r.pillarId)).toEqual([
      "insurance",          // critical
      "cyber-digital",      // high, score 3
      "physical-security",  // high, score 5
    ]);
  });

  it("uses pillarId ASC as the final tiebreaker when severity AND score match", () => {
    const result = resolveTopRisks([
      { pillar: "reputational-social", score: 4, riskLevel: "MEDIUM" },
      { pillar: "geographic-environmental", score: 4, riskLevel: "MEDIUM" },
      { pillar: "insurance", score: 4, riskLevel: "MEDIUM" },
    ]);
    expect(result.map((r) => r.pillarId)).toEqual([
      "geographic-environmental",
      "insurance",
      "reputational-social",
    ]);
  });

  it("respects the limit parameter (default 3)", () => {
    const all = [
      { pillar: "governance", score: 1, riskLevel: "CRITICAL" },
      { pillar: "cyber-digital", score: 2, riskLevel: "HIGH" },
      { pillar: "physical-security", score: 3, riskLevel: "HIGH" },
      { pillar: "insurance", score: 4, riskLevel: "MEDIUM" },
      { pillar: "geographic-environmental", score: 5, riskLevel: "MEDIUM" },
      { pillar: "reputational-social", score: 6, riskLevel: "LOW" },
    ];
    expect(resolveTopRisks(all)).toHaveLength(3);
    expect(resolveTopRisks(all, 5)).toHaveLength(5);
    expect(resolveTopRisks(all, 1)).toHaveLength(1);
    expect(resolveTopRisks(all, 1)[0].pillarId).toBe("governance");
  });

  it("attaches summary text from RISK_AREAS for use in the mini-list", () => {
    const result = resolveTopRisks([
      { pillar: "cyber-digital", score: 3, riskLevel: "HIGH" },
    ]);
    expect(result[0].summary).toMatch(/Digital footprint/i);
  });
});
