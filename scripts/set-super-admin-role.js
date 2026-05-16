#!/usr/bin/env node
/**
 * Promote an existing user to SUPER_ADMIN by plaintext email.
 *
 * Usage:
 *   node scripts/set-super-admin-role.js buddy@ebilly.com
 *
 * Requires DATABASE_URL + ENCRYPTION_KEY (same as other user scripts).
 * Sign out and sign in as that user so the JWT picks up the new role.
 */
const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "..", ".env.local"),
  quiet: true,
});
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const { userEmailCiphertext } = require("./lib/user-email-ciphertext-cjs");

const emailArg = process.argv[2];
if (!emailArg || emailArg.startsWith("-")) {
  console.error("Usage: node scripts/set-super-admin-role.js <email>");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  if (!process.env.ENCRYPTION_KEY) {
    console.error("ENCRYPTION_KEY not set.");
    process.exit(1);
  }
  const ct = userEmailCiphertext(emailArg.trim().toLowerCase());
  const updated = await prisma.user.updateMany({
    where: { emailCiphertext: ct },
    data: { role: "SUPER_ADMIN" },
  });
  if (updated.count === 0) {
    console.error("No user found for that email (check spelling / casing).");
    process.exit(1);
  }
  console.log("✅ SUPER_ADMIN set for", emailArg.trim());
  console.log("   Have them sign out and sign in again.");
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
