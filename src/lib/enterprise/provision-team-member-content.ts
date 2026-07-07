import "server-only";

import { prisma } from "@/lib/db";
import { cloneAdvisorDefaultsIfNeeded } from "@/lib/methodology/clone-advisor-defaults";
import {
  cloneEnterpriseDefaultsIfNeeded,
  syncEnterpriseRulesToAdvisor,
} from "@/lib/methodology/clone-enterprise-defaults";
import { syncEnterpriseMethodologyToAdvisor } from "@/lib/methodology/clone-enterprise-methodology";

/**
 * Copy firm recommendation rules and methodology onto a team member's advisor
 * profile after they accept an enterprise invite.
 */
export async function provisionEnterpriseTeamMemberContent(
  enterpriseId: string,
  advisorProfileId: string,
): Promise<void> {
  await cloneEnterpriseDefaultsIfNeeded(enterpriseId);
  await syncEnterpriseRulesToAdvisor(enterpriseId, advisorProfileId);
  await syncEnterpriseMethodologyToAdvisor(enterpriseId, advisorProfileId);

  const activeRuleCount = await prisma.advisorRecommendationRule.count({
    where: { advisorProfileId, isActive: true },
  });
  if (activeRuleCount === 0) {
    await cloneAdvisorDefaultsIfNeeded(advisorProfileId);
  }
}

export async function resolveEnterpriseIdForAdvisorProfile(
  advisorProfileId: string,
): Promise<string | null> {
  const profile = await prisma.advisorProfile.findUnique({
    where: { id: advisorProfileId },
    select: {
      enterpriseId: true,
      user: {
        select: {
          enterpriseMembership: {
            select: { enterpriseId: true, status: true },
          },
        },
      },
    },
  });

  const membership = profile?.user.enterpriseMembership;
  return (
    profile?.enterpriseId ??
    (membership?.status === "ACTIVE" ? membership.enterpriseId : null) ??
    null
  );
}

/** Backfill firm rules and methodology for members who joined before provisioning ran. */
export async function ensureEnterpriseTeamMemberProvisioned(
  advisorProfileId: string,
): Promise<void> {
  const enterpriseId = await resolveEnterpriseIdForAdvisorProfile(advisorProfileId);
  if (!enterpriseId) return;

  const [activeRuleCount, entPillarCount, linkedPillarCount] = await Promise.all([
    prisma.advisorRecommendationRule.count({
      where: { advisorProfileId, isActive: true },
    }),
    prisma.enterprisePillarOverride.count({ where: { enterpriseId } }),
    prisma.advisorPillarOverride.count({
      where: { advisorProfileId, enterpriseSourceId: { not: null } },
    }),
  ]);

  const needsRules = activeRuleCount === 0;
  const needsPillars =
    entPillarCount > 0 && linkedPillarCount < entPillarCount;

  if (!needsRules && !needsPillars) return;

  await provisionEnterpriseTeamMemberContent(enterpriseId, advisorProfileId);
}
