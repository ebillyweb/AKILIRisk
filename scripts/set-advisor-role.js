#!/usr/bin/env node
/**
 * Set role to ADVISOR for advisor@test.com so the Advisor/Governance nav links appear.
 * Run: node scripts/set-advisor-role.js
 * Then sign out and sign in again so the session gets a fresh JWT with the role.
 */
const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "..", ".env.local"),
  quiet: true,
});
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { userEmailCiphertext } = require('./lib/user-email-ciphertext-cjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ADVISOR_TEST_EMAIL = 'advisor@test.com';

async function main() {
  if (!process.env.ENCRYPTION_KEY) {
    console.error('ENCRYPTION_KEY not set. Required for User.email ciphertext.');
    process.exit(1);
  }
  const updated = await prisma.user.updateMany({
    where: { emailCiphertext: userEmailCiphertext(ADVISOR_TEST_EMAIL) },
    data: { role: 'ADVISOR' },
  });
  if (updated.count === 0) {
    console.log(`No user found with email ${ADVISOR_TEST_EMAIL}. Create the user first (e.g. run seed-advisor-test-data.js).`);
    process.exit(1);
  }
  console.log('✅ Set role to ADVISOR for advisor@test.com. Sign out and sign in again to see Advisor/Governance in the nav.');
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
