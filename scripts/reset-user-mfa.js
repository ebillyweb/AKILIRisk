#!/usr/bin/env node
/**
 * Clear MFA for a user (dev / support). MFA is opt-in; this resets accounts
 * that were enrolled during testing or have a stale authenticator entry.
 *
 * Run: EMAIL=buddy@ebilly.com node scripts/reset-user-mfa.js
 */
const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "..", ".env.local"),
  quiet: true,
});
const { PrismaClient, Prisma } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const { userEmailCiphertext } = require("./lib/user-email-ciphertext-cjs");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.EMAIL?.trim().toLowerCase();
  if (!email) {
    console.error("Set EMAIL=... to target a user.");
    process.exit(1);
  }
  if (!process.env.ENCRYPTION_KEY) {
    console.error("ENCRYPTION_KEY not set.");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { emailCiphertext: userEmailCiphertext(email) },
    select: { id: true },
  });
  if (!user) {
    console.error("User not found:", email);
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      mfaEnabled: false,
      mfaSecret: null,
      mfaRecoveryCodes: Prisma.DbNull,
    },
  });

  await prisma.session.updateMany({
    where: { userId: user.id, expires: { gt: new Date() } },
    data: { mfaVerified: true },
  });

  console.log("✅ MFA disabled for", email);
  console.log("   Sign out and sign in again for a fresh session.");
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
