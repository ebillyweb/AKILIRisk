import "server-only";

import { findUserByEmail } from "@/lib/auth/user-email";
import { prisma } from "@/lib/db";

import { DuplicateInvitationError } from "@/lib/invitations/service";

type DbLike = Pick<typeof prisma, "advisorProfile" | "clientAdvisorAssignment">;

export const ENTERPRISE_CLIENT_ALREADY_IN_FIRM_MESSAGE =
  "This client is already in your firm's portfolio.";

/**
 * Blocks a second ACTIVE assignment for the same client within one enterprise.
 */
export async function assertEnterpriseClientNotAlreadyInFirm(
  advisorProfileId: string,
  clientEmail: string,
  db: DbLike = prisma
): Promise<void> {
  const profile = await db.advisorProfile.findUnique({
    where: { id: advisorProfileId },
    select: { enterpriseId: true },
  });
  if (!profile?.enterpriseId) return;

  const user = await findUserByEmail(clientEmail.trim().toLowerCase(), {
    select: { id: true },
  });
  if (!user) return;

  const existing = await db.clientAdvisorAssignment.findFirst({
    where: {
      clientId: user.id,
      status: "ACTIVE",
      advisor: { enterpriseId: profile.enterpriseId },
    },
    select: { id: true },
  });

  if (existing) {
    throw new DuplicateInvitationError(ENTERPRISE_CLIENT_ALREADY_IN_FIRM_MESSAGE);
  }
}
