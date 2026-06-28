import "server-only";

import type { SubscriptionTier } from "@prisma/client";

import { findUserByEmail } from "@/lib/auth/user-email";
import { cancelSoloSubscriptionForEnterprise } from "@/lib/enterprise/cancel-solo-subscription";
import { deleteEnterpriseFirmByAdmin } from "@/lib/enterprise/firm-lifecycle";
import { transferAdvisorAssetsToEnterprise } from "@/lib/enterprise/transfer-advisor-assets";
import {
  acceptEnterpriseTeamInvite,
  inviteEnterpriseMember,
} from "@/lib/enterprise/team-invite";
import { resolveAdvisorBrandingForProfile } from "@/lib/enterprise/branding";
import {
  ENTERPRISE_DEFAULT_CLIENT_LIMIT,
  ENTERPRISE_DEFAULT_PER_ADVISOR_CLIENT_LIMIT,
  ENTERPRISE_DEFAULT_SEAT_LIMIT,
} from "@/lib/enterprise/constants";
import { getSubdomainActivationData } from "@/lib/advisor/platform-subdomain";
import { syncEnterpriseRulesToMembers } from "@/lib/methodology/clone-enterprise-defaults";
import { syncEnterpriseMethodologyToMembers } from "@/lib/methodology/clone-enterprise-methodology";
import {
  createCustomIntakeQuestionForAdvisor,
  createCustomRecommendationRuleForAdvisor,
} from "@/lib/test/methodology-snapshot-prepare";
import { prisma } from "@/lib/db";

const TEST_EMAIL_SUFFIX = "@test.com";

export type EnterpriseScenarioSnapshot = {
  runId: string;
  enterpriseId: string;
  slug: string;
  ownerEmail: string;
  memberEmail: string;
  marker: {
    tagline: string;
    intakeQuestionText: string;
    recommendationRuleName: string;
    primaryColor: string;
  };
};

export type EnterpriseScenarioInspect = {
  enterpriseId: string;
  slug: string;
  enterprise: {
    tagline: string | null;
    primaryColor: string | null;
    intakeQuestionTexts: string[];
    recommendationRuleNames: string[];
  };
  owner: {
    profileId: string;
    enterpriseId: string | null;
  };
  member: {
    profileId: string;
    enterpriseId: string | null;
    role: string;
    resolvedBranding: {
      tagline: string | null;
      primaryColor: string | null;
    } | null;
    intakeQuestionTexts: string[];
    recommendationRuleNames: string[];
  };
};

function assertTestEmail(email: string): void {
  if (!email.endsWith(TEST_EMAIL_SUFFIX)) {
    throw new Error(`Enterprise E2E is restricted to *${TEST_EMAIL_SUFFIX} accounts.`);
  }
}

async function requireAdvisorUser(email: string) {
  const user = await findUserByEmail(email.trim().toLowerCase(), {
    select: {
      id: true,
      advisorProfile: { select: { id: true, enterpriseId: true } },
      enterpriseMembership: { select: { id: true, enterpriseId: true, status: true } },
    },
  });
  if (!user?.advisorProfile) {
    throw new Error(`Advisor profile not found for ${email}`);
  }
  return user;
}

async function assertSoloAdvisor(email: string) {
  const user = await requireAdvisorUser(email);
  if (user.advisorProfile!.enterpriseId || user.enterpriseMembership) {
    throw new Error(`${email} is already linked to an enterprise. Run teardown first.`);
  }
  return user;
}

