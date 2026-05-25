import "server-only";

import type { UserRole } from "@prisma/client";

import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/admin/auth";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import { decryptUserEmail, withDecryptedEmail } from "@/lib/auth/user-email";

export type ClientsAdminScope = "active" | "all";

export type AdvisorsAdminScope = "active" | "all";

export async function getAdvisorsForAdmin(opts?: { scope?: AdvisorsAdminScope }) {
  await requireAdminRole();
  const scope = opts?.scope ?? "active";
  // Round-11 commit 2.4b: select emailCiphertext, decrypt in the
  // mapper so callers keep reading `.email` as plaintext. orderBy on
  // emailCiphertext is meaningless (deterministic ciphertext doesn't
  // preserve string order), so we fall back to createdAt — admin UIs
  // can re-sort client-side after the email plaintext is hydrated.
  const advisors = await prisma.user.findMany({
    where: {
      role: "ADVISOR",
      ...(scope === "active" ? { deletedAt: null } : {}),
    },
    select: {
      id: true,
      emailCiphertext: true,
      name: true,
      firstName: true,
      lastName: true,
      createdAt: true,
      deletedAt: true,
      advisorPortalAccessEnabled: true,
      subscription: {
        select: {
          status: true,
          tier: true,
          billingCycle: true,
          whiteLabel: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
        },
      },
      advisorProfile: {
        select: {
          id: true,
          firmName: true,
          licenseNumber: true,
          specializations: true,
          phone: true,
          jobTitle: true,
          bio: true,
          logoUrl: true,
          logoS3Key: true,
          brandName: true,
          primaryColor: true,
          secondaryColor: true,
          accentColor: true,
          _count: { select: { clientAssignments: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return advisors.map(withDecryptedEmail);
}

/** Fetch a single advisor by user id for admin edit form. */
export async function getAdvisorForAdmin(userId: string) {
  await requireAdminRole();
  // Round-11 commit 2.4b: same ciphertext→plaintext mapper pattern.
  const user = await prisma.user.findFirst({
    where: { id: userId, role: "ADVISOR" },
    select: {
      id: true,
      emailCiphertext: true,
      name: true,
      firstName: true,
      lastName: true,
      deletedAt: true,
      advisorPortalAccessEnabled: true,
      subscription: {
        select: {
          status: true,
          tier: true,
          billingCycle: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          stripeSubscriptionId: true,
          createdAt: true,
        },
      },
      advisorProfile: {
        select: {
          id: true,
          firmName: true,
          licenseNumber: true,
          specializations: true,
          phone: true,
          jobTitle: true,
          bio: true,
        },
      },
    },
  });
  return user ? withDecryptedEmail(user) : null;
}

export async function getClientsForAdmin(opts?: { scope?: ClientsAdminScope }) {
  const { userId, email, role } = await requireAdminRole();
  const scope = opts?.scope ?? "active";
  // Round-11 commit 2.4b: ciphertext on both the top-level User and
  // the joined advisor.user; decrypt at exit so the admin page sees
  // `.email` plaintext on every row.
  const usersRaw = await prisma.user.findMany({
    where: {
      role: "USER",
      ...(scope === "active" ? { deletedAt: null } : {}),
    },
    select: {
      id: true,
      emailCiphertext: true,
      name: true,
      deletedAt: true,
      createdAt: true,
      _count: {
        select: { intakeInterviews: true, assessments: true },
      },
      clientAssignments: {
        select: {
          status: true,
          assignedAt: true,
          advisor: {
            select: {
              id: true,
              user: { select: { emailCiphertext: true, name: true } },
              firmName: true,
            },
          },
        },
      },
      // §4.5 commit 2: surface the most recent assessment id (with at
      // least one PillarScore) so the admin clients page can render a
      // "Download report" button per row. We pull the most-recent
      // assessment regardless of scoring state, then filter to those that
      // have scores in the post-load mapper — keeps the query a single
      // round-trip rather than per-row PillarScore lookups.
      assessments: {
        select: {
          id: true,
          completedAt: true,
          scores: { select: { id: true }, take: 1 },
        },
        orderBy: { startedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "asc" },
  });
  const users = usersRaw.map((u) => {
    const latestAssessment = u.assessments[0];
    const latestScoredAssessmentId =
      latestAssessment && latestAssessment.scores.length > 0
        ? latestAssessment.id
        : null;
    return {
      ...u,
      email: decryptUserEmail(u.emailCiphertext),
      latestScoredAssessmentId,
      clientAssignments: u.clientAssignments.map((a) => ({
        ...a,
        advisor: {
          ...a.advisor,
          user: {
            ...a.advisor.user,
            email: decryptUserEmail(a.advisor.user.emailCiphertext),
          },
        },
      })),
    };
  });

  // Fire-and-forget audit. writeAudit catches its own errors so a slow Prisma
  // write can't break the page render. Metadata records the row count only —
  // the actual user list (PII-heavy) is NOT logged. Filter params are an
  // empty object today (the admin clients page filters client-side after
  // loading the full list); recorded for parity with future filterable
  // versions of these queries.
  void writeAudit({
    actor: { userId, role: role as UserRole, email },
    action: AUDIT_ACTIONS.DATA_ACCESS_ADMIN_CLIENTS_LIST,
    entityType: "User",
    entityId: null,
    metadata: { rowCount: users.length, filterParams: { scope } },
  });

  return users;
}

export async function getIntakeForAdmin() {
  const { userId, email, role } = await requireAdminRole();
  // Round-11 commit 2.4b: nested ciphertext fields on user + advisor.user.
  const interviewsRaw = await prisma.intakeInterview.findMany({
    select: {
      id: true,
      status: true,
      currentQuestionIndex: true,
      startedAt: true,
      completedAt: true,
      submittedAt: true,
      updatedAt: true,
      user: { select: { id: true, emailCiphertext: true, name: true } },
      approval: {
        select: {
          id: true,
          status: true,
          advisor: { select: { user: { select: { emailCiphertext: true } } } },
        },
      },
      _count: { select: { responses: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  const interviews = interviewsRaw.map((i) => ({
    ...i,
    user: { ...i.user, email: decryptUserEmail(i.user.emailCiphertext) },
    approval: i.approval
      ? {
          ...i.approval,
          advisor: {
            ...i.approval.advisor,
            user: {
              ...i.approval.advisor.user,
              email: decryptUserEmail(i.approval.advisor.user.emailCiphertext),
            },
          },
        }
      : null,
  }));

  void writeAudit({
    actor: { userId, role: role as UserRole, email },
    action: AUDIT_ACTIONS.DATA_ACCESS_ADMIN_INTAKE_LIST,
    entityType: "IntakeInterview",
    entityId: null,
    metadata: { rowCount: interviews.length, filterParams: {} },
  });

  return interviews;
}

export async function getAssessmentsForAdmin() {
  const { userId, email, role } = await requireAdminRole();
  // Round-11 commit 2.4b: ciphertext on user, decrypt at exit.
  const assessmentsRaw = await prisma.assessment.findMany({
    select: {
      id: true,
      userId: true,
      version: true,
      status: true,
      currentPillar: true,
      currentQuestionIndex: true,
      startedAt: true,
      completedAt: true,
      updatedAt: true,
      user: { select: { id: true, emailCiphertext: true, name: true } },
      _count: { select: { responses: true, scores: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  const assessments = assessmentsRaw.map((a) => ({
    ...a,
    user: { ...a.user, email: decryptUserEmail(a.user.emailCiphertext) },
  }));

  void writeAudit({
    actor: { userId, role: role as UserRole, email },
    action: AUDIT_ACTIONS.DATA_ACCESS_ADMIN_ASSESSMENTS_LIST,
    entityType: "Assessment",
    entityId: null,
    metadata: { rowCount: assessments.length, filterParams: {} },
  });

  return assessments;
}

export async function getGovernanceReviewLeadsForAdmin() {
  await requireAdminRole();
  // Round-11 commit 2.4b: assignedAdvisor.user.email decrypted at exit.
  const leads = await prisma.governanceReviewLead.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      assignedAdvisor: {
        select: {
          id: true,
          firmName: true,
          user: { select: { emailCiphertext: true, name: true } },
        },
      },
    },
  });
  return leads.map((l) => ({
    ...l,
    assignedAdvisor: l.assignedAdvisor
      ? {
          ...l.assignedAdvisor,
          user: {
            ...l.assignedAdvisor.user,
            email: decryptUserEmail(l.assignedAdvisor.user.emailCiphertext),
          },
        }
      : null,
  }));
}

export async function getAdvisorProfilesForLeadAssignment() {
  await requireAdminRole();
  // Round-11 commit 2.4b: same nested decrypt.
  const profiles = await prisma.advisorProfile.findMany({
    where: { user: { deletedAt: null } },
    select: {
      id: true,
      firmName: true,
      user: { select: { emailCiphertext: true, name: true } },
    },
    orderBy: { id: "asc" },
  });
  return profiles.map((p) => ({
    ...p,
    user: { ...p.user, email: decryptUserEmail(p.user.emailCiphertext) },
  }));
}

/** Platform staff (`ADMIN` / `SUPER_ADMIN`) for the admin Staff page. */
export async function getPlatformStaffForAdmin() {
  await requireAdminRole();
  const rows = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
    select: {
      id: true,
      emailCiphertext: true,
      name: true,
      role: true,
      deletedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(withDecryptedEmail);
}
