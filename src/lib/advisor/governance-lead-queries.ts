import "server-only";

import type { GovernanceReviewLead } from "@prisma/client";
import { getAdvisorProfileOrThrow, requireAdvisorRole } from "@/lib/advisor/auth";
import { prisma } from "@/lib/db";

const advisorLeadSelect = {
  id: true,
  name: true,
  email: true,
  familyComplexity: true,
  investableAssetsRange: true,
  promptedInterest: true,
  assignedAt: true,
  createdAt: true,
} as const;

export type AdvisorGovernanceLead = Pick<
  GovernanceReviewLead,
  keyof typeof advisorLeadSelect
>;

export async function getAssignedGovernanceLeadsForAdvisor(): Promise<
  AdvisorGovernanceLead[]
> {
  const { userId } = await requireAdvisorRole();
  const profile = await getAdvisorProfileOrThrow(userId);

  return prisma.governanceReviewLead.findMany({
    where: { assignedAdvisorId: profile.id },
    orderBy: [{ assignedAt: "desc" }, { createdAt: "desc" }],
    select: advisorLeadSelect,
  });
}

export async function getAssignedGovernanceLeadForAdvisor(
  leadId: string
): Promise<AdvisorGovernanceLead | null> {
  const trimmedId = leadId.trim();
  if (!trimmedId) return null;

  const { userId } = await requireAdvisorRole();
  const profile = await getAdvisorProfileOrThrow(userId);

  return prisma.governanceReviewLead.findFirst({
    where: { id: trimmedId, assignedAdvisorId: profile.id },
    select: advisorLeadSelect,
  });
}

export async function markLeadNotificationsReadForAdvisor(leadId: string): Promise<void> {
  const trimmedId = leadId.trim();
  if (!trimmedId) return;

  const { userId } = await requireAdvisorRole();
  const profile = await getAdvisorProfileOrThrow(userId);

  await prisma.advisorNotification.updateMany({
    where: {
      advisorId: profile.id,
      type: "NEW_LEAD",
      referenceId: trimmedId,
      read: false,
    },
    data: { read: true },
  });
}

export async function countUnreadLeadNotificationsForAdvisor(): Promise<number> {
  const { userId } = await requireAdvisorRole();
  const profile = await getAdvisorProfileOrThrow(userId);

  return prisma.advisorNotification.count({
    where: {
      advisorId: profile.id,
      type: "NEW_LEAD",
      read: false,
    },
  });
}
