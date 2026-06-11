import { describe, expect, it, vi, beforeEach } from "vitest";
import { getClientIntakeGateState } from "@/lib/client/intake-gate";

const mockFindAssignment = vi.fn();
const mockFindInterview = vi.fn();
const mockFindApproval = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    clientAdvisorAssignment: {
      findFirst: (...args: unknown[]) => mockFindAssignment(...args),
    },
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
    mockFindAssignment.mockResolvedValue({
      intakeWaivedAt: null,
      includedPillars: [],
    });
    mockFindInterview.mockResolvedValue({ id: "iv-1" });
  });

  it("locks assessment when intake not approved with pillars", async () => {
    mockFindApproval.mockResolvedValue(null);

    const gate = await getClientIntakeGateState("client-1");
    expect(gate.assessmentUnlocked).toBe(false);
    expect(gate.intakeApproved).toBe(false);
  });

  it("unlocks assessment when approved with included pillars", async () => {
    mockFindApproval.mockResolvedValue({
      status: "APPROVED",
      includedPillars: ["governance", "cyber-digital"],
    });

    const gate = await getClientIntakeGateState("client-1");
    expect(gate.assessmentUnlocked).toBe(true);
    expect(gate.intakeApproved).toBe(true);
  });

  it("does not unlock on waiver alone without assessment domains", async () => {
    mockFindAssignment.mockResolvedValue({
      intakeWaivedAt: new Date(),
      includedPillars: [],
    });
    mockFindApproval.mockResolvedValue(null);

    const gate = await getClientIntakeGateState("client-1");
    expect(gate.intakeWaived).toBe(true);
    expect(gate.assessmentScopePending).toBe(true);
    expect(gate.assessmentUnlocked).toBe(false);
  });

  it("unlocks when intake waived with assignment pillar scope", async () => {
    mockFindAssignment.mockResolvedValue({
      intakeWaivedAt: new Date(),
      includedPillars: ["governance", "cyber-digital"],
    });
    mockFindApproval.mockResolvedValue(null);

    const gate = await getClientIntakeGateState("client-1");
    expect(gate.intakeWaived).toBe(true);
    expect(gate.assessmentUnlocked).toBe(true);
    expect(gate.assessmentScopePending).toBe(false);
  });

  it("does not unlock when approved but included pillars empty", async () => {
    mockFindApproval.mockResolvedValue({
      status: "APPROVED",
      includedPillars: [],
    });

    const gate = await getClientIntakeGateState("client-1");
    expect(gate.intakeApproved).toBe(true);
    expect(gate.assessmentUnlocked).toBe(false);
  });
});
