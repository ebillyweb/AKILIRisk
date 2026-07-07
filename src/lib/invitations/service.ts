import "server-only";

import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { normalizeWaiverScopeInput } from "@/lib/client/assessment-scope";
import { decryptUserEmail, findUserByEmail } from "@/lib/auth/user-email";
import { resolveClientReferenceCode } from "@/lib/client/client-reference-code.server";
import { createInvitationToken, INVITATION_TTL_SEC } from "@/lib/invite";
import {
  buildInvitationSignupUrl,
  resolveInvitationLinkContextForSend,
} from "@/lib/invitations/invitation-link";
import type { SubscriptionFeatures } from "@/lib/validation/branding";
import {
  CreateInvitationInput,
  InvitationWithDetails,
  InvitationListFilters,
  InvitationListResult,
  InvitationStatus
} from "./types";
import { reconcileAdvisorInvitationStatuses } from "./redeem-invitation";
import { assertEnterpriseClientNotAlreadyInFirm } from "@/lib/enterprise/firm-client-invite";

export function invitationCanResend(invitation: {
  status: InvitationStatus;
  resendCount: number;
}): boolean {
  if (invitation.resendCount >= 3) return false;
  if (invitation.status === InvitationStatus.EXPIRED) return false;
  if (invitation.status === InvitationStatus.REGISTERED) return false;
  return (
    invitation.status === InvitationStatus.SENT ||
    invitation.status === InvitationStatus.OPENED
  );
}

export class DuplicateInvitationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateInvitationError";
  }
}

export const PENDING_INVITATION_RESEND_MESSAGE =
  "An invitation to this email is already pending. Use Resend in the invitation list below to send it again and extend the expiry.";

export const REGISTERED_INVITATION_MESSAGE =
  "This client has already registered using a previous invitation.";

export const PENDING_INVITATION_RESEND_LIMIT_MESSAGE =
  "An invitation to this email is already pending and has reached the resend limit. Expire it in the invitation list below, then send a new invitation.";

const BLOCKING_INVITATION_STATUSES: InvitationStatus[] = [
  InvitationStatus.SENT,
  InvitationStatus.OPENED,
  InvitationStatus.REGISTERED,
];

type InviteCodeDb = Pick<typeof prisma, "inviteCode">;

/**
 * Prevents duplicate pending invites for the same advisor + client email.
 * EXPIRED rows are ignored so advisors can issue a fresh invitation.
 *
 * Uses case-insensitive `prefillEmail` matching so legacy rows created before
 * email normalization (commit 6cba4cd) still block duplicate sends.
 */
export async function assertNoBlockingInvitationForEmail(
  advisorId: string,
  clientEmail: string,
  db: InviteCodeDb = prisma
): Promise<void> {
  const normalizedEmail = clientEmail.trim().toLowerCase();
  if (!normalizedEmail) return;

  const existing = await db.inviteCode.findFirst({
    where: {
      createdBy: advisorId,
      prefillEmail: { equals: normalizedEmail, mode: "insensitive" },
      status: { in: BLOCKING_INVITATION_STATUSES },
    },
    select: { status: true, resendCount: true },
    orderBy: { createdAt: "desc" },
  });

  if (!existing) return;

  console.info("[invitations] blocked duplicate send", {
    advisorId,
    clientEmail: normalizedEmail,
    status: existing.status,
    resendCount: existing.resendCount,
  });

  if (existing.status === InvitationStatus.REGISTERED) {
    throw new DuplicateInvitationError(REGISTERED_INVITATION_MESSAGE);
  }

  if (existing.resendCount >= 3) {
    throw new DuplicateInvitationError(PENDING_INVITATION_RESEND_LIMIT_MESSAGE);
  }

  throw new DuplicateInvitationError(PENDING_INVITATION_RESEND_MESSAGE);
}

