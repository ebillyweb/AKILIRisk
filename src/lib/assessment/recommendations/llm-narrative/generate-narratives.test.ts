import { describe, it, expect, vi } from "vitest";
import { GOLDEN_CASES } from "./eval/golden-set";
import {
  runNarrativeGeneration,
  type NarrativeDeps,
  type PillarMeta,
  type RecommendationRow,
} from "./generate-narratives";
import type { NarrativeInput, NarrativeOutput, WeakFinding } from "./shape-a-prompt";

const aiCase = GOLDEN_CASES.find((c) => c.id === "ai-critical-two-services")!;

// Two AI services under the ai-emerging-tech pillar, matching the golden case.
const recommendations: RecommendationRow[] = [
  { recId: "rec-1", serviceId: "ai_impersonation_defense", name: "AI Impersonation & Deepfake Defense Program", description: "…" },
  { recId: "rec-2", serviceId: "ai_data_governance", name: "AI Tool Data Governance Program", description: "…" },
];

const servicePillar = new Map<string, string>([
  ["ai_impersonation_defense", "ai-emerging-tech"],
  ["ai_data_governance", "ai-emerging-tech"],
]);

const weakByPillar = new Map<string, WeakFinding[]>([["ai-emerging-tech", aiCase.input.weakFindings]]);

const pillarMeta = new Map<string, PillarMeta>([
  ["ai-emerging-tech", { name: "AI & Emerging Tech Risk", score: 0.7, riskLevel: "critical" }],
]);

function makeDeps(overrides: Partial<NarrativeDeps> = {}): {
  deps: NarrativeDeps;
  persist: ReturnType<typeof vi.fn>;
} {
  const persist = vi.fn().mockResolvedValue(undefined);
  const deps: NarrativeDeps = {
    loadRecommendations: async () => recommendations,
    loadPillarMeta: async () => pillarMeta,
    loadWeakFindingsByPillar: async () => weakByPillar,
    loadServicePillarMap: async () => servicePillar,
    generate: async () => aiCase.referenceGood,
    persist,
    model: "gpt-4o",
    now: () => "2026-07-19T00:00:00.000Z",
    ...overrides,
  };
  return { deps, persist };
}

describe("runNarrativeGeneration", () => {
  it("writes a validated narrative to every recommendation in the pillar", async () => {
    const { deps, persist } = makeDeps();
    const summary = await runNarrativeGeneration("a1", deps);

    expect(summary.pillarsSucceeded).toBe(1);
    expect(summary.narrativesWritten).toBe(2);
    expect(persist).toHaveBeenCalledTimes(2);

    const [recId, narrative, meta] = persist.mock.calls[0];
    expect(recId).toBe("rec-1");
    expect(narrative.pillarSummary).toBe(aiCase.referenceGood.pillarSummary);
    expect(narrative.rationale).toContain("wire");
    expect(meta).toMatchObject({ provider: "openai", model: "gpt-4o", validated: true });
    expect(meta.promptHash).toMatch(/^[0-9a-f]{16}$/);
    expect(meta.generatedAt).toBe("2026-07-19T00:00:00.000Z");
  });

  it("passes the model exactly the selected services (schema-pinnable)", async () => {
    let seen: NarrativeInput | undefined;
    const { deps } = makeDeps({
      generate: async (input) => {
        seen = input;
        return aiCase.referenceGood;
      },
    });
    await runNarrativeGeneration("a1", deps);
    expect(seen?.selectedServices.map((s) => s.serviceId)).toEqual([
      "ai_impersonation_defense",
      "ai_data_governance",
    ]);
  });

  it("fails closed when the model returns a hallucinated service id (persists nothing)", async () => {
    const bad: NarrativeOutput = {
      ...aiCase.referenceGood,
      recommendations: [
        { ...aiCase.referenceGood.recommendations[0], serviceId: "ai_made_up" },
        aiCase.referenceGood.recommendations[1],
      ],
    };
    const { deps, persist } = makeDeps({ generate: async () => bad });
    const summary = await runNarrativeGeneration("a1", deps);
    expect(summary.pillarsFailed).toBe(1);
    expect(summary.narrativesWritten).toBe(0);
    expect(persist).not.toHaveBeenCalled();
  });

  it("retries once on a validation miss and succeeds on the second sample", async () => {
    const bad: NarrativeOutput = {
      ...aiCase.referenceGood,
      recommendations: [
        { ...aiCase.referenceGood.recommendations[0], serviceId: "ai_made_up" },
        aiCase.referenceGood.recommendations[1],
      ],
    };
    const generate = vi
      .fn()
      .mockResolvedValueOnce(bad) // first sample fails the validator
      .mockResolvedValueOnce(aiCase.referenceGood); // retry passes
    const { deps, persist } = makeDeps({ generate });
    const summary = await runNarrativeGeneration("a1", deps);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(summary.pillarsSucceeded).toBe(1);
    expect(persist).toHaveBeenCalledTimes(2);
  });

  it("fails closed after the retry is also invalid", async () => {
    const bad: NarrativeOutput = {
      ...aiCase.referenceGood,
      recommendations: [aiCase.referenceGood.recommendations[0]], // missing a service, both times
    };
    const generate = vi.fn().mockResolvedValue(bad);
    const { deps, persist } = makeDeps({ generate });
    const summary = await runNarrativeGeneration("a1", deps);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(summary.pillarsFailed).toBe(1);
    expect(persist).not.toHaveBeenCalled();
  });

  it("fails closed when generation throws, without rejecting", async () => {
    const { deps, persist } = makeDeps({
      generate: async () => {
        throw new Error("model timeout");
      },
    });
    const summary = await runNarrativeGeneration("a1", deps);
    expect(summary.pillarsFailed).toBe(1);
    expect(persist).not.toHaveBeenCalled();
  });

  it("skips a pillar with no weak findings (thin grounding → static copy)", async () => {
    const { deps, persist } = makeDeps({ loadWeakFindingsByPillar: async () => new Map() });
    const summary = await runNarrativeGeneration("a1", deps);
    expect(summary.pillarsSkipped).toBe(1);
    expect(summary.pillarsSucceeded).toBe(0);
    expect(persist).not.toHaveBeenCalled();
  });

  it("ignores recommendations whose service has no pillar mapping", async () => {
    const { deps, persist } = makeDeps({ loadServicePillarMap: async () => new Map() });
    const summary = await runNarrativeGeneration("a1", deps);
    expect(summary.pillarsProcessed).toBe(0);
    expect(persist).not.toHaveBeenCalled();
  });

  it("returns an empty summary when there are no recommendations", async () => {
    const generate = vi.fn();
    const { deps } = makeDeps({ loadRecommendations: async () => [], generate });
    const summary = await runNarrativeGeneration("a1", deps);
    expect(summary.pillarsProcessed).toBe(0);
    expect(generate).not.toHaveBeenCalled();
  });
});
