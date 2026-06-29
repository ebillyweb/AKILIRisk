import "server-only";

import type { SubscriptionTier } from "@prisma/client";

import { AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import { userEmailForDisplay } from "@/lib/auth/user-email";
import { TIER_DISPLAY_NAME } from "@/lib/billing/tier-catalog";
import { isModuleTier } from "@/lib/billing/plan-prices-ui";
import { prisma } from "@/lib/db";
import { escapeHtml } from "@/lib/escape-html";
import {
  renderPlatformEmailCta,
  renderPlatformEmailHeadline,
  renderPlatformEmailUrlFallback,
  wrapPlatformEmailContent,
} from "@/lib/email/platform-email-layout";
import { sendNotification } from "@/lib/notifications/service";
import { getPublicAppUrlStrict } from "@/lib/public-app-url";

export function enterpriseProvisionCompleteReferenceId(enterpriseId: string): string {
  return `enterprise-active:${enterpriseId}`;
}

type ProvisionCompleteEmailParams = {
  headline: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
};

export function buildEnterpriseProvisionCompleteEmailHtml(
  params: ProvisionCompleteEmailParams,
): string {
  return wrapPlatformEmailContent({
    documentTitle: params.headline,
    bodyHtml: `
      ${renderPlatformEmailHeadline(params.headline)}
      ${params.bodyHtml}
      ${renderPlatformEmailCta({ label: params.ctaLabel, href: params.ctaUrl })}
      ${renderPlatformEmailUrlFallback(params.ctaUrl)}`,
  });
}

async function resolveProvisioningAdminUserId(
  enterpriseId: string,
  actorUserId?: string | null,
): Promise<string | null> {
  if (actorUserId?.trim()) return actorUserId;

  const rows = await prisma.auditLog.findMany({
    where: {
      entityType: "AdvisorEnterprise",
      entityId: enterpriseId,
      action: AUDIT_ACTIONS.USER_UPDATE,
    },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: { actorUserId: true, afterData: true },
  });

  for (const row of rows) {
    const after = row.afterData as { provisionSubmitted?: boolean } | null;
    if (after?.provisionSubmitted === true && row.actorUserId) {
      return row.actorUserId;
    }
  }

  return null;
}

function moduleTierLabel(tier: SubscriptionTier | null | undefined): string | null {
  if (!tier || !isModuleTier(tier)) return null;
  return TIER_DISPLAY_NAME[tier];
}

/**
 * Notify the firm owner (advisor) and provisioning admin when async setup completes.
 * Failures are logged and do not fail the provision job.
 */
export async function notifyEnterpriseProvisionComplete(options: {
  enterpriseId: string;
  actorUserId?: string | null;
}): Promise<void> {
  const { enterpriseId, actorUserId } = options;
  const baseUrl = getPublicAppUrlStrict();
  if (!baseUrl) {
    console.warn(
      "notifyEnterpriseProvisionComplete: no public app URL; skipping notifications",
    );
    return;
  }

  const enterprise = await prisma.advisorEnterprise.findUnique({
    where: { id: enterpriseId },
    select: {
      id: true,
      name: true,
      slug: true,
      subscription: { select: { tier: true } },
      memberships: {
        where: { role: "OWNER", status: "ACTIVE" },
        take: 1,
        select: {
          advisorProfileId: true,
          user: {
            select: {
              id: true,
              name: true,
              emailCiphertext: true,
            },
          },
        },
      },
    },
  });

  if (!enterprise) return;

  const ownerMembership = enterprise.memberships[0];
  if (!ownerMembership?.advisorProfileId) return;

  const referenceId = enterpriseProvisionCompleteReferenceId(enterpriseId);
  const tierLabel = moduleTierLabel(enterprise.subscription?.tier);
  const tierPhrase = tierLabel ? ` (${tierLabel} module tier)` : "";
  const ownerName = ownerMembership.user.name?.trim() || "Advisor";
  const ownerEmail = userEmailForDisplay(ownerMembership.user);
  const ownerHubUrl = `${baseUrl}/advisor`;
  const adminDetailUrl = `${baseUrl}/admin/enterprises/${enterpriseId}`;

  const ownerBody = `<p style="margin:0 0 12px;line-height:1.6;color:#334155;">
    Hi ${escapeHtml(ownerName)}, your firm <strong style="color:#0f172a;">${escapeHtml(enterprise.name)}</strong>${escapeHtml(tierPhrase)} is ready.
    You can sign in to the Advisor Hub, manage firm billing, and invite team members.
  </p>`;

  try {
    await sendNotification({
      recipientUserId: ownerMembership.user.id,
      recipientEmail: ownerEmail,
      category: "system",
      title: `${enterprise.name} is ready`,
      message: `Your firm ${enterprise.name}${tierPhrase} finished provisioning. Open the Advisor Hub to get started.`,
      referenceId,
      advisorProfileId: ownerMembership.advisorProfileId,
      emailSubject: `Akili Risk — ${enterprise.name} is ready`,
      emailHtml: buildEnterpriseProvisionCompleteEmailHtml({
        headline: "Your firm is ready",
        bodyHtml: ownerBody,
        ctaLabel: "Open Advisor Hub",
        ctaUrl: ownerHubUrl,
      }),
    });
  } catch (error) {
    console.error("Enterprise owner provision notification failed:", error);
  }

  const adminUserId = await resolveProvisioningAdminUserId(enterpriseId, actorUserId);
  if (!adminUserId || adminUserId === ownerMembership.user.id) return;

  const adminUser = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: { id: true, name: true, emailCiphertext: true, role: true },
  });
  if (!adminUser) return;

  const adminName = adminUser.name?.trim() || "Admin";
  const adminEmail = userEmailForDisplay(adminUser);
  const adminBody = `<p style="margin:0 0 12px;line-height:1.6;color:#334155;">
    Enterprise firm <strong style="color:#0f172a;">${escapeHtml(enterprise.name)}</strong>
    (<span style="font-family:ui-monospace,monospace;">${escapeHtml(enterprise.slug)}</span>)${escapeHtml(tierPhrase)}
    finished background provisioning and is now <strong style="color:#0f172a;">Active</strong>.
    Owner: ${escapeHtml(ownerName)} (${escapeHtml(ownerEmail)}).
  </p>`;

  try {
    await sendNotification({
      recipientUserId: adminUser.id,
      recipientEmail: adminEmail,
      category: "system",
      title: `${enterprise.name} provisioning complete`,
      message: `${enterprise.name} (${enterprise.slug}) is now active. Owner: ${ownerName}.`,
      referenceId: `${referenceId}:admin`,
      emailSubject: `Akili Risk — ${enterprise.name} provisioning complete`,
      emailHtml: buildEnterpriseProvisionCompleteEmailHtml({
        headline: "Enterprise provisioning complete",
        bodyHtml: adminBody,
        ctaLabel: "View firm in Admin",
        ctaUrl: adminDetailUrl,
      }),
    });
  } catch (error) {
    console.error("Enterprise admin provision notification failed:", error);
  }
}
