"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSuperAdminRole } from "@/lib/admin/auth";
import { createNotification } from "@/lib/data/advisor";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import { checkClientLimitForAdvisorProfile } from "@/lib/billing/subscription-service";
import { assertEnterpriseClientNotAlreadyInFirm } from "@/lib/enterprise/firm-client-invite";
import { DuplicateInvitationError } from "@/lib/invitations/service";
import { decryptUserEmail } from "@/lib/auth/user-email";

const assignClientSchema = z.object({
  clientId: z.string().cuid(),
  target: z.string().min(1),
});

async function resolveAdvisorProfileIdForTarget(
  target: string,
): Promise<{ advisorProfileId: string } | { error: string }> {
  if (target.startsWith("advisor:")) {
    const advisorProfileId = target.slice("advisor:".length);
    if (!z.string().cuid().safeParse(advisorProfileId).success) {
      return { error: "Invalid advisor target" };
    }
    return { advisorProfileId };
  }

  if (target.startsWith("enterprise:")) {
    const enterpriseId = target.slice("enterprise:".length);
    if (!z.string().cuid().safeParse(enterpriseId).success) {
      return { error: "Invalid enterprise target" };
    }

    const membership = await prisma.enterpriseMembership.findFirst({
      where: {
        enterpriseId,
        role: "OWNER",
        status: "ACTIVE",
        advisorProfileId: { not: null },
      },
      select: { advisorProfileId: true },
    });

    if (!membership?.advisorProfileId) {
      return { error: "Enterprise has no active owner with an advisor profile" };
    }

    return { advisorProfileId: membership.advisorProfileId };
  }

  return { error: "Invalid assignment target" };
}

export async function assignClientBySuperAdminAction(raw: unknown) {
  try {
    const {
      userId: actorUserId,
      email: actorEmail,
      role: actorRole,
    } = await requireSuperAdminRole();
    const parsed = assignClientSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false as const, error: "Invalid assignment payload" };
    }

    const resolved = await resolveAdvisorProfileIdForTarget(parsed.data.target);
    if ("error" in resolved) {
      return { success: false as const, error: resolved.error };
    }
    const { advisorProfileId } = resolved;

    const [client, advisor] = await Promise.all([
      prisma.user.findFirst({
        where: {
          id: parsed.data.clientId,
          role: "USER",
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          emailCiphertext: true,
        },
      }),
      prisma.advisorProfile.findFirst({
        where: {
          id: advisorProfileId,
          user: { deletedAt: null, role: "ADVISOR" },
        },
        select: {
          id: true,
          firmName: true,
          enterpriseId: true,
          user: { select: { name: true, emailCiphertext: true } },
        },
      }),
    ]);

    if (!client) {
      return { success: false as const, error: "Client not found" };
    }
    if (!advisor) {
      return { success: false as const, error: "Advisor not found" };
    }

    const clientEmail = decryptUserEmail(client.emailCiphertext);

    const activeAssignmentCount = await prisma.clientAdvisorAssignment.count({
      where: { clientId: client.id, status: "ACTIVE" },
    });
    if (activeAssignmentCount > 0) {
      return {
        success: false as const,
        error: "Client already has an active advisor assignment",
      };
    }

    try {
      await assertEnterpriseClientNotAlreadyInFirm(advisorProfileId, clientEmail);
    } catch (e) {
      if (e instanceof DuplicateInvitationError) {
        return { success: false as const, error: e.message };
      }
      throw e;
    }

    const limitCheck = await checkClientLimitForAdvisorProfile(advisorProfileId);
    if (!limitCheck.canAddClient) {
      return {
        success: false as const,
        error: `Advisor client limit reached (${limitCheck.currentCount}/${limitCheck.limit})`,
      };
    }

    const existingAssignment = await prisma.clientAdvisorAssignment.findUnique({
      where: {
        clientId_advisorId: {
          clientId: client.id,
          advisorId: advisorProfileId,
        },
      },
      select: { id: true, status: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.clientProfile.upsert({
        where: { userId: client.id },
        create: { userId: client.id },
        update: {},
      });

      if (existingAssignment) {
        await tx.clientAdvisorAssignment.update({
          where: { id: existingAssignment.id },
          data: { status: "ACTIVE", assignedAt: new Date() },
        });
      } else {
        await tx.clientAdvisorAssignment.create({
          data: {
            clientId: client.id,
            advisorId: advisorProfileId,
          },
        });
      }
    });

    const advisorEmail = decryptUserEmail(advisor.user.emailCiphertext);
    const advisorLabel = advisor.user.name?.trim() || advisorEmail;

    await writeAudit({
      actor: { userId: actorUserId, role: actorRole as UserRole, email: actorEmail },
      action: AUDIT_ACTIONS.CLIENT_ASSIGNMENT_ADMIN_ASSIGN,
      entityType: "User",
      entityId: client.id,
      beforeData: {
        activeAssignmentCount,
        assignmentId: existingAssignment?.id ?? null,
        assignmentStatus: existingAssignment?.status ?? null,
      },
      afterData: {
        advisorProfileId,
        advisorLabel,
        enterpriseId: advisor.enterpriseId,
        target: parsed.data.target,
      },
    });

    await createNotification(
      advisorProfileId,
      "SYSTEM",
      "Client assigned by platform admin",
      `${client.name?.trim() || clientEmail} was assigned to your portfolio.`,
      client.id,
    );

    revalidatePath("/admin/clients");
    return { success: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to assign client";
    return { success: false as const, error: message };
  }
}
