import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    advisorEnterprise: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("./billing-context", () => ({
  resolveBillingContext: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { resolveBillingContext } from "./billing-context";
import {
  DEFAULT_ENTERPRISE_ADVISOR_MEMBER_VISIBILITY,
  getEnterpriseAdvisorMemberVisibilityForEnterprise,
  isEnterpriseActionPlanWorkspaceEnabled,
  isEnterpriseDocumentRequirementsWorkspaceEnabled,
  isEnterpriseMemberVisibilityEnabled,
  isEnterpriseSkipIntakeWorkspaceEnabled,
  mapEnterpriseAdvisorMemberVisibility,
  resolveEnterpriseMemberVisibilityContext,
  visibilityInputToEnterpriseUpdate,
} from "./advisor-member-visibility";

const mockFindUnique = vi.mocked(prisma.advisorEnterprise.findUnique);
const mockBillingContext = vi.mocked(resolveBillingContext);

describe("mapEnterpriseAdvisorMemberVisibility", () => {
  it("maps database columns to visibility keys", () => {
    expect(
      mapEnterpriseAdvisorMemberVisibility({
        advisorMemberPortfolioVisible: false,
        advisorMemberAssessmentLeadsVisible: true,
        advisorMemberMethodologyVisible: true,
        advisorMemberEngagementsVisible: false,
        advisorMemberReassessmentVisible: true,
        advisorMemberProductToursVisible: false,
        advisorMemberHideTierLockedNav: false,
        advisorMemberSkipIntakeEnabled: false,
        advisorMemberSkipPostIntakeReviewEnabled: false,
        advisorMemberDocumentRequirementsEnabled: true,
        advisorMemberActionPlanEnabled: true,
      }),
    ).toEqual({
      portfolio: false,
      assessmentLeads: true,
      methodology: true,
      engagements: false,
      reassessment: true,
      productTours: false,
      hideTierLockedNav: false,
      skipIntake: false,
      skipPostIntakeReview: false,
      documentRequirements: true,
      actionPlan: true,
    });
  });
});

describe("resolveEnterpriseMemberVisibilityContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not apply restrictions for solo advisors", async () => {
    mockBillingContext.mockResolvedValue({
      kind: "solo",
      userId: "u1",
      advisorProfileId: "p1",
      subscription: null,
    });

    const result = await resolveEnterpriseMemberVisibilityContext("u1");
    expect(result.applyRestrictions).toBe(false);
    expect(result.settings).toEqual(DEFAULT_ENTERPRISE_ADVISOR_MEMBER_VISIBILITY);
    expect(isEnterpriseSkipIntakeWorkspaceEnabled(result)).toBe(true);
  });

  it("applies restrictions for enterprise ADVISOR role", async () => {
    mockBillingContext.mockResolvedValue({
      kind: "enterprise",
      enterpriseId: "ent-1",
      role: "ADVISOR",
      advisorProfileId: "p1",
      subscription: null,
    });
    mockFindUnique.mockResolvedValue({
      advisorMemberPortfolioVisible: false,
      advisorMemberAssessmentLeadsVisible: true,
      advisorMemberMethodologyVisible: true,
      advisorMemberEngagementsVisible: true,
      advisorMemberReassessmentVisible: true,
      advisorMemberProductToursVisible: true,
      advisorMemberHideTierLockedNav: false,
      advisorMemberSkipIntakeEnabled: false,
      advisorMemberSkipPostIntakeReviewEnabled: false,
      advisorMemberDocumentRequirementsEnabled: false,
      advisorMemberActionPlanEnabled: false,
    });

    const result = await resolveEnterpriseMemberVisibilityContext("u1");
    expect(result.applyRestrictions).toBe(true);
    expect(result.settings.portfolio).toBe(false);
    expect(isEnterpriseMemberVisibilityEnabled(result, "skipIntake")).toBe(false);
    expect(isEnterpriseMemberVisibilityEnabled(result, "documentRequirements")).toBe(false);
  });

  it("does not apply restrictions for enterprise OWNER", async () => {
    mockBillingContext.mockResolvedValue({
      kind: "enterprise",
      enterpriseId: "ent-1",
      role: "OWNER",
      advisorProfileId: "p1",
      subscription: null,
    });
    mockFindUnique.mockResolvedValue({
      advisorMemberPortfolioVisible: false,
      advisorMemberAssessmentLeadsVisible: false,
      advisorMemberMethodologyVisible: false,
      advisorMemberEngagementsVisible: false,
      advisorMemberReassessmentVisible: false,
      advisorMemberProductToursVisible: false,
      advisorMemberHideTierLockedNav: false,
      advisorMemberSkipIntakeEnabled: false,
      advisorMemberSkipPostIntakeReviewEnabled: false,
      advisorMemberDocumentRequirementsEnabled: false,
      advisorMemberActionPlanEnabled: false,
    });

    const result = await resolveEnterpriseMemberVisibilityContext("u1");
    expect(result.applyRestrictions).toBe(false);
    expect(isEnterpriseMemberVisibilityEnabled(result, "portfolio")).toBe(true);
    expect(isEnterpriseMemberVisibilityEnabled(result, "skipIntake")).toBe(true);
    expect(isEnterpriseMemberVisibilityEnabled(result, "documentRequirements")).toBe(true);
    expect(isEnterpriseSkipIntakeWorkspaceEnabled(result)).toBe(false);
    expect(isEnterpriseDocumentRequirementsWorkspaceEnabled(result)).toBe(false);
    expect(isEnterpriseActionPlanWorkspaceEnabled(result)).toBe(false);
  });
});

describe("visibilityInputToEnterpriseUpdate", () => {
  it("maps form input to prisma update payload", () => {
    expect(
      visibilityInputToEnterpriseUpdate({
        portfolio: true,
        assessmentLeads: false,
        methodology: false,
        engagements: true,
        reassessment: false,
        productTours: true,
        hideTierLockedNav: false,
        skipIntake: false,
        skipPostIntakeReview: false,
        documentRequirements: false,
        actionPlan: false,
      }),
    ).toEqual({
      advisorMemberPortfolioVisible: true,
      advisorMemberAssessmentLeadsVisible: false,
      advisorMemberMethodologyVisible: false,
      advisorMemberEngagementsVisible: true,
      advisorMemberReassessmentVisible: false,
      advisorMemberProductToursVisible: true,
      advisorMemberHideTierLockedNav: false,
      advisorMemberSkipIntakeEnabled: false,
      advisorMemberSkipPostIntakeReviewEnabled: false,
      advisorMemberDocumentRequirementsEnabled: false,
      advisorMemberActionPlanEnabled: false,
    });
  });
});

describe("getEnterpriseAdvisorMemberVisibilityForEnterprise", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns defaults when enterprise is missing", async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await getEnterpriseAdvisorMemberVisibilityForEnterprise("missing");
    expect(result).toEqual(DEFAULT_ENTERPRISE_ADVISOR_MEMBER_VISIBILITY);
  });
});
