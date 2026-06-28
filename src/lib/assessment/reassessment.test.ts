/**
 * Tests for reassessment creation service.
 *
 * Coverage:
 *   - createReassessment links to previous assessment, derives version from chain
 *   - getReassessmentChain walks chain and returns oldest-first
 *   - getLatestCompletedAssessment finds most recent COMPLETED assessment
 *   - includedPillars behavior for "full" vs "pillar" vs "targeted" types
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// -- Prisma mock fns -------------------------------------------------------
const findUniqueOrThrowAssessment = vi.fn();
const findUniqueAssessment = vi.fn();
const findFirstAssessment = vi.fn();
const createAssessment = vi.fn();
const transactionFn = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    assessment: {
      findUniqueOrThrow: (...a: unknown[]) => findUniqueOrThrowAssessment(...a),
      findUnique: (...a: unknown[]) => findUniqueAssessment(...a),
      findFirst: (...a: unknown[]) => findFirstAssessment(...a),
      create: (...a: unknown[]) => createAssessment(...a),
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => transactionFn(fn),
  },
}));

import {
  createReassessment,
  getReassessmentChain,
  getLatestCompletedAssessment,
} from "./reassessment";

describe("createReassessment", () => {
  const txClient = {
    assessment: {
      findUniqueOrThrow: findUniqueOrThrowAssessment,
      findUnique: findUniqueAssessment,
      create: createAssessment,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: $transaction executes the callback with txClient
    transactionFn.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(txClient),
    );
  });

  it("creates linked assessment with previousAssessmentId set", async () => {
    // Chain of length 1 (no predecessor)
    findUniqueOrThrowAssessment.mockResolvedValue({
      id: "prev-1",
      userId: "user-1",
      snapshotId: "snap-1",
      previousAssessmentId: null,
    });
    findUniqueAssessment.mockResolvedValue({
      previousAssessmentId: null,
    });
    createAssessment.mockResolvedValue({ id: "new-1" });

    const result = await createReassessment({
      userId: "user-1",
      previousAssessmentId: "prev-1",
      type: "full",
    });

    expect(result.id).toBe("new-1");
    expect(result.version).toBe(2); // chain length 1 + 1

    // Verify create was called with previousAssessmentId
    const createCall = createAssessment.mock.calls[0][0];
    expect(createCall.data.previousAssessmentId).toBe("prev-1");
    expect(createCall.data.status).toBe("IN_PROGRESS");
    expect(createCall.data.snapshotId).toBe("snap-1");
  });

  it("derives version from chain length, not version field", async () => {
    // Chain: root -> mid -> prev (length 3), so new = version 4
    findUniqueOrThrowAssessment.mockResolvedValue({
      id: "prev-3",
      userId: "user-1",
      snapshotId: "snap-1",
      previousAssessmentId: "mid-2",
    });

    // Walk chain: prev-3 -> mid-2 -> root-1 -> null
    findUniqueAssessment
      .mockResolvedValueOnce({ previousAssessmentId: "mid-2" })  // prev-3
      .mockResolvedValueOnce({ previousAssessmentId: "root-1" }) // mid-2
      .mockResolvedValueOnce({ previousAssessmentId: null });    // root-1

    createAssessment.mockResolvedValue({ id: "new-4" });

    const result = await createReassessment({
      userId: "user-1",
      previousAssessmentId: "prev-3",
      type: "full",
    });

    expect(result.version).toBe(4); // chain length 3 + 1
  });

  it("sets empty includedPillars for full assessment type", async () => {
    findUniqueOrThrowAssessment.mockResolvedValue({
      id: "prev-1",
      userId: "user-1",
      snapshotId: null,
      previousAssessmentId: null,
    });
    findUniqueAssessment.mockResolvedValue({ previousAssessmentId: null });
    createAssessment.mockResolvedValue({ id: "new-1" });

    await createReassessment({
      userId: "user-1",
      previousAssessmentId: "prev-1",
      type: "full",
    });

    const createCall = createAssessment.mock.calls[0][0];
    expect(createCall.data.includedPillars).toEqual([]);
  });

  it("sets selected pillars for pillar assessment type", async () => {
    findUniqueOrThrowAssessment.mockResolvedValue({
      id: "prev-1",
      userId: "user-1",
      snapshotId: null,
      previousAssessmentId: null,
    });
    findUniqueAssessment.mockResolvedValue({ previousAssessmentId: null });
    createAssessment.mockResolvedValue({ id: "new-1" });

    await createReassessment({
      userId: "user-1",
      previousAssessmentId: "prev-1",
      type: "pillar",
      includedPillars: ["governance", "cyber-digital"],
    });

    const createCall = createAssessment.mock.calls[0][0];
    expect(createCall.data.includedPillars).toEqual(["governance", "cyber-digital"]);
  });

  it("uses prisma $transaction for atomicity", async () => {
    findUniqueOrThrowAssessment.mockResolvedValue({
      id: "prev-1",
      userId: "user-1",
      snapshotId: null,
      previousAssessmentId: null,
    });
    findUniqueAssessment.mockResolvedValue({ previousAssessmentId: null });
    createAssessment.mockResolvedValue({ id: "new-1" });

    await createReassessment({
      userId: "user-1",
      previousAssessmentId: "prev-1",
      type: "full",
    });

    expect(transactionFn).toHaveBeenCalledTimes(1);
  });
});

describe("getReassessmentChain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("walks chain and returns oldest-first", async () => {
    // Chain: current -> mid -> root
    findUniqueAssessment
      .mockResolvedValueOnce({
        id: "current",
        version: 1,
        status: "IN_PROGRESS",
        completedAt: null,
        createdAt: new Date("2026-06-03"),
        previousAssessmentId: "mid",
      })
      .mockResolvedValueOnce({
        id: "mid",
        version: 1,
        status: "COMPLETED",
        completedAt: new Date("2026-03-01"),
        createdAt: new Date("2026-02-01"),
        previousAssessmentId: "root",
      })
      .mockResolvedValueOnce({
        id: "root",
        version: 1,
        status: "COMPLETED",
        completedAt: new Date("2025-12-01"),
        createdAt: new Date("2025-11-01"),
        previousAssessmentId: null,
      });

    const chain = await getReassessmentChain("current");

    expect(chain).toHaveLength(3);
    // Oldest first
    expect(chain[0].id).toBe("root");
    expect(chain[1].id).toBe("mid");
    expect(chain[2].id).toBe("current");
  });

  it("returns single entry for assessment with no predecessor", async () => {
    findUniqueAssessment.mockResolvedValueOnce({
      id: "only",
      version: 1,
      status: "COMPLETED",
      completedAt: new Date("2026-01-01"),
      createdAt: new Date("2025-12-01"),
      previousAssessmentId: null,
    });

    const chain = await getReassessmentChain("only");

    expect(chain).toHaveLength(1);
    expect(chain[0].id).toBe("only");
  });
});

describe("getLatestCompletedAssessment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns most recent completed assessment", async () => {
    findFirstAssessment.mockResolvedValue({ id: "latest", version: 2 });

    const result = await getLatestCompletedAssessment("user-1");

    expect(result).toEqual({ id: "latest", version: 2 });
    const call = findFirstAssessment.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
    expect(call.where.status).toBe("COMPLETED");
    expect(call.orderBy.completedAt).toBe("desc");
  });

  it("returns null when no completed assessment exists", async () => {
    findFirstAssessment.mockResolvedValue(null);

    const result = await getLatestCompletedAssessment("user-1");

    expect(result).toBeNull();
  });
});
