import "server-only";

import { revalidatePath } from "next/cache";
import type { UserRole } from "@prisma/client";

import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import { cancelStripeSubscriptionBestEffort } from "@/lib/billing/cancel-stripe-subscription";
import { prisma } from "@/lib/db";
import { logSafeError } from "@/lib/log-safe-error";

import { transferAdvisorAssetsToEnterprise } from "./transfer-advisor-assets";
import { notifyEnterpriseProvisionComplete } from "./enterprise-provision-notifications";

const PROVISION_TRANSACTION_TIMEOUT_MS = 300_000;

export type FinalizeEnterpriseProvisionResult = {
  success: boolean;
  enterpriseId: string;
  skipped?: boolean;
  error?: string;
};

type ProvisionActor = {
  userId: string;
  email: string | null;
  role: UserRole;
};

async function resolveOwnerStripeSubscriptionId(ownerUserId: string): Promise<string | null> {
  const soloSub = await prisma.subscription.findUnique({
    where: { userId: ownerUserId },
    select: { stripeSubscriptionId: true, status: true },
  });
  const stripeId = soloSub?.stripeSubscriptionId?.trim();
  if (!stripeId || soloSub?.status !== "CANCELLED") return null;
  return stripeId;
}

/**
 * Completes heavy enterprise setup after the admin form returns: asset transfer,
 * methodology sync, Stripe cleanup, and activation. Idempotent — safe to retry via
 * cron when status is still PROVISIONING.
 */
export async function finalizeEnterpriseProvision(
  enterpriseId: string,
  actor?: ProvisionActor,
): Promise<FinalizeEnterpriseProvisionResult> {
  const enterprise = await prisma.advisorEnterprise.findUnique({
    where: { id: enterpriseId },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      seatLimit: true,
      clientLimit: true,
      perAdvisorClientLimit: true,
      paymentMethod: true,
      subscription: { select: { tier: true } },
      memberships: {
        where: { role: "OWNER", status: "ACTIVE" },
        take: 1,
        select: {
          userId: true,
          advisorProfileId: true,
        },
      },
    },
  });

  if (!enterprise) {
    return { success: false, enterpriseId, error: "Enterprise not found" };
  }

  if (enterprise.status !== "PROVISIONING") {
    return { success: true, enterpriseId, skipped: true };
  }

  const owner = enterprise.memberships[0];
  if (!owner?.advisorProfileId) {
    return {
      success: false,
      enterpriseId,
      error: "Active owner membership with advisor profile is required",
    };
  }

  try {
    const claimed = await prisma.$transaction(
      async (tx) => {
        // Atomically claim the PROVISIONING -> ACTIVE transition as the first
        // statement. A concurrent finalize (BullMQ drain racing the legacy
        // sweep, or the after() trigger racing the cron) blocks on the row
        // lock, then sees status already ACTIVE and gets count 0 — so only the
        // winner runs the non-idempotent asset transfer. On transfer failure
        // the whole tx rolls back, reverting status to PROVISIONING for retry.
        const claim = await tx.advisorEnterprise.updateMany({
          where: { id: enterpriseId, status: "PROVISIONING" },
          data: { status: "ACTIVE" },
        });
        if (claim.count === 0) {
          return false;
        }

        await transferAdvisorAssetsToEnterprise(
          tx,
          owner.advisorProfileId!,
          enterpriseId,
        );

        return true;
      },
      { timeout: PROVISION_TRANSACTION_TIMEOUT_MS },
    );

    if (!claimed) {
      return { success: true, enterpriseId, skipped: true };
    }

    const soloStripeSubscriptionId = await resolveOwnerStripeSubscriptionId(owner.userId);
    await cancelStripeSubscriptionBestEffort(soloStripeSubscriptionId);

    const { syncEnterpriseRulesToMembers } = await import(
      "@/lib/methodology/clone-enterprise-defaults"
    );
    const { syncEnterpriseMethodologyToMembers } = await import(
      "@/lib/methodology/clone-enterprise-methodology"
    );
    await syncEnterpriseRulesToMembers(enterpriseId);
    await syncEnterpriseMethodologyToMembers(enterpriseId);

    if (actor) {
      await writeAudit({
        actor: {
          userId: actor.userId,
          role: actor.role,
          email: actor.email,
        },
        action: AUDIT_ACTIONS.USER_UPDATE,
        entityType: "AdvisorEnterprise",
        entityId: enterpriseId,
        afterData: {
          status: "ACTIVE",
          name: enterprise.name,
          slug: enterprise.slug,
          ownerUserId: owner.userId,
          moduleTier: enterprise.subscription?.tier ?? null,
          provisionCompleted: true,
        },
      });
    }

    revalidatePath("/admin/advisors");
    revalidatePath("/admin/enterprises");
    revalidatePath(`/admin/enterprises/${enterpriseId}`);
    revalidatePath("/admin");

    try {
      await notifyEnterpriseProvisionComplete({
        enterpriseId,
        actorUserId: actor?.userId,
      });
    } catch (notifyError) {
      console.error("Enterprise provision complete notifications failed:", notifyError);
    }

    return { success: true, enterpriseId };
  } catch (e) {
    logSafeError(`enterprise/finalizeProvision:${enterpriseId}`, e);
    const message = e instanceof Error ? e.message : "Provision finalize failed";

    if (actor) {
      try {
        await writeAudit({
          actor: {
            userId: actor.userId,
            role: actor.role,
            email: actor.email,
          },
          action: AUDIT_ACTIONS.USER_UPDATE,
          entityType: "AdvisorEnterprise",
          entityId: enterpriseId,
          afterData: {
            status: "PROVISIONING",
            name: enterprise.name,
            slug: enterprise.slug,
            provisionFailed: true,
            provisionError: message,
          },
        });
      } catch (auditError) {
        console.error("Failed to write provision failure audit:", auditError);
      }
    }

    return {
      success: false,
      enterpriseId,
      error: message,
    };
  }
}

/** Cron / ops retry for firms stuck in PROVISIONING after the HTTP after() hook. */
export async function processPendingEnterpriseProvisions(options?: {
  limit?: number;
}): Promise<{
  processed: number;
  activated: number;
  failed: number;
}> {
  const limit = options?.limit ?? 5;
  const pending = await prisma.advisorEnterprise.findMany({
    where: { status: "PROVISIONING" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let activated = 0;
  let failed = 0;

  for (const row of pending) {
    const result = await finalizeEnterpriseProvision(row.id);
    if (result.skipped) continue;
    if (result.success) {
      activated += 1;
    } else {
      failed += 1;
    }
  }

  return { processed: pending.length, activated, failed };
}
