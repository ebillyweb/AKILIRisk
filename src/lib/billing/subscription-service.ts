import "server-only";

import {
  Prisma,
  type BillingCycle,
  type Subscription as SubscriptionRow,
  type SubscriptionStatus,
  type SubscriptionTier,
} from "@prisma/client";
import type Stripe from "stripe";

import { prisma } from "@/lib/db";

import { TIER_LIMITS } from "./constants";
import {
  getPriceIdForTier,
  getPriceIdPlanMap,
  isBillingEnabled,
} from "./config";
import { currentPeriodEndFromStripeSubscription } from "./stripe-subscription-period";
import { mapStripeSubscriptionStatus } from "./stripe-status";

export type DbLike = Prisma.TransactionClient | typeof prisma;

export class ClientLimitError extends Error {
  constructor(
    message: string,
    public readonly payload: {
      currentTier?: SubscriptionTier;
      currentCount: number;
      limit: number;
      upgradePath: string;
    }
  ) {
    super(message);
    this.name = "ClientLimitError";
  }
}

function subscriptionAllowsNewClients(
  status: SubscriptionStatus,
  currentPeriodEnd: Date,
  cancelAtPeriodEnd: boolean
): boolean {
  if (status === "UNPAID") return false;
  if (status === "CANCELLED") {
    if (cancelAtPeriodEnd && currentPeriodEnd > new Date()) return true;
    return false;
  }
  if (status === "GRACE_PERIOD") {
    return currentPeriodEnd > new Date();
  }
  return status === "ACTIVE" || status === "PAST_DUE";
}

export async function countActiveClientsForAdvisor(
  advisorProfileId: string,
  db: DbLike = prisma
): Promise<number> {
  return db.clientAdvisorAssignment.count({
    where: { advisorId: advisorProfileId, status: "ACTIVE" },
  });
}

/**
 * When billing is enabled but no Subscription row exists yet, enforce Starter limits
 * until the advisor completes Stripe Checkout (admin portal access still requires a qualifying subscription).
 */
function defaultLimitWhenMissingSubscription(): number {
  return TIER_LIMITS.STARTER;
}

export async function checkClientLimitForAdvisorProfile(
  advisorProfileId: string,
  db: DbLike = prisma
): Promise<{
  canAddClient: boolean;
  currentCount: number;
  limit: number;
  status?: SubscriptionStatus;
}> {
  const profile = await db.advisorProfile.findUnique({
    where: { id: advisorProfileId },
    select: { userId: true },
  });

  if (!profile) {
    return { canAddClient: false, currentCount: 0, limit: 0 };
  }

  const currentCount = await countActiveClientsForAdvisor(advisorProfileId, db);

  // Local/staging convenience: when billing isn't wired up
  // (`ENABLE_BILLING_FEATURES=false`), let advisors add clients without a
  // subscription row so seeded fixtures work end-to-end. Production never
  // takes this shortcut — flipping billing off there must not silently
  // grant unlimited clients regardless of tier. Mirrors
  // `advisorHubAccessFromRow` in `@/lib/advisor/auth` and
  // `missingSubscriptionFallback()` in `@/lib/subscription/validation`.
  if (!isBillingEnabled() && process.env.NODE_ENV !== "production") {
    return {
      canAddClient: true,
      currentCount,
      limit: Number.MAX_SAFE_INTEGER,
    };
  }

  const subscription = await db.subscription.findUnique({
    where: { userId: profile.userId },
  });

  const limit = subscription?.clientLimit ?? defaultLimitWhenMissingSubscription();

  if (!subscription) {
    const canAdd = currentCount < limit;
    return {
      canAddClient: canAdd,
      currentCount,
      limit,
    };
  }

  const allowed = subscriptionAllowsNewClients(
    subscription.status,
    subscription.currentPeriodEnd,
    subscription.cancelAtPeriodEnd
  );

  const canAddClient = allowed && currentCount < limit;

  return {
    canAddClient,
    currentCount,
    limit,
    status: subscription.status,
  };
}

export async function assertCanAddClientForAdvisorProfile(
  advisorProfileId: string,
  db: DbLike = prisma
): Promise<void> {
  const check = await checkClientLimitForAdvisorProfile(advisorProfileId, db);
  if (check.canAddClient) return;

  const profile = await db.advisorProfile.findUnique({
    where: { id: advisorProfileId },
    include: { user: { select: { id: true } } },
  });
  const sub = profile
    ? await db.subscription.findUnique({ where: { userId: profile.userId } })
    : null;

  const atCap = check.currentCount >= check.limit;
  const message = atCap
    ? `Client limit reached (${check.currentCount}/${check.limit}). Upgrade your plan to add more clients.`
    : "Your subscription is not active. Update billing to add clients.";

  throw new ClientLimitError(message, {
    currentTier: sub?.tier,
    currentCount: check.currentCount,
    limit: check.limit,
    upgradePath: "/advisor/billing",
  });
}

