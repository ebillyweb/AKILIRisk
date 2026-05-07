#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Test helper: print the seeded client's IntakeInterview id and the first
 * question id we can use for audio-upload smoke tests.
 *
 * Output (stdout, JSON): `{ "interviewId": "...", "questionId": "..." }`
 *
 * The audio-streaming smoke test (`tests/smoke/intake-audio-endpoint.spec.ts`)
 * calls this in beforeAll to discover the IDs, then exercises the upload +
 * playback round-trip.
 */
const path = require('path');
const dotenv = require('dotenv');
const repoRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(repoRoot, '.env.local'), quiet: true });
dotenv.config({ path: path.join(repoRoot, '.env'), quiet: true });

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const TEST_CLIENT_EMAIL = process.env.CLIENT_EMAIL || 'client@test.com';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set. Add it to .env.local or .env, then re-run.');
  process.exit(1);
}
if (!process.env.ENCRYPTION_KEY) {
  console.error('ENCRYPTION_KEY not set. Required to compute the user-email ciphertext for lookup.');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Round-11 commit 2.4b dropped the plaintext User.email column;
// `findUnique({ where: { email } })` would fail at the SQL layer.
// We compute the deterministic ciphertext for the test email and
// look up by emailCiphertext instead.
//
// This script is .js (CommonJS) and can't `require` the TypeScript
// helper at `src/lib/encryption`, so we inline the deterministic
// AES-256-GCM the helper produces. The shape (scrypt key, HMAC-IV,
// iv:authTag:ciphertext output) is identical to
// `encryptDeterministic(plaintext, "User.email")` — keep them in
// sync if either changes.
const crypto = require('crypto');
function deriveAesKey() {
  return crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);
}
function userEmailCiphertext(email) {
  const plaintext = email.trim().toLowerCase();
  const key = deriveAesKey();
  const iv = crypto
    .createHmac('sha256', 'User.email')
    .update(plaintext, 'utf8')
    .digest()
    .subarray(0, 16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext}`;
}

(async () => {
  try {
    const user = await prisma.user.findFirst({
      where: { emailCiphertext: userEmailCiphertext(TEST_CLIENT_EMAIL) },
      select: { id: true },
    });
    if (!user) throw new Error(`User not found: ${TEST_CLIENT_EMAIL}`);

    const interview = await prisma.intakeInterview.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    if (!interview) {
      throw new Error(
        `No IntakeInterview for ${TEST_CLIENT_EMAIL}. Re-run scripts/seed-advisor-test-data.js`
      );
    }

    const response = await prisma.intakeResponse.findFirst({
      where: { interviewId: interview.id },
      orderBy: { updatedAt: 'asc' },
      select: { questionId: true },
    });

    // If no responses exist yet, that's fine — the smoke test uploads its
    // own audio against a known question id from the seed.
    const FALLBACK_QUESTION_ID = process.env.FIXTURE_QUESTION_ID || 'q1';

    process.stdout.write(
      JSON.stringify({
        interviewId: interview.id,
        questionId: response?.questionId ?? FALLBACK_QUESTION_ID,
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
