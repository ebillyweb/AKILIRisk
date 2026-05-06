import "server-only";

import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { createInvitationToken, INVITATION_TTL_SEC } from "@/lib/invite";
import {
  CreateInvitationInput,
  InvitationWithDetails,
  InvitationListFilters,
  InvitationStatus
} from "./types";

function generateInviteCode(): string {
  // Generate 6-character alphanumeric uppercase code
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  const bytes = randomBytes(6);

  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }

  return code;
}

export async function createAdvisorInvitation(
  advisorId: string,
  input: CreateInvitationInput
): Promise<InvitationWithDetails & { url: string }> {
  const code = generateInviteCode();
  const expiresAt = new Date(Date.now() + INVITATION_TTL_SEC * 1000);

  const invitation = await prisma.inviteCode.create({
    data: {
      code,
      prefillEmail: input.clientEmail,
      expiresAt,
      maxUses: 1,
      createdBy: advisorId,
      status: InvitationStatus.SENT,
      personalMessage: input.personalMessage,
      intakeWaived: input.intakeWaived ?? false,
      clientName: input.clientName,
    },
    include: {
      advisor: {
        select: {
          id: true,
          firmName: true,
          user: {
            select: {
              name: true,
              // Round-11 commit 2.4b: ciphertext, callers decrypt at usage.
              emailCiphertext: true,
            },
          },
        },
      },
    },
  });

  const token = createInvitationToken(invitation.id);
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const callback = invitation.intakeWaived ? "/assessment" : "/intake";
  const url = `${baseUrl}/signup?invite=${token}&callbackUrl=${encodeURIComponent(callback)}`;

  return {
    ...invitation,
    isExpired: invitation.expiresAt ? invitation.expiresAt < new Date() : false,
    canResend: invitation.resendCount < 3,
    url,
  };
}

export async function getAdvisorInvitations(
  advisorId: string,
  filters?: InvitationListFilters
): Promise<InvitationWithDetails[]> {
  const where: any = {
    createdBy: advisorId,
  };

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.search) {
    where.OR = [
      { prefillEmail: { contains: filters.search, mode: "insensitive" } },
      { clientName: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const invitations = await prisma.inviteCode.findMany({
    where,
    include: {
      advisor: {
        select: {
          id: true,
          firmName: true,
          user: {
            select: {
              name: true,
              // Round-11 commit 2.4b: ciphertext, callers decrypt at usage.
              emailCiphertext: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return invitations.map((invitation) => ({
    ...invitation,
    isExpired: invitation.expiresAt ? invitation.expiresAt < new Date() : false,
    canResend: invitation.resendCount < 3,
  }));
}

export async function resendInvitation(
  advisorId: string,
  invitationId: string
): Promise<InvitationWithDetails & { url: string }> {
  // Find invitation and verify ownership
  const invitation = await prisma.inviteCode.findUnique({
    where: { id: invitationId },
    include: {
      advisor: {
        select: {
          id: true,
          firmName: true,
          user: {
            select: {
              name: true,
              // Round-11 commit 2.4b: ciphertext, callers decrypt at usage.
              emailCiphertext: true,
            },
          },
        },
      },
    },
  });

  if (!invitation || invitation.createdBy !== advisorId) {
    throw new Error("Invitation not found or access denied");
  }

  if (invitation.resendCount >= 3) {
    throw new Error("Maximum resend limit reached");
  }

  // Update invitation with new expiry and reset status
  const expiresAt = new Date(Date.now() + INVITATION_TTL_SEC * 1000);

  const updatedInvitation = await prisma.inviteCode.update({
    where: { id: invitationId },
    data: {
      expiresAt,
      status: InvitationStatus.SENT,
      statusUpdatedAt: new Date(),
      resendCount: { increment: 1 },
    },
    include: {
      advisor: {
        select: {
          id: true,
          firmName: true,
          user: {
            select: {
              name: true,
              // Round-11 commit 2.4b: ciphertext, callers decrypt at usage.
              emailCiphertext: true,
            },
          },
        },
      },
    },
  });

  const token = createInvitationToken(updatedInvitation.id);
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const callback = updatedInvitation.intakeWaived ? "/assessment" : "/intake";
  const url = `${baseUrl}/signup?invite=${token}&callbackUrl=${encodeURIComponent(callback)}`;

  return {
    ...updatedInvitation,
    isExpired: false,
    canResend: updatedInvitation.resendCount < 3,
    url,
  };
}

export async function expireInvitation(
  advisorId: string,
  invitationId: string
): Promise<InvitationWithDetails> {
  // Find invitation and verify ownership
  const invitation = await prisma.inviteCode.findUnique({
    where: { id: invitationId },
    include: {
      advisor: {
        select: {
          id: true,
          firmName: true,
          user: {
            select: {
              name: true,
              // Round-11 commit 2.4b: ciphertext, callers decrypt at usage.
              emailCiphertext: true,
            },
          },
        },
      },
    },
  });

  if (!invitation || invitation.createdBy !== advisorId) {
    throw new Error("Invitation not found or access denied");
  }

  const updatedInvitation = await prisma.inviteCode.update({
    where: { id: invitationId },
    data: {
      status: InvitationStatus.EXPIRED,
      statusUpdatedAt: new Date(),
      expiresAt: new Date(), // Set to now
    },
    include: {
      advisor: {
        select: {
          id: true,
          firmName: true,
          user: {
            select: {
              name: true,
              // Round-11 commit 2.4b: ciphertext, callers decrypt at usage.
              emailCiphertext: true,
            },
          },
        },
      },
    },
  });

  return {
    ...updatedInvitation,
    isExpired: true,
    canResend: false,
  };
}