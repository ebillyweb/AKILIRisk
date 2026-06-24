#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Test helper: print `client-fresh@test.com`'s current IntakeInterview id
 * plus the first visible intake-script question id. The mixed-mode intake
 * Playwright spec (`tests/smoke/intake-mixed-mode.spec.ts`) calls this
 * after the user clicks "Begin interview" so the spec can upload a tiny
 * webm against the right (interviewId, questionId) pair, exercising the
 * audio path in the same wizard run as the Type path.
 *
 * Output (stdout, JSON): `{ "interviewId": "...", "questionId": "..." }`
 *
 * Pattern mirrors `scripts/get-client-intake-fixture.js`, with one
 * difference: the fresh-client interview has no IntakeResponse rows yet,
 * so we resolve `questionId` from the PillarQuestion bank (the same place
 * the wizard loads its script from: `loadIntakeScriptQuestions` in
 * src/lib/intake/load-intake-script.ts).
 */
const path = require('path');
const dotenv = require('dotenv');
const repoRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(repoRoot, '.env.local'), quiet: true });

const { PrismaClient, PillarCategoryKind } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const FRESH_EMAIL = process.env.FRESH_CLIENT_EMAIL || 'client-fresh@test.com';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set. Add it to .env.local, then re-run.');
  process.exit(1);
}
if (!process.env.ENCRYPTION_KEY) {
  console.error('ENCRYPTION_KEY not set. Required to compute the user-email ciphertext for lookup.');
  process.exit(1);
}

const { userEmailCiphertext } = require('./lib/user-email-ciphertext-cjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

(async () => {
  try {
    const user = await prisma.user.findFirst({
      where: { emailCiphertext: userEmailCiphertext(FRESH_EMAIL) },
      select: { id: true },
    });
    if (!user) throw new Error(`User not found: ${FRESH_EMAIL}`);

    const interview = await prisma.intakeInterview.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    if (!interview) {
      throw new Error(
        `No IntakeInterview for ${FRESH_EMAIL}. Begin the interview in the UI before calling this fixture, or seed via tests/.`,
      );
    }

    // Same selection rule as loadIntakeScriptQuestions (src/lib/intake/load-intake-script.ts):
    // PillarQuestion rows in a category with kind = INTAKE that are currently visible.
    const firstQuestion = await prisma.pillarQuestion.findFirst({
      where: {
        isVisible: true,
        section: { category: { kind: PillarCategoryKind.INTAKE } },
      },
      orderBy: [
        { section: { category: { displayOrder: 'asc' } } },
        { section: { displayOrder: 'asc' } },
        { displayOrder: 'asc' },
      ],
      select: { id: true },
    });
    if (!firstQuestion) {
      throw new Error('No visible INTAKE-category PillarQuestion rows. Re-seed the intake bank.');
    }

    process.stdout.write(
      JSON.stringify({
        interviewId: interview.id,
        questionId: firstQuestion.id,
      }),
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
})().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
