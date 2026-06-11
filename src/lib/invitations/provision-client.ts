import "server-only";

import { InvitationStatus, type UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { findUserByEmail, userEmailWriteData } from "@/lib/auth/user-email";

type TxLike = Pick<
  typeof prisma,
  "advisorProfile" | "clientAdvisorAssignment" | "clientProfile" | "inviteCode" | "user"
>;

function waiverAssignmentData(invite: {
  intakeWaived: boolean;
  createdBy: string | null;
}) {
  if (!invite.intakeWaived || !invite.createdBy) return {};
  return {
    intakeWaivedAt: new Date(),
    intakeWaivedByAdvisorId: invite.createdBy,
  };
}

async function findActiveEnterpriseAssignmentForClient(
  tx: TxLike,
  clientId: string,
  invitingAdvisorId: string,
) {
  const profile = await tx.advisorProfile.findUnique({
    where: { id: invitingAdvisorId },
    select: { enterpriseId: true },
  });
  if (!profile?.enterpriseId) return null;

  return tx.clientAdvisorAssignment.findFirst({
    where: {
      clientId,
      status: "ACTIVE",
      advisor: { enterpriseId: profile.enterpriseId },
    },
    select: { id: true, advisorId: true },
  });
}

export type ProvisionClientResult =
  | { ok: true; userId: string; created: boolean }
  | { ok: false; error: string; code: "not_found" | "expired" | "exhausted" | "blocked" };

/**
 * Ensure a client User exists for an advisor InviteCode and is linked to the
 * inviting advisor. Idempotent for repeat visits by the same email.
 */
export async function provisionClientFromInviteCode(
  inviteCodeId: string,
  email: string,
): Promise<ProvisionClientResult> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return { ok: false, error: "Invitation is missing a client email.", code: "not_found" };
  }

  const invite = await prisma.inviteCode.findUnique({
    where: { id: inviteCodeId },
    select: {
      id: true,
      prefillEmail: true,
      expiresAt: true,
      maxUses: true,
      usedCount: true,
      createdBy: true,
      clientName: true,
      status: true,
      intakeWaived: true,
    },
  });

  if (!invite) {
    return { ok: false, error: "This invitation is no longer valid.", code: "not_found" };
  }

  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return { ok: false, error: "This invitation has expired.", code: "expired" };
  }

  const inviteEmail = invite.prefillEmail?.trim().toLowerCase() ?? "";
  if (inviteEmail && inviteEmail !== normalizedEmail) {
    return { ok: false, error: "This invitation is no longer valid.", code: "not_found" };
  }

  const existing = await findUserByEmail(normalizedEmail, {
    where: { deletedAt: null },
    select: { id: true, role: true },
  });

  if (existing && existing.role !== "USER") {
    return {
      ok: false,
      error: "This email is associated with a non-client account.",
      code: "blocked",
    };
  }

  const atUseLimit =
    invite.maxUses != null && invite.usedCount >= invite.maxUses;

  if (!existing && atUseLimit) {
    return {
      ok: false,
      error: "This invitation has already been used.",
      code: "exhausted",
    };
  }

  if (existing) {
    if (invite.createdBy) {
      await prisma.$transaction(async (tx) => {
        await tx.clientProfile.upsert({
          where: { userId: existing.id },
          create: { userId: existing.id },
          update: {},
        });

        const enterpriseAssignment = invite.createdBy
          ? await findActiveEnterpriseAssignmentForClient(
              tx,
              existing.id,
              invite.createdBy,
            )
          : null;

        if (!enterpriseAssignment) {
          const assignment = await tx.clientAdvisorAssignment.findFirst({
            where: { clientId: existing.id, advisorId: invite.createdBy! },
            select: { id: true, intakeWaivedAt: true },
          });
          if (!assignment) {
            await tx.clientAdvisorAssignment.create({
              data: {
                clientId: existing.id,
                advisorId: invite.createdBy!,
                ...waiverAssignmentData(invite),
              },
            });
          } else if (invite.intakeWaived && !assignment.intakeWaivedAt) {
            await tx.clientAdvisorAssignment.update({
              where: { id: assignment.id },
              data: waiverAssignmentData(invite),
            });
          }
        }

        if (invite.status !== InvitationStatus.REGISTERED) {
          await tx.inviteCode.update({
            where: { id: inviteCodeId },
            data: {
              status: InvitationStatus.REGISTERED,
              statusUpdatedAt: new Date(),
            },
          });
        }
      });
    }

    return { ok: true, userId: existing.id, created: false };
  }

  const userName = invite.clientName?.trim() || undefined;

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        ...userEmailWriteData(normalizedEmail),
        role: "USER" as UserRole,
        password: null,
        name: userName,
        emailVerified: new Date(),
      },
      select: { id: true },
    });

    if (invite.createdBy) {
      await tx.clientProfile.create({
        data: { userId: created.id },
      });

      const enterpriseAssignment = await findActiveEnterpriseAssignmentForClient(
        tx,
        created.id,
        invite.createdBy,
      );
      if (!enterpriseAssignment) {
        await tx.clientAdvisorAssignment.create({
          data: {
            clientId: created.id,
            advisorId: invite.createdBy,
            ...waiverAssignmentData(invite),
          },
        });
      }

      await tx.inviteCode.update({
        where: { id: inviteCodeId },
        data: {
          status: InvitationStatus.REGISTERED,
          statusUpdatedAt: new Date(),
          usedCount: { increment: 1 },
        },
      });
    } else {
      await tx.inviteCode.update({
        where: { id: inviteCodeId },
        data: { usedCount: { increment: 1 } },
      });
    }

    return created;
  });

  return { ok: true, userId: user.id, created: true };
}
