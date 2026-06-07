import { describe, expect, it } from "vitest";
import { isDuplicateQueuedAction, parseQueuedPillarActions } from "./pillar-action-queue";

describe("pillar-action-queue", () => {
  it("parses valid queued actions", () => {
    const parsed = parseQueuedPillarActions([
      {
        id: "a1",
        questionId: "q1",
        questionLabel: "Governance A1",
        pillar: "governance",
        source: "assessment",
        actionText: "Document mission statement",
        queuedAt: "2026-06-06T00:00:00.000Z",
        queuedByUserId: "user-1",
      },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.actionText).toBe("Document mission statement");
  });

  it("detects duplicate queue entries", () => {
    const existing = parseQueuedPillarActions([
      {
        id: "a1",
        questionId: "q1",
        questionLabel: "Q1",
        pillar: null,
        source: "intake",
        actionText: "Follow up",
        queuedAt: "2026-06-06T00:00:00.000Z",
        queuedByUserId: "user-1",
      },
    ]);
    expect(isDuplicateQueuedAction(existing, "q1", "Follow up")).toBe(true);
    expect(isDuplicateQueuedAction(existing, "q2", "Follow up")).toBe(false);
  });
});
