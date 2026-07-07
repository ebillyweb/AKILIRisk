#!/usr/bin/env node
/**
 * READ-ONLY: list active client assignments for an advisor and test email decrypt.
 * Run: EMAIL=advisor@test.com node scripts/diag-advisor-client-decrypt.js
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local"), quiet: true });

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const crypto = require("crypto");
const { userEmailCiphertext } = require("./lib/user-email-ciphertext-cjs");

function deriveAesKey() {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) throw new Error("ENCRYPTION_KEY not set");
  return crypto.scryptSync(encryptionKey, "salt", 32);
}

function decryptUserEmail(ciphertext) {
  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("Invalid ciphertext format");
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
  return plaintext;
}

async function main() {
  const advisorEmail = (process.env.EMAIL || "advisor@test.com").trim().toLowerCase();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const advisor = await prisma.user.findUnique({
    where: { emailCiphertext: userEmailCiphertext(advisorEmail) },
    select: { id: true, advisorProfile: { select: { id: true } } },
  });

  if (!advisor?.advisorProfile) {
    console.log(JSON.stringify({ found: false, advisorEmail }, null, 2));
    return;
  }

  const assignments = await prisma.clientAdvisorAssignment.findMany({
    where: { advisorId: advisor.advisorProfile.id, status: "ACTIVE" },
    include: {
      client: {
        select: { id: true, emailCiphertext: true, name: true, createdAt: true },
      },
    },
    orderBy: { assignedAt: "asc" },
  });

  const rows = [];
  let failures = 0;
  for (const a of assignments) {
    try {
      const email = decryptUserEmail(a.client.emailCiphertext);
      rows.push({ status: "ok", clientId: a.client.id, email, name: a.client.name });
    } catch (err) {
      failures += 1;
      rows.push({
        status: "fail",
        clientId: a.client.id,
        name: a.client.name,
        ciphertextPrefix: a.client.emailCiphertext.slice(0, 32),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        advisorEmail,
        activeClients: assignments.length,
        decryptFailures: failures,
        rows,
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
