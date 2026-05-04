import "server-only";

import type {
  BillingCycle,
  Prisma,
  Subscription as SubscriptionRow,
  SubscriptionStatus,
  SubscriptionTier,
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
 * Apply a Stripe subscription snapshot to our DB.
 *
 * `eventCreatedAt` (Stripe `event.created` for the webhook delivering this
 * snapshot, in Date form) is recorded into `Subscription.lastStripeEventAt`
 * atomically with the rest of the upsert. The webhook route calls this
 * helper only after running its own ordering check, but writing the
 * timestamp inside the same upsert closes the small window where two
 * concurrent webhook handlers could otherwise race.
 *
 * `eventCreatedAt` is optional for non-webhook callers (e.g. checkout
 * flows that retrieve the subscription mid-request). Those callers don't
 * have an inbound event timestamp to record.
 */
export async function upsertSubscriptionFromStripe(
  userId: string,
  sub: Stripe.Subscription,
  stripeCustomerId: string,
  db: DbLike = prisma,
  eventCreatedAt?: Date
): Promise<SubscriptionRow> {
  const existing = await db.subscription.findUnique({ where: { userId } });
  const { tier, billingCycle, priceId } = tierFromStripeSubscription(
    sub,
    existing?.tier
  );
  const clientLimit = TIER_LIMITS[tier];
  const status = mapStripeSubscriptionStatus(sub.status);
  const currentPeriodEnd = currentPeriodEndFromStripeSubscription(sub);
  const cancelAtPeriodEnd = sub.cancel_at_period_end === true;

  const row = await db.subscription.upsert({
    where: { userId },
    create: {
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
    update: {
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
    },
  });

  if (existing) {
    const tierChanged = existing.tier !== tier;
    const statusChanged = existing.status !== status;
    if (tierChanged || statusChanged) {
      await appendSubscriptionAuditLog(db, row.id, "stripe_sync", {
        previousTier: existing.tier,
        newTier: tier,
        metadata: {
          previousStatus: existing.status,
          newStatus: status,
          stripeSubscriptionId: sub.id,
        },
      });
    }
  } else {
    await appendSubscriptionAuditLog(db, row.id, "created", {
      newTier: tier,
      metadata: { source: "stripe_webhook", stripeSubscriptionId: sub.id },
    });
  }

  return row;
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
