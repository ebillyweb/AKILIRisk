#!/usr/bin/env node
/**
 * Create a test invite code for the assessment flow.
 * Run: node scripts/seed-invite-code.js [CODE] [PREFILL_EMAIL]
 * Code is 6 characters, letters and/or numbers (e.g. 123456, ABC123, BELV01).
 * Optional PREFILL_EMAIL: when users enter this code, the signup form email is prefilled (e.g. buddy+belvcustomer@ebilly.com).
 */
const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "..", ".env.local"),
  quiet: true,
});
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DEFAULT_CODE = "123456";
const TEST_CLIENT_PREFILL = "buddy+belvcustomer@ebilly.com";

function normalizeCode(code) {
  return code
    .trim()
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 6);
}

async function main() {
  const codeArg = process.argv[2];
  const prefillArg = process.argv[3];

  // No args: seed default code and test client invite (BELV01 -> buddy+belvcustomer@ebilly.com)
  if (!codeArg) {
    await prisma.inviteCode.upsert({
      where: { code: DEFAULT_CODE },
      update: {},
      create: { code: DEFAULT_CODE, maxUses: null, usedCount: 0 },
    });
    console.log("Invite code ready:", DEFAULT_CODE);

    const testInvite = await prisma.inviteCode.upsert({
      where: { code: "BELV01" },
      update: { prefillEmail: TEST_CLIENT_PREFILL },
      create: {
        code: "BELV01",
        prefillEmail: TEST_CLIENT_PREFILL,
        maxUses: null,
        usedCount: 0,
      },
    });
    console.log("Test client invite ready: BELV01 -> prefill", testInvite.prefillEmail);
    console.log("Use at: /start");
    return;
  }

  const code = codeArg;
  const prefillEmail = prefillArg ? prefillArg.trim() : null;
  const normalized = normalizeCode(code) || DEFAULT_CODE;
  const invite = await prisma.inviteCode.upsert({
    where: { code: normalized },
    update: { prefillEmail: prefillEmail || undefined },
    create: {
      code: normalized,
      prefillEmail: prefillEmail || undefined,
      maxUses: null,
      usedCount: 0,
    },
  });
  console.log("Invite code ready:", invite.code, invite.prefillEmail ? `(prefill: ${invite.prefillEmail})` : "");
  console.log("Use it at: /start");
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
