import { describe, expect, it } from "vitest";
import { pickLatestAssessmentForPipeline } from "./pick-latest-assessment-for-pipeline";

const base = {
  status: "IN_PROGRESS" as const,
  completedAt: null,
  scoreCount: 0,
  responseCount: 0,
};

describe("pickLatestAssessmentForPipeline", () => {
  it("prefers a completed assessment over a newer empty in-progress shell", () => {
    const picked = pickLatestAssessmentForPipeline([
      {
        id: "old-completed",
        ...base,
        status: "COMPLETED",
        startedAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-10"),
        completedAt: new Date("2026-01-10"),
        scoreCount: 6,
      },
      {
        id: "empty-restart",
        ...base,
        startedAt: new Date("2026-03-01"),
        updatedAt: new Date("2026-03-05"),
      },
    ]);

    expect(picked?.id).toBe("old-completed");
  });

  it("prefers an in-progress assessment that already has scores over an older completed one", () => {
    const picked = pickLatestAssessmentForPipeline([
      {
        id: "old-completed",
        ...base,
        status: "COMPLETED",
        startedAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-10"),
        completedAt: new Date("2026-01-10"),
        scoreCount: 6,
      },
      {
        id: "active-scoring",
        ...base,
        startedAt: new Date("2026-03-01"),
        updatedAt: new Date("2026-03-05"),
        scoreCount: 2,
      },
    ]);

    expect(picked?.id).toBe("active-scoring");
  });

  it("prefers answered in-progress work over an empty shell", () => {
    const picked = pickLatestAssessmentForPipeline([
      {
        id: "empty",
        ...base,
        startedAt: new Date("2026-03-02"),
        updatedAt: new Date("2026-03-02"),
      },
      {
        id: "answered",
        ...base,
        startedAt: new Date("2026-03-01"),
        updatedAt: new Date("2026-03-05"),
        responseCount: 12,
      },
    ]);

    expect(picked?.id).toBe("answered");
  });

  it("breaks startedAt ties with updatedAt within the same priority", () => {
    const picked = pickLatestAssessmentForPipeline([
      {
        id: "older-update",
        ...base,
        startedAt: new Date("2026-03-01"),
        updatedAt: new Date("2026-03-01"),
      },
      {
        id: "newer-update",
        ...base,
        startedAt: new Date("2026-03-01"),
        updatedAt: new Date("2026-03-10"),
      },
    ]);

    expect(picked?.id).toBe("newer-update");
  });
});
