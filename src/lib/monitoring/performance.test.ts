import { describe, expect, it } from "vitest";

import {
  getPerformanceLevel,
  PERFORMANCE_THRESHOLDS,
} from "@/lib/monitoring/performance";

describe("getPerformanceLevel", () => {
  it("classifies durations into expected tiers", () => {
    expect(getPerformanceLevel(50)).toBe("FAST");
    expect(getPerformanceLevel(PERFORMANCE_THRESHOLDS.FAST)).toBe("FAST");
    expect(getPerformanceLevel(500)).toBe("WARNING");
    expect(getPerformanceLevel(PERFORMANCE_THRESHOLDS.WARNING)).toBe("WARNING");
    expect(getPerformanceLevel(2500)).toBe("SLOW");
    expect(getPerformanceLevel(PERFORMANCE_THRESHOLDS.SLOW)).toBe("SLOW");
  });

  it("treats 3–10s as slow rather than critical", () => {
    expect(getPerformanceLevel(3272)).toBe("SLOW");
    expect(getPerformanceLevel(7427)).toBe("SLOW");
    expect(getPerformanceLevel(PERFORMANCE_THRESHOLDS.CRITICAL)).toBe("SLOW");
  });

  it("only marks operations above 10s as critical", () => {
    expect(getPerformanceLevel(PERFORMANCE_THRESHOLDS.CRITICAL + 1)).toBe("CRITICAL");
    expect(getPerformanceLevel(15000)).toBe("CRITICAL");
  });
});
