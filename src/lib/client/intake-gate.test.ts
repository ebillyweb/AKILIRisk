import { describe, expect, it, vi, beforeEach } from "vitest";
import { getClientIntakeGateState } from "@/lib/client/intake-gate";

const mockGetEngagementScope = vi.fn();
const mockFindInterview = vi.fn();
const mockFindApproval = vi.fn();

vi.mock("@/lib/client/engagement-scope", () => ({
  getClientEngagementScope: (...args: unknown[]) => mockGetEngagementScope(...args),
  isEngagementAssessmentUnlocked: (scope: { includedPillars: string[] }) =>
    scope.includedPillars.length > 0,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    intakeInterview: {
      findFirst: (...args: unknown[]) => mockFindInterview(...args),
    },
    intakeApproval: {
      findFirst: (...args: unknown[]) => mockFindApproval(...args),
    },
  },
}));

describe("getClientIntakeGateState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEngagementScope.mockResolvedValue({
      includedPillars: [],
      focusAreas: [],
      source: null,
      approvalId: null,
      assignmentId: "asg-1",
      intakeWaived: false,
      assessmentWaived: false,
    });
    mockFindInterview.mockResolvedValue({ id: "iv-1" });
    mockFindApproval.mockResolvedValue(null);
  });

  it("locks assessment when engagement scope is empty", async () => {
    const gate = await getClientIntakeGateState("client-1");
    expect(gate.assessmentUnlocked).toBe(false);
    expect(gate.intakeApproved).toBe(false);
  });

  it("unlocks assessment when engagement scope is set", async () => {
    mockGetEngagementScope.mockResolvedValue({
      includedPillars: ["governance", "cyber-digital"],
      focusAreas: ["governance", "cyber-digital"],
      source: "assignment",
      approvalId: null,
      assignmentId: "asg-1",
      intakeWaived: false,
      assessmentWaived: false,
    });
    mockFindApproval.mockResolvedValue({ status: "APPROVED" });

    const gate = await getClientIntakeGateState("client-1");
    expect(gate.assessmentUnlocked).toBe(true);
    expect(gate.intakeApproved).toBe(true);
  });

  it("does not unlock on waiver alone without assessment domains", async () => {
    mockGetEngagementScope.mockResolvedValue({
      includedPillars: [],
      focusAreas: [],
      source: null,
      approvalId: null,
      assignmentId: "asg-1",
      intakeWaived: true,
      assessmentWaived: false,
    });

    const gate = await getClientIntakeGateState("client-1");
    expect(gate.intakeWaived).toBe(true);
    expect(gate.assessmentScopePending).toBe(true);
    expect(gate.assessmentUnlocked).toBe(false);
  });

  it("unlocks when intake waived with assignment pillar scope", async () => {
    mockGetEngagementScope.mockResolvedValue({
      includedPillars: ["governance", "cyber-digital"],
      focusAreas: ["governance", "cyber-digital"],
      source: "assignment",
      approvalId: null,
      assignmentId: "asg-1",
      intakeWaived: true,
      assessmentWaived: false,
    });

    const gate = await getClientIntakeGateState("client-1");
    expect(gate.intakeWaived).toBe(true);
    expect(gate.assessmentUnlocked).toBe(true);
    expect(gate.assessmentScopePending).toBe(false);
  });

  it("returns assessmentWaived when set on engagement scope", async () => {
    mockGetEngagementScope.mockResolvedValue({
      includedPillars: ["governance"],
      focusAreas: ["governance"],
      source: "assignment",
      approvalId: null,
      assignmentId: "asg-1",
      intakeWaived: false,
      assessmentWaived: true,
    });

    const gate = await getClientIntakeGateState("client-1");
    expect(gate.assessmentWaived).toBe(true);
  });

  it("does not unlock when approved but engagement scope empty", async () => {
    mockFindApproval.mockResolvedValue({ status: "APPROVED" });

    const gate = await getClientIntakeGateState("client-1");
    expect(gate.intakeApproved).toBe(true);
    expect(gate.assessmentUnlocked).toBe(false);
  });
});
