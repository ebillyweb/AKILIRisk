import "server-only";

import {
  isAdvisorHubNavRole,
  isPlatformAdminRole,
} from "@/lib/auth-roles";
import {
  findPortfolioAssignmentForClient,
  resolvePortfolioScope,
} from "@/lib/enterprise/portfolio-access";

export type IntakeAudioStreamAccessRole =
  | "owner"
  | "portfolio_advisor"
  | "platform_admin";

/**
 * Who may stream bytes from `/api/intake/[id]/audio/[questionId]`.
 * Mirrors intake review visibility: client owner, portfolio-scoped advisors,
 * and platform staff admins.
 */
export async function resolveIntakeAudioStreamAccess(input: {
  sessionUserId: string;
  sessionRole: string | null | undefined;
  ownerUserId: string;
}): Promise<IntakeAudioStreamAccessRole | null> {
  const { sessionUserId, sessionRole, ownerUserId } = input;

  if (ownerUserId === sessionUserId) {
    return "owner";
  }

  if (isPlatformAdminRole(sessionRole)) {
    return "platform_admin";
  }

  if (!isAdvisorHubNavRole(sessionRole)) {
    return null;
  }

  const scope = await resolvePortfolioScope(sessionUserId);
  if (!scope) {
    return null;
  }

  const access = await findPortfolioAssignmentForClient(scope, ownerUserId);
  return access ? "portfolio_advisor" : null;
}
