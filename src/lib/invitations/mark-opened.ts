import "server-only";

import { InvitationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Advances SENT → OPENED when a client opens an invitation link.
 * Does not downgrade REGISTERED or other terminal states.
 */
export async function markInvitationOpened(invitationId: string): Promise<void> {
  await prisma.inviteCode.updateMany({
    where: {
      id: invitationId,
      status: InvitationStatus.SENT,
    },
    data: {
      status: InvitationStatus.OPENED,
      statusUpdatedAt: new Date(),
    },
  });
}
