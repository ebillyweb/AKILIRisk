#!/usr/bin/env tsx

/**
 * Verify email addresses for advisor fixture accounts used by Playwright.
 * Credentials sign-in rejects ADVISOR users with emailVerified=null (auth.config.ts).
 *
 * Run with: npx tsx scripts/verify-advisor-fixture-emails.ts
 */

import { prisma } from "../src/lib/db";

async function verifyAdvisorFixtureEmails() {
  console.log("🔍 Finding unverified advisor fixture users...");

  const unverified = await prisma.user.findMany({
    where: {
      role: "ADVISOR",
      emailVerified: null,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      role: true,
    },
  });

  if (unverified.length === 0) {
    console.log("✅ All advisor users are already verified!");
    return;
  }

  console.log(`📧 Found ${unverified.length} unverified advisor user(s):`);
  for (const user of unverified) {
    console.log(`  - ${user.name || "Unnamed"} (${user.id})`);
  }

  console.log("\n🚀 Verifying advisor emails...");

  const result = await prisma.user.updateMany({
    where: {
      role: "ADVISOR",
      emailVerified: null,
      deletedAt: null,
    },
    data: {
      emailVerified: new Date(),
    },
  });

  console.log(`✅ Verified ${result.count} advisor email address(es).`);
}

verifyAdvisorFixtureEmails()
  .catch((error) => {
    console.error("❌ Error verifying advisor emails:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
