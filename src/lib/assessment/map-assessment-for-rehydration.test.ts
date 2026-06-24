import { describe, expect, it, vi } from "vitest";
import {
  mapAssessmentForRehydration,
  mapResponseForRehydration,
} from "@/lib/assessment/map-assessment-for-rehydration";

const decryptSpy = vi.fn((value: unknown) => {
  if (value === "cipher-yes") return "yes";
  if (value === "cipher-2") return 2;
  return null;
});

vi.mock("@/lib/data/response-content", () => ({
  safeDecryptAnswer: (value: unknown) => decryptSpy(value),
}));

describe("mapAssessmentForRehydration", () => {
  it("decrypts saved answers for client rehydration", () => {
    const mapped = mapResponseForRehydration({
      id: "resp-1",
      questionId: "gov-q1",
      answer: "cipher-yes",
      skipped: false,
    });
    expect(mapped).toEqual({
      questionId: "gov-q1",
      answer: "yes",
      skipped: false,
    });
  });

  it("maps all responses on an assessment payload", () => {
    const mapped = mapAssessmentForRehydration({
      id: "asm-1",
      status: "IN_PROGRESS",
      responses: [
        { questionId: "gov-q1", answer: "cipher-yes", skipped: false },
        { questionId: "gov-q2", answer: "cipher-2", skipped: false },
      ],
    });
    expect(mapped.responses).toEqual([
      { questionId: "gov-q1", answer: "yes", skipped: false },
      { questionId: "gov-q2", answer: 2, skipped: false },
    ]);
  });
});
