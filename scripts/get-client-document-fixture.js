#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Test helper: first unfulfilled DocumentRequirement for the seeded client.
 *
 * Output (stdout, JSON): `{ "requirementId": "...", "clientId": "..." }`
 */
const path = require("path");
const dotenv = require("dotenv");
const repoRoot = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(repoRoot, ".env.local"), quiet: true });

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const TEST_CLIENT_EMAIL = process.env.CLIENT_EMAIL || "client@test.com";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set. Add it to .env.local, then re-run.");
  process.exit(1);
}
if (!process.env.ENCRYPTION_KEY) {
  console.error(
    "ENCRYPTION_KEY not set. Required to compute the user-email ciphertext for lookup.",
  );
  process.exit(1);
}

const { userEmailCiphertext } = require("./lib/user-email-ciphertext-cjs");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

(async () => {
  try {
    const user = await prisma.user.findFirst({
      where: { emailCiphertext: userEmailCiphertext(TEST_CLIENT_EMAIL) },
      select: { id: true },
    });
    if (!user) {
      throw new Error(`User not found: ${TEST_CLIENT_EMAIL}`);
    }

    const requirement = await prisma.documentRequirement.findFirst({
      where: { clientId: user.id, fulfilled: false },
      orderBy: { createdAt: "asc" },
      select: { id: true, clientId: true },
    });
    if (!requirement) {
      throw new Error(
        `No unfulfilled DocumentRequirement for ${TEST_CLIENT_EMAIL}. ` +
          "Re-run scripts/seed-advisor-test-data.js or scripts/reset-client-document-requirement.js",
      );
    }

    process.stdout.write(
      JSON.stringify({
        requirementId: requirement.id,
        clientId: requirement.clientId,
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
