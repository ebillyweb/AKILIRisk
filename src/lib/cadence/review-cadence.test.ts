/**
 * Tests for cadence engine: pure functions, overdue dedup, and initialization.
 *
 * Coverage:
 *   - computeNextDueDate for each frequency (90, 180, 365 days)
 *   - getCadenceStatus: on_track, due_soon, overdue, system_recommended
 *   - getOverdueCadences filters recently reminded (lastReminderSentAt within 7 days)
 *   - getDueSoonCadences filters recently reminded
 *   - initializeCadenceForClient uses enterprise default frequency
 *   - isCadenceEngineEnabled follows enterprise feature flag pattern
 *   - checkSystemReassessmentTriggers returns shouldRecommend when threshold met
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { addDays, subDays } from "date-fns";

// -- Prisma mocks --

const findUniqueCadence = vi.fn();
const upsertCadence = vi.fn();
const findManyCadence = vi.fn();
const findUniqueProfile = vi.fn();
const countRecommendations = vi.fn();
const findFirstAssessment = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    reviewCadence: {
      findUnique: (...a: unknown[]) => findUniqueCadence(...a),
      upsert: (...a: unknown[]) => upsertCadence(...a),
      findMany: (...a: unknown[]) => findManyCadence(...a),
    },
    advisorProfile: {
      findUnique: (...a: unknown[]) => findUniqueProfile(...a),
    },
    assessmentRecommendation: {
      count: (...a: unknown[]) => countRecommendations(...a),
    },
    assessment: {
      findFirst: (...a: unknown[]) => findFirstAssessment(...a),
    },
  },
}));

// Import after mocks
import { computeNextDueDate, getCadenceStatus } from "./review-cadence";
import {
  CADENCE_FREQUENCY_DAYS,
  DUE_SOON_THRESHOLD_DAYS,
} from "./cadence-types";

describe("computeNextDueDate", () => {
  const baseDate = new Date("2026-01-15T00:00:00Z");

  it("adds 90 days for QUARTERLY", () => {
    const result = computeNextDueDate(baseDate, "QUARTERLY");
    expect(result).toEqual(addDays(baseDate, 90));
  });

  it("adds 180 days for SEMI_ANNUAL", () => {
    const result = computeNextDueDate(baseDate, "SEMI_ANNUAL");
    expect(result).toEqual(addDays(baseDate, 180));
  });

  it("adds 365 days for ANNUAL", () => {
    const result = computeNextDueDate(baseDate, "ANNUAL");
    expect(result).toEqual(addDays(baseDate, 365));
  });

  it("matches CADENCE_FREQUENCY_DAYS constants", () => {
    for (const [freq, days] of Object.entries(CADENCE_FREQUENCY_DAYS)) {
      const result = computeNextDueDate(
        baseDate,
        freq as keyof typeof CADENCE_FREQUENCY_DAYS,
      );
      expect(result).toEqual(addDays(baseDate, days));
    }
  });
});

describe("getCadenceStatus", () => {
  it("returns system_recommended when systemRecommended is true", () => {
    const futureDate = addDays(new Date(), 30);
    const result = getCadenceStatus(futureDate, true);
    expect(result.status).toBe("system_recommended");
  });

  it("returns on_track when due date is far in the future", () => {
    const futureDate = addDays(new Date(), 60);
    const result = getCadenceStatus(futureDate, false);
    expect(result.status).toBe("on_track");
    expect(result.daysUntilDue).toBeGreaterThan(DUE_SOON_THRESHOLD_DAYS);
  });

  it("returns due_soon when within 14 days", () => {
    const soonDate = addDays(new Date(), 10);
    const result = getCadenceStatus(soonDate, false);
    expect(result.status).toBe("due_soon");
    expect(result.daysUntilDue).toBeLessThanOrEqual(DUE_SOON_THRESHOLD_DAYS);
    expect(result.daysUntilDue).toBeGreaterThan(0);
  });

  it("returns due_soon at exactly 14 days", () => {
    const exactDate = addDays(new Date(), 14);
    const result = getCadenceStatus(exactDate, false);
    expect(result.status).toBe("due_soon");
  });

  it("returns overdue when past due", () => {
    const pastDate = subDays(new Date(), 5);
    const result = getCadenceStatus(pastDate, false);
    expect(result.status).toBe("overdue");
    expect(result.daysUntilDue).toBeLessThanOrEqual(0);
  });

  it("returns overdue at exactly today (0 days)", () => {
    // differenceInDays with same day = 0, which is <= 0
    const today = new Date();
    const result = getCadenceStatus(today, false);
    expect(result.status).toBe("overdue");
  });
});

describe("getOverdueCadences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries cadences with nextDueDate < now and dedup filter", async () => {
    findManyCadence.mockResolvedValue([]);

    // Dynamically import to use the mocked prisma
    const { getOverdueCadences } = await import("./review-cadence");
    await getOverdueCadences();

    expect(findManyCadence).toHaveBeenCalledTimes(1);
    const call = findManyCadence.mock.calls[0][0];

    // nextDueDate should be less than now
    expect(call.where.nextDueDate.lt).toBeInstanceOf(Date);

    // OR clause for dedup: null or older than 7 days
    expect(call.where.OR).toHaveLength(2);
    expect(call.where.OR[0]).toEqual({ lastReminderSentAt: null });
    expect(call.where.OR[1].lastReminderSentAt.lt).toBeInstanceOf(Date);
  });
});

describe("getDueSoonCadences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries cadences due within threshold days with dedup", async () => {
    findManyCadence.mockResolvedValue([]);

    const { getDueSoonCadences } = await import("./review-cadence");
    await getDueSoonCadences(14);

    expect(findManyCadence).toHaveBeenCalledTimes(1);
    const call = findManyCadence.mock.calls[0][0];

    // nextDueDate should be between now and now+threshold
    expect(call.where.nextDueDate.gte).toBeInstanceOf(Date);
    expect(call.where.nextDueDate.lte).toBeInstanceOf(Date);

    // Dedup filter
    expect(call.where.OR).toHaveLength(2);
  });
});

describe("initializeCadenceForClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses enterprise default frequency when available", async () => {
    findUniqueProfile.mockResolvedValue({
      enterprise: { defaultCadenceFrequency: "QUARTERLY" },
    });

    const cadenceRow = {
      id: "cad-1",
      clientId: "client-1",
      advisorProfileId: "advisor-1",
      frequency: "QUARTERLY",
      nextDueDate: addDays(new Date("2026-06-01"), 90),
      isOverridden: false,
      systemRecommended: false,
      systemRecommendationReason: null,
      lastAssessmentId: "assess-1",
      lastReminderSentAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    upsertCadence.mockResolvedValue(cadenceRow);

    const { initializeCadenceForClient } = await import("./review-cadence");
    const result = await initializeCadenceForClient(
      "client-1",
      "advisor-1",
      "assess-1",
      new Date("2026-06-01"),
    );

    expect(result.frequency).toBe("QUARTERLY");
    expect(result.clientId).toBe("client-1");
    expect(result.lastAssessmentId).toBe("assess-1");

    // Verify upsert was called with QUARTERLY frequency
    const upsertCall = upsertCadence.mock.calls[0][0];
    expect(upsertCall.create.frequency).toBe("QUARTERLY");
  });

  it("defaults to ANNUAL when no enterprise exists", async () => {
    findUniqueProfile.mockResolvedValue({ enterprise: null });

    const cadenceRow = {
      id: "cad-2",
      clientId: "client-2",
      advisorProfileId: "solo-advisor",
      frequency: "ANNUAL",
      nextDueDate: addDays(new Date("2026-06-01"), 365),
      isOverridden: false,
      systemRecommended: false,
      systemRecommendationReason: null,
      lastAssessmentId: "assess-2",
      lastReminderSentAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    upsertCadence.mockResolvedValue(cadenceRow);

    const { initializeCadenceForClient } = await import("./review-cadence");
    await initializeCadenceForClient(
      "client-2",
      "solo-advisor",
      "assess-2",
      new Date("2026-06-01"),
    );

    const upsertCall = upsertCadence.mock.calls[0][0];
    expect(upsertCall.create.frequency).toBe("ANNUAL");
  });
});

describe("checkSystemReassessmentTriggers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns shouldRecommend=true when threshold met and no reassessment exists", async () => {
    countRecommendations.mockResolvedValue(3);
    findFirstAssessment.mockResolvedValue(null);

    const { checkSystemReassessmentTriggers } = await import(
      "./system-triggers"
    );
    const result = await checkSystemReassessmentTriggers(
      "client-1",
      "assess-1",
    );

    expect(result.shouldRecommend).toBe(true);
    expect(result.reason).toContain("3 completed recommendations");
  });

  it("returns shouldRecommend=false when below threshold", async () => {
    countRecommendations.mockResolvedValue(2);

    const { checkSystemReassessmentTriggers } = await import(
      "./system-triggers"
    );
    const result = await checkSystemReassessmentTriggers(
      "client-1",
      "assess-1",
    );

    expect(result.shouldRecommend).toBe(false);
    expect(result.reason).toBeNull();
  });

  it("returns shouldRecommend=false when reassessment already exists", async () => {
    countRecommendations.mockResolvedValue(5);
    findFirstAssessment.mockResolvedValue({ id: "reassess-1" });

    const { checkSystemReassessmentTriggers } = await import(
      "./system-triggers"
    );
    const result = await checkSystemReassessmentTriggers(
      "client-1",
      "assess-1",
    );

    expect(result.shouldRecommend).toBe(false);
    expect(result.reason).toBeNull();
  });
});

describe("isCadenceEngineEnabled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when enterprise tracking is enabled", async () => {
    findUniqueProfile.mockResolvedValue({
      enterprise: { implementationTrackingEnabled: true },
    });

    const { isCadenceEngineEnabled } = await import(
      "../engagement/feature-flags"
    );
    const result = await isCadenceEngineEnabled("advisor-1");
    expect(result).toBe(true);
  });

  it("returns false when enterprise tracking is disabled", async () => {
    findUniqueProfile.mockResolvedValue({
      enterprise: { implementationTrackingEnabled: false },
    });

    const { isCadenceEngineEnabled } = await import(
      "../engagement/feature-flags"
    );
    const result = await isCadenceEngineEnabled("advisor-2");
    expect(result).toBe(false);
  });

  it("returns true for solo advisors (no enterprise)", async () => {
    findUniqueProfile.mockResolvedValue({ enterprise: null });

    const { isCadenceEngineEnabled } = await import(
      "../engagement/feature-flags"
    );
    const result = await isCadenceEngineEnabled("solo-advisor");
    expect(result).toBe(true);
  });

  it("returns false when profile not found", async () => {
    findUniqueProfile.mockResolvedValue(null);

    const { isCadenceEngineEnabled } = await import(
      "../engagement/feature-flags"
    );
    const result = await isCadenceEngineEnabled("nonexistent");
    expect(result).toBe(false);
  });
});
