#!/usr/bin/env node
/**
 * Resets `client-fresh@test.com` to a NOT_STARTED intake state.
 *
 * Used by the Playwright intake happy-path test in `tests/smoke/client-intake.spec.ts`.
 * Each run flips the user to SUBMITTED, so this script wipes their IntakeInterview
 * rows (cascades to IntakeResponse + IntakeApproval) before the next run.
 *
 * Run manually:
 *   node scripts/reset-fresh-client-intake.js
 *
 * Run from a Playwright fixture:
 *   execSync('node scripts/reset-fresh-client-intake.js')
 *
 * Requires DATABASE_URL (loaded from .env.local then .env, same as the seed scripts).
 */

const path = require('path');
const repoRoot = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(repoRoot, '.env.local'), quiet: true });
require('dotenv').config({ path: path.join(repoRoot, '.env'), quiet: true });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { userEmailCiphertext } = require('./lib/user-email-ciphertext-cjs');

const FRESH_EMAIL = process.env.FRESH_CLIENT_EMAIL || 'client-fresh@test.com';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set. Add it to .env.local or .env, then re-run.');
  process.exit(1);
}
if (!process.env.ENCRYPTION_KEY) {
  console.error('ENCRYPTION_KEY not set. Required for User email ciphertext lookups.');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.user.findFirst({
    where: { emailCiphertext: userEmailCiphertext(FRESH_EMAIL) },
  });
  if (!user) {
    console.error(
      `User ${FRESH_EMAIL} not found. Run \`node scripts/seed-advisor-test-data.js\` first.`
    );
    process.exit(2);
  }

  const result = await prisma.intakeInterview.deleteMany({ where: { userId: user.id } });
  console.log(
    `Reset ${FRESH_EMAIL}: deleted ${result.count} intake interview row(s) (responses + approvals cascade).`
  );
}

main()
  .catch((e) => {
    console.error('Reset failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
