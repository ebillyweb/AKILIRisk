import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    facilitatedSession: {
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/intake/auto-approve-default-pillars", () => ({
  approveIntakeWithDefaultPillars: vi.fn(),
  canAdvisorSkipPostIntakeReview: vi.fn(),
}));

vi.mock("@/lib/enterprise/advisor-member-visibility", () => ({
  resolveEnterpriseMemberVisibilityContext: vi.fn(),
}));

vi.mock("@/lib/facilitated/bootstrap-assessment-from-approval", () => ({
  ensureScopedAssessmentForClient: vi.fn(),
}));

vi.mock("@/lib/methodology/cached-pillar-catalog", () => ({
  getPlatformPillarCatalog: vi.fn(),
}));

vi.mock("@/lib/audit/audit-log", () => ({
  writeAudit: vi.fn(),
  AUDIT_ACTIONS: { FACILITATED_SESSION_SCOPE_SET: "facilitated_session.scope_set" },
}));

import { prisma } from "@/lib/db";
import {
  approveIntakeWithDefaultPillars,
  canAdvisorSkipPostIntakeReview,
} from "@/lib/intake/auto-approve-default-pillars";
import { resolveEnterpriseMemberVisibilityContext } from "@/lib/enterprise/advisor-member-visibility";
import { ensureScopedAssessmentForClient } from "@/lib/facilitated/bootstrap-assessment-from-approval";
import { getPlatformPillarCatalog } from "@/lib/methodology/cached-pillar-catalog";
import { tryAdvanceFacilitatedPastPostIntakeReview } from "./post-intake-advance";

const mockApprove = vi.mocked(approveIntakeWithDefaultPillars);
const mockCanSkip = vi.mocked(canAdvisorSkipPostIntakeReview);
const mockEnsureAssessment = vi.mocked(ensureScopedAssessmentForClient);
const mockCatalog = vi.mocked(getPlatformPillarCatalog);
const mockSessionUpdate = vi.mocked(prisma.facilitatedSession.update);

describe("tryAdvanceFacilitatedPastPostIntakeReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveEnterpriseMemberVisibilityContext).mockResolvedValue({
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
    mockCanSkip.mockReturnValue(true);
    mockApprove.mockResolvedValue({
      approvalId: "appr-1",
      includedPillars: ["governance", "cyber"],
      focusAreas: ["governance", "cyber"],
    });
    mockCatalog.mockResolvedValue([
      { id: "governance", name: "Governance", summary: "", displayOrder: 1 },
      { id: "cyber", name: "Cyber", summary: "", displayOrder: 2 },
    ]);
    mockEnsureAssessment.mockResolvedValue("asm-1");
    mockSessionUpdate.mockResolvedValue({ id: "sess-1" } as never);
  });

  it("advances facilitated sessions with default pillars when policy allows", async () => {
    const path = await tryAdvanceFacilitatedPastPostIntakeReview({
      facilitatedSessionId: "sess-1",
      clientUserId: "client-1",
      interviewId: "int-1",
      advisorProfileId: "adv-1",
      advisorUserId: "user-1",
      actor: { userId: "user-1", role: "ADVISOR", email: "a@example.com" },
    });

    expect(mockApprove).toHaveBeenCalledWith({
      interviewId: "int-1",
      clientUserId: "client-1",
      advisorProfileId: "adv-1",
    });
    expect(path).toBe("/advisor/facilitate/sess-1/assessment/governance/0");
  });

  it("returns null when post-intake review skip is disabled", async () => {
    mockCanSkip.mockReturnValue(false);

    const path = await tryAdvanceFacilitatedPastPostIntakeReview({
      facilitatedSessionId: "sess-1",
      clientUserId: "client-1",
      interviewId: "int-1",
      advisorProfileId: "adv-1",
      advisorUserId: "user-1",
      actor: { userId: "user-1", role: "ADVISOR", email: "a@example.com" },
    });

    expect(path).toBeNull();
    expect(mockApprove).not.toHaveBeenCalled();
  });
});
