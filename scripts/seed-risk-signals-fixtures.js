#!/usr/bin/env node
/**
 * Seed deterministic pillar scores + AdvisorSignal rows for risk-signals data tests.
 *
 * Prerequisites: `node scripts/seed-advisor-test-data.js`
 *
 * Usage:
 *   node scripts/seed-risk-signals-fixtures.js
 *
 * Contract: tests/fixtures/risk-signals.ts
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

const FIXTURE = {
  clientAEmail: "risk-signals-a@test.local",
  clientBEmail: "risk-signals-b@test.local",
  signalTitleA: "RS-FIXTURE-A: Critical governance",
  signalTitleB: "RS-FIXTURE-B: Critical governance",
  signalTitleAStale: "RS-FIXTURE-A: Stale (outside 90-day window)",
  dedupeKeys: {
    aCritical: "rs-fixture-a-gov-critical",
    bCritical: "rs-fixture-b-gov-critical",
    aStale: "rs-fixture-a-gov-critical-stale",
  },
  assessmentIds: {
    a: "rs-fixture-asmt-a",
    b: "rs-fixture-asmt-b",
  },
};

const ADVISOR_A_EMAIL = "advisor@test.com";
const ADVISOR_B_EMAIL = "advisor2@test.com";
const SIGNAL_FEED_WINDOW_DAYS = 90;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set (.env.local).");
  process.exit(1);
}
if (!process.env.ENCRYPTION_KEY) {
  console.error("ENCRYPTION_KEY not set (.env.local).");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function upsertFixtureClient(email) {
  const emailCiphertext = userEmailCiphertext(email);
  return prisma.user.upsert({
    where: { emailCiphertext },
    update: { emailCiphertext, role: "USER", name: email, password: null },
    create: {
      emailCiphertext,
      role: "USER",
      name: email,
      password: null,
    },
  });
}

async function upsertCompletedAssessment(userId, assessmentId, completedAt) {
  return prisma.assessment.upsert({
    where: { id: assessmentId },
    update: {
      userId,
      status: "COMPLETED",
      completedAt,
      deliverablePhase: "PREVIEW",
    },
    create: {
      id: assessmentId,
      userId,
      status: "COMPLETED",
      completedAt,
      deliverablePhase: "PREVIEW",
    },
  });
}

async function upsertPillarScore(assessmentId, pillar, score, riskLevel, calculatedAt) {
  const existing = await prisma.pillarScore.findFirst({
    where: { assessmentId, pillar },
    select: { id: true },
  });
  if (existing) {
    return prisma.pillarScore.update({
      where: { id: existing.id },
      data: { score, riskLevel, calculatedAt },
    });
  }
  return prisma.pillarScore.create({
    data: {
      assessmentId,
      pillar,
      score,
      riskLevel,
      breakdown: {},
      calculatedAt,
    },
  });
}

async function upsertAdvisorSignal({
  advisorId,
  clientId,
  dedupeKey,
  title,
  severity,
  createdAt,
}) {
  return prisma.advisorSignal.upsert({
    where: {
      advisorId_dedupeKey: { advisorId, dedupeKey },
    },
    update: {
      clientId,
      title,
      severity,
      createdAt,
      readAt: null,
      type: "PILLAR_CRITICAL",
      message: title,
      payload: { href: `/advisor/intelligence/${clientId}` },
    },
    create: {
      advisorId,
      clientId,
      dedupeKey,
      title,
      severity,
      createdAt,
      readAt: null,
      type: "PILLAR_CRITICAL",
      message: title,
      payload: { href: `/advisor/intelligence/${clientId}` },
    },
  });
}

async function main() {
  console.log("🌱 Seeding risk-signals fixtures...");

  const advisorAUser = await prisma.user.findFirst({
    where: { emailCiphertext: userEmailCiphertext(ADVISOR_A_EMAIL) },
    select: { id: true, advisorProfile: { select: { id: true } } },
  });
  const advisorBUser = await prisma.user.findFirst({
    where: { emailCiphertext: userEmailCiphertext(ADVISOR_B_EMAIL) },
    select: { id: true, advisorProfile: { select: { id: true } } },
  });

  if (!advisorAUser?.advisorProfile?.id || !advisorBUser?.advisorProfile?.id) {
    console.error(
      "Missing advisor profiles. Run: node scripts/seed-advisor-test-data.js"
    );
    process.exit(1);
  }

  const advisorAId = advisorAUser.advisorProfile.id;
  const advisorBId = advisorBUser.advisorProfile.id;

  const clientA = await upsertFixtureClient(FIXTURE.clientAEmail);
  const clientB = await upsertFixtureClient(FIXTURE.clientBEmail);

  await prisma.clientProfile.upsert({
    where: { userId: clientA.id },
    update: {},
    create: { userId: clientA.id },
  });
  await prisma.clientProfile.upsert({
    where: { userId: clientB.id },
    update: {},
    create: { userId: clientB.id },
  });

  await prisma.clientAdvisorAssignment.upsert({
    where: {
      clientId_advisorId: { clientId: clientA.id, advisorId: advisorAId },
    },
    update: { status: "ACTIVE" },
    create: {
      clientId: clientA.id,
      advisorId: advisorAId,
      status: "ACTIVE",
      assignedAt: new Date(),
    },
  });
  await prisma.clientAdvisorAssignment.upsert({
    where: {
      clientId_advisorId: { clientId: clientB.id, advisorId: advisorBId },
    },
    update: { status: "ACTIVE" },
    create: {
      clientId: clientB.id,
      advisorId: advisorBId,
      status: "ACTIVE",
      assignedAt: new Date(),
    },
  });

  const completedAt = new Date();
  const asmtA = await upsertCompletedAssessment(
    clientA.id,
    FIXTURE.assessmentIds.a,
    completedAt
  );
  const asmtB = await upsertCompletedAssessment(
    clientB.id,
    FIXTURE.assessmentIds.b,
    completedAt
  );

  await upsertPillarScore(asmtA.id, "governance", 2, "CRITICAL", completedAt);
  await upsertPillarScore(asmtA.id, "cyber-digital", 8, "LOW", completedAt);
  await upsertPillarScore(asmtB.id, "governance", 8, "LOW", completedAt);

  const recent = new Date();
  const stale = new Date();
  stale.setDate(stale.getDate() - (SIGNAL_FEED_WINDOW_DAYS + 10));

  await upsertAdvisorSignal({
    advisorId: advisorAId,
    clientId: clientA.id,
    dedupeKey: FIXTURE.dedupeKeys.aCritical,
    title: FIXTURE.signalTitleA,
    severity: "critical",
    createdAt: recent,
  });
  await upsertAdvisorSignal({
    advisorId: advisorBId,
    clientId: clientB.id,
    dedupeKey: FIXTURE.dedupeKeys.bCritical,
    title: FIXTURE.signalTitleB,
    severity: "critical",
    createdAt: recent,
  });
  await upsertAdvisorSignal({
    advisorId: advisorAId,
    clientId: clientA.id,
    dedupeKey: FIXTURE.dedupeKeys.aStale,
    title: FIXTURE.signalTitleAStale,
    severity: "critical",
    createdAt: stale,
  });

  console.log("✅ Risk-signals fixtures ready:");
  console.log(`   Advisor A (${ADVISOR_A_EMAIL}): client ${FIXTURE.clientAEmail}`);
  console.log(`   Advisor B (${ADVISOR_B_EMAIL}): client ${FIXTURE.clientBEmail}`);
  console.log("   Run Playwright: tests/smoke/risk-signals-data.spec.ts");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
