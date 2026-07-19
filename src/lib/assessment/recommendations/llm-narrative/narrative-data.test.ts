import { describe, it, expect, vi, beforeEach } from "vitest";

const { pillarQuestion, advisorPillarQuestion, enterprisePillarQuestion, assessmentResponse } =
  vi.hoisted(() => ({
    pillarQuestion: { findMany: vi.fn() },
    advisorPillarQuestion: { findMany: vi.fn() },
    enterprisePillarQuestion: { findMany: vi.fn() },
    assessmentResponse: { findMany: vi.fn() },
  }));

vi.mock("@/lib/db", () => ({
  prisma: { pillarQuestion, advisorPillarQuestion, enterprisePillarQuestion, assessmentResponse },
}));
vi.mock("@/lib/data/response-content", () => ({
  safeDecryptAnswer: (v: unknown) => v,
}));

import { isUuid, loadQuestionBankRows, loadWeakFindingsByPillar } from "./narrative-data";

const UUID = "0e37b1a2-4c5d-4e6f-8a9b-0c1d2e3f4a5b";
const CUID = "cmqjxx3wv00b5xjg86zzemik9";

beforeEach(() => {
  pillarQuestion.findMany.mockReset().mockResolvedValue([]);
  advisorPillarQuestion.findMany.mockReset().mockResolvedValue([]);
  enterprisePillarQuestion.findMany.mockReset().mockResolvedValue([]);
  assessmentResponse.findMany.mockReset().mockResolvedValue([]);
});

describe("isUuid", () => {
  it("recognizes UUIDs and rejects cuids", () => {
    expect(isUuid(UUID)).toBe(true);
    expect(isUuid(CUID)).toBe(false);
    expect(isUuid("not-an-id")).toBe(false);
  });
});

describe("loadQuestionBankRows", () => {
  it("routes UUID ids to the platform table only (never sends cuids there)", async () => {
    pillarQuestion.findMany.mockResolvedValue([{ id: UUID, questionText: "Q", questionNumber: "1.1", answer0: "a", answer1: "b", answer2: "c", answer3: "d" }]);
    await loadQuestionBankRows([UUID]);
    expect(pillarQuestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [UUID] } } }),
    );
    // A cuid must never reach the uuid-typed platform column.
    expect(advisorPillarQuestion.findMany).not.toHaveBeenCalled();
  });

  it("routes cuid ids to the cloned tables, not the platform table", async () => {
    advisorPillarQuestion.findMany.mockResolvedValue([{ id: CUID, questionText: "Q", questionNumber: "A1", answer0: "None", answer1: "Some", answer2: "Most", answer3: "All" }]);
    const byId = await loadQuestionBankRows([CUID]);
    expect(pillarQuestion.findMany).not.toHaveBeenCalled();
    expect(advisorPillarQuestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [CUID] } } }),
    );
    expect(enterprisePillarQuestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [CUID] } } }),
    );
    expect(byId.get(CUID)?.questionText).toBe("Q");
  });

  it("merges a mixed id set across tables", async () => {
    pillarQuestion.findMany.mockResolvedValue([{ id: UUID, questionText: "P", questionNumber: "1.1", answer0: "", answer1: "", answer2: "", answer3: "" }]);
    advisorPillarQuestion.findMany.mockResolvedValue([{ id: CUID, questionText: "A", questionNumber: "A1", answer0: "", answer1: "", answer2: "", answer3: "" }]);
    const byId = await loadQuestionBankRows([UUID, CUID]);
    expect(byId.get(UUID)?.questionText).toBe("P");
    expect(byId.get(CUID)?.questionText).toBe("A");
    expect(pillarQuestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [UUID] } } }),
    );
  });
});

describe("loadWeakFindingsByPillar", () => {
  it("keeps a weak answer whose anchor text is empty, backfilling a generic label", async () => {
    // Advisor-cloned question with empty answer0..3, answered at maturity 0.
    assessmentResponse.findMany.mockResolvedValue([
      { questionId: CUID, pillar: "governance", answer: "0" },
    ]);
    advisorPillarQuestion.findMany.mockResolvedValue([
      { id: CUID, questionText: "Is there a family governance body?", questionNumber: "A2", answer0: null, answer1: "", answer2: "", answer3: "" },
    ]);

    const byPillar = await loadWeakFindingsByPillar("a1");
    const findings = byPillar.get("governance");
    expect(findings).toHaveLength(1);
    expect(findings![0].chosenLevel).toBe(0);
    expect(findings![0].chosenLabel).toBe("Not in place"); // generic fallback
    expect(findings![0].questionText).toContain("governance body"); // real grounding intact
  });

  it("uses the question's own anchor label when present", async () => {
    assessmentResponse.findMany.mockResolvedValue([
      { questionId: UUID, pillar: "cyber-digital", answer: 1 },
    ]);
    pillarQuestion.findMany.mockResolvedValue([
      { id: UUID, questionText: "MFA everywhere?", questionNumber: "B1", answer0: "None", answer1: "Some", answer2: "Most", answer3: "All" },
    ]);

    const byPillar = await loadWeakFindingsByPillar("a1");
    expect(byPillar.get("cyber-digital")![0].chosenLabel).toBe("Some");
  });

  it("skips answers above the weak threshold", async () => {
    assessmentResponse.findMany.mockResolvedValue([
      { questionId: UUID, pillar: "cyber-digital", answer: 2 },
    ]);
    pillarQuestion.findMany.mockResolvedValue([
      { id: UUID, questionText: "MFA?", questionNumber: "B1", answer0: "None", answer1: "Some", answer2: "Most", answer3: "All" },
    ]);
    const byPillar = await loadWeakFindingsByPillar("a1");
    expect(byPillar.size).toBe(0);
  });
});
