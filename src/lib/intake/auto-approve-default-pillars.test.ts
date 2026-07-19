import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    intakeApproval: {
      findFirst: vi.fn(),
    },
    clientAdvisorAssignment: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/data/advisor", () => ({
  createIntakeApproval: vi.fn(),
  updateIntakeApproval: vi.fn(),
}));

vi.mock("@/lib/data/intake", () => ({
  getIntakeInterview: vi.fn(),
}));

vi.mock("@/lib/intake/pillar-recommendations", () => ({
  computePillarRecommendations: vi.fn(),
}));

vi.mock("@/lib/intake/load-intake-script", () => ({
  loadIntakeScriptQuestions: vi.fn(),
}));

vi.mock("@/lib/client/engagement-scope", () => ({
  persistClientEngagementScope: vi.fn(),
}));

vi.mock("@/lib/methodology/advisor-assessment-domains", () => ({
  loadAdvisorAssessmentDomainOptions: vi.fn(),
  assertAdvisorAssessmentDomainSelection: vi.fn(),
  ensureAllPlatformPillarsActiveForAdvisor: vi.fn(),
}));

vi.mock("@/lib/methodology/cached-pillar-catalog", () => ({
  getPlatformPillarCatalog: vi.fn(),
}));

vi.mock("@/lib/enterprise/advisor-member-visibility", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/enterprise/advisor-member-visibility")>();
  return {
    ...actual,
    resolveEnterpriseMemberVisibilityContext: vi.fn(),
    isEnterpriseMemberVisibilityEnabled: vi.fn(),
  };
});

vi.mock("@/lib/audit/audit-log", () => ({
  writeAudit: vi.fn(),
  AUDIT_ACTIONS: { INTAKE_APPROVE: "intake.approve" },
}));

vi.mock("@/lib/intake/notify-client-intake-approved", () => ({
  notifyClientOfIntakeApproval: vi.fn(),
}));

vi.mock("@/lib/auth/user-email", () => ({
  decryptUserEmail: vi.fn(() => "advisor@example.com"),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { approveIntakeWithDefaultPillars, tryAutoApproveSelfServiceIntakeAfterSubmit } from "./auto-approve-default-pillars";
import {
  ensureAllPlatformPillarsActiveForAdvisor,
  loadAdvisorAssessmentDomainOptions,
} from "@/lib/methodology/advisor-assessment-domains";
import { getPlatformPillarCatalog } from "@/lib/methodology/cached-pillar-catalog";
import { createIntakeApproval, updateIntakeApproval } from "@/lib/data/advisor";
import { getIntakeInterview } from "@/lib/data/intake";
import { loadIntakeScriptQuestions } from "@/lib/intake/load-intake-script";
import { computePillarRecommendations } from "@/lib/intake/pillar-recommendations";
import { persistClientEngagementScope } from "@/lib/client/engagement-scope";
import {
  isEnterpriseMemberVisibilityEnabled,
  resolveEnterpriseMemberVisibilityContext,
} from "@/lib/enterprise/advisor-member-visibility";
import { writeAudit } from "@/lib/audit/audit-log";

const mockAssignmentFindFirst = vi.mocked(prisma.clientAdvisorAssignment.findFirst);
const mockApprovalFindFirst = vi.mocked(prisma.intakeApproval.findFirst);
const mockVisibilityContext = vi.mocked(resolveEnterpriseMemberVisibilityContext);
const mockVisibilityEnabled = vi.mocked(isEnterpriseMemberVisibilityEnabled);
const mockEnsurePlatformActive = vi.mocked(ensureAllPlatformPillarsActiveForAdvisor);

describe("tryAutoApproveSelfServiceIntakeAfterSubmit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApprovalFindFirst.mockResolvedValue(null);
    mockAssignmentFindFirst.mockResolvedValue({
      advisorId: "adv-1",
      advisor: {
        userId: "user-1",
        user: { role: "ADVISOR", emailCiphertext: "cipher" },
      },
    } as never);
    mockVisibilityContext.mockResolvedValue({
      applyRestrictions: true,
      settings: {
        portfolio: true,
        assessmentLeads: true,
        methodology: true,
        engagements: true,
        reassessment: true,
        productTours: true,
        hideTierLockedNav: false,
        skipIntake: false,
        skipPostIntakeReview: true,
        documentRequirements: true,
        actionPlan: true,
        sharedClientVisibility: false,
      },
      enterpriseId: "ent-1",
      role: "ADVISOR",
    });
    mockVisibilityEnabled.mockReturnValue(true);
    vi.mocked(loadAdvisorAssessmentDomainOptions).mockResolvedValue([
      { id: "governance", name: "Governance", summary: "" },
      { id: "cyber-digital", name: "Cyber", summary: "" },
    ]);
    vi.mocked(getPlatformPillarCatalog).mockResolvedValue([
      { id: "governance", name: "Governance", summary: "", displayOrder: 1 },
      { id: "cyber-digital", name: "Cyber", summary: "", displayOrder: 2 },
    ]);
    vi.mocked(getIntakeInterview).mockResolvedValue({ responses: [] } as never);
    vi.mocked(loadIntakeScriptQuestions).mockResolvedValue([]);
    vi.mocked(computePillarRecommendations).mockReturnValue([]);
    vi.mocked(createIntakeApproval).mockResolvedValue({ id: "appr-draft" } as never);
    vi.mocked(updateIntakeApproval).mockResolvedValue({ id: "appr-1" } as never);
    vi.mocked(persistClientEngagementScope).mockResolvedValue({
      includedPillars: ["governance", "cyber-digital"],
      focusAreas: ["governance", "cyber-digital"],
    });
    mockEnsurePlatformActive.mockResolvedValue(undefined);
  });

  it("auto-approves self-service intake when policy allows", async () => {
    const approved = await tryAutoApproveSelfServiceIntakeAfterSubmit("int-1", "client-1");

    expect(approved).toBe(true);
    expect(mockEnsurePlatformActive).toHaveBeenCalled();
    expect(writeAudit).toHaveBeenCalled();
    expect(persistClientEngagementScope).toHaveBeenCalledWith(
      expect.objectContaining({
        includedPillars: ["governance", "cyber-digital"],
        focusAreas: ["governance", "cyber-digital"],
      }),
    );
  });

  it("returns false when post-intake review skip is disabled", async () => {
    mockVisibilityEnabled.mockReturnValue(false);

    const approved = await tryAutoApproveSelfServiceIntakeAfterSubmit("int-1", "client-1");

    expect(approved).toBe(false);
    expect(persistClientEngagementScope).not.toHaveBeenCalled();
  });
});

