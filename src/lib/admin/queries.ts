import "server-only";

import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/admin/auth";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";

export type AdvisorsAdminScope = "active" | "all";

export async function getAdvisorsForAdmin(opts?: { scope?: AdvisorsAdminScope }) {
  await requireAdminRole();
  const scope = opts?.scope ?? "active";
  const advisors = await prisma.user.findMany({
    where: {
      role: "ADVISOR",
      ...(scope === "active" ? { deletedAt: null } : {}),
    },
    select: {
      id: true,
      email: true,
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
    orderBy: { email: "asc" },
  });
  return advisors;
}

/** Fetch a single advisor by user id for admin edit form. */
export async function getAdvisorForAdmin(userId: string) {
  await requireAdminRole();
  const user = await prisma.user.findFirst({
    where: { id: userId, role: "ADVISOR" },
    select: {
      id: true,
      email: true,
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
  return user;
}

export async function getClientsForAdmin() {
  const { userId, email } = await requireAdminRole();
  const users = await prisma.user.findMany({
    where: { role: "USER" },
    select: {
      id: true,
      email: true,
      name: true,
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
              user: { select: { email: true, name: true } },
              firmName: true,
            },
          },
        },
      },
    },
    orderBy: { email: "asc" },
  });

  // Fire-and-forget audit. writeAudit catches its own errors so a slow Prisma
  // write can't break the page render. Metadata records the row count only —
  // the actual user list (PII-heavy) is NOT logged. Filter params are an
  // empty object today (the admin clients page filters client-side after
  // loading the full list); recorded for parity with future filterable
  // versions of these queries.
  void writeAudit({
    actor: { userId, role: "ADMIN", email },
    action: AUDIT_ACTIONS.DATA_ACCESS_ADMIN_CLIENTS_LIST,
    entityType: "User",
    entityId: null,
    metadata: { rowCount: users.length, filterParams: {} },
  });

  return users;
}

export async function getIntakeForAdmin() {
  const { userId, email } = await requireAdminRole();
  const interviews = await prisma.intakeInterview.findMany({
    select: {
      id: true,
      status: true,
      currentQuestionIndex: true,
      startedAt: true,
      completedAt: true,
      submittedAt: true,
      updatedAt: true,
      user: { select: { id: true, email: true, name: true } },
      approval: {
        select: {
          id: true,
          status: true,
          advisor: { select: { user: { select: { email: true } } } },
        },
      },
      _count: { select: { responses: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  void writeAudit({
    actor: { userId, role: "ADMIN", email },
    action: AUDIT_ACTIONS.DATA_ACCESS_ADMIN_INTAKE_LIST,
    entityType: "IntakeInterview",
    entityId: null,
    metadata: { rowCount: interviews.length, filterParams: {} },
  });

  return interviews;
}

export async function getAssessmentsForAdmin() {
  const { userId, email } = await requireAdminRole();
  const assessments = await prisma.assessment.findMany({
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
      user: { select: { id: true, email: true, name: true } },
      _count: { select: { responses: true, scores: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  void writeAudit({
    actor: { userId, role: "ADMIN", email },
    action: AUDIT_ACTIONS.DATA_ACCESS_ADMIN_ASSESSMENTS_LIST,
    entityType: "Assessment",
    entityId: null,
    metadata: { rowCount: assessments.length, filterParams: {} },
  });

  return assessments;
}

export async function getGovernanceReviewLeadsForAdmin() {
  await requireAdminRole();
  return prisma.governanceReviewLead.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      assignedAdvisor: {
        select: {
          id: true,
          firmName: true,
          user: { select: { email: true, name: true } },
        },
      },
    },
  });
}

export async function getAdvisorProfilesForLeadAssignment() {
  await requireAdminRole();
  return prisma.advisorProfile.findMany({
    where: { user: { deletedAt: null } },
    select: {
      id: true,
      firmName: true,
      user: { select: { email: true, name: true } },
    },
    orderBy: { id: "asc" },
  });
}
