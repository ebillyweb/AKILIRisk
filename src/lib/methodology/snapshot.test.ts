import { describe, expect, it } from "vitest";
import {
  getActivePillars,
  getPillarCountLabel,
  getPillarWeightMap,
  hashSnapshotBlob,
  resolvePillarLabel,
  riskAreasFromSnapshot,
} from "@/lib/methodology/snapshot";
import type { MethodologySnapshotBlob } from "@/lib/methodology/types";
import { SNAPSHOT_SCHEMA_VERSION } from "@/lib/methodology/types";

function fixtureBlob(
  overrides?: Partial<MethodologySnapshotBlob>,
): MethodologySnapshotBlob {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    catalogVersion: 1,
    includedPillarSlugs: ["governance", "cyber-digital"],
    pillars: [
      {
        pillarId: "p1",
        slug: "governance",
        canonicalName: "Governance",
        isActive: true,
        displayName: "Family Governance",
        weight: 9,
        threshold: { lowMin: 80, mediumMin: 60, highMin: 40 },
        emphasisMultiplier: 1.5,
        displayOrder: 1,
        version: 1,
      },
      {
        pillarId: "p2",
        slug: "cyber-digital",
        canonicalName: "Cyber & Digital",
        isActive: true,
        displayName: null,
        weight: 16,
        threshold: { lowMin: 80, mediumMin: 60, highMin: 40 },
        emphasisMultiplier: 1.5,
        displayOrder: 2,
        version: 1,
      },
      {
        pillarId: "p3",
        slug: "insurance",
        canonicalName: "Insurance",
        isActive: false,
        displayName: null,
        weight: 14,
        threshold: { lowMin: 80, mediumMin: 60, highMin: 40 },
        emphasisMultiplier: 1.5,
        displayOrder: 3,
        version: 1,
      },
    ],
    assessmentQuestions: {},
    intakeQuestions: [],
    pillarNarratives: {},
    recRules: [],
    ...overrides,
  };
}

describe("hashSnapshotBlob", () => {
  it("is deterministic for the same blob", () => {
    const blob = fixtureBlob();
    expect(hashSnapshotBlob(blob)).toBe(hashSnapshotBlob(blob));
  });

  it("changes when blob content changes", () => {
    const a = fixtureBlob();
    const b = fixtureBlob({ catalogVersion: 2 });
    expect(hashSnapshotBlob(a)).not.toBe(hashSnapshotBlob(b));
  });
});

describe("resolvePillarLabel", () => {
  it("prefers advisor display name over canonical name", () => {
    const blob = fixtureBlob();
    expect(resolvePillarLabel(blob, "governance")).toBe("Family Governance");
    expect(resolvePillarLabel(blob, "cyber-digital")).toBe("Cyber & Digital");
  });
});

describe("getActivePillars", () => {
  it("returns includedPillarSlugs when set", () => {
    const blob = fixtureBlob();
    expect(getActivePillars(blob)).toEqual(["governance", "cyber-digital"]);
  });

  it("falls back to active pillars when included list empty", () => {
    const blob = fixtureBlob({ includedPillarSlugs: [] });
    expect(getActivePillars(blob)).toEqual(["governance", "cyber-digital"]);
  });
});

describe("getPillarWeightMap", () => {
  it("returns weights only for active pillars", () => {
    const blob = fixtureBlob();
    expect(getPillarWeightMap(blob)).toEqual({
      governance: 9,
      "cyber-digital": 16,
    });
  });
});

describe("getPillarCountLabel", () => {
  it("pluralizes domain count", () => {
    expect(getPillarCountLabel(fixtureBlob())).toBe(
      "2 household risk domains",
    );
  });
});

describe("riskAreasFromSnapshot", () => {
  it("returns ordered active risk areas with resolved labels", () => {
    const areas = riskAreasFromSnapshot(fixtureBlob());
    expect(areas.map((a) => a.id)).toEqual(["governance", "cyber-digital"]);
    expect(areas[0]?.name).toBe("Family Governance");
  });
});
