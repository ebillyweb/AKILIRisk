#!/usr/bin/env node
/**
 * Restore AdvisorSubdomain `independent-wealth` for advisor2 fixture.
 * Used when preview DB drifted and tenant-portal canaries 404.
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

if (!process.env.ENCRYPTION_KEY) {
  console.error("ENCRYPTION_KEY not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const email = "advisor2@test.com";
  const user = await prisma.user.findUnique({
    where: { emailCiphertext: userEmailCiphertext(email) },
    select: {
      id: true,
      advisorProfile: { select: { id: true, firmName: true } },
    },
  });

  if (!user?.advisorProfile?.id) {
    throw new Error(
      `${email} / AdvisorProfile missing — run node scripts/seed-advisor-test-data.js`,
    );
  }

  const advisorId = user.advisorProfile.id;
  await prisma.advisorSubdomain.deleteMany({
    where: {
      OR: [{ advisorId }, { subdomain: "independent-wealth" }],
    },
  });
  await prisma.advisorSubdomain.create({
    data: {
      advisorId,
      subdomain: "independent-wealth",
      isActive: true,
      dnsVerified: true,
      sslProvisioned: true,
      verifiedAt: new Date(),
      lastCheckedAt: new Date(),
    },
  });

  // Ensure branded portal title matches the smoke assertion.
  await prisma.advisorProfile.update({
    where: { id: advisorId },
    data: {
      firmName: "Independent Wealth Group",
      brandName: "Independent Wealth Group",
      brandingEnabled: true,
    },
  });

  const row = await prisma.advisorSubdomain.findUnique({
    where: { subdomain: "independent-wealth" },
    select: { subdomain: true, isActive: true, dnsVerified: true },
  });
  console.log("Restored:", row);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
