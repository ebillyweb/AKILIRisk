import "server-only";

import { prisma } from "@/lib/db";
import type { AdvisorBrandingData } from "@/lib/validation/branding";
import {
  resolveAdvisorBrandingForProfile,
} from "@/lib/enterprise/branding";

/**
 * Branding for the client's currently active advisor assignment (main app /dashboard, not subdomain "branded" routes).
 */
export async function getAssignedAdvisorBrandingForClient(
  clientUserId: string
): Promise<AdvisorBrandingData | null> {
  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: { clientId: clientUserId, status: "ACTIVE" },
    orderBy: { assignedAt: "desc" },
    select: { advisorId: true },
  });

  if (!assignment) return null;

  return resolveAdvisorBrandingForProfile(assignment.advisorId);
}
