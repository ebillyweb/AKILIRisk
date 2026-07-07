import "server-only";

import type { EnterpriseRole } from "@prisma/client";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";

import { resolveBillingContext } from "./billing-context";

export const ENTERPRISE_ADVISOR_MEMBER_VISIBILITY_KEYS = [
  "portfolio",
  "assessmentLeads",
  "methodology",
  "engagements",
  "reassessment",
  "productTours",
  "hideTierLockedNav",
  "skipIntake",
  "skipPostIntakeReview",
  "documentRequirements",
  "actionPlan",
] as const;

export type EnterpriseAdvisorMemberVisibilityKey =
  (typeof ENTERPRISE_ADVISOR_MEMBER_VISIBILITY_KEYS)[number];

export type EnterpriseAdvisorMemberVisibility = Record<
  EnterpriseAdvisorMemberVisibilityKey,
  boolean
>;

const enterpriseVisibilitySelect = {
  advisorMemberPortfolioVisible: true,
  advisorMemberAssessmentLeadsVisible: true,
  advisorMemberMethodologyVisible: true,
  advisorMemberEngagementsVisible: true,
  advisorMemberReassessmentVisible: true,
  advisorMemberProductToursVisible: true,
  advisorMemberHideTierLockedNav: true,
  advisorMemberSkipIntakeEnabled: true,
  advisorMemberSkipPostIntakeReviewEnabled: true,
  advisorMemberDocumentRequirementsEnabled: true,
  advisorMemberActionPlanEnabled: true,
} as const;

export function mapEnterpriseAdvisorMemberVisibility(row: {
  advisorMemberPortfolioVisible: boolean;
  advisorMemberAssessmentLeadsVisible: boolean;
  advisorMemberMethodologyVisible: boolean;
  advisorMemberEngagementsVisible: boolean;
  advisorMemberReassessmentVisible: boolean;
  advisorMemberProductToursVisible: boolean;
  advisorMemberHideTierLockedNav: boolean;
  advisorMemberSkipIntakeEnabled: boolean;
  advisorMemberSkipPostIntakeReviewEnabled: boolean;
  advisorMemberDocumentRequirementsEnabled: boolean;
  advisorMemberActionPlanEnabled: boolean;
}): EnterpriseAdvisorMemberVisibility {
  return {
    portfolio: row.advisorMemberPortfolioVisible,
    assessmentLeads: row.advisorMemberAssessmentLeadsVisible,
    methodology: row.advisorMemberMethodologyVisible,
    engagements: row.advisorMemberEngagementsVisible,
    reassessment: row.advisorMemberReassessmentVisible,
    productTours: row.advisorMemberProductToursVisible,
    hideTierLockedNav: row.advisorMemberHideTierLockedNav,
    skipIntake: row.advisorMemberSkipIntakeEnabled,
    skipPostIntakeReview: row.advisorMemberSkipPostIntakeReviewEnabled,
    documentRequirements: row.advisorMemberDocumentRequirementsEnabled,
    actionPlan: row.advisorMemberActionPlanEnabled,
  };
}

export const DEFAULT_ENTERPRISE_ADVISOR_MEMBER_VISIBILITY: EnterpriseAdvisorMemberVisibility =
  {
    portfolio: true,
    assessmentLeads: true,
    methodology: true,
    engagements: true,
    reassessment: true,
    productTours: true,
    hideTierLockedNav: false,
    skipIntake: false,
    skipPostIntakeReview: false,
    documentRequirements: true,
    actionPlan: true,
  };

export type EnterpriseMemberVisibilityContext = {
  /** When true, nav and routes should enforce firm visibility toggles. */
  applyRestrictions: boolean;
  settings: EnterpriseAdvisorMemberVisibility;
  enterpriseId: string | null;
  role: EnterpriseRole | null;
};

export async function getEnterpriseAdvisorMemberVisibilityForEnterprise(
  enterpriseId: string,
): Promise<EnterpriseAdvisorMemberVisibility> {
  const enterprise = await prisma.advisorEnterprise.findUnique({
    where: { id: enterpriseId },
    select: enterpriseVisibilitySelect,
  });
  if (!enterprise) {
    return DEFAULT_ENTERPRISE_ADVISOR_MEMBER_VISIBILITY;
  }
  return mapEnterpriseAdvisorMemberVisibility(enterprise);
}

/**
 * Resolve whether enterprise member visibility restrictions apply to this user.
 * OWNER and ADMIN are exempt; solo advisors are unaffected.
 */
