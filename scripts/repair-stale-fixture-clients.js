#!/usr/bin/env node
/**
 * Remove stale fixture client rows that fail email decrypt (left over from
 * re-seeding @test.com users under a previous ENCRYPTION_KEY).
 *
 * Keeps assignments whose client email decrypts with the current key.
 *
 * Usage:
 *   node scripts/repair-stale-fixture-clients.js --yes
 *   EMAIL=advisor@test.com node scripts/repair-stale-fixture-clients.js --yes
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local"), quiet: true });

const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const { userEmailCiphertext } = require("./lib/user-email-ciphertext-cjs");

const YES = process.argv.includes("--yes");

function deriveAesKey() {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) throw new Error("ENCRYPTION_KEY not set");
  return crypto.scryptSync(encryptionKey, "salt", 32);
}

function tryDecryptUserEmail(ciphertext) {
  try {
    const parts = ciphertext.split(":");
    if (parts.length !== 3) return { ok: false, error: "invalid format" };
    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = deriveAesKey();
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivHex, "hex"),
    );
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    let plaintext = decipher.update(encryptedHex, "hex", "utf8");
    plaintext += decipher.final("utf8");
    return { ok: true, email: plaintext };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main() {
  if (!YES) {
    console.error("Refusing to run without --yes (removes stale assignments/users).");
    console.error("  node scripts/repair-stale-fixture-clients.js --yes");
    process.exit(1);
  }

  const advisorEmail = (process.env.EMAIL || "advisor@test.com").trim().toLowerCase();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const advisor = await prisma.user.findUnique({
    where: { emailCiphertext: userEmailCiphertext(advisorEmail) },
    select: { advisorProfile: { select: { id: true } } },
  });

  if (!advisor?.advisorProfile) {
    throw new Error(`Advisor not found: ${advisorEmail}`);
  }

  const assignments = await prisma.clientAdvisorAssignment.findMany({
    where: { advisorId: advisor.advisorProfile.id, status: "ACTIVE" },
    include: { client: { select: { id: true, emailCiphertext: true, name: true } } },
  });

  const staleClientIds = [];
  for (const assignment of assignments) {
    const result = tryDecryptUserEmail(assignment.client.emailCiphertext);
    if (!result.ok) {
      staleClientIds.push(assignment.client.id);
      console.log(
        `Stale client ${assignment.client.id} (${assignment.client.name}): ${result.error}`,
      );
    }
  }

  if (staleClientIds.length === 0) {
    console.log("No stale fixture clients found.");
    await prisma.$disconnect();
    await pool.end();
    return;
  }

  const removedAssignments = await prisma.clientAdvisorAssignment.deleteMany({
    where: {
      advisorId: advisor.advisorProfile.id,
      clientId: { in: staleClientIds },
    },
  });

  const removedUsers = await prisma.user.deleteMany({
    where: { id: { in: staleClientIds }, role: "USER" },
  });

  console.log(
    `Removed ${removedAssignments.count} stale assignment(s) and ${removedUsers.count} orphan client user(s).`,
  );
  console.log("Re-run: node scripts/seed-advisor-test-data.js");

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
