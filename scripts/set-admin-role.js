#!/usr/bin/env node
/**
 * Ensure buddy@ebilly.com exists and has role SUPER_ADMIN (highest privilege).
 * Platform admins use ADMIN or SUPER_ADMIN; super admins alone may edit
 * platform-wide settings (see `requireSuperAdminRole` in `src/lib/admin/auth.ts`).
 *
 * Run: node scripts/set-admin-role.js
 * Then sign out and sign in again so the session gets a fresh JWT with the role.
 */
const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "..", ".env.local"),
  quiet: true,
});
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const bcryptjs = require("bcryptjs");
const { userEmailCiphertext } = require("./lib/user-email-ciphertext-cjs");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ADMIN_EMAIL = "buddy@ebilly.com";
const DEFAULT_PASSWORD = "Test1111!"; // change if needed for local dev

async function main() {
  if (!process.env.ENCRYPTION_KEY) {
    console.error("ENCRYPTION_KEY not set. Required for User.email ciphertext.");
    process.exit(1);
  }
  const hashedPassword = await bcryptjs.hash(DEFAULT_PASSWORD, 12);
  const adminCt = userEmailCiphertext(ADMIN_EMAIL);

  const user = await prisma.user.upsert({
    where: { emailCiphertext: adminCt },
    update: {
      emailCiphertext: adminCt,
      role: "SUPER_ADMIN",
      password: hashedPassword,
    },
    create: {
      emailCiphertext: adminCt,
      password: hashedPassword,
      name: "Admin",
      role: "SUPER_ADMIN",
    },
  });

  // Ensure admin has an AdvisorProfile so they can use /advisor (clients, pipeline, etc.)
  await prisma.advisorProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      specializations: ["governance", "risk-assessment"],
      firmName: "Admin",
      bio: "Admin account with advisor portal access.",
    },
  });

  console.log("✅ Set role to SUPER_ADMIN for", ADMIN_EMAIL);
  console.log("✅ Advisor profile ensured for", ADMIN_EMAIL, "(can use /advisor).");
  console.log("   Sign out and sign in again to see the Admin nav and access /admin.");
}

main()
  .then(() => prisma.$disconnect())
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    pool.end();
    process.exit(1);
  });