function withDecryptedAdvisorEmail<T extends {
  advisor: {
    id: string;
    firmName: string | null;
    user: { name: string | null; emailCiphertext: string };
  } | null;
}>(invitation: T): Omit<T, "advisor"> & { advisor: InvitationWithDetails["advisor"] } {
  return {
    ...invitation,
    advisor: invitation.advisor
      ? {
          ...invitation.advisor,
          user: {
            name: invitation.advisor.user.name,
            email: decryptUserEmail(invitation.advisor.user.emailCiphertext),
          },
        }
      : null,
  };
}

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

async function invitationSignupUrl(
  advisorId: string,
  inviteCodeId: string,
  intakeWaived: boolean,
  features: Pick<SubscriptionFeatures, "customSubdomainEnabled">
): Promise<string> {
  const linkContext = await resolveInvitationLinkContextForSend(advisorId, features);
  const token = createInvitationToken(inviteCodeId);
  const callback = intakeWaived ? "/assessment" : "/intake";
  return buildInvitationSignupUrl(linkContext.origin, token, callback);
}

export async function createAdvisorInvitation(
  advisorId: string,
  input: CreateInvitationInput,
  options?: { subscriptionFeatures?: Pick<SubscriptionFeatures, "customSubdomainEnabled"> }
): Promise<InvitationWithDetails & { url: string }> {
  const normalizedEmail = input.clientEmail.trim().toLowerCase();

  await assertEnterpriseClientNotAlreadyInFirm(advisorId, normalizedEmail);

  const invitation = await prisma.$transaction(async (tx) => {
    await assertNoBlockingInvitationForEmail(advisorId, normalizedEmail, tx);
    await assertEnterpriseClientNotAlreadyInFirm(advisorId, normalizedEmail, tx);

    const code = generateInviteCode();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_SEC * 1000);

    const waiverScope =
      input.intakeWaived && input.includedPillars?.length
        ? await normalizeWaiverScopeInput({
            includedPillars: input.includedPillars,
            focusAreas: input.focusAreas,
          })
        : null;

    return tx.inviteCode.create({
      data: {
        code,
        prefillEmail: normalizedEmail,
        expiresAt,
        maxUses: 1,
        createdBy: advisorId,
        status: InvitationStatus.SENT,
        personalMessage: input.personalMessage,
        intakeWaived: input.intakeWaived ?? false,
        includedPillars: waiverScope?.includedPillars ?? [],
        focusAreas: waiverScope?.focusAreas ?? [],
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
  });

  console.info("[invitations] created invite row", {
    advisorId,
    inviteCodeId: invitation.id,
    clientEmail: normalizedEmail,
  });

  const features = options?.subscriptionFeatures ?? { customSubdomainEnabled: false };
  const url = await invitationSignupUrl(
    advisorId,
    invitation.id,
    invitation.intakeWaived ?? false,
    features
  );

  return {
    ...withDecryptedAdvisorEmail(invitation),
    isExpired: invitation.expiresAt ? invitation.expiresAt < new Date() : false,
    canResend: invitationCanResend(invitation),
    url,
  };
}

export async function getAdvisorInvitations(
  advisorId: string,
  filters?: InvitationListFilters,
  pagination?: { page: number; pageSize: number },
  options?: { pseudonymousWorkspaceLabeling?: boolean },
): Promise<InvitationListResult> {
  await reconcileAdvisorInvitationStatuses(advisorId);
  const pseudonymousWorkspaceLabeling = options?.pseudonymousWorkspaceLabeling === true;

  const where: {
    createdBy: string;
    status?: InvitationStatus;
    createdAt?: { gte: Date };
    OR?: Array<{
      prefillEmail?: { contains: string; mode: "insensitive" } | { equals: string; mode: "insensitive" };
      clientName?: { contains: string; mode: "insensitive" };
    }>;
  } = {
    createdBy: advisorId,
  };

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.sentWithinDays) {
    const since = new Date();
    since.setDate(since.getDate() - filters.sentWithinDays);
    where.createdAt = { gte: since };
  }

  if (filters?.search) {
    const query = filters.search.trim();
    if (pseudonymousWorkspaceLabeling) {
      const matchingUsers = await prisma.user.findMany({
        where: {
          clientReferenceCode: { contains: query, mode: "insensitive" },
          clientAssignments: {
            some: { advisorId, status: { in: ["ACTIVE", "INACTIVE"] } },
          },
        },
        select: { emailCiphertext: true },
      });
      const matchingEmails = matchingUsers.map((user) =>
        decryptUserEmail(user.emailCiphertext).trim().toLowerCase(),
      );
      where.OR =
        matchingEmails.length > 0
          ? matchingEmails.map((email) => ({
              prefillEmail: { equals: email, mode: "insensitive" as const },
            }))
          : [{ prefillEmail: { equals: "__no_match__", mode: "insensitive" as const } }];
    } else {
      where.OR = [
        { prefillEmail: { contains: query, mode: "insensitive" } },
        { clientName: { contains: query, mode: "insensitive" } },
      ];
    }
  }

  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? Number.MAX_SAFE_INTEGER;
  const skip = pagination ? (page - 1) * pageSize : undefined;
  const take = pagination?.pageSize;

  const [totalCount, invitations] = await prisma.$transaction([
    prisma.inviteCode.count({ where }),
    prisma.inviteCode.findMany({
      where,
      include: {
        advisor: {
          select: {
            id: true,
            firmName: true,
            user: {
              select: {
                name: true,
                emailCiphertext: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
  ]);

  return {
    items: await attachClientReferenceCodes(
      invitations.map((invitation) => ({
        ...withDecryptedAdvisorEmail(invitation),
        isExpired: invitation.expiresAt ? invitation.expiresAt < new Date() : false,
        canResend: invitationCanResend(invitation),
      })),
    ),
    totalCount,
    page,
    pageSize: pagination?.pageSize ?? totalCount,
  };
}

type RegisteredClientLookup = {
  clientReferenceCode: string | null;
  registeredClientId: string | null;
};

async function attachClientReferenceCodes<
  T extends { prefillEmail: string | null },
>(
  invitations: T[],
): Promise<Array<T & RegisteredClientLookup>> {
  const uniqueEmails = [
    ...new Set(
      invitations
        .map((invitation) => invitation.prefillEmail?.trim().toLowerCase())
        .filter((email): email is string => Boolean(email)),
    ),
  ];

  const clientByEmail = new Map<string, RegisteredClientLookup>();
  await Promise.all(
    uniqueEmails.map(async (email) => {
      const user = await findUserByEmail(email, {
        select: { id: true, clientReferenceCode: true },
      });
      if (!user) {
        clientByEmail.set(email, {
          clientReferenceCode: null,
          registeredClientId: null,
        });
        return;
      }
      const code = await resolveClientReferenceCode(user.id, user.clientReferenceCode);
      clientByEmail.set(email, {
        clientReferenceCode: code,
        registeredClientId: user.id,
      });
    }),
  );

  return invitations.map((invitation) => {
    const email = invitation.prefillEmail?.trim().toLowerCase();
    const client = email ? clientByEmail.get(email) : undefined;
    return {
      ...invitation,
      clientReferenceCode: client?.clientReferenceCode ?? null,
      registeredClientId: client?.registeredClientId ?? null,
    };
  });
}

export async function resendInvitation(
  advisorId: string,
  invitationId: string,
  options?: { subscriptionFeatures?: Pick<SubscriptionFeatures, "customSubdomainEnabled"> }
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

  if (invitation.status === InvitationStatus.EXPIRED) {
    throw new Error("This invitation has expired and cannot be resent.");
  }

  if (invitation.status === InvitationStatus.REGISTERED) {
    throw new Error("This client has already registered using this invitation.");
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

  const features = options?.subscriptionFeatures ?? { customSubdomainEnabled: false };
  const url = await invitationSignupUrl(
    advisorId,
    updatedInvitation.id,
    updatedInvitation.intakeWaived ?? false,
    features
  );

  return {
    ...withDecryptedAdvisorEmail(updatedInvitation),
    isExpired: false,
    canResend: invitationCanResend(updatedInvitation),
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
    ...withDecryptedAdvisorEmail(updatedInvitation),
    isExpired: true,
    canResend: false,
  };
}