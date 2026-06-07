import "server-only";

import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import {
  issueMagicLinkToken,
  invalidatePriorMagicLinkTokens,
} from "@/lib/auth/magic-link";
import { decryptUserEmail } from "@/lib/auth/user-email";
import { sendIntakeApprovedMagicLinkEmail } from "@/lib/email";
import { getPublicAppUrlStrict } from "@/lib/public-app-url";
import { safeDecryptUserName } from "@/lib/data/client-pii";
import { logSafeError } from "@/lib/log-safe-error";

export type IntakeApprovedNotifyActor = {
  userId: string;
  role: UserRole;
  email: string | null;
};

/**
 * After intake approval, email the client a fresh magic link that signs them
 * in and redirects to /assessment. Invalidates prior unexpired tokens for the
 * client's email so the new link supersedes any older sign-in links.
 *
 * Failures are logged and swallowed — approval must not roll back if email
 * delivery fails.
 */
export async function notifyClientOfIntakeApproval(params: {
  interviewId: string;
  advisorProfileId: string;
  actor: IntakeApprovedNotifyActor;
}): Promise<{ sent: boolean }> {
  const { interviewId, advisorProfileId, actor } = params;

  try {
    const interview = await prisma.intakeInterview.findUnique({
      where: { id: interviewId },
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            name: true,
            emailCiphertext: true,
            role: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!interview?.user || interview.user.deletedAt) {
      return { sent: false };
    }
    if (interview.user.role !== "USER") {
      return { sent: false };
    }

    const assignment = await prisma.clientAdvisorAssignment.findFirst({
      where: {
        clientId: interview.userId,
        advisorId: advisorProfileId,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    if (!assignment) {
      return { sent: false };
    }

    const advisor = await prisma.advisorProfile.findUnique({
      where: { id: advisorProfileId },
      select: { firmName: true },
    });
    const advisorFirmName = advisor?.firmName?.trim() || "Your advisor";

    const baseUrl = getPublicAppUrlStrict();
    if (!baseUrl) {
      console.warn(
        "Intake-approved client email skipped: public app URL not configured (AUTH_URL / NEXT_PUBLIC_URL)."
      );
      return { sent: false };
    }

    const clientEmail = decryptUserEmail(interview.user.emailCiphertext);
    const clientName =
      safeDecryptUserName(interview.user.name, {
        rowId: interview.user.id,
      }) || "there";

    await invalidatePriorMagicLinkTokens(clientEmail);
    const issued = await issueMagicLinkToken(clientEmail);

    const verifyUrl = new URL("/auth/magic-link/verify", baseUrl);
    verifyUrl.searchParams.set("token", issued.rawToken);
    verifyUrl.searchParams.set("redirectTo", "/assessment");

    await sendIntakeApprovedMagicLinkEmail(
      clientEmail,
      clientName,
      advisorFirmName,
      verifyUrl.toString()
    );

    await writeAudit({
      actor,
      action: AUDIT_ACTIONS.INTAKE_APPROVED_CLIENT_MAGIC_LINK,
      entityType: "User",
      entityId: interview.user.id,
      metadata: {
        interviewId,
        clientId: interview.user.id,
        advisorId: advisorProfileId,
        email: clientEmail,
        tokenId: issued.tokenId,
      },
    });

    return { sent: true };
  } catch (error) {
    logSafeError("notifyClientOfIntakeApproval", error);
    return { sent: false };
  }
}
