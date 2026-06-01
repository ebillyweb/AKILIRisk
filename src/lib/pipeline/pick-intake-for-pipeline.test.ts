import { describe, expect, it } from "vitest";

import { pickIntakeForPipeline } from "./pick-intake-for-pipeline";

describe("pickIntakeForPipeline", () => {
  const submitted = {
    id: "submitted",
    status: "SUBMITTED" as const,
    submittedAt: new Date("2026-06-01T00:00:00Z"),
    updatedAt: new Date("2026-06-01T00:00:00Z"),
  };

  const restarted = {
    id: "restarted",
    status: "NOT_STARTED" as const,
    submittedAt: null,
    updatedAt: new Date("2026-06-01T01:00:00Z"),
  };

  it("prefers a submitted interview over a newer empty restart", () => {
    expect(pickIntakeForPipeline([restarted, submitted])).toEqual(submitted);
  });

  it("prefers completed over in-progress when both exist", () => {
    const completed = {
      id: "completed",
      status: "COMPLETED" as const,
      submittedAt: null,
      updatedAt: new Date("2026-06-01T00:30:00Z"),
    };
    const inProgress = {
      id: "in-progress",
      status: "IN_PROGRESS" as const,
      submittedAt: null,
      updatedAt: new Date("2026-06-01T01:00:00Z"),
    };

    expect(pickIntakeForPipeline([inProgress, completed])).toEqual(completed);
  });
});