function tierFromStripeSubscription(
  sub: Stripe.Subscription,
  existingTier?: SubscriptionTier
): { tier: SubscriptionTier; billingCycle: BillingCycle; priceId: string | null } {
  const priceId =
    sub.items?.data?.[0]?.price?.id && typeof sub.items.data[0].price.id === "string"
      ? sub.items.data[0].price.id
      : null;

  const map = getPriceIdPlanMap();
  if (priceId && map[priceId]) {
    return { ...map[priceId], priceId };
  }

  const metaTier = sub.metadata?.tier as SubscriptionTier | undefined;
  const metaCycle = sub.metadata?.billing_cycle as BillingCycle | undefined;
  if (
    metaTier &&
    metaCycle &&
    (metaTier === "STARTER" || metaTier === "GROWTH" || metaTier === "PROFESSIONAL") &&
    (metaCycle === "MONTHLY" || metaCycle === "ANNUAL")
  ) {
    return { tier: metaTier, billingCycle: metaCycle, priceId };
  }

  // Fallback path: price ID isn't in the env-configured map AND Stripe
  // metadata didn't carry a usable tier/cycle. This typically means the
  // subscription was created out-of-band (Stripe Dashboard, legacy import).
  // Default to STARTER (lowest paid tier) — never GROWTH — so we don't
  // silently over-grant entitlements. Existing rows keep their tier so we
  // don't downgrade a paying customer because of a one-off webhook
  // hiccup. The warning is grep-friendly so we can audit how often this
  // path fires in production.
  if (!existingTier) {
    console.warn(
      `[subscription-service] Unmapped Stripe price ID, defaulting to STARTER tier: ${priceId ?? "<no price id>"}`
    );
  }
  return {
    tier: existingTier ?? "STARTER",
    billingCycle: "MONTHLY",
    priceId,
  };
}

