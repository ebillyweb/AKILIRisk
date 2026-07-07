/**
 * Integration: enterprise-deactivated pillars must not appear for new team members.
 *
 * Run against a dev/preview DB:
 *   INTEGRATION=1 npm run test -- src/lib/enterprise/enterprise-member-pillars.integration.test.ts
 */
import path from "node:path";

import dotenv from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

dotenv.config({ path: path.join(process.cwd(), ".env.local"), quiet: true });

import type { SubscriptionTier } from "@prisma/client";

import { findUserByEmail } from "@/lib/auth/user-email";
import { getSubdomainActivationData } from "@/lib/advisor/platform-subdomain";
import { prisma } from "@/lib/db";
import { cancelSoloSubscriptionForEnterprise } from "@/lib/enterprise/cancel-solo-subscription";
import {
  ENTERPRISE_DEFAULT_CLIENT_LIMIT,
  ENTERPRISE_DEFAULT_PER_ADVISOR_CLIENT_LIMIT,
  ENTERPRISE_DEFAULT_SEAT_LIMIT,
} from "@/lib/enterprise/constants";
import { deleteEnterpriseFirmByAdmin } from "@/lib/enterprise/firm-lifecycle";
import {
  acceptEnterpriseTeamInvite,
  inviteEnterpriseMember,
} from "@/lib/enterprise/team-invite";
import {
  ensureEnterprisePlatformMethodologyInTx,
} from "@/lib/methodology/clone-enterprise-methodology";
import {
  loadActiveAdvisorMethodologyPillars,
  loadAdvisorMethodologyPillars,
} from "@/lib/methodology/methodology-queries";

const RUN_INTEGRATION = process.env.INTEGRATION === "1" && Boolean(process.env.DATABASE_URL);
const OWNER_EMAIL = "advisor2@test.com";
const MEMBER_EMAIL = "advisor3@test.com";
const DEACTIVATED_SLUG = "cyber-digital";
const SUPER_ADMIN_EMAIL = "buddy@ebilly.com";

async function teardownEnterprise(enterpriseId: string, enterpriseSlug: string) {
  const actor = await findUserByEmail(SUPER_ADMIN_EMAIL, { select: { id: true } });
  if (!actor?.id) return;
  await deleteEnterpriseFirmByAdmin({
    enterpriseId,
    confirmSlug: enterpriseSlug,
    actor: { userId: actor.id, role: "SUPER_ADMIN" },
  });
}

async function cleanupStalePillarE2eFirms(ownerUserId: string, memberProfileId: string) {
  const memberships = await prisma.enterpriseMembership.findMany({
    where: {
      OR: [{ userId: ownerUserId }, { advisorProfileId: memberProfileId }],
      enterprise: { slug: { startsWith: "pillar-e2e-" } },
    },
    select: { enterpriseId: true, enterprise: { select: { slug: true } } },
  });
  for (const row of memberships) {
    await teardownEnterprise(row.enterpriseId, row.enterprise.slug);
  }

  await prisma.advisorRecommendationRule.deleteMany({
    where: { advisorProfileId: memberProfileId },
  });
  await prisma.advisorPillarOverride.deleteMany({
    where: { advisorProfileId: memberProfileId },
  });
  await prisma.advisorPillarQuestion.deleteMany({
    where: { advisorProfileId: memberProfileId },
  });
  await prisma.advisorIntakeQuestion.deleteMany({
    where: { advisorProfileId: memberProfileId },
  });
  await prisma.advisorPillarNarrative.deleteMany({
    where: { advisorProfileId: memberProfileId },
  });
  await prisma.advisorProfile.update({
    where: { id: memberProfileId },
    data: { starterContentClonedAt: null, enterpriseId: null },
  });
}

