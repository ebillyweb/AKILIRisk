import { describe, expect, it } from "vitest";
import { formatIntakeApprovalStatus } from "./approval-status-label";

describe("formatIntakeApprovalStatus", () => {
  it("maps approval enums to plain English", () => {
    expect(formatIntakeApprovalStatus("APPROVED")).toBe("Approved");
    expect(formatIntakeApprovalStatus("IN_REVIEW")).toBe("Under review");
    expect(formatIntakeApprovalStatus("PENDING")).toBe("Pending review");
    expect(formatIntakeApprovalStatus("REJECTED")).toBe("Rejected");
  });
});
