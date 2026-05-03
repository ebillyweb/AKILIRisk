#!/usr/bin/env node
/**
 * Removes any User rows created by the Playwright signup happy-path test.
 *
 * The signup test (`tests/smoke/public-signup.spec.ts`) creates a throwaway
 * user with email `pw-signup-<timestamp>@test.com`. Cascades drop the
 * IntakeInterview / IntakeResponse / ClientAdvisorAssignment rows that may
 * have been seeded along with the user.
 *
 * Idempotent. Safe to run before AND after the test (afterAll hook calls it
 * to clean up the user it just created; beforeAll calls it to mop up
 * leftovers from previous failed runs).
 *
 * Requires DATABASE_URL (loaded from .env.local then .env, same pattern as
 * the other seed scripts).
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const EMAIL_PREFIX = 'pw-signup-';
const EMAIL_DOMAIN = '@test.com';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set. Add it to .env.local or .env, then re-run.');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const result = await prisma.user.deleteMany({
    where: {
      AND: [
        { email: { startsWith: EMAIL_PREFIX } },
        { email: { endsWith: EMAIL_DOMAIN } },
      ],
    },
  });
  console.log(
    `Cleanup: removed ${result.count} user(s) matching ${EMAIL_PREFIX}*${EMAIL_DOMAIN}.`
  );
}

main()
  .catch((e) => {
    console.error('Cleanup failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
