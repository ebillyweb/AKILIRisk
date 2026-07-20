import { describe, it, expect } from "vitest";
import { clientNarrative, advisorNarrative } from "./narrative-display";

const copy = {
  pillarSummary: "Summary.",
  headline: "Close the wire-transfer gap",
  rationale: "You do not verify wire requests out of band.",
  tailoredActions: ["Require call-back", "Agree a code word"],
  citedFindings: ["10.1"],
  confidence: "high",
};

describe("clientNarrative gating", () => {
  it("returns null when pending", () => {
    const c = { aiNarrative: copy, aiNarrativeReview: { status: "pending", edited: false } };
    expect(clientNarrative(c)).toBeNull();
  });
  it("returns the narrative when approved", () => {
    const c = { aiNarrative: copy, aiNarrativeReview: { status: "approved", edited: false } };
    const n = clientNarrative(c);
    expect(n?.headline).toBe(copy.headline);
    expect(n?.tailoredActions).toEqual(copy.tailoredActions);
  });
  it("returns null when there is no narrative", () => {
    expect(clientNarrative(null)).toBeNull();
    expect(clientNarrative({})).toBeNull();
    expect(clientNarrative({ aiNarrative: { headline: "x" } })).toBeNull(); // missing rationale
  });
});

describe("advisorNarrative", () => {
  it("returns narrative + pending review even before approval", () => {
    const c = { aiNarrative: copy, aiNarrativeReview: { status: "pending", edited: false } };
    const { narrative, review } = advisorNarrative(c);
    expect(narrative?.headline).toBe(copy.headline);
    expect(review.status).toBe("pending");
  });
  it("defaults review to pending when absent", () => {
    const { narrative, review } = advisorNarrative({ aiNarrative: copy });
    expect(narrative).not.toBeNull();
    expect(review.status).toBe("pending");
  });
  it("returns null narrative when none stored", () => {
    const { narrative } = advisorNarrative({});
    expect(narrative).toBeNull();
  });
});
