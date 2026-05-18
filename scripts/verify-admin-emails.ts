#!/usr/bin/env tsx

/**
 * Verify email addresses for existing admin users
 * Run with: npx tsx scripts/verify-admin-emails.ts
 */

import { prisma } from "../src/lib/db";

async function verifyAdminEmails() {
  console.log("🔍 Finding unverified admin users...");

  const unverifiedAdmins = await prisma.user.findMany({
    where: {
      role: { in: ["ADMIN", "SUPER_ADMIN"] },
      emailVerified: null,
      deletedAt: null,
    },
    select: {
      id: true,
      emailCiphertext: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  if (unverifiedAdmins.length === 0) {
    console.log("✅ All admin users are already verified!");
    return;
  }

  console.log(`📧 Found ${unverifiedAdmins.length} unverified admin users:`);

  for (const user of unverifiedAdmins) {
    console.log(`  - ${user.name || "Unnamed"} (${user.role})`);
  }

  console.log("\n🚀 Verifying all admin emails...");

  const result = await prisma.user.updateMany({
    where: {
      role: { in: ["ADMIN", "SUPER_ADMIN"] },
      emailVerified: null,
      deletedAt: null,
    },
    data: {
      emailVerified: new Date(),
    },
  });

  console.log(`✅ Verified ${result.count} admin email addresses!`);
  console.log("📝 All admin users now show as 'Verified' in the admin interface.");
}

verifyAdminEmails()
  .catch((error) => {
    console.error("❌ Error verifying admin emails:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });