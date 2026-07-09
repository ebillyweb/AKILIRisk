import "server-only";

import { userEmailForDisplay } from "@/lib/auth/user-email";
import { prisma } from "@/lib/db";
import { escapeHtml } from "@/lib/escape-html";
import { buildEnterpriseProvisionCompleteEmailHtml } from "@/lib/enterprise/enterprise-provision-notifications";
import { sendNotification } from "@/lib/notifications/service";
import { getPublicAppUrlStrict } from "@/lib/public-app-url";

const paragraph = "margin:0 0 12px;line-height:1.6;color:#334155;";
const mono = "font-family:ui-monospace,monospace;color:#0f172a;";

/**
 * Notify a firm's active OWNER/ADMIN members that a platform administrator
 * changed the firm's white-label subdomain (portal web address). Best-effort:
 * failures are logged and never block the change. No-ops when the firm has no
 * owner/admin members to notify.
 */
export async function notifyEnterpriseSubdomainChanged(options: {
  enterpriseId: string;
  previousSlug: string;
  newSlug: string;
}): Promise<void> {
  const { enterpriseId, previousSlug, newSlug } = options;

  const enterprise = await prisma.advisorEnterprise.findUnique({
    where: { id: enterpriseId },
    select: {
      id: true,
      name: true,
      memberships: {
        where: { role: { in: ["OWNER", "ADMIN"] }, status: "ACTIVE" },
        select: {
          advisorProfileId: true,
          user: { select: { id: true, name: true, emailCiphertext: true } },
        },
      },
    },
  });

  // "If needed" — nothing to do when there are no owner/admin members.
  if (!enterprise || enterprise.memberships.length === 0) return;

  const baseUrl = getPublicAppUrlStrict();
  const hubUrl = baseUrl ? `${baseUrl}/advisor` : null;

  const bodyHtml = (name: string) => `
    <p style="${paragraph}">
      Hi ${escapeHtml(name)}, a platform administrator updated the portal web
      address for <strong style="color:#0f172a;">${escapeHtml(enterprise.name)}</strong>.
    </p>
    <p style="${paragraph}">
      Previous address: <span style="${mono}">${escapeHtml(previousSlug)}</span><br />
      New address: <span style="${mono}">${escapeHtml(newSlug)}</span>
    </p>
    <p style="${paragraph}">
      Any invitations you already sent using the old address will no longer
      work — please resend them so your clients get the new link.
    </p>`;

  for (const member of enterprise.memberships) {
    const name = member.user.name?.trim() || "there";
    const email = userEmailForDisplay(member.user);

    try {
      await sendNotification({
        recipientUserId: member.user.id,
        recipientEmail: email,
        category: "system",
        title: "Your firm's portal address changed",
        message: `The portal address for ${enterprise.name} was updated to "${newSlug}". Please resend any invitations you sent using the old link.`,
        referenceId: `enterprise-subdomain-changed:${enterpriseId}:${newSlug}`,
        advisorProfileId: member.advisorProfileId ?? undefined,
        emailSubject: "Akili Risk — your firm's portal address changed",
        emailHtml: hubUrl
          ? buildEnterpriseProvisionCompleteEmailHtml({
              headline: "Your firm's portal address changed",
              bodyHtml: bodyHtml(name),
              ctaLabel: "Open Advisor Hub",
              ctaUrl: hubUrl,
            })
          : undefined,
      });
    } catch (error) {
      console.error("Enterprise subdomain-change notification failed:", error);
    }
  }
}
