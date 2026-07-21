import { beforeEach, describe, expect, it, vi } from "vitest";
import { reconcileAssessmentCompletionIfNeeded } from "./reconcile-assessment-completion";

const { mockTransaction, mockFindUnique, mockSync } = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockFindUnique: vi.fn(),
  mockSync: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mockTransaction,
    assessment: {
      findUnique: mockFindUnique,
    },
  },
}));

vi.mock("@/lib/assessment/assessment-completion", () => ({
  syncAssessmentCompletionStatus: mockSync,
}));

const catalog = [
  { id: "governance", name: "Governance", slug: "governance" },
  { id: "cyber-digital", name: "Cyber", slug: "cyber-digital" },
] as const;

describe("reconcileAssessmentCompletionIfNeeded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => fn({}));
    mockFindUnique.mockResolvedValue({
      status: "COMPLETED",
      completedAt: new Date("2026-03-10"),
      deliverablePhase: "PREVIEW",
    });
  });

  it("syncs when every scoped pillar is scored but status is still IN_PROGRESS", async () => {
    const result = await reconcileAssessmentCompletionIfNeeded({
      assessmentId: "asm-1",
      status: "IN_PROGRESS",
      completedAt: null,
      deliverablePhase: "PREVIEW",
      pillarIds: ["governance", "cyber-digital"],
      includedPillars: ["governance", "cyber-digital"],
      catalog,
    });

    expect(mockSync).toHaveBeenCalledWith({}, "asm-1");
    expect(result.status).toBe("COMPLETED");
    expect(result.completedAt).toEqual(new Date("2026-03-10"));
  });

  it("does not sync when scope is incomplete", async () => {
    const result = await reconcileAssessmentCompletionIfNeeded({
      assessmentId: "asm-1",
      status: "IN_PROGRESS",
      completedAt: null,
      deliverablePhase: "PREVIEW",
      pillarIds: ["governance"],
      includedPillars: ["governance", "cyber-digital"],
      catalog,
    });

    expect(mockSync).not.toHaveBeenCalled();
    expect(result.status).toBe("IN_PROGRESS");
  });
});
