/**
 * Tests for targeted follow-up question selection.
 *
 * Coverage:
 *   - Extracts questionIds from answer_match conditions
 *   - Extracts questionIds from missing_control conditions
 *   - Excludes conditions without questionId (e.g., score_threshold)
 *   - Deduplicates question IDs across multiple recommendations
 *   - Returns empty array when no completed recommendations
 *   - getTargetedQuestionCount returns correct length
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findManyRecs = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    assessmentRecommendation: {
      findMany: (...a: unknown[]) => findManyRecs(...a),
    },
  },
}));

import {
  getTargetedFollowupQuestions,
  getTargetedQuestionCount,
} from "./targeted-followup";

function makeRec(
  conditions: Array<{ type: string; questionId?: string }>,
) {
  return {
    serviceRecommendation: {
      recommendationRules: [
        {
          triggerConditions: conditions,
        },
      ],
    },
  };
}

describe("getTargetedFollowupQuestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findManyRecs.mockResolvedValue([]);
  });

  it("extracts questionIds from answer_match conditions", async () => {
    findManyRecs.mockResolvedValue([
      makeRec([
        { type: "answer_match", questionId: "q-1" },
        { type: "answer_match", questionId: "q-2" },
      ]),
    ]);

    const result = await getTargetedFollowupQuestions("assess-1");

    expect(result).toContain("q-1");
    expect(result).toContain("q-2");
    expect(result).toHaveLength(2);
  });

  it("extracts questionIds from missing_control conditions", async () => {
    findManyRecs.mockResolvedValue([
      makeRec([{ type: "missing_control", questionId: "q-3" }]),
    ]);

    const result = await getTargetedFollowupQuestions("assess-1");

    expect(result).toEqual(["q-3"]);
  });

  it("excludes conditions without questionId (e.g., score_threshold)", async () => {
    findManyRecs.mockResolvedValue([
      makeRec([
        { type: "score_threshold" }, // no questionId
        { type: "risk_level" },      // no questionId
        { type: "answer_match", questionId: "q-4" },
      ]),
    ]);

    const result = await getTargetedFollowupQuestions("assess-1");

    expect(result).toEqual(["q-4"]);
  });

  it("deduplicates question IDs across multiple recommendations", async () => {
    findManyRecs.mockResolvedValue([
      makeRec([{ type: "answer_match", questionId: "q-shared" }]),
      makeRec([
        { type: "answer_match", questionId: "q-shared" },
        { type: "missing_control", questionId: "q-unique" },
      ]),
    ]);

    const result = await getTargetedFollowupQuestions("assess-1");

    expect(result).toContain("q-shared");
    expect(result).toContain("q-unique");
    expect(result).toHaveLength(2);
  });

  it("returns empty array when no completed recommendations", async () => {
    findManyRecs.mockResolvedValue([]);

    const result = await getTargetedFollowupQuestions("assess-1");

    expect(result).toEqual([]);
  });

  it("scopes query to assessmentId and COMPLETED status", async () => {
    await getTargetedFollowupQuestions("assess-99");

    const call = findManyRecs.mock.calls[0][0];
    expect(call.where.assessmentId).toBe("assess-99");
    expect(call.where.status).toBe("COMPLETED");
  });

  it("handles non-array triggerConditions gracefully", async () => {
    findManyRecs.mockResolvedValue([
      {
        serviceRecommendation: {
          recommendationRules: [
            { triggerConditions: "not-an-array" },
          ],
        },
      },
    ]);

    const result = await getTargetedFollowupQuestions("assess-1");

    expect(result).toEqual([]);
  });
});

describe("getTargetedQuestionCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns count of eligible questions", async () => {
    findManyRecs.mockResolvedValue([
      makeRec([
        { type: "answer_match", questionId: "q-1" },
        { type: "answer_match", questionId: "q-2" },
        { type: "missing_control", questionId: "q-3" },
      ]),
    ]);

    const count = await getTargetedQuestionCount("assess-1");

    expect(count).toBe(3);
  });

  it("returns zero when no eligible questions", async () => {
    findManyRecs.mockResolvedValue([]);

    const count = await getTargetedQuestionCount("assess-1");

    expect(count).toBe(0);
  });
});
