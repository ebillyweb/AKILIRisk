import "server-only";

import type { EnterpriseRole } from "@prisma/client";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";

import { resolveBillingContext } from "./billing-context";

export const ENTERPRISE_ADVISOR_MEMBER_VISIBILITY_KEYS = [
  "portfolio",
  "methodology",
  "engagements",
  "reassessment",
  "productTours",
  "hideTierLockedNav",
] as const;

export type EnterpriseAdvisorMemberVisibilityKey =
  (typeof ENTERPRISE_ADVISOR_MEMBER_VISIBILITY_KEYS)[number];

export type EnterpriseAdvisorMemberVisibility = Record<
  EnterpriseAdvisorMemberVisibilityKey,
  boolean
>;

const enterpriseVisibilitySelect = {
  advisorMemberPortfolioVisible: true,
  advisorMemberMethodologyVisible: true,
  advisorMemberEngagementsVisible: true,
  advisorMemberReassessmentVisible: true,
  advisorMemberProductToursVisible: true,
  advisorMemberHideTierLockedNav: true,
} as const;

export function mapEnterpriseAdvisorMemberVisibility(row: {
  advisorMemberPortfolioVisible: boolean;
  advisorMemberMethodologyVisible: boolean;
  advisorMemberEngagementsVisible: boolean;
  advisorMemberReassessmentVisible: boolean;
  advisorMemberProductToursVisible: boolean;
  advisorMemberHideTierLockedNav: boolean;
}): EnterpriseAdvisorMemberVisibility {
  return {
    portfolio: row.advisorMemberPortfolioVisible,
    methodology: row.advisorMemberMethodologyVisible,
    engagements: row.advisorMemberEngagementsVisible,
    reassessment: row.advisorMemberReassessmentVisible,
    productTours: row.advisorMemberProductToursVisible,
    hideTierLockedNav: row.advisorMemberHideTierLockedNav,
  };
}

export const DEFAULT_ENTERPRISE_ADVISOR_MEMBER_VISIBILITY: EnterpriseAdvisorMemberVisibility =
  {
    portfolio: true,
    methodology: true,
    engagements: true,
    reassessment: true,
    productTours: true,
    hideTierLockedNav: false,
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

export function visibilityInputToEnterpriseUpdate(
  input: EnterpriseAdvisorMemberVisibilityInput,
) {
  return {
    advisorMemberPortfolioVisible: input.portfolio,
    advisorMemberMethodologyVisible: input.methodology,
    advisorMemberEngagementsVisible: input.engagements,
    advisorMemberReassessmentVisible: input.reassessment,
    advisorMemberProductToursVisible: input.productTours,
    advisorMemberHideTierLockedNav: input.hideTierLockedNav,
  };
}
