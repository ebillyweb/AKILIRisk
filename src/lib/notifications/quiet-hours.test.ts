import { describe, expect, it } from "vitest";

import { localTimeStringToUtc, utcTimeStringToLocal } from "./quiet-hours";

describe("quiet-hours time conversion", () => {
  it("round-trips local time through UTC storage", () => {
    const local = "14:30";
    const utc = localTimeStringToUtc(local);
    const back = utcTimeStringToLocal(utc);
    expect(back).toBe(local);
  });
});
