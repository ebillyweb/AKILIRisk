#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * US-46c Playwright fixture helper: print the seeded client's clientId
 * and the id of an Assessment + AssessmentResponse we can drill into
 * from /advisor/pipeline/<clientId>/assessment/<assessmentId>.
 *
 * Idempotent: if `client@test.com` already has an Assessment, we reuse
 * the most-recently-updated one; otherwise we mint a minimal IN_PROGRESS
 * row with one response so the advisor review page has something to
 * iterate over. We do NOT seed an encrypted answer — `safeDecryptAnswer`
 * accepts a null answer and the page still renders the row + the per-
 * answer advisor-note panel, which is what the smoke test exercises.
 *
 * Output (stdout, JSON):
 *   {
 *     "clientId": "...",
 *     "assessmentId": "...",
 *     "assessmentResponseId": "..."
 *   }
 *
 * Sister to `scripts/get-client-intake-fixture.js`.
 */
const path = require('path');
const dotenv = require('dotenv');
const repoRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(repoRoot, '.env.local'), quiet: true });

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const TEST_CLIENT_EMAIL = process.env.CLIENT_EMAIL || 'client@test.com';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set. Add it to .env.local, then re-run.');
  process.exit(1);
}
if (!process.env.ENCRYPTION_KEY) {
  console.error(
    'ENCRYPTION_KEY not set. Required to compute the user-email ciphertext for lookup.'
  );
  process.exit(1);
}

const { userEmailCiphertext } = require('./lib/user-email-ciphertext-cjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

(async () => {
  try {
    const user = await prisma.user.findFirst({
      where: { emailCiphertext: userEmailCiphertext(TEST_CLIENT_EMAIL) },
      select: { id: true },
    });
    if (!user) throw new Error(`User not found: ${TEST_CLIENT_EMAIL}`);

    // Reuse the most-recent assessment for this user if one exists. The
    // smoke test only cares that ONE assessment + ONE response is reachable;
    // it doesn't care about pillar/score completeness.
    let assessment = await prisma.assessment.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });

    if (!assessment) {
      assessment = await prisma.assessment.create({
        data: {
          userId: user.id,
          status: 'IN_PROGRESS',
        },
        select: { id: true },
      });
    }

    let response = await prisma.assessmentResponse.findFirst({
      where: { assessmentId: assessment.id },
      orderBy: { answeredAt: 'asc' },
      select: { id: true },
    });

    if (!response) {
      response = await prisma.assessmentResponse.create({
        data: {
          assessmentId: assessment.id,
          questionId: 'q-smoke-1',
          pillar: 'governance',
          subCategory: 'policies',
          // answer is nullable (skipped path) — `safeDecryptAnswer`
          // accepts null and the advisor review page still renders.
          answer: null,
          skipped: true,
        },
        select: { id: true },
      });
    }

    process.stdout.write(
      JSON.stringify({
        clientId: user.id,
        assessmentId: assessment.id,
        assessmentResponseId: response.id,
      })
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
})().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
