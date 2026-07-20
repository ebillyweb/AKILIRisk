import { describe, it, expect } from "vitest";
import {
  PENDING_REVIEW,
  parseReview,
  isNarrativeVisibleToClient,
  applyNarrativeEdit,
  approveNarrative,
  unapproveNarrative,
  type EditableNarrative,
  type NarrativeReview,
} from "./narrative-review";

const narrative: EditableNarrative = {
  headline: "Close the wire-transfer gap",
  rationale: "You do not verify wire requests out of band.",
  tailoredActions: ["Require call-back", "Agree a code word"],
};

describe("client visibility gate", () => {
  it("hides pending, shows approved", () => {
    expect(isNarrativeVisibleToClient(PENDING_REVIEW)).toBe(false);
    expect(isNarrativeVisibleToClient({ status: "approved", edited: false })).toBe(true);
    expect(isNarrativeVisibleToClient(null)).toBe(false);
  });
});

describe("parseReview", () => {
  it("defaults unknown/empty to pending", () => {
    expect(parseReview(undefined)).toEqual({ status: "pending", edited: false });
    expect(parseReview({ status: "bogus" }).status).toBe("pending");
  });
  it("preserves a stored approved review", () => {
    const r = parseReview({ status: "approved", edited: true, reviewedBy: "u1", reviewedAt: "t" });
    expect(r).toMatchObject({ status: "approved", edited: true, reviewedBy: "u1", reviewedAt: "t" });
  });
});

describe("applyNarrativeEdit", () => {
  it("applies defined edits and preserves the original on first edit", () => {
    const { narrative: n1, review: r1 } = applyNarrativeEdit(narrative, PENDING_REVIEW, {
      rationale: "Refined advisor wording.",
    });
    expect(n1.rationale).toBe("Refined advisor wording.");
    expect(n1.headline).toBe(narrative.headline); // untouched
    expect(r1.edited).toBe(true);
    expect(r1.original).toEqual(narrative); // model's original preserved
  });

  it("keeps the FIRST original across multiple edits", () => {
    const step1 = applyNarrativeEdit(narrative, PENDING_REVIEW, { headline: "Edit one" });
    const step2 = applyNarrativeEdit(step1.narrative, step1.review, { headline: "Edit two" });
    expect(step2.narrative.headline).toBe("Edit two");
    expect(step2.review.original?.headline).toBe(narrative.headline); // still the model's first
  });

  it("ignores empty/blank edit fields", () => {
    const { narrative: n } = applyNarrativeEdit(narrative, PENDING_REVIEW, {
      headline: "   ",
      tailoredActions: [],
    });
    expect(n.headline).toBe(narrative.headline);
    expect(n.tailoredActions).toEqual(narrative.tailoredActions);
  });

  it("editing an approved narrative keeps it approved", () => {
    const approved: NarrativeReview = { status: "approved", edited: false, reviewedBy: "u1", reviewedAt: "t" };
    const { review } = applyNarrativeEdit(narrative, approved, { rationale: "tweak" });
    expect(review.status).toBe("approved");
    expect(review.edited).toBe(true);
  });
});

describe("approve / unapprove", () => {
  it("approve records reviewer + timestamp and gates the client in", () => {
    const r = approveNarrative(PENDING_REVIEW, "advisor-1", "2026-07-19T00:00:00Z");
    expect(r).toMatchObject({ status: "approved", reviewedBy: "advisor-1", reviewedAt: "2026-07-19T00:00:00Z" });
    expect(isNarrativeVisibleToClient(r)).toBe(true);
  });

  it("unapprove hides it from the client again", () => {
    const approved = approveNarrative(PENDING_REVIEW, "advisor-1", "t");
    const back = unapproveNarrative(approved);
    expect(back.status).toBe("pending");
    expect(back.reviewedBy).toBeUndefined();
    expect(isNarrativeVisibleToClient(back)).toBe(false);
  });
});
