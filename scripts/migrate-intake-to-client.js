#!/usr/bin/env node
/**
 * One-off: reassign a SUBMITTED IntakeInterview from an advisor's User row to the
 * assigned client's User row (fixes intake completed while logged in as advisor).
 *
 * Default target: buddy+client2@ebilly.com and the advisor-owned SUBMITTED
 * interview for that client's ACTIVE assignment.
 *
 * Usage:
 *   node scripts/migrate-intake-to-client.js              # apply
 *   DRY_RUN=1 node scripts/migrate-intake-to-client.js    # preview only
 *
 * Optional env:
 *   CLIENT_EMAIL=buddy+client2@ebilly.com
 *   INTERVIEW_ID=cmpt8n6cd000004jolsjuyrt0   # skip auto-detect
 *   DRY_RUN=1
 *
 * Requires DATABASE_URL and ENCRYPTION_KEY in `.env.local`.
 */

const path = require("path");
const repoRoot = path.resolve(__dirname, "..");
require("dotenv").config({
  path: path.join(repoRoot, ".env.local"),
  quiet: true,
});

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const { userEmailCiphertext } = require("./lib/user-email-ciphertext-cjs");

const CLIENT_EMAIL =
  process.env.CLIENT_EMAIL || "buddy+client2@ebilly.com";
const INTERVIEW_ID = process.env.INTERVIEW_ID?.trim() || null;
const DRY_RUN =
  process.env.DRY_RUN === "1" || process.argv.includes("--dry-run");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set. Add it to .env.local, then re-run.");
  process.exit(1);
}
if (!process.env.ENCRYPTION_KEY) {
  console.error("ENCRYPTION_KEY not set. Required for User email ciphertext lookups.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function findClient() {
  const user = await prisma.user.findFirst({
    where: { emailCiphertext: userEmailCiphertext(CLIENT_EMAIL) },
    select: {
      id: true,
      role: true,
      name: true,
      clientAssignments: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          advisorId: true,
          intakeWaivedAt: true,
          advisor: {
            select: {
              id: true,
              firmName: true,
              userId: true,
              user: { select: { id: true, role: true, name: true } },
            },
          },
        },
      },
      intakeInterviews: {
        select: { id: true, status: true, submittedAt: true },
      },
    },
  });
  if (!user) {
    throw new Error(`Client not found: ${CLIENT_EMAIL}`);
  }
  if (user.role !== "USER") {
    throw new Error(
      `${CLIENT_EMAIL} has role ${user.role}; expected USER.`,
    );
  }
  return user;
}

async function loadInterviewById(id) {
  const interview = await prisma.intakeInterview.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, role: true, name: true } },
      _count: { select: { responses: true } },
      approval: { select: { id: true, status: true, advisorId: true } },
    },
  });
  if (!interview) {
    throw new Error(`Interview not found: ${id}`);
  }
  return interview;
}

async function findMisplacedInterviewForClient(client) {
  const assignment = client.clientAssignments[0];
  if (!assignment) {
    throw new Error(
      `No ACTIVE ClientAdvisorAssignment for ${CLIENT_EMAIL}. Assign the client first.`,
    );
  }

  const advisorUserId = assignment.advisor.userId;
  const interview = await prisma.intakeInterview.findFirst({
    where: {
      userId: advisorUserId,
      OR: [{ status: "SUBMITTED" }, { submittedAt: { not: null } }],
    },
    orderBy: { submittedAt: "desc" },
    include: {
      user: { select: { id: true, role: true, name: true } },
      _count: { select: { responses: true } },
      approval: { select: { id: true, status: true, advisorId: true } },
    },
  });

  if (!interview) {
    const existingClientSubmitted = client.intakeInterviews.filter(
      (i) => i.status === "SUBMITTED" || i.submittedAt != null,
    );
    if (existingClientSubmitted.length > 0) {
      const id = existingClientSubmitted[0].id;
      console.log(
        `Nothing to migrate: ${CLIENT_EMAIL} already owns submitted intake ${id}.`,
      );
      console.log(`Advisor review: /advisor/review/${id}`);
      console.log(`Admin review: /admin/intake/${id}`);
      console.log(
        `Sign in as the assigned advisor (${assignment.advisor.firmName}) or a platform admin to open the review.`,
      );
      return null;
    }

    throw new Error(
      `No submitted intake on advisor user ${advisorUserId} (${assignment.advisor.firmName}). ` +
        "Set INTERVIEW_ID explicitly or complete intake as the client.",
    );
  }

  return { interview, assignment };
}

async function main() {
  const client = await findClient();

  const resolved = INTERVIEW_ID
    ? {
        interview: await loadInterviewById(INTERVIEW_ID),
        assignment: client.clientAssignments[0] ?? null,
      }
    : await findMisplacedInterviewForClient(client);

  if (!resolved) {
    return;
  }

  const { interview, assignment } = resolved;

  if (interview.userId === client.id) {
    console.log(
      `Nothing to do: interview ${interview.id} is already owned by ${CLIENT_EMAIL}.`,
    );
    return;
  }

  if (interview.user.role !== "ADVISOR" && interview.user.role !== "ADMIN") {
    console.warn(
      `Warning: interview owner role is ${interview.user.role}, not ADVISOR/ADMIN.`,
    );
  }

  const existingClientSubmitted = client.intakeInterviews.filter(
    (i) =>
      i.status === "SUBMITTED" ||
      i.submittedAt != null,
  );
  if (existingClientSubmitted.length > 0) {
    throw new Error(
      `Client already has ${existingClientSubmitted.length} submitted intake(s): ` +
        `${existingClientSubmitted.map((i) => i.id).join(", ")}. ` +
        "Resolve manually before migrating.",
    );
  }

  const plan = {
    clientEmail: CLIENT_EMAIL,
    clientUserId: client.id,
    interviewId: interview.id,
    fromUserId: interview.userId,
    fromUserName: interview.user.name,
    fromUserRole: interview.user.role,
    responseCount: interview._count.responses,
    approval: interview.approval,
    assignmentAdvisorId: assignment?.advisorId ?? null,
    intakeWaived: assignment?.intakeWaivedAt != null,
  };

  console.log(DRY_RUN ? "--- DRY RUN ---" : "--- APPLY ---");
  console.log(JSON.stringify(plan, null, 2));

  if (assignment?.intakeWaivedAt) {
    console.warn(
      "Note: intake is waived on this assignment; pipeline may not show awaiting review until waiver is cleared.",
    );
  }

  if (DRY_RUN) {
    console.log("No changes written (DRY_RUN=1).");
    return;
  }

  const updated = await prisma.intakeInterview.update({
    where: { id: interview.id },
    data: { userId: client.id },
    select: {
      id: true,
      userId: true,
      status: true,
      submittedAt: true,
      _count: { select: { responses: true } },
    },
  });

  console.log("Updated IntakeInterview:", updated);
  console.log(
    `Advisor review URL path: /advisor/review/${updated.id}`,
  );
  console.log(
    "Refresh the advisor pipeline (Awaiting review filter) to confirm the client appears.",
  );
}

main()
  .catch((e) => {
    console.error("Migration failed:", e.message || e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
