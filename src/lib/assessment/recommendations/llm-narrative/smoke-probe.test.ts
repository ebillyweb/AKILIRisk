import { describe, expect, it, vi } from "vitest";
import {
  runNarrativeSmokeProbe,
  SMOKE_NARRATIVE_INPUT,
} from "./smoke-probe";
import type { NarrativeOutput } from "./shape-a-prompt";

describe("runNarrativeSmokeProbe", () => {
  it("returns structural summary for a schema-valid model output", async () => {
    const output: NarrativeOutput = {
      pillarSummary:
        "Your household has material AI exposure on wire verification and tool use. Both gaps are addressable with process changes.",
      recommendations: SMOKE_NARRATIVE_INPUT.selectedServices.map((s) => ({
        serviceId: s.serviceId,
        headline: `Address ${s.name}`,
        rationale:
          "You indicated a weak finding that this service closes with concrete process changes for your household.",
        tailoredActions: [
          "Assign an owner for the control",
          "Document the verification protocol",
        ],
        citedFindings: ["10.1"],
        confidence: "high" as const,
      })),
    };

    const result = await runNarrativeSmokeProbe({
      generate: vi.fn().mockResolvedValue(output),
    });

    expect(result.ok).toBe(true);
    expect(result.pillarSummary.length).toBeGreaterThan(10);
    expect(result.recommendationCount).toBe(2);
    expect(result.serviceIds).toEqual([
      "ai_impersonation_defense",
      "ai_data_governance",
    ]);
    expect(result.validationOk).toBe(true);
  });

  it("surfaces validation failures without throwing", async () => {
    const output: NarrativeOutput = {
      pillarSummary: "Summary.",
      recommendations: [
        {
          serviceId: "invented_service",
          headline: "Bad",
          rationale: "Not grounded.",
          tailoredActions: ["One"],
          citedFindings: [],
          confidence: "low",
        },
      ],
    };

    const result = await runNarrativeSmokeProbe({
      generate: vi.fn().mockResolvedValue(output),
    });

    expect(result.validationOk).toBe(false);
    expect(result.validationReasons.length).toBeGreaterThan(0);
  });
});
