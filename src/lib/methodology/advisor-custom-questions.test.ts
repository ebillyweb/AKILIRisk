import { describe, expect, it } from "vitest";
import { intakeQuestionsFromSnapshot } from "@/lib/intake/intake-script-from-snapshot";
import { pillarQuestionsFromSnapshot } from "@/lib/methodology/assessment-from-snapshot";
import type { MethodologySnapshotBlob } from "@/lib/methodology/types";
import { SNAPSHOT_SCHEMA_VERSION } from "@/lib/methodology/types";

function snapshotWithCustomQuestions(): MethodologySnapshotBlob {
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
          questionId: "base-aq",
          riskAreaId: "governance",
          sortOrderGlobal: 1,
          text: "Base assessment question",
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
        {
          questionId: "custom-aq",
          riskAreaId: "governance",
          sortOrderGlobal: 99,
          text: "Advisor custom assessment question",
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
        id: "base-iq",
        displayOrder: 1,
        questionNumber: "1",
        questionText: "Base intake question",
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
      {
        id: "custom-iq",
        displayOrder: 99,
        questionNumber: "99",
        questionText: "Advisor custom intake question",
        context: "custom ctx",
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
    pillarNarratives: {},
    recRules: [],
  };
}

describe("custom advisor questions in snapshot runtime", () => {
  it("includes custom intake and assessment rows from snapshot blob", () => {
    const snap = snapshotWithCustomQuestions();
    const intake = intakeQuestionsFromSnapshot(snap);
    expect(intake.map((q) => q.questionText)).toEqual([
      "Base intake question",
      "Advisor custom intake question",
    ]);

    const parsed = {
      ...snap,
      snapshotId: "s1",
      advisorProfileId: "a1",
      takenAt: new Date(),
    };
    const assessment = pillarQuestionsFromSnapshot(parsed, "governance");
    expect(assessment.map((q) => q.text)).toEqual([
      "Base assessment question",
      "Advisor custom assessment question",
    ]);
  });

  it("excludes hidden questions from snapshot fixture (visibility gate at snapshot build)", () => {
    const snap = snapshotWithCustomQuestions();
    snap.intakeQuestions = snap.intakeQuestions.filter((q) => q.id !== "custom-iq");
    const intake = intakeQuestionsFromSnapshot(snap);
    expect(intake).toHaveLength(1);
    expect(intake[0]?.questionText).toBe("Base intake question");
  });
});
