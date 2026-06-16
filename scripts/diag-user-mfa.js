#!/usr/bin/env node
/**
 * MFA support tool for a single user.
 *
 * READ-ONLY (default): show MFA state + session row counts.
 *   EMAIL=buddy@ebilly.com node scripts/diag-user-mfa.js
 *
 * DISABLE: clear MFA (mfaEnabled=false, secret + recovery codes) and DELETE
 * all of the user's session rows (purges stale/accumulated rows).
 *   EMAIL=buddy@ebilly.com DISABLE=1 node scripts/diag-user-mfa.js
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
    console.error("Set EMAIL=...");
    process.exit(1);
  }
  const user = await prisma.user.findUnique({
    where: { emailCiphertext: userEmailCiphertext(email) },
    select: { id: true, role: true, mfaEnabled: true, mfaSecret: true },
  });
  if (!user) {
    console.error("User not found:", email);
    process.exit(1);
  }
  const now = new Date();
  const sessions = await prisma.session.findMany({
    where: { userId: user.id },
    orderBy: { expires: "desc" },
    select: { id: true, mfaVerified: true, expires: true },
  });
  const active = sessions.filter((s) => s.expires > now);
  console.log("User:", email);
  console.log("  id:        ", user.id);
  console.log("  role:      ", user.role);
  console.log("  mfaEnabled:", user.mfaEnabled);
  console.log("  hasSecret: ", Boolean(user.mfaSecret));
  console.log("  sessions:   total", sessions.length, "| active", active.length);
  console.log(
    "  active mfaVerified breakdown:",
    "verified=" + active.filter((s) => s.mfaVerified).length,
    "unverified=" + active.filter((s) => !s.mfaVerified).length
  );

  if (process.env.DISABLE === "1") {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaRecoveryCodes: Prisma.DbNull,
      },
    });
    const del = await prisma.session.deleteMany({ where: { userId: user.id } });
    console.log("");
    console.log("✅ MFA disabled for", email);
    console.log("   Deleted", del.count, "session rows.");
    console.log("   Sign out and sign in again for a fresh session.");
  }
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
