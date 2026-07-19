import { describe, it, expect, vi, beforeEach } from "vitest";

const { pillarQuestion, advisorPillarQuestion, enterprisePillarQuestion } = vi.hoisted(() => ({
  pillarQuestion: { findMany: vi.fn() },
  advisorPillarQuestion: { findMany: vi.fn() },
  enterprisePillarQuestion: { findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({
  prisma: { pillarQuestion, advisorPillarQuestion, enterprisePillarQuestion },
}));
vi.mock("@/lib/data/response-content", () => ({
  safeDecryptAnswer: (v: unknown) => v,
}));

import { isUuid, loadQuestionBankRows } from "./narrative-data";

const UUID = "0e37b1a2-4c5d-4e6f-8a9b-0c1d2e3f4a5b";
const CUID = "cmqjxx3wv00b5xjg86zzemik9";

beforeEach(() => {
  pillarQuestion.findMany.mockReset().mockResolvedValue([]);
  advisorPillarQuestion.findMany.mockReset().mockResolvedValue([]);
  enterprisePillarQuestion.findMany.mockReset().mockResolvedValue([]);
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
