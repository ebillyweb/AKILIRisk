import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    platformSettings: {
      findUnique: (...args: unknown[]) => findUnique(...args),
    },
  },
}));

import { getActiveRiskThresholds } from "./risk-thresholds";
import {
  DEFAULT_RISK_THRESHOLDS,
  riskLevelFromResiliencePercent,
} from "./governance-rubric";

beforeEach(() => {
  findUnique.mockReset();
});

describe("getActiveRiskThresholds", () => {
  it("returns defaults when PlatformSettings row is missing", async () => {
    findUnique.mockResolvedValue(null);
    const out = await getActiveRiskThresholds();
    expect(out).toEqual(DEFAULT_RISK_THRESHOLDS);
  });

  it("returns hydrated values from the row", async () => {
    findUnique.mockResolvedValue({
      riskThresholdLow: 85,
      riskThresholdMedium: 65,
      riskThresholdHigh: 45,
    });
    const out = await getActiveRiskThresholds();
    expect(out).toEqual({ lowMin: 85, mediumMin: 65, highMin: 45 });
  });

  it("falls back per-field when a value is out-of-range or null", async () => {
    findUnique.mockResolvedValue({
      riskThresholdLow: 999, // out of range
      riskThresholdMedium: -5, // out of range
      riskThresholdHigh: null, // missing
    });
    const out = await getActiveRiskThresholds();
    expect(out).toEqual(DEFAULT_RISK_THRESHOLDS);
  });

  it("returns defaults if the DB read throws", async () => {
    findUnique.mockRejectedValue(new Error("DB down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await getActiveRiskThresholds();
    expect(out).toEqual(DEFAULT_RISK_THRESHOLDS);
    spy.mockRestore();
  });
});

describe("riskLevelFromResiliencePercent (boundary)", () => {
  it("maps default thresholds correctly", () => {
    expect(riskLevelFromResiliencePercent(100)).toBe("low");
    expect(riskLevelFromResiliencePercent(80)).toBe("low");
    expect(riskLevelFromResiliencePercent(79.99)).toBe("medium");
    expect(riskLevelFromResiliencePercent(60)).toBe("medium");
    expect(riskLevelFromResiliencePercent(59.99)).toBe("high");
    expect(riskLevelFromResiliencePercent(40)).toBe("high");
    expect(riskLevelFromResiliencePercent(39.99)).toBe("critical");
    expect(riskLevelFromResiliencePercent(0)).toBe("critical");
  });

  it("respects custom thresholds", () => {
    const custom = { lowMin: 90, mediumMin: 70, highMin: 50 };
    expect(riskLevelFromResiliencePercent(95, custom)).toBe("low");
    expect(riskLevelFromResiliencePercent(85, custom)).toBe("medium");
    expect(riskLevelFromResiliencePercent(65, custom)).toBe("high");
    expect(riskLevelFromResiliencePercent(45, custom)).toBe("critical");
  });

  it("produces a defined level for monotonic-violating thresholds (defensive)", () => {
    // Bad config: lowMin <= mediumMin <= highMin. The cascade still returns
    // a defined level — the first cutoff that matches wins, even if the
    // semantics are wrong. Server action prevents this from being persisted.
    const bad = { lowMin: 30, mediumMin: 50, highMin: 70 };
    expect(riskLevelFromResiliencePercent(40, bad)).toBe("low"); // matches lowMin first
    expect(riskLevelFromResiliencePercent(20, bad)).toBe("critical"); // falls through
  });
});
