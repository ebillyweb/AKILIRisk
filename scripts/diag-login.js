#!/usr/bin/env node
/**
 * READ-ONLY login diagnostic for a credentials (advisor/admin) account.
 * Run: EMAIL=advisor@test.com node scripts/diag-login.js
 * Optional: PASSWORD=... to test a bcrypt compare against the stored hash.
 */
const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "..", ".env.local"),
  quiet: true,
});
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
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
    select: {
      id: true,
      role: true,
      password: true,
      deletedAt: true,
      emailVerified: true,
      passwordChangeRequired: true,
      passwordPolicyRevision: true,
      createdAt: true,
    },
  });
  if (!user) {
    console.error("User not found:", email);
    process.exit(1);
  }
  console.log("User:", email);
  console.log("  id:                    ", user.id);
  console.log("  role:                  ", user.role);
  console.log("  hasPassword:           ", Boolean(user.password));
  console.log("  passwordHashPrefix:    ", user.password ? user.password.slice(0, 7) : "(none)");
  console.log("  deletedAt:             ", user.deletedAt);
  console.log("  emailVerified:         ", user.emailVerified);
  console.log("  passwordChangeRequired:", user.passwordChangeRequired);
  console.log("  passwordPolicyRevision:", user.passwordPolicyRevision);

  if (process.env.PASSWORD && user.password) {
    const ok = await bcrypt.compare(process.env.PASSWORD, user.password);
    console.log("  PASSWORD compare:      ", ok ? "MATCH" : "NO MATCH");
  }

  const failures = await prisma.auditLog.findMany({
    where: { entityId: user.id, action: { startsWith: "auth.signin" } },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { action: true, createdAt: true, metadata: true },
  });
  console.log("\n  recent auth.signin* audit rows:");
  for (const f of failures) {
    const reason = f.metadata && typeof f.metadata === "object" ? f.metadata.reason : undefined;
    console.log(
      "   ",
      f.createdAt.toISOString(),
      f.action,
      reason ? `(${reason})` : ""
    );
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
