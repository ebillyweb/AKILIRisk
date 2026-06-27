/**
 * Tests for engagement feature flag helpers.
 *
 * Coverage:
 *   - Enterprise with flag true returns true
 *   - Enterprise with flag false returns false
 *   - No enterprise row (solo advisor) defaults to true
 *   - No profile found returns false
 *   - isTrackingActiveForAssessment returns true when published, false otherwise
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findUniqueProfile = vi.fn();
const findUniqueAssessment = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    advisorProfile: {
      findUnique: (...a: unknown[]) => findUniqueProfile(...a),
    },
    assessment: {
      findUnique: (...a: unknown[]) => findUniqueAssessment(...a),
    },
  },
}));

import {
  isImplementationTrackingEnabled,
  isTrackingActiveForAssessment,
} from "./feature-flags";

describe("isImplementationTrackingEnabled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when enterprise flag is true", async () => {
    findUniqueProfile.mockResolvedValue({
      enterprise: { implementationTrackingEnabled: true },
    });

    const result = await isImplementationTrackingEnabled("advisor-1");
    expect(result).toBe(true);
    expect(findUniqueProfile).toHaveBeenCalledWith({
      where: { id: "advisor-1" },
      select: {
        enterprise: {
          select: { implementationTrackingEnabled: true },
        },
      },
    });
  });

  it("returns false when enterprise flag is false", async () => {
    findUniqueProfile.mockResolvedValue({
      enterprise: { implementationTrackingEnabled: false },
    });

    const result = await isImplementationTrackingEnabled("advisor-2");
    expect(result).toBe(false);
  });

  it("returns true when no enterprise row (solo advisor)", async () => {
    findUniqueProfile.mockResolvedValue({
      enterprise: null,
    });

    const result = await isImplementationTrackingEnabled("solo-advisor");
    expect(result).toBe(true);
  });

  it("returns false when profile not found", async () => {
    findUniqueProfile.mockResolvedValue(null);

    const result = await isImplementationTrackingEnabled("nonexistent");
    expect(result).toBe(false);
  });
});

describe("isTrackingActiveForAssessment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when actionPlanPublishedAt is set", async () => {
    findUniqueAssessment.mockResolvedValue({
      actionPlanPublishedAt: new Date("2026-06-01"),
    });

    const result = await isTrackingActiveForAssessment("assessment-1");
    expect(result).toBe(true);
  });

  it("returns false when actionPlanPublishedAt is null", async () => {
    findUniqueAssessment.mockResolvedValue({
      actionPlanPublishedAt: null,
    });

    const result = await isTrackingActiveForAssessment("assessment-2");
    expect(result).toBe(false);
  });

  it("returns false when assessment not found", async () => {
    findUniqueAssessment.mockResolvedValue(null);

    const result = await isTrackingActiveForAssessment("nonexistent");
    expect(result).toBe(false);
  });
});
