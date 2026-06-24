import { describe, expect, it } from "vitest";
import { recommendationRulesFromSnapshot } from "@/lib/methodology/snapshot-helpers";
import type { MethodologySnapshotBlob } from "@/lib/methodology/types";
import { SNAPSHOT_SCHEMA_VERSION } from "@/lib/methodology/types";

function snapshotWithCustomRecRule(): MethodologySnapshotBlob {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    catalogVersion: 1,
    includedPillarSlugs: ["governance"],
    pillars: [],
    assessmentQuestions: {},
    intakeQuestions: [],
    pillarNarratives: {},
    recRules: [
      {
        id: "base-rule",
        pillarId: "p1",
        pillarSlug: "governance",
        name: "Base platform rule",
        serviceId: "svc-base",
        conditions: [
          { type: "risk_level", pillarId: "governance", operator: "in", value: ["high"] },
        ],
        priority: 5,
        isActive: true,
        version: 1,
      },
      {
        id: "custom-rule",
        pillarId: "p1",
        pillarSlug: "governance",
        name: "Advisor custom rule",
        serviceId: "svc-custom",
        conditions: [
          {
            type: "risk_level",
            pillarId: "governance",
            operator: "in",
            value: ["high", "critical"],
          },
        ],
        priority: 10,
        isActive: true,
        version: 1,
      },
    ],
  };
}

describe("custom advisor recommendation rules in snapshot runtime", () => {
  it("includes custom and base rules from snapshot blob", () => {
    const snap = snapshotWithCustomRecRule();
    const rules = recommendationRulesFromSnapshot(snap);
    expect(rules).toHaveLength(2);
    expect(rules.map((r) => r.id)).toEqual(["base-rule", "custom-rule"]);
    expect(rules[1]?.serviceId).toBe("svc-custom");
  });

  it("excludes inactive rules at snapshot build time", () => {
    const snap = snapshotWithCustomRecRule();
    snap.recRules = snap.recRules.filter((r) => r.id !== "custom-rule");
    expect(recommendationRulesFromSnapshot(snap)).toHaveLength(1);
  });
});
