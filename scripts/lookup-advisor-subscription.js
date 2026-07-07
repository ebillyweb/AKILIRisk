#!/usr/bin/env node
/**
 * Look up advisor by email and optionally grant preview GRACE_PERIOD subscription.
 *
 *   node scripts/lookup-advisor-subscription.js justinbutler.bcg@gmail.com
 *   node scripts/lookup-advisor-subscription.js justinbutler.bcg@gmail.com --grant-grace
 */
const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "..", ".env.local"),
  quiet: true,
});

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const crypto = require("crypto");

const email = (process.argv[2] ?? "justinbutler.bcg@gmail.com").trim().toLowerCase();
const grantGrace = process.argv.includes("--grant-grace");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function subscriptionEntitlesAdvisorPortal(sub) {
  if (!sub) return false;
  const { status, currentPeriodEnd, cancelAtPeriodEnd } = sub;
  if (status === "UNPAID") return false;
  if (status === "CANCELLED") {
    if (cancelAtPeriodEnd && currentPeriodEnd > new Date()) return true;
    return false;
  }
  if (status === "GRACE_PERIOD") return currentPeriodEnd > new Date();
  return status === "ACTIVE" || status === "PAST_DUE";
}

function isBillingEnabled() {
  return process.env.ENABLE_BILLING_FEATURES !== "false";
}

function hasQualifyingPaidStripeSubscription(sub) {
  if (!sub?.stripeSubscriptionId?.trim()) return false;
  return sub.status === "ACTIVE" || sub.status === "PAST_DUE";
}

function isPastPaidSignupDeadline(sub) {
  const deadline = new Date(sub.createdAt);
  deadline.setDate(deadline.getDate() + 30);
  return new Date() >= deadline;
}

function subscriptionQualifiesForPortal(sub, billingOn) {
  if (!sub || !subscriptionEntitlesAdvisorPortal(sub)) return false;
  if (!billingOn) return true;
  if (hasQualifyingPaidStripeSubscription(sub)) return true;
  if (isPastPaidSignupDeadline(sub)) return false;
  return sub.status === "GRACE_PERIOD" && sub.currentPeriodEnd > new Date();
}

async function emailCiphertext(plaintext) {
  // Use app's deterministic encryption via dynamic import of encryption module
  const { encryptDeterministic } = await import("../src/lib/encryption.ts");
  return encryptDeterministic(plaintext.trim().toLowerCase(), "User.email");
}

async function main() {
  const ciphertext = await emailCiphertext(email);

  const user = await prisma.user.findFirst({
    where: { emailCiphertext: ciphertext },
    select: {
      id: true,
      role: true,
      deletedAt: true,
      advisorPortalAccessEnabled: true,
      createdAt: true,
      lastLoginAt: true,
      advisorProfile: { select: { id: true, firmName: true } },
      subscription: true,
      enterpriseMembership: {
        select: {
          status: true,
          enterprise: { select: { id: true, name: true, status: true } },
        },
      },
    },
  });

  if (!user) {
    console.log(JSON.stringify({ found: false, email, emailCiphertext: ciphertext }, null, 2));
    return;
  }

  const billingOn = isBillingEnabled();
  let blockReason = null;
  let allowed = true;

  if (user.role === "ADVISOR") {
    if (user.deletedAt) blockReason = "deactivated";
    else if (user.advisorPortalAccessEnabled === false) blockReason = "disabled";
    else if (user.enterpriseMembership?.status === "SUSPENDED") blockReason = "suspended";
    else if (user.enterpriseMembership?.enterprise?.status === "SUSPENDED") blockReason = "suspended";
    else if (!subscriptionQualifiesForPortal(user.subscription, billingOn)) blockReason = "subscription";
    if (blockReason) allowed = false;
  }

  const report = {
    found: true,
    email,
    billingEnabled: billingOn,
    hubAccess: { allowed, blockReason },
    user: {
      id: user.id,
      role: user.role,
      deletedAt: user.deletedAt,
      advisorPortalAccessEnabled: user.advisorPortalAccessEnabled,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      advisorProfile: user.advisorProfile,
      enterpriseMembership: user.enterpriseMembership,
      subscription: user.subscription,
    },
  };

  if (grantGrace) {
    if (user.role !== "ADVISOR") {
      report.grant = { success: false, error: "User is not ADVISOR" };
    } else if (!user.advisorProfile) {
      report.grant = { success: false, error: "No advisor profile" };
    } else {
      const periodEnd = new Date();
      periodEnd.setDate(periodEnd.getDate() + 30);
      const sub = await prisma.subscription.upsert({
        where: { userId: user.id },
        update: {
          tier: "ESSENTIALS",
          status: "GRACE_PERIOD",
          clientLimit: 25,
          billingCycle: "MONTHLY",
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        },
        create: {
          userId: user.id,
          tier: "ESSENTIALS",
          status: "GRACE_PERIOD",
          clientLimit: 25,
          billingCycle: "MONTHLY",
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        },
      });
      if (user.advisorPortalAccessEnabled === false) {
        await prisma.user.update({
          where: { id: user.id },
          data: { advisorPortalAccessEnabled: true },
        });
      }
      report.grant = {
        success: true,
        subscriptionId: sub.id,
        currentPeriodEnd: periodEnd.toISOString(),
        portalAccessEnabled: true,
      };
      report.hubAccess = { allowed: true, blockReason: null };
      report.user.subscription = sub;
      report.user.advisorPortalAccessEnabled = true;
    }
  }

  console.log(JSON.stringify(report, (_k, v) => (v instanceof Date ? v.toISOString() : v), 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
