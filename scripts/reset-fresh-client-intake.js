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
 * Requires DATABASE_URL in `.env.local` (same pattern as other seed scripts).
 */

const path = require('path');
const repoRoot = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(repoRoot, '.env.local'), quiet: true });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { userEmailCiphertext } = require('./lib/user-email-ciphertext-cjs');

const FRESH_EMAIL = process.env.FRESH_CLIENT_EMAIL || 'client-fresh@test.com';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set. Add it to .env.local, then re-run.');
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

  // Also clear any assessment the client may have started in a prior run.
  // Without this, `hasClientAssessmentStarted` stays true and the intake-edit
  // gate (assertClientIntakeAnswersEditable) 409s audio/answer uploads even
  // after the interview is wiped. All Assessment children (responses, scores,
  // recommendations, reports, intelligence events) cascade on delete.
  const assessments = await prisma.assessment.deleteMany({ where: { userId: user.id } });

  console.log(
    `Reset ${FRESH_EMAIL}: deleted ${result.count} intake interview row(s) ` +
      `(responses + approvals cascade) and ${assessments.count} assessment row(s) ` +
      `(scores + responses + reports cascade).`
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
