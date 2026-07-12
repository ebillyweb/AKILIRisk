import { describe, expect, it } from "vitest";
import {
  PLATFORM_PILLAR_COUNT,
  SAMPLE_PILLAR_SCORES,
  SAMPLE_PILLARS_IN_SCOPE,
} from "@/lib/marketing/sample-report-preview";
import { maturityScoreToPercent } from "@/lib/assessment/governance-rubric";

describe("sample report preview", () => {
  it("models all ten platform pillars with advisor scoping", () => {
    expect(PLATFORM_PILLAR_COUNT).toBe(10);
    expect(SAMPLE_PILLAR_SCORES).toHaveLength(10);
    expect(SAMPLE_PILLARS_IN_SCOPE.length).toBeGreaterThan(0);
    expect(SAMPLE_PILLARS_IN_SCOPE.length).toBeLessThan(PLATFORM_PILLAR_COUNT);
    expect(SAMPLE_PILLAR_SCORES.some((pillar) => !pillar.inScope)).toBe(true);
  });

  it("provides short labels and scores for the pillar radar preview", () => {
    const outOfScope = SAMPLE_PILLAR_SCORES.filter((pillar) => !pillar.inScope);
    expect(outOfScope.map((pillar) => pillar.shortName).sort()).toEqual([
      "AI Risk",
      "Geographic",
    ]);

    for (const pillar of SAMPLE_PILLARS_IN_SCOPE) {
      expect(pillar.shortName.length).toBeLessThanOrEqual(12);
      expect(maturityScoreToPercent(pillar.maturity)).toBeGreaterThan(0);
    }
  });
});
