import "server-only";

import type { EnterpriseRole } from "@prisma/client";

import { prisma } from "@/lib/db";

import { resolveBillingContext } from "./billing-context";

export type PortfolioScope =
  | {
      mode: "assigned";
      advisorProfileId: string;
      enterpriseId: string | null;
      role: EnterpriseRole | null;
    }
  | {
      mode: "firm";
      enterpriseId: string;
      advisorProfileId: string;
      role: EnterpriseRole;
    };

const ASSIGNMENT_STATUSES_ACTIVE = ["ACTIVE"] as const;
const ASSIGNMENT_STATUSES_DETAIL = ["ACTIVE", "INACTIVE"] as const;

/**
 * Resolve whether the advisor sees only their book or the full firm portfolio.
 */
export async function resolvePortfolioScope(
  userId: string
): Promise<PortfolioScope | null> {
  const ctx = await resolveBillingContext(userId);
  if (!ctx) return null;

  if (ctx.kind === "enterprise" && (ctx.role === "OWNER" || ctx.role === "ADMIN")) {
    return {
      mode: "firm",
      enterpriseId: ctx.enterpriseId,
      advisorProfileId: ctx.advisorProfileId,
      role: ctx.role,
    };
  }

  return {
    mode: "assigned",
    advisorProfileId: ctx.advisorProfileId,
    enterpriseId: ctx.kind === "enterprise" ? ctx.enterpriseId : null,
    role: ctx.kind === "enterprise" ? ctx.role : null,
  };
}

export async function listAdvisorProfileIdsForScope(
  scope: PortfolioScope
): Promise<string[]> {
  if (scope.mode === "assigned") {
    return [scope.advisorProfileId];
  }
  const profiles = await prisma.advisorProfile.findMany({
    where: { enterpriseId: scope.enterpriseId },
    select: { id: true },
  });
  return profiles.map((p) => p.id);
}

/**
 * Advisor **User** ids in scope — the identity that authors advisory notes
 * (`*AdvisorNote.advisorId`). For firm scope this is every advisor in the
 * enterprise, so note reads can be limited to the firm rather than leaking
 * notes authored by advisors outside it.
 */
export async function listAdvisorUserIdsForScope(
  scope: PortfolioScope
): Promise<string[]> {
  if (scope.mode === "assigned") {
    const profile = await prisma.advisorProfile.findUnique({
      where: { id: scope.advisorProfileId },
      select: { userId: true },
    });
    return profile?.userId ? [profile.userId] : [];
  }
  const profiles = await prisma.advisorProfile.findMany({
    where: { enterpriseId: scope.enterpriseId },
    select: { userId: true },
  });
  return profiles
    .map((p) => p.userId)
    .filter((id): id is string => Boolean(id));
}

/**
 * Returns the assignment's advisor profile id when the caller may access the client.
 */
export async function findPortfolioAssignmentForClient(
  scope: PortfolioScope,
  clientId: string,
  options?: { includeInactive?: boolean }
): Promise<{ assignmentAdvisorProfileId: string } | null> {
  const statuses = options?.includeInactive
    ? [...ASSIGNMENT_STATUSES_DETAIL]
    : [...ASSIGNMENT_STATUSES_ACTIVE];

  if (scope.mode === "assigned") {
    const assignment = await prisma.clientAdvisorAssignment.findFirst({
      where: {
        advisorId: scope.advisorProfileId,
        clientId,
        status: { in: statuses },
      },
      select: { advisorId: true },
    });
    return assignment
      ? { assignmentAdvisorProfileId: assignment.advisorId }
      : null;
  }

  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: {
      clientId,
      status: { in: statuses },
      advisor: { enterpriseId: scope.enterpriseId },
    },
    select: { advisorId: true },
  });
  return assignment ? { assignmentAdvisorProfileId: assignment.advisorId } : null;
}

export async function assertPortfolioClientAccess(
  scope: PortfolioScope,
  clientId: string,
  options?: { includeInactive?: boolean }
): Promise<{ assignmentAdvisorProfileId: string }> {
  const access = await findPortfolioAssignmentForClient(scope, clientId, options);
  if (!access) {
    throw new Error("Client not found or not assigned to you");
  }
  return access;
}
