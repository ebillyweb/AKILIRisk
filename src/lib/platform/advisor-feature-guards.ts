import "server-only";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import {
  requireEnterpriseMemberVisibility,
  type EnterpriseAdvisorMemberVisibilityKey,
} from "@/lib/enterprise/advisor-member-visibility";
import { getPlatformFeatureFlags } from "@/lib/platform/feature-flags";

const DISABLED_REDIRECT = "/advisor";

async function requireEnterpriseMemberNavAccess(
  key: EnterpriseAdvisorMemberVisibilityKey,
) {
  const session = await auth();
  if (session?.user?.id) {
    await requireEnterpriseMemberVisibility(session.user.id, key, DISABLED_REDIRECT);
  }
}

export async function requireAdvisorGovernanceDashboardEnabled() {
  const flags = await getPlatformFeatureFlags();
  if (!flags.governanceDashboardEnabled) {
    redirect(DISABLED_REDIRECT);
  }
  await requireEnterpriseMemberNavAccess("portfolio");
}

export async function requireAdvisorRiskIntelligenceEnabled() {
  const flags = await getPlatformFeatureFlags();
  if (!flags.riskIntelligenceEnabled) {
    redirect(DISABLED_REDIRECT);
  }
  await requireEnterpriseMemberNavAccess("portfolio");
}

export async function requireAdvisorMethodologyMemberAccess() {
  await requireEnterpriseMemberNavAccess("methodology");
}

export async function requireAdvisorEngagementsMemberAccess() {
  await requireEnterpriseMemberNavAccess("engagements");
}

export async function requireAdvisorReassessmentMemberAccess() {
  await requireEnterpriseMemberNavAccess("reassessment");
}
