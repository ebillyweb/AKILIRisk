#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Test helper: delete `StripeWebhookEvent` rows by id-prefix.
 *
 * Usage: `node scripts/delete-stripe-webhook-events.js <id-prefix>`
 *
 * The webhook smoke spec generates ids like `evt_test_<runId>_<n>` and
 * cleans them up in afterAll. Prefix delete is safer than wildcard so we
 * never wipe production-shaped Stripe event ids.
 */
const path = require('path');
const dotenv = require('dotenv');
const repoRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(repoRoot, '.env.local'), quiet: true });

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const prefix = process.argv[2];
if (!prefix || !prefix.startsWith('evt_test_')) {
  console.error('Refusing to run: prefix must start with "evt_test_"');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set. Add it to .env.local, then re-run.');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

(async () => {
  try {
    const result = await prisma.stripeWebhookEvent.deleteMany({
      where: { id: { startsWith: prefix } },
    });
    process.stdout.write(JSON.stringify({ deleted: result.count }));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
})().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
