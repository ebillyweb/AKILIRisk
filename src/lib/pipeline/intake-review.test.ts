import { describe, expect, it } from "vitest";

import { isIntakeAwaitingAdvisorReview } from "./intake-review";

describe("isIntakeAwaitingAdvisorReview", () => {
  const submitted = {
    id: "int-1",
    status: "SUBMITTED" as const,
    submittedAt: new Date(),
  };

  it("is false when intake is waived", () => {
    expect(isIntakeAwaitingAdvisorReview(submitted, null, true)).toBe(false);
  });

  it("is true when submitted and no approval row", () => {
    expect(isIntakeAwaitingAdvisorReview(submitted, null, false)).toBe(true);
  });

  it("is true when approval is PENDING or IN_REVIEW", () => {
    expect(
      isIntakeAwaitingAdvisorReview(submitted, { status: "PENDING" }, false),
    ).toBe(true);
    expect(
      isIntakeAwaitingAdvisorReview(submitted, { status: "IN_REVIEW" }, false),
    ).toBe(true);
  });

  it("is false when approved or rejected", () => {
    expect(
      isIntakeAwaitingAdvisorReview(submitted, { status: "APPROVED" }, false),
    ).toBe(false);
    expect(
      isIntakeAwaitingAdvisorReview(submitted, { status: "REJECTED" }, false),
    ).toBe(false);
  });

  it("is false when assessment is already completed", () => {
    expect(
      isIntakeAwaitingAdvisorReview(submitted, { status: "PENDING" }, false, {
        assessmentCompleted: true,
      }),
    ).toBe(false);
  });
});
