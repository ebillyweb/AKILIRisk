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
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const { PrismaClient } = require('@prisma/client');

const prefix = process.argv[2];
if (!prefix || !prefix.startsWith('evt_test_')) {
  console.error('Refusing to run: prefix must start with "evt_test_"');
  process.exit(1);
}

(async () => {
  const prisma = new PrismaClient();
  try {
    const result = await prisma.stripeWebhookEvent.deleteMany({
      where: { id: { startsWith: prefix } },
    });
    process.stdout.write(JSON.stringify({ deleted: result.count }));
  } finally {
    await prisma.$disconnect();
  }
})().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
