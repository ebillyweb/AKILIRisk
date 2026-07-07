#!/usr/bin/env node
/**
 * Legacy: backfill Subscription rows without Stripe IDs (historical STRIPE-SPEC migration).
 *
 * Tier: >25 active clients → PROFESSIONAL (100-client limit), else GROWTH (50).
 * Status GRACE_PERIOD with calendar grace end (next UTC midnight), not a 30-day hub window.
 *
 * With billing enabled, advisors still need a qualifying Stripe subscription for portal
 * access after calendar grace (see subscriptionQualifiesForPortalEnablement). Prefer admin
 * createAdvisorByAdmin or real Checkout / webhooks for new advisors.
 *
 * Usage: node scripts/migrate-advisor-subscriptions.js
 */

const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "..", ".env.local"),
  quiet: true,
});

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const TIER_LIMITS = { PROFESSIONAL: 50, BUSINESS: 100 };

function newAdvisorGracePeriodEndsAt(from = new Date()) {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const d = from.getUTCDate();
  return new Date(Date.UTC(y, m, d + 1, 0, 0, 0, 0));
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Migrating advisor subscriptions…");

  const advisors = await prisma.user.findMany({
    where: { role: "ADVISOR", advisorProfile: { isNot: null } },
    select: {
      id: true,
      email: true,
      advisorProfile: { select: { id: true } },
    },
  });

  let created = 0;
  let skipped = 0;

  const createdAt = new Date();
  const gracePeriodEnd = newAdvisorGracePeriodEndsAt(createdAt);

  for (const user of advisors) {
    if (!user.advisorProfile) continue;

    const existing = await prisma.subscription.findUnique({
      where: { userId: user.id },
    });
    if (existing) {
      skipped += 1;
      continue;
    }

    const clientCount = await prisma.clientAdvisorAssignment.count({
      where: { advisorId: user.advisorProfile.id, status: "ACTIVE" },
    });

    const tier = clientCount > 25 ? "BUSINESS" : "PROFESSIONAL";
    const clientLimit = TIER_LIMITS[tier];

    await prisma.subscription.create({
      data: {
        userId: user.id,
        tier,
        status: "GRACE_PERIOD",
        clientLimit,
        billingCycle: "MONTHLY",
        currentPeriodEnd: gracePeriodEnd,
      },
    });

    const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
    if (sub) {
      await prisma.subscriptionAuditLog.create({
        data: {
          subscriptionId: sub.id,
          action: "migration_backfill",
          newTier: tier,
          metadata: {
            clientCountAtMigration: clientCount,
            email: user.email,
            gracePeriodEnd: gracePeriodEnd.toISOString(),
          },
        },
      });
    }

    created += 1;
    console.log(`  + ${user.email} → ${tier} (${clientCount} clients, limit ${clientLimit})`);
  }

  console.log(`Done. Created ${created}, skipped (already had subscription) ${skipped}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
