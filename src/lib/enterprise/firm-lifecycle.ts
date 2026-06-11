import "server-only";

import type { UserRole } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getSubdomainActivationData } from "@/lib/advisor/platform-subdomain";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";

export class EnterpriseLifecycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnterpriseLifecycleError";
  }
}

async function cancelStripeSubscriptionBestEffort(
  stripeSubscriptionId: string | null | undefined
): Promise<void> {
  if (!stripeSubscriptionId?.trim()) return;
  try {
    const { getStripe } = await import("@/lib/stripe");
    await getStripe().subscriptions.cancel(stripeSubscriptionId);
  } catch (error) {
    console.error("Enterprise lifecycle: Stripe cancel failed", error);
  }
}

async function loadEnterpriseForLifecycle(enterpriseId: string) {
  const enterprise = await prisma.advisorEnterprise.findUnique({
    where: { id: enterpriseId },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      subscription: {
        select: {
          id: true,
          status: true,
          stripeSubscriptionId: true,
        },
      },
      memberships: {
        select: { userId: true },
      },
    },
  });
  if (!enterprise) {
    throw new EnterpriseLifecycleError("Enterprise firm not found.");
  }
  return enterprise;
}

function memberUserIds(enterprise: { memberships: { userId: string }[] }) {
  return enterprise.memberships.map((m) => m.userId);
}

export async function suspendEnterpriseFirmByAdmin(input: {
  enterpriseId: string;
  actor: { userId: string; email?: string | null; role?: UserRole | string | null };
}): Promise<void> {
  const enterprise = await loadEnterpriseForLifecycle(input.enterpriseId);

  if (enterprise.status === "SUSPENDED") {
    throw new EnterpriseLifecycleError("This firm is already suspended.");
  }

  const userIds = memberUserIds(enterprise);

  await prisma.$transaction(async (tx) => {
    await tx.advisorEnterprise.update({
      where: { id: enterprise.id },
      data: { status: "SUSPENDED" },
    });

    if (enterprise.subscription) {
      await tx.subscription.update({
        where: { id: enterprise.subscription.id },
        data: {
          status: "CANCELLED",
          cancelAtPeriodEnd: false,
        },
      });
      await tx.subscriptionAuditLog.create({
        data: {
          subscriptionId: enterprise.subscription.id,
          action: "admin_enterprise_suspend",
          metadata: { enterpriseId: enterprise.id },
        },
      });
    }

    await tx.advisorSubdomain.updateMany({
      where: { enterpriseId: enterprise.id },
      data: { isActive: false },
    });

    if (userIds.length > 0) {
      await tx.session.deleteMany({ where: { userId: { in: userIds } } });
    }
  });

  await cancelStripeSubscriptionBestEffort(
    enterprise.subscription?.stripeSubscriptionId
  );

  await writeAudit({
    actor: {
      userId: input.actor.userId,
      role: input.actor.role as UserRole | undefined,
      email: input.actor.email,
    },
    action: AUDIT_ACTIONS.ENTERPRISE_SUSPEND,
    entityType: "AdvisorEnterprise",
    entityId: enterprise.id,
    beforeData: { status: "ACTIVE" },
    afterData: { status: "SUSPENDED" },
    metadata: { slug: enterprise.slug, memberCount: userIds.length },
  });
}

export async function reactivateEnterpriseFirmByAdmin(input: {
  enterpriseId: string;
  actor: { userId: string; email?: string | null; role?: UserRole | string | null };
}): Promise<void> {
  const enterprise = await loadEnterpriseForLifecycle(input.enterpriseId);

  if (enterprise.status === "ACTIVE") {
    throw new EnterpriseLifecycleError("This firm is already active.");
  }

  const periodEnd = new Date();
  periodEnd.setUTCFullYear(periodEnd.getUTCFullYear() + 1);
  const activation = getSubdomainActivationData();

  await prisma.$transaction(async (tx) => {
    await tx.advisorEnterprise.update({
      where: { id: enterprise.id },
      data: { status: "ACTIVE" },
    });

    if (enterprise.subscription) {
      await tx.subscription.update({
        where: { id: enterprise.subscription.id },
        data: {
          status: "ACTIVE",
          cancelAtPeriodEnd: false,
          currentPeriodEnd: periodEnd,
        },
      });
      await tx.subscriptionAuditLog.create({
        data: {
          subscriptionId: enterprise.subscription.id,
          action: "admin_enterprise_reactivate",
          metadata: {
            enterpriseId: enterprise.id,
            currentPeriodEnd: periodEnd.toISOString(),
          },
        },
      });
    }

    await tx.advisorSubdomain.updateMany({
      where: { enterpriseId: enterprise.id },
      data: {
        isActive: activation.isActive,
        dnsVerified: activation.dnsVerified,
        sslProvisioned: activation.sslProvisioned,
        verifiedAt: activation.verifiedAt,
      },
    });
  });

  await writeAudit({
    actor: {
      userId: input.actor.userId,
      role: input.actor.role as UserRole | undefined,
      email: input.actor.email,
    },
    action: AUDIT_ACTIONS.ENTERPRISE_REACTIVATE,
    entityType: "AdvisorEnterprise",
    entityId: enterprise.id,
    beforeData: { status: "SUSPENDED" },
    afterData: { status: "ACTIVE" },
    metadata: { slug: enterprise.slug },
  });
}

export async function deleteEnterpriseFirmByAdmin(input: {
  enterpriseId: string;
  confirmSlug: string;
  actor: { userId: string; email?: string | null; role?: UserRole | string | null };
}): Promise<void> {
  const enterprise = await loadEnterpriseForLifecycle(input.enterpriseId);

  if (input.confirmSlug.trim() !== enterprise.slug) {
    throw new EnterpriseLifecycleError(
      "Confirmation slug does not match. Type the firm slug exactly to delete."
    );
  }

  const userIds = memberUserIds(enterprise);
  const stripeSubscriptionId = enterprise.subscription?.stripeSubscriptionId ?? null;

  await prisma.$transaction(async (tx) => {
    if (userIds.length > 0) {
      await tx.session.deleteMany({ where: { userId: { in: userIds } } });
    }

    await tx.advisorEnterprise.delete({ where: { id: enterprise.id } });
  });

  await cancelStripeSubscriptionBestEffort(stripeSubscriptionId);

  await writeAudit({
    actor: {
      userId: input.actor.userId,
      role: input.actor.role as UserRole | undefined,
      email: input.actor.email,
    },
    action: AUDIT_ACTIONS.ENTERPRISE_DELETE,
    entityType: "AdvisorEnterprise",
    entityId: enterprise.id,
    beforeData: {
      name: enterprise.name,
      slug: enterprise.slug,
      status: enterprise.status,
    },
    metadata: { memberCount: userIds.length },
  });
}