describe.skipIf(!RUN_INTEGRATION)(
  "enterprise member pillar provisioning (integration)",
  () => {
    let enterpriseId = "";
    let slug = "";
    let memberProfileId = "";

    beforeAll(async () => {
      const owner = await findUserByEmail(OWNER_EMAIL, {
        select: {
          id: true,
          advisorProfile: { select: { id: true, enterpriseId: true } },
          enterpriseMembership: { select: { id: true } },
        },
      });
      const member = await findUserByEmail(MEMBER_EMAIL, {
        select: {
          id: true,
          advisorProfile: { select: { id: true, enterpriseId: true } },
          enterpriseMembership: { select: { id: true } },
        },
      });

      if (!owner?.advisorProfile || !member?.advisorProfile) {
        throw new Error("Fixture advisors missing — run scripts/seed-advisor-test-data.js");
      }
      if (owner.advisorProfile.enterpriseId || owner.enterpriseMembership) {
        throw new Error(`${OWNER_EMAIL} already linked to an enterprise`);
      }
      if (member.advisorProfile.enterpriseId || member.enterpriseMembership) {
        throw new Error(`${MEMBER_EMAIL} already linked to an enterprise`);
      }

      await cleanupStalePillarE2eFirms(owner.id, member.advisorProfile.id);

      const runId = Date.now().toString(36);
      slug = `pillar-e2e-${runId}`.slice(0, 24);
      const moduleTier: SubscriptionTier = "PROFESSIONAL";
      const periodEnd = new Date();
      periodEnd.setUTCFullYear(periodEnd.getUTCFullYear() + 1);

      const created = await prisma.$transaction(
        async (tx) => {
        const enterprise = await tx.advisorEnterprise.create({
          data: {
            name: `Pillar E2E ${runId}`,
            slug,
            seatLimit: ENTERPRISE_DEFAULT_SEAT_LIMIT,
            clientLimit: ENTERPRISE_DEFAULT_CLIENT_LIMIT,
            perAdvisorClientLimit: ENTERPRISE_DEFAULT_PER_ADVISOR_CLIENT_LIMIT,
            paymentMethod: "WIRE",
            billingContactUserId: owner.id,
          },
        });

        await cancelSoloSubscriptionForEnterprise(
          owner.id,
          { reason: "enterprise_owner_provision", enterpriseId: enterprise.id },
          tx,
        );

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
        await tx.advisorSubdomain.upsert({
          where: { advisorId: owner.advisorProfile!.id },
          create: {
            advisorId: owner.advisorProfile!.id,
            enterpriseId: enterprise.id,
            subdomain: slug,
            isActive: activation.isActive,
            dnsVerified: activation.dnsVerified,
            sslProvisioned: activation.sslProvisioned,
            verifiedAt: activation.verifiedAt,
          },
          update: {
            enterpriseId: enterprise.id,
            subdomain: slug,
            isActive: activation.isActive,
            dnsVerified: activation.dnsVerified,
            sslProvisioned: activation.sslProvisioned,
            verifiedAt: activation.verifiedAt,
          },
        });

        await ensureEnterprisePlatformMethodologyInTx(tx, enterprise.id);

        const pillar = await tx.pillar.findUnique({ where: { slug: DEACTIVATED_SLUG } });
        if (!pillar) {
          throw new Error(`Pillar ${DEACTIVATED_SLUG} not in DB — run npm run seed:pillar-ddl`);
        }

        await tx.enterprisePillarOverride.updateMany({
          where: { enterpriseId: enterprise.id, pillarId: pillar.id },
          data: { isActive: false },
        });

        return enterprise.id;
      },
        { timeout: 120_000 },
      );

      enterpriseId = created;

      const invite = await inviteEnterpriseMember(owner.id, { email: MEMBER_EMAIL });
      await acceptEnterpriseTeamInvite(invite.membershipId, member.id);
      memberProfileId = member.advisorProfile.id;
    }, 120_000);

    afterAll(async () => {
      if (!enterpriseId || !slug) return;
      await teardownEnterprise(enterpriseId, slug);
    }, 120_000);

    it("marks the deactivated pillar inactive on the new member profile", async () => {
      const pillars = await loadAdvisorMethodologyPillars(memberProfileId);
      const deactivated = pillars.find((p) => p.slug === DEACTIVATED_SLUG);
      expect(deactivated).toBeDefined();
      expect(deactivated!.isActive).toBe(false);
    });

    it("excludes deactivated pillars from active navigation", async () => {
      const active = await loadActiveAdvisorMethodologyPillars(memberProfileId);
      expect(active.map((p) => p.slug)).not.toContain(DEACTIVATED_SLUG);
    });

    it("links enterprise pillar overrides onto the member", async () => {
      const entCount = await prisma.enterprisePillarOverride.count({
        where: { enterpriseId },
      });
      const linked = await prisma.advisorPillarOverride.count({
        where: { advisorProfileId: memberProfileId, enterpriseSourceId: { not: null } },
      });
      expect(linked).toBeGreaterThan(0);
      expect(linked).toBe(entCount);
    });
  },
);
