import { beforeEach, describe, expect, it, vi } from "vitest";
import { SNAPSHOT_SCHEMA_VERSION } from "@/lib/methodology/types";

const prismaSpies = vi.hoisted(() => ({
  assessment: { findUnique: vi.fn() },
  intakeSnapshot: { findUnique: vi.fn() },
  intakeInterview: { findFirst: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));

import { loadSnapshotForAssessment } from "@/lib/methodology/snapshot";

const PINNED_SNAPSHOT_ROW = {
  id: "snap-pinned",
  advisorProfileId: "advisor-1",
  takenAt: new Date("2026-06-27T00:00:00Z"),
  snapshotBlob: {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    catalogVersion: 1,
    includedPillarSlugs: ["geographic-environmental"],
    pillars: [],
    assessmentQuestions: {
      "geographic-environmental": [
        {
          questionId: "cmq-cloned-geo-1",
          riskAreaId: "geographic-environmental",
          sortOrderGlobal: 1,
          text: "Cloned geo question",
          helpText: null,
          learnMore: null,
          riskRelevance: null,
          type: "scored_0_3",
          options: null,
          required: true,
          weight: 1,
          scoreMap: {},
          branchingDependsOn: null,
          branchingPredicate: null,
          profileConditionKey: null,
          omitMaturityScoreWhenYes: false,
        },
      ],
    },
    intakeQuestions: [],
    pillarNarratives: {},
    recRules: [],
  },
};

describe("loadSnapshotForAssessment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the snapshot pinned on the assessment", async () => {
    prismaSpies.assessment.findUnique.mockResolvedValue({
      snapshotId: "snap-pinned",
    });
    prismaSpies.intakeSnapshot.findUnique.mockResolvedValue(PINNED_SNAPSHOT_ROW);

    const snapshot = await loadSnapshotForAssessment("asmt-1");

    expect(snapshot?.snapshotId).toBe("snap-pinned");
    expect(
      snapshot?.assessmentQuestions["geographic-environmental"]?.[0]?.questionId,
    ).toBe("cmq-cloned-geo-1");
    expect(prismaSpies.intakeSnapshot.findUnique).toHaveBeenCalledWith({
      where: { id: "snap-pinned" },
    });
    expect(prismaSpies.intakeInterview.findFirst).not.toHaveBeenCalled();
  });

  it("returns null when the assessment has no pinned snapshotId", async () => {
    prismaSpies.assessment.findUnique.mockResolvedValue({
      snapshotId: null,
    });

    const snapshot = await loadSnapshotForAssessment("asmt-unpinned");

    expect(snapshot).toBeNull();
    expect(prismaSpies.intakeSnapshot.findUnique).not.toHaveBeenCalled();
    // Regression: do not fall back to intake-interview snapshots — those use
    // advisor-cloned question IDs that will not match live-bank answers.
    expect(prismaSpies.intakeInterview.findFirst).not.toHaveBeenCalled();
  });

  it("returns null when the assessment row is missing", async () => {
    prismaSpies.assessment.findUnique.mockResolvedValue(null);

    await expect(loadSnapshotForAssessment("missing")).resolves.toBeNull();
    expect(prismaSpies.intakeInterview.findFirst).not.toHaveBeenCalled();
  });
});
