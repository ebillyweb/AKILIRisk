import { describe, expect, it } from "vitest";
import { intakeQuestionsFromSnapshot } from "@/lib/intake/intake-script-from-snapshot";
import { pillarQuestionsFromSnapshot } from "@/lib/methodology/assessment-from-snapshot";
import {
  recommendationRulesFromSnapshot,
  snapshotQuestionsForPillar,
} from "@/lib/methodology/snapshot-helpers";
import type { MethodologySnapshotBlob } from "@/lib/methodology/types";
import { SNAPSHOT_SCHEMA_VERSION } from "@/lib/methodology/types";

function baseSnapshot(
  intakeText: string,
  assessmentText: string,
): MethodologySnapshotBlob {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    catalogVersion: 1,
    includedPillarSlugs: ["governance"],
    pillars: [
      {
        pillarId: "p1",
        slug: "governance",
        canonicalName: "Governance",
        isActive: true,
        displayName: null,
        weight: 9,
        threshold: { lowMin: 80, mediumMin: 60, highMin: 40 },
        emphasisMultiplier: 1.5,
        displayOrder: 1,
        version: 1,
      },
    ],
    assessmentQuestions: {
      governance: [
        {
          questionId: "aq1",
          riskAreaId: "governance",
          sortOrderGlobal: 1,
          text: assessmentText,
          helpText: null,
          learnMore: null,
          riskRelevance: null,
          type: "maturity-scale",
          options: [{ value: 0, label: "0" }],
          required: true,
          weight: 2,
          scoreMap: { "0": 0, "1": 1, "2": 2, "3": 3 },
          branchingDependsOn: null,
          branchingPredicate: null,
          profileConditionKey: null,
          omitMaturityScoreWhenYes: false,
        },
      ],
    },
    intakeQuestions: [
      {
        id: "iq1",
        displayOrder: 1,
        questionNumber: "1",
        questionText: intakeText,
        context: "ctx",
        helpText: null,
        learnMore: null,
        answerType: "audio",
        options: null,
        relatedPillarIds: [],
        recommendedActions: null,
        isVisible: true,
        version: 1,
      },
    ],
    pillarNarratives: {
      governance: {
        pillarId: "p1",
        slug: "governance",
        allNegative: ["neg"],
        allYes: ["yes"],
        midBand: { critical: ["c"], high: ["h"], medium: ["m"], low: ["l"] },
        version: 1,
      },
    },
    recRules: [
      {
        id: "r1",
        pillarId: "p1",
        pillarSlug: "governance",
        name: "Rule",
        serviceId: "svc1",
        conditions: [],
        priority: 1,
        isActive: true,
        version: 1,
      },
    ],
  };
}

describe("snapshot runtime isolation (blob fixtures)", () => {
  it("intake script reads snapshotted question text only", () => {
    const snap = baseSnapshot("Original intake", "Original assessment");
    const questions = intakeQuestionsFromSnapshot(snap);
    expect(questions[0]?.questionText).toBe("Original intake");

    snap.intakeQuestions[0]!.questionText = "Edited live";
    expect(questions[0]?.questionText).toBe("Original intake");
  });

  it("assessment questions read snapshotted bank only", () => {
    const snap = baseSnapshot("Original intake", "Original assessment");
    const parsed = {
      ...snap,
      snapshotId: "s1",
      advisorProfileId: "a1",
      takenAt: new Date(),
    };
    const questions = pillarQuestionsFromSnapshot(parsed, "governance");
    expect(questions[0]?.text).toBe("Original assessment");

    snap.assessmentQuestions.governance![0]!.text = "Edited live";
    expect(questions[0]?.text).toBe("Original assessment");
    expect(snapshotQuestionsForPillar(snap, "governance")[0]?.text).toBe(
      "Edited live",
    );
  });

  it("narratives and rec rules are extracted from snapshot blob", () => {
    const snap = baseSnapshot("q", "a");
    expect(snap.pillarNarratives.governance?.allNegative).toEqual(["neg"]);
    expect(recommendationRulesFromSnapshot(snap)).toHaveLength(1);

    snap.pillarNarratives.governance!.allNegative = ["changed"];
    expect(snap.pillarNarratives.governance?.allNegative).toEqual(["changed"]);
  });
});