describe("approveIntakeWithDefaultPillars", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadAdvisorAssessmentDomainOptions).mockResolvedValue([
      { id: "governance", name: "Governance", summary: "" },
      { id: "cyber-digital", name: "Cyber", summary: "" },
    ]);
    vi.mocked(getPlatformPillarCatalog).mockResolvedValue([
      { id: "governance", name: "Governance", summary: "", displayOrder: 1 },
      { id: "cyber-digital", name: "Cyber", summary: "", displayOrder: 2 },
    ]);
    vi.mocked(getIntakeInterview).mockResolvedValue({ responses: [] } as never);
    vi.mocked(loadIntakeScriptQuestions).mockResolvedValue([]);
    vi.mocked(computePillarRecommendations).mockReturnValue([]);
    vi.mocked(createIntakeApproval).mockResolvedValue({ id: "appr-draft" } as never);
    vi.mocked(updateIntakeApproval).mockResolvedValue({ id: "appr-1" } as never);
    vi.mocked(persistClientEngagementScope).mockResolvedValue({
      includedPillars: ["governance", "cyber-digital"],
      focusAreas: ["governance", "cyber-digital"],
    });
    mockEnsurePlatformActive.mockResolvedValue(undefined);
  });

  it("defaults to the full platform catalog, not only pre-active advisor domains", async () => {
    const result = await approveIntakeWithDefaultPillars({
      interviewId: "int-1",
      clientUserId: "client-1",
      advisorProfileId: "adv-1",
    });

    expect(mockEnsurePlatformActive).toHaveBeenCalledWith("adv-1");
    expect(result).toEqual({
      approvalId: "appr-1",
      includedPillars: ["governance", "cyber-digital"],
      focusAreas: ["governance", "cyber-digital"],
    });
    expect(updateIntakeApproval).toHaveBeenCalledWith(
      "appr-draft",
      expect.objectContaining({
        includedPillars: ["governance", "cyber-digital"],
        focusAreas: ["governance", "cyber-digital"],
      }),
    );
  });

  it("returns null when the platform catalog is empty", async () => {
    vi.mocked(getPlatformPillarCatalog).mockResolvedValue([]);

    const result = await approveIntakeWithDefaultPillars({
      interviewId: "int-1",
      clientUserId: "client-1",
      advisorProfileId: "adv-1",
    });

    expect(result).toBeNull();
  });
});
