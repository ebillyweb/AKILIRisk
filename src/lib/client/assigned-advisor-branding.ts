import "server-only";

import { prisma } from "@/lib/db";
import type { AdvisorBrandingData } from "@/lib/validation/branding";
import {
  ADVISOR_BRANDING_PROFILE_SELECT,
  mapAdvisorProfileToBrandingData,
} from "@/lib/client/advisor-branding-profile";

/**
 * Branding for the client's currently active advisor assignment (main app /dashboard, not subdomain "branded" routes).
 */
export async function getAssignedAdvisorBrandingForClient(
  clientUserId: string
): Promise<AdvisorBrandingData | null> {
  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: { clientId: clientUserId, status: "ACTIVE" },
    orderBy: { assignedAt: "desc" },
    select: {
      advisor: {
        select: ADVISOR_BRANDING_PROFILE_SELECT,
      },
    },
  });

  const advisor = assignment?.advisor;
  if (!advisor?.brandingEnabled) {
    return null;
  }

  return mapAdvisorProfileToBrandingData(advisor);
}
