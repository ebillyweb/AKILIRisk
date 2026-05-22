#!/usr/bin/env node
/**
 * Upsert platform-reserved subdomain labels into ReservedSubdomains.
 * Run after migrations: node scripts/seed-platform-reserved-subdomains.js
 */
const path = require('path');
require('dotenv').config({
  path: path.join(__dirname, '..', '.env.local'),
  quiet: true,
});

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set. Add it to .env.local');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PLATFORM_LABELS = [
  ['preview', 'Staging / preview deployment host'],
  ['staging', 'Staging environment'],
  ['www', 'Primary website'],
  ['app', 'Application entry host'],
  ['api', 'API host'],
  ['admin', 'Admin console'],
  ['dev', 'Development'],
  ['test', 'Testing'],
  ['mail', 'Mail infrastructure'],
  ['smtp', 'Mail infrastructure'],
  ['cdn', 'CDN'],
  ['static', 'Static assets'],
  ['assets', 'Static assets'],
];

async function main() {
  for (const [subdomain, reason] of PLATFORM_LABELS) {
    await prisma.reservedSubdomains.upsert({
      where: { subdomain },
      create: { subdomain, reason },
      update: { reason },
    });
  }
  console.log(`✅ Upserted ${PLATFORM_LABELS.length} platform reserved subdomains`);
}

main()
  .then(() => prisma.$disconnect())
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect().finally(() => pool.end());
    process.exit(1);
  });
