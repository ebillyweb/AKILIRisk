import { describe, expect, it } from "vitest";

import {
  startOfDayInTimeZone,
  startOfPriorDayInTimeZone,
  US_CENTRAL_TIMEZONE,
} from "./timezone-day-boundary";

describe("startOfDayInTimeZone (America/Chicago)", () => {
  it("returns midnight Central for a midday UTC instant in CDT", () => {
    const instant = new Date("2026-06-15T18:00:00.000Z");
    const start = startOfDayInTimeZone(instant, US_CENTRAL_TIMEZONE);
    expect(start.toISOString()).toBe("2026-06-15T05:00:00.000Z");
  });

  it("returns previous Central day before local midnight", () => {
    const beforeMidnight = new Date("2026-06-15T04:30:00.000Z");
    const start = startOfDayInTimeZone(beforeMidnight, US_CENTRAL_TIMEZONE);
    expect(start.toISOString()).toBe("2026-06-14T05:00:00.000Z");
  });

  it("uses CST offset in winter", () => {
    const instant = new Date("2026-01-15T18:00:00.000Z");
    const start = startOfDayInTimeZone(instant, US_CENTRAL_TIMEZONE);
    expect(start.toISOString()).toBe("2026-01-15T06:00:00.000Z");
  });

  it("startOfPriorDayInTimeZone steps back one Central calendar day", () => {
    const instant = new Date("2026-06-15T18:00:00.000Z");
    const yesterday = startOfPriorDayInTimeZone(instant, US_CENTRAL_TIMEZONE);
    expect(yesterday.toISOString()).toBe("2026-06-14T05:00:00.000Z");
  });
});
