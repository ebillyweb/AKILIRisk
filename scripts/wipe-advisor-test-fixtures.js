#!/usr/bin/env node
/**
 * Delete User rows for the fixed @test.com fixtures created by
 * `seed-advisor-test-data.js` and `seed-intake-test-clients.js`.
 *
 * Cascades remove related AdvisorProfile, assignments, intake rows, etc.
 *
 * Usage:
 *   node scripts/wipe-advisor-test-fixtures.js --yes
 *
 * Optional: also remove the local admin fixture (buddy@ebilly.com):
 *   node scripts/wipe-advisor-test-fixtures.js --yes --with-admin
 *
 * Requires DATABASE_URL + ENCRYPTION_KEY (same as seed scripts).
 */
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const { userEmailCiphertext } = require("./lib/user-email-ciphertext-cjs");

const YES = process.argv.includes("--yes");
const WITH_ADMIN = process.argv.includes("--with-admin");

/** Must stay in sync with seed-advisor-test-data.js + seed-intake-test-clients.js */
const FIXTURE_EMAILS = [
  "advisor@test.com",
  "client@test.com",
  "client-mfa@test.com",
  "client-fresh@test.com",
  "advisor2@test.com",
  "advisor3@test.com",
  "advisor4@test.com",
  "advisor-unbranded@test.com",
  "client-unbranded@test.com",
  "client+intake@test.com",
  "client+assessment@test.com",
];

const ADMIN_FIXTURE_EMAIL = "buddy@ebilly.com";

if (!YES) {
  console.error("Refusing to run without --yes (destructive). Example:");
  console.error("  node scripts/wipe-advisor-test-fixtures.js --yes");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set (.env.local or .env).");
  process.exit(1);
}
if (!process.env.ENCRYPTION_KEY) {
  console.error("ENCRYPTION_KEY not set (required for emailCiphertext).");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const emails = [...FIXTURE_EMAILS];
  if (WITH_ADMIN) emails.push(ADMIN_FIXTURE_EMAIL);

  const ciphertexts = emails.map((e) => userEmailCiphertext(e));
  const result = await prisma.user.deleteMany({
    where: { emailCiphertext: { in: ciphertexts } },
  });
  console.log(`Removed ${result.count} user(s) matching ${emails.length} fixture email(s).`);
  if (!WITH_ADMIN) {
    console.log("(Admin buddy@ebilly.com was not removed; pass --with-admin to include.)");
  }
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
