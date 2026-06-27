#!/usr/bin/env tsx

/**
 * Repair advisor Playwright fixtures on shared Preview/staging DB without
 * re-running the full seed (which may fail on partial schema drift).
 *
 * Run: npx tsx scripts/fix-advisor-playwright-fixtures.ts
 */

import path from "node:path";
import { config } from "dotenv";

config({ path: path.join(__dirname, "..", ".env.local"), quiet: true });

const FIXTURE_EMAILS = {
  advisor: "advisor@test.com",
  advisor2: "advisor2@test.com",
  advisor4: "advisor4@test.com",
  advisorUnbranded: "advisor-unbranded@test.com",
} as const;

function gracePeriodEnd() {
  const end = new Date();
  end.setDate(end.getDate() + 30);
  return end;
}

const TIER_CLIENT_LIMITS = {
  ESSENTIALS: 25,
  PROFESSIONAL: 50,
  BUSINESS: 100,
  PLATINUM: 150,
  ENTERPRISE: 100,
} as const;

function graceSubscriptionPayload(tier: "ESSENTIALS" | "PROFESSIONAL") {
  return {
    tier,
    status: "GRACE_PERIOD" as const,
    clientLimit: TIER_CLIENT_LIMITS[tier],
    billingCycle: "MONTHLY" as const,
    currentPeriodEnd: gracePeriodEnd(),
    cancelAtPeriodEnd: false,
  };
}

async function main() {
  const { prisma } = await import("../src/lib/db");
  const { userEmailCiphertext } = await import("../src/lib/auth/user-email-crypto");

  console.log("🔧 Repairing advisor Playwright fixtures...");

  const verified = await prisma.user.updateMany({
    where: {
      role: "ADVISOR",
      emailVerified: null,
      deletedAt: null,
    },
    data: { emailVerified: new Date() },
  });
  console.log(`✅ Verified ${verified.count} advisor email(s)`);

  const subscriptionPlan: Array<{
    key: keyof typeof FIXTURE_EMAILS;
    tier: "ESSENTIALS" | "PROFESSIONAL";
  }> = [
    { key: "advisor", tier: "ESSENTIALS" },
    { key: "advisor2", tier: "PROFESSIONAL" },
    { key: "advisor4", tier: "ESSENTIALS" },
    { key: "advisorUnbranded", tier: "ESSENTIALS" },
  ];

  for (const { key, tier } of subscriptionPlan) {
    const email = FIXTURE_EMAILS[key];
    const user = await prisma.user.findUnique({
      where: { emailCiphertext: userEmailCiphertext(email) },
      select: { id: true, role: true },
    });
    if (!user || user.role !== "ADVISOR") {
      console.warn(`⚠️  Skipping subscription — user not found: ${email}`);
      continue;
    }
    const data = graceSubscriptionPayload(tier);
    await prisma.subscription.upsert({
      where: { userId: user.id },
      update: data,
      create: { userId: user.id, ...data },
    });
    console.log(`✅ Subscription ${tier} for ${email}`);
  }

  console.log("🎉 Advisor fixture repair complete.");
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("❌ Fixture repair failed:", error);
  process.exit(1);
});