export async function setupEnterpriseScenario(input: {
  ownerEmail: string;
  memberEmail: string;
  runId?: string;
  moduleTier?: SubscriptionTier;
}): Promise<EnterpriseScenarioSnapshot> {
  const ownerEmail = input.ownerEmail.trim().toLowerCase();
  const memberEmail = input.memberEmail.trim().toLowerCase();
  assertTestEmail(ownerEmail);
  assertTestEmail(memberEmail);

  const runId = input.runId ?? Date.now().toString(36);
  const slug = `e2e-${runId}`.slice(0, 20);
  const marker = {
    tagline: `E2E firm tagline ${runId}`,
    intakeQuestionText: `E2E custom intake ${runId}`,
    recommendationRuleName: `E2E rec rule ${runId}`,
    primaryColor: "#533483",
  };

  const owner = await assertSoloAdvisor(ownerEmail);
  await assertSoloAdvisor(memberEmail);

  await prisma.advisorProfile.update({
    where: { id: owner.advisorProfile!.id },
    data: {
      tagline: marker.tagline,
      primaryColor: marker.primaryColor,
      brandingEnabled: true,
    },
  });

  await createCustomIntakeQuestionForAdvisor(ownerEmail, marker.intakeQuestionText);
  await createCustomRecommendationRuleForAdvisor(
    ownerEmail,
    "governance",
    marker.recommendationRuleName,
  );

  const moduleTier = input.moduleTier ?? "PROFESSIONAL";
  const periodEnd = new Date();
  periodEnd.setUTCFullYear(periodEnd.getUTCFullYear() + 1);

  let soloStripeSubscriptionId: string | null = null;

  const { enterpriseId } = await prisma.$transaction(async (tx) => {
    const enterprise = await tx.advisorEnterprise.create({
      data: {
        name: `E2E Firm ${runId}`,
        slug,
        seatLimit: ENTERPRISE_DEFAULT_SEAT_LIMIT,
        clientLimit: ENTERPRISE_DEFAULT_CLIENT_LIMIT,
        perAdvisorClientLimit: ENTERPRISE_DEFAULT_PER_ADVISOR_CLIENT_LIMIT,
        paymentMethod: "WIRE",
        billingContactUserId: owner.id,
      },
    });

    const soloCancel = await cancelSoloSubscriptionForEnterprise(
      owner.id,
      { reason: "enterprise_owner_provision", enterpriseId: enterprise.id },
      tx,
    );
    soloStripeSubscriptionId = soloCancel.stripeSubscriptionId;

    await tx.advisorProfile.update({
      where: { id: owner.advisorProfile!.id },
      data: { enterpriseId: enterprise.id },
    });

    await tx.enterpriseMembership.create({
      data: {
        enterpriseId: enterprise.id,
        userId: owner.id,
        advisorProfileId: owner.advisorProfile!.id,
        role: "OWNER",
        status: "ACTIVE",
        acceptedAt: new Date(),
      },
    });

    await tx.subscription.create({
      data: {
        enterpriseId: enterprise.id,
        tier: moduleTier,
        status: "ACTIVE",
        clientLimit: ENTERPRISE_DEFAULT_CLIENT_LIMIT,
        billingCycle: "ANNUAL",
        currentPeriodEnd: periodEnd,
      },
    });

    const activation = getSubdomainActivationData();
    const existingSubdomain = await tx.advisorSubdomain.findUnique({
      where: { advisorId: owner.advisorProfile!.id },
    });
    if (existingSubdomain) {
      await tx.advisorSubdomain.update({
        where: { advisorId: owner.advisorProfile!.id },
        data: {
          enterpriseId: enterprise.id,
          subdomain: slug,
          isActive: activation.isActive,
          dnsVerified: activation.dnsVerified,
          sslProvisioned: activation.sslProvisioned,
          verifiedAt: activation.verifiedAt,
        },
      });
    } else {
      await tx.advisorSubdomain.create({
        data: {
          advisorId: owner.advisorProfile!.id,
          enterpriseId: enterprise.id,
          subdomain: slug,
          isActive: activation.isActive,
          dnsVerified: activation.dnsVerified,
          sslProvisioned: activation.sslProvisioned,
          verifiedAt: activation.verifiedAt,
        },
      });
    }

    await transferAdvisorAssetsToEnterprise(tx, owner.advisorProfile!.id, enterprise.id);

    return { enterpriseId: enterprise.id };
  });

  await syncEnterpriseRulesToMembers(enterpriseId);
  await syncEnterpriseMethodologyToMembers(enterpriseId);

  const invite = await inviteEnterpriseMember(owner.id, {
    email: memberEmail,
    role: "ADVISOR",
  });
  const member = await requireAdvisorUser(memberEmail);
  await acceptEnterpriseTeamInvite(invite.membershipId, member.id);

  return {
    runId,
    enterpriseId,
    slug,
    ownerEmail,
    memberEmail,
    marker,
  };
}

export async function inspectEnterpriseScenario(
  enterpriseId: string,
  memberEmail: string,
): Promise<EnterpriseScenarioInspect> {
  const enterprise = await prisma.advisorEnterprise.findUnique({
    where: { id: enterpriseId },
    select: {
      id: true,
      slug: true,
      tagline: true,
      primaryColor: true,
      intakeQuestions: { select: { questionText: true } },
      recommendationRules: { select: { name: true } },
    },
  });
  if (!enterprise) {
    throw new Error("Enterprise not found");
  }

  const ownerMembership = await prisma.enterpriseMembership.findFirst({
    where: { enterpriseId, role: "OWNER", status: "ACTIVE" },
    select: { advisorProfileId: true },
  });

  const member = await requireAdvisorUser(memberEmail);
  const membership = await prisma.enterpriseMembership.findFirst({
    where: { enterpriseId, userId: member.id, status: "ACTIVE" },
    select: { role: true },
  });

  const memberBranding = member.advisorProfile
    ? await resolveAdvisorBrandingForProfile(member.advisorProfile.id)
    : null;

  const memberIntake = await prisma.advisorIntakeQuestion.findMany({
    where: { advisorProfileId: member.advisorProfile!.id },
    select: { questionText: true },
    orderBy: { displayOrder: "asc" },
  });
  const memberRules = await prisma.advisorRecommendationRule.findMany({
    where: { advisorProfileId: member.advisorProfile!.id, isActive: true },
    select: { name: true },
    orderBy: { priority: "asc" },
  });

  return {
    enterpriseId: enterprise.id,
    slug: enterprise.slug,
    enterprise: {
      tagline: enterprise.tagline,
      primaryColor: enterprise.primaryColor,
      intakeQuestionTexts: enterprise.intakeQuestions.map((q) => q.questionText),
      recommendationRuleNames: enterprise.recommendationRules.map((r) => r.name),
    },
    owner: {
      profileId: ownerMembership?.advisorProfileId ?? "",
      enterpriseId: enterprise.id,
    },
    member: {
      profileId: member.advisorProfile!.id,
      enterpriseId: member.advisorProfile!.enterpriseId,
      role: membership?.role ?? "UNKNOWN",
      resolvedBranding: memberBranding
        ? {
            tagline: memberBranding.tagline ?? null,
            primaryColor: memberBranding.primaryColor ?? null,
          }
        : null,
      intakeQuestionTexts: memberIntake.map((q) => q.questionText),
      recommendationRuleNames: memberRules.map((r) => r.name),
    },
  };
}

export async function teardownEnterpriseScenario(input: {
  enterpriseId: string;
  slug: string;
  actorUserId: string;
}): Promise<void> {
  await deleteEnterpriseFirmByAdmin({
    enterpriseId: input.enterpriseId,
    confirmSlug: input.slug,
    actor: { userId: input.actorUserId, role: "SUPER_ADMIN" },
  });
}