export async function appendSubscriptionAuditLog(
  db: DbLike,
  subscriptionId: string,
  action: string,
  opts?: {
    previousTier?: SubscriptionTier | null;
    newTier?: SubscriptionTier | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await db.subscriptionAuditLog.create({
    data: {
      subscriptionId,
      action,
      previousTier: opts?.previousTier ?? undefined,
      newTier: opts?.newTier ?? undefined,
      metadata: opts?.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}

/**
 * Outcome of `upsertSubscriptionFromStripe`. `applied: false` means the
 * write was skipped because a newer event has already been applied to this
 * subscription (stale-event ordering check). `row` is always populated when
 * the subscription exists (either before or after this call); only on the
 * first-ever create-path failure with no existing row would it be null,
 * which we don't currently expose because that path always creates a row.
 */
export interface UpsertSubscriptionResult {
  row: SubscriptionRow;
  applied: boolean;
}

/**
 * Apply a Stripe subscription snapshot to our DB.
 *
 * `eventCreatedAt` (Stripe `event.created` for the webhook delivering this
 * snapshot, in Date form) is recorded into `Subscription.lastStripeEventAt`
 * atomically with the rest of the upsert.
 *
 * Race safety (round-6 fix): when `eventCreatedAt` is set, the update path
 * uses a conditional `updateMany` keyed on `lastStripeEventAt < eventCreatedAt
 * OR null`. This collapses the previous read-then-compare-then-write
 * (`isEventNewerThanCurrent` check followed by an unconditional upsert) into
 * a single atomic write. Two concurrent newer-and-older webhooks racing for
 * the same userId can no longer interleave to clobber the newer state.
 *
 * `eventCreatedAt` is optional for non-webhook callers (e.g. checkout
 * flows that retrieve the subscription mid-request). Those callers don't
 * have an inbound event timestamp to record and always run as
 * unconditional updates.
 */
export async function upsertSubscriptionFromStripe(
  userId: string,
  sub: Stripe.Subscription,
  stripeCustomerId: string,
  db: DbLike = prisma,
  eventCreatedAt?: Date
): Promise<UpsertSubscriptionResult> {
  const existing = await db.subscription.findUnique({ where: { userId } });
  const { tier, billingCycle, priceId } = tierFromStripeSubscription(
    sub,
    existing?.tier
  );
  const clientLimit = TIER_LIMITS[tier];
  const status = mapStripeSubscriptionStatus(sub.status);
  const currentPeriodEnd = currentPeriodEndFromStripeSubscription(sub);
  const cancelAtPeriodEnd = sub.cancel_at_period_end === true;

  // Create path. The unique constraint on userId protects against two
  // concurrent first-event creates: one wins, the other catches P2002 and
  // falls through to the update path on the now-existing row.
  if (!existing) {
    try {
      const created = await db.subscription.create({
        data: {
          userId,
          stripeCustomerId,
          stripeSubscriptionId: sub.id,
          stripePriceId: priceId,
          tier,
          status,
          clientLimit,
          billingCycle,
          currentPeriodEnd,
          cancelAtPeriodEnd,
          lastStripeEventAt: eventCreatedAt ?? null,
        },
      });

      await appendSubscriptionAuditLog(db, created.id, "created", {
        newTier: tier,
        metadata: { source: "stripe_webhook", stripeSubscriptionId: sub.id },
      });

      return { row: created, applied: true };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        // Lost the create race; another concurrent webhook just inserted
        // the row. Re-read and fall through to the update path so the
        // ordering check still runs against the newly-created row.
        const reread = await db.subscription.findUnique({ where: { userId } });
        if (!reread) {
          // Vanishingly unlikely (would require a DELETE between create and
          // re-read). Surface as a hard error rather than silently mis-
          // applying the snapshot.
          throw err;
        }
        return updateExisting(reread);
      }
      throw err;
    }
  }

  return updateExisting(existing);

  async function updateExisting(
    current: SubscriptionRow
  ): Promise<UpsertSubscriptionResult> {
    const updateData: Prisma.SubscriptionUpdateManyMutationInput = {
      stripeCustomerId,
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId ?? undefined,
      tier,
      status,
      clientLimit,
      billingCycle,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      // Only advance the marker when the caller passed one. Non-webhook
      // callers (checkout path) leave it untouched.
      ...(eventCreatedAt ? { lastStripeEventAt: eventCreatedAt } : {}),
    };

    if (eventCreatedAt) {
      // Conditional update — only succeeds when this event is strictly newer
      // than the last applied one (or no prior event has been applied).
      // count === 0 means a concurrent newer event has already won; we
      // report applied=false so the caller skips downstream side effects
      // (audit logs, etc.) without mutating state.
      const result = await db.subscription.updateMany({
        where: {
          userId,
          OR: [
            { lastStripeEventAt: null },
            { lastStripeEventAt: { lt: eventCreatedAt } },
          ],
        },
        data: updateData,
      });
      if (result.count === 0) {
        return { row: current, applied: false };
      }
    } else {
      // Non-webhook caller — unconditional update, no ordering check.
      await db.subscription.updateMany({
        where: { userId },
        data: updateData,
      });
    }

    const updated = await db.subscription.findUnique({ where: { userId } });
    if (!updated) {
      throw new Error(
        `Subscription disappeared after update for userId ${userId}`
      );
    }

    const tierChanged = current.tier !== tier;
    const statusChanged = current.status !== status;
    if (tierChanged || statusChanged) {
      await appendSubscriptionAuditLog(db, updated.id, "stripe_sync", {
        previousTier: current.tier,
        newTier: tier,
        metadata: {
          previousStatus: current.status,
          newStatus: status,
          stripeSubscriptionId: sub.id,
        },
      });
    }

    return { row: updated, applied: true };
  }
}

export async function syncSubscriptionByStripeId(
  stripeSubscriptionId: string,
  db: DbLike = prisma
): Promise<void> {
  const { getStripe } = await import("@/lib/stripe");
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
    expand: ["latest_invoice"],
  });
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) return;

  const subRecord = await db.subscription.findFirst({
    where: { stripeSubscriptionId },
    select: { userId: true },
  });
  const userId =
    subRecord?.userId ??
    (typeof sub.metadata?.userId === "string" ? sub.metadata.userId : null);
  if (!userId) return;

  // Non-webhook caller (no eventCreatedAt) → always applies. Discard the
  // result; this helper has no return value and no downstream caller cares
  // about applied vs. stale.
  await upsertSubscriptionFromStripe(userId, sub, customerId, db);
}

export function validateCheckoutPrice(
  tier: SubscriptionTier,
  billingCycle: BillingCycle
): string {
  const priceId = getPriceIdForTier(tier, billingCycle);
  if (!priceId) {
    throw new Error(
      `Missing Stripe price env for ${tier} ${billingCycle}. Configure STRIPE_PRICE_* in the environment.`
    );
  }
  return priceId;
}
