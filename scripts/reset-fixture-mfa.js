#!/usr/bin/env node
/**
 * Clear MFA on all standard test/fixture accounts (opt-in default).
 * Run after MFA Playwright smokes or when sign-in incorrectly asks for TOTP.
 *
 *   node scripts/reset-fixture-mfa.js
 */
const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "..", ".env.local"),
  quiet: true,
});
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const { resetFixtureMfa, FIXTURE_EMAILS } = require("./lib/reset-fixture-mfa-cjs");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  if (!process.env.ENCRYPTION_KEY) {
    console.error("ENCRYPTION_KEY not set.");
    process.exit(1);
  }
  const count = await resetFixtureMfa(prisma);
  console.log(`✅ MFA disabled for ${count} fixture user(s).`);
  console.log("   Emails:", FIXTURE_EMAILS.join(", "));
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