export async function resolveEnterpriseMemberVisibilityContext(
  userId: string,
): Promise<EnterpriseMemberVisibilityContext> {
  const ctx = await resolveBillingContext(userId);
  if (!ctx || ctx.kind !== "enterprise") {
    return {
      applyRestrictions: false,
      settings: DEFAULT_ENTERPRISE_ADVISOR_MEMBER_VISIBILITY,
      enterpriseId: null,
      role: null,
    };
  }

  const settings = await getEnterpriseAdvisorMemberVisibilityForEnterprise(
    ctx.enterpriseId,
  );

  const applyRestrictions = ctx.role === "ADVISOR";

  return {
    applyRestrictions,
    settings,
    enterpriseId: ctx.enterpriseId,
    role: ctx.role,
  };
}

export function isEnterpriseMemberVisibilityEnabled(
  context: EnterpriseMemberVisibilityContext,
  key: EnterpriseAdvisorMemberVisibilityKey,
): boolean {
  if (!context.applyRestrictions) return true;
  return context.settings[key];
}

/**
 * Firm-level skip intake flag for invitations and pipeline waiver UI.
 * Applies to owners/admins as well — when disabled, the feature is hidden for the whole firm.
 * Solo advisors are unaffected.
 */
export function isEnterpriseSkipIntakeWorkspaceEnabled(
  context: EnterpriseMemberVisibilityContext,
): boolean {
  if (!context.enterpriseId) return true;
  return context.settings.skipIntake;
}

/**
 * Firm-level document requirements flag for advisor workspace UI and mutations.
 * Applies to owners/admins as well — when disabled, the feature is hidden for the whole firm.
 */
export function isEnterpriseDocumentRequirementsWorkspaceEnabled(
  context: EnterpriseMemberVisibilityContext,
): boolean {
  return context.settings.documentRequirements;
}

/**
 * Firm-level action plan flag for advisor workspace UI and client portal surfaces.
 */
export function isEnterpriseActionPlanWorkspaceEnabled(
  context: EnterpriseMemberVisibilityContext,
): boolean {
  return context.settings.actionPlan;
}

export async function requireEnterpriseMemberVisibility(
  userId: string,
  key: EnterpriseAdvisorMemberVisibilityKey,
  redirectTo = "/advisor",
): Promise<void> {
  const context = await resolveEnterpriseMemberVisibilityContext(userId);
  if (!isEnterpriseMemberVisibilityEnabled(context, key)) {
    redirect(redirectTo);
  }
}

export type EnterpriseAdvisorMemberVisibilityInput = EnterpriseAdvisorMemberVisibility;

export async function assertAdvisorCanSkipIntake(userId: string): Promise<void> {
  const context = await resolveEnterpriseMemberVisibilityContext(userId);
  if (!isEnterpriseSkipIntakeWorkspaceEnabled(context)) {
    throw new Error(
      "Your firm has disabled skip intake in the advisor workspace.",
    );
  }
}

export async function assertAdvisorCanSkipPostIntakeReview(
  userId: string,
): Promise<void> {
  const context = await resolveEnterpriseMemberVisibilityContext(userId);
  if (!isEnterpriseMemberVisibilityEnabled(context, "skipPostIntakeReview")) {
    throw new Error(
      "Your firm administrator has not allowed team members to skip post-intake review.",
    );
  }
}

export async function assertAdvisorCanManageActionPlan(
  userId: string,
): Promise<void> {
  const context = await resolveEnterpriseMemberVisibilityContext(userId);
  if (!isEnterpriseActionPlanWorkspaceEnabled(context)) {
    throw new Error(
      "Your firm has disabled action plans in the advisor workspace.",
    );
  }
}

export async function assertAdvisorCanManageDocumentRequirements(
  userId: string,
): Promise<void> {
  const context = await resolveEnterpriseMemberVisibilityContext(userId);
  if (!isEnterpriseDocumentRequirementsWorkspaceEnabled(context)) {
    throw new Error(
      "Your firm has disabled document requirements in the advisor workspace.",
    );
  }
  if (!isEnterpriseMemberVisibilityEnabled(context, "documentRequirements")) {
    throw new Error(
      "Your firm administrator has not allowed team members to manage document requirements.",
    );
  }
}

export function visibilityInputToEnterpriseUpdate(
  input: EnterpriseAdvisorMemberVisibilityInput,
) {
  return {
    advisorMemberPortfolioVisible: input.portfolio,
    advisorMemberAssessmentLeadsVisible: input.assessmentLeads,
    advisorMemberMethodologyVisible: input.methodology,
    advisorMemberEngagementsVisible: input.engagements,
    advisorMemberReassessmentVisible: input.reassessment,
    advisorMemberProductToursVisible: input.productTours,
    advisorMemberHideTierLockedNav: input.hideTierLockedNav,
    advisorMemberSkipIntakeEnabled: input.skipIntake,
    advisorMemberSkipPostIntakeReviewEnabled: input.skipPostIntakeReview,
    advisorMemberDocumentRequirementsEnabled: input.documentRequirements,
    advisorMemberActionPlanEnabled: input.actionPlan,
  };
}
