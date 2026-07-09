import "server-only";

import { userEmailForDisplay } from "@/lib/auth/user-email";
import { prisma } from "@/lib/db";
import { escapeHtml } from "@/lib/escape-html";
import { buildEnterpriseProvisionCompleteEmailHtml } from "@/lib/enterprise/enterprise-provision-notifications";
import { sendNotification } from "@/lib/notifications/service";
import { getPublicAppUrlStrict } from "@/lib/public-app-url";

const paragraph = "margin:0 0 12px;line-height:1.6;color:#334155;";

type OwnerUser = { id: string; name: string | null; emailCiphertext: string };

/**
 * Notify the new owner (and the demoted previous owner) that a platform
 * administrator transferred a firm's ownership. Best-effort: failures are
 * logged and never block the transfer.
 */
export async function notifyEnterpriseOwnerChanged(options: {
  enterpriseId: string;
  previousOwnerUserId: string;
}): Promise<void> {
  const { enterpriseId, previousOwnerUserId } = options;

  const enterprise = await prisma.advisorEnterprise.findUnique({
    where: { id: enterpriseId },
    select: {
      id: true,
      name: true,
      memberships: {
        where: { role: "OWNER", status: "ACTIVE" },
        take: 1,
        select: {
          advisorProfileId: true,
          user: { select: { id: true, name: true, emailCiphertext: true } },
        },
      },
    },
  });

  const ownerMembership = enterprise?.memberships[0];
  if (!enterprise || !ownerMembership) return;

  const baseUrl = getPublicAppUrlStrict();
  const hubUrl = baseUrl ? `${baseUrl}/advisor` : null;
  const firmName = enterprise.name;

  const previousOwner = await prisma.user.findUnique({
    where: { id: previousOwnerUserId },
    select: { id: true, name: true, emailCiphertext: true },
  });

  const send = async (
    user: OwnerUser,
    advisorProfileId: string | null,
    title: string,
    bodyHtml: string,
    message: string
  ) => {
    try {
      await sendNotification({
        recipientUserId: user.id,
        recipientEmail: userEmailForDisplay(user),
        category: "system",
        title,
        message,
        referenceId: `enterprise-owner-changed:${enterpriseId}:${ownerMembership.user.id}`,
        advisorProfileId: advisorProfileId ?? undefined,
        emailSubject: "Akili Risk — firm ownership updated",
        emailHtml: hubUrl
          ? buildEnterpriseProvisionCompleteEmailHtml({
              headline: title,
              bodyHtml,
              ctaLabel: "Open Advisor Hub",
              ctaUrl: hubUrl,
            })
          : undefined,
      });
    } catch (error) {
      console.error("Enterprise owner-change notification failed:", error);
    }
  };

  const newOwnerName = ownerMembership.user.name?.trim() || "there";
  await send(
    ownerMembership.user,
    ownerMembership.advisorProfileId,
    "You are now the owner of your firm",
    `<p style="${paragraph}">
      Hi ${escapeHtml(newOwnerName)}, a platform administrator made you the owner
      of <strong style="color:#0f172a;">${escapeHtml(firmName)}</strong>. You now
      have full control over the firm's settings, billing, and team.
    </p>`,
    `You are now the owner of ${firmName}.`
  );

  if (previousOwner && previousOwner.id !== ownerMembership.user.id) {
    const prevName = previousOwner.name?.trim() || "there";
    await send(
      previousOwner,
      null,
      "Your firm's ownership was transferred",
      `<p style="${paragraph}">
        Hi ${escapeHtml(prevName)}, a platform administrator transferred ownership
        of <strong style="color:#0f172a;">${escapeHtml(firmName)}</strong> to
        another member of your team. Your account remains an administrator on the
        firm.
      </p>`,
      `Ownership of ${firmName} was transferred; you remain an administrator.`
    );
  }
}
