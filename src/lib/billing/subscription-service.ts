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

import { clientLimitForTier, TIER_LIMITS } from "./constants";
import {
  getPriceIdForTier,
  getPriceIdPlanMap,
  isBillingEnabled,
} from "./config";
import { SELF_SERVE_TIERS, tierEnvKey, type SelfServeTier } from "./tier-catalog";
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
  return clientLimitForTier("ESSENTIALS");
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
    select: { userId: true, enterpriseId: true },
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

  if (profile.enterpriseId) {
    const { checkEnterpriseInviteLimits } = await import(
      "@/lib/enterprise/client-limits"
    );
    const enterpriseCheck = await checkEnterpriseInviteLimits(
      profile.enterpriseId,
      advisorProfileId,
      db
    );
    const enterprise = await db.advisorEnterprise.findUnique({
      where: { id: profile.enterpriseId },
      select: {
        subscription: {
          select: {
            status: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
          },
        },
      },
    });
    const subscription = enterprise?.subscription;
    const allowed = subscription
      ? subscriptionAllowsNewClients(
          subscription.status,
          subscription.currentPeriodEnd,
          subscription.cancelAtPeriodEnd
        )
      : false;

    return {
      canAddClient: allowed && enterpriseCheck.canAddClient,
      currentCount: enterpriseCheck.advisorCount,
      limit: enterpriseCheck.advisorLimit,
      status: subscription?.status,
    };
  }

  const subscription = await db.subscription.findUnique({
    where: { userId: profile.userId },
  });

  const limit = subscription
    ? clientLimitForTier(subscription.tier)
    : defaultLimitWhenMissingSubscription();

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
    select: { userId: true, enterpriseId: true },
  });

  if (profile?.enterpriseId) {
    const enterprise = await db.advisorEnterprise.findUnique({
      where: { id: profile.enterpriseId },
      select: {
        subscription: {
          select: {
            status: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
          },
        },
      },
    });
    const subscription = enterprise?.subscription;
    const allowed = subscription
      ? subscriptionAllowsNewClients(
          subscription.status,
          subscription.currentPeriodEnd,
          subscription.cancelAtPeriodEnd
        )
      : false;
    if (!allowed) {
      throw new ClientLimitError(
        "Your firm's subscription is not active. Contact your account manager.",
        {
          currentCount: check.currentCount,
          limit: check.limit,
          upgradePath: "/advisor/billing",
        }
      );
    }
    const { assertCanAddClientForEnterpriseInvite } = await import(
      "@/lib/enterprise/client-limits"
    );
    await assertCanAddClientForEnterpriseInvite(
      profile.enterpriseId,
      advisorProfileId,
      db
    );
    return;
  }

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
    (metaTier === "ESSENTIALS" ||
      metaTier === "PROFESSIONAL" ||
      metaTier === "BUSINESS" ||
      metaTier === "PLATINUM") &&
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
    tier: existingTier ?? "ESSENTIALS",
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

export async function upsertEnterpriseSubscriptionFromStripe(
  enterpriseId: string,
  sub: Stripe.Subscription,
  stripeCustomerId: string,
  db: DbLike = prisma,
  eventCreatedAt?: Date
): Promise<UpsertSubscriptionResult> {
  const enterprise = await db.advisorEnterprise.findUnique({
    where: { id: enterpriseId },
    select: { clientLimit: true },
  });
  if (!enterprise) {
    throw new Error(`AdvisorEnterprise not found: ${enterpriseId}`);
  }

  const existing = await db.subscription.findUnique({ where: { enterpriseId } });
  const { tier, billingCycle, priceId } = tierFromStripeSubscription(
    sub,
    existing?.tier ?? "ESSENTIALS"
  );
  const clientLimit = enterprise.clientLimit;
  const status = mapStripeSubscriptionStatus(sub.status);
  const currentPeriodEnd = currentPeriodEndFromStripeSubscription(sub);
  const cancelAtPeriodEnd = sub.cancel_at_period_end === true;

  if (!existing) {
    try {
      const created = await db.subscription.create({
        data: {
          enterpriseId,
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
        metadata: {
          source: "stripe_webhook",
          stripeSubscriptionId: sub.id,
          enterpriseId,
        },
      });

      return { row: created, applied: true };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const reread = await db.subscription.findUnique({ where: { enterpriseId } });
        if (!reread) throw err;
        return updateExistingEnterprise(reread);
      }
      throw err;
    }
  }

  return updateExistingEnterprise(existing);

  async function updateExistingEnterprise(
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
      ...(eventCreatedAt ? { lastStripeEventAt: eventCreatedAt } : {}),
    };

    if (eventCreatedAt) {
      const result = await db.subscription.updateMany({
        where: {
          enterpriseId,
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
      await db.subscription.updateMany({
        where: { enterpriseId },
        data: updateData,
      });
    }

    const updated = await db.subscription.findUnique({ where: { enterpriseId } });
    if (!updated) {
      throw new Error(
        `Subscription disappeared after update for enterpriseId ${enterpriseId}`
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
          enterpriseId,
        },
      });
    }

    return { row: updated, applied: true };
  }
}

/** Stripe Search query literals use single quotes; escape embedded quotes by doubling. */
function escapeStripeSearchLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function subscriptionStripeStatusRank(status: Stripe.Subscription.Status): number {
  switch (status) {
    case "active":
      return 5;
    case "trialing":
      return 4;
    case "past_due":
      return 3;
    case "unpaid":
    case "paused":
    case "incomplete":
      return 2;
    case "canceled":
    case "incomplete_expired":
      return 1;
    default:
      return 0;
  }
}

function pickPrimaryStripeSubscription(
  subs: Stripe.Subscription[]
): Stripe.Subscription | null {
  if (subs.length === 0) return null;
  return (
    [...subs].sort((a, b) => {
      const d =
        subscriptionStripeStatusRank(b.status) -
        subscriptionStripeStatusRank(a.status);
      if (d !== 0) return d;
      return (b.created ?? 0) - (a.created ?? 0);
    })[0] ?? null
  );
}

/**
 * When webhooks never wrote `Subscription` (or only wrote `stripeCustomerId`),
 * `/advisor/billing` would show checkout for every tier. Pull the live Stripe
 * subscription for this advisor (metadata `userId`, known customer id, then
 * customer-by-email) and upsert the row so plan cards use `stripe_update`.
 */
export async function reconcileAdvisorSubscriptionWithStripe(
  userId: string,
  email: string | null,
  current: SubscriptionRow | null,
  db: DbLike = prisma
): Promise<SubscriptionRow | null> {
  if (!isBillingEnabled()) {
    return current;
  }

  if (current?.stripeSubscriptionId?.trim()) {
    return current;
  }

  try {
    const { getStripe } = await import("@/lib/stripe");
    const stripe = getStripe();
    const seen = new Set<string>();
    const candidates: Stripe.Subscription[] = [];

    const pushUnique = (subs: Stripe.Subscription[]) => {
      for (const s of subs) {
        if (seen.has(s.id)) continue;
        seen.add(s.id);
        candidates.push(s);
      }
    };

    const listForCustomer = async (customerId: string) => {
      const res = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 30,
      });
      pushUnique(res.data);
    };

    try {
      const q = escapeStripeSearchLiteral(userId);
      const searched = await stripe.subscriptions.search({
        query: `metadata['userId']:'${q}'`,
        limit: 30,
      });
      pushUnique(searched.data);
    } catch (e) {
      console.warn(
        "[subscription-service] Stripe subscription search failed (billing reconcile):",
        e
      );
    }

    const custId = current?.stripeCustomerId?.trim();
    if (custId) {
      await listForCustomer(custId);
    }

    const emailTrim = email?.trim();
    if (emailTrim) {
      const customers = await stripe.customers.list({
        email: emailTrim,
        limit: 20,
      });
      for (const c of customers.data) {
        if (c.id) await listForCustomer(c.id);
      }
    }

    const best = pickPrimaryStripeSubscription(candidates);
    if (!best) {
      return current;
    }

    const customerIdRaw = best.customer;
    const customerId =
      typeof customerIdRaw === "string"
        ? customerIdRaw
        : customerIdRaw && typeof customerIdRaw === "object" && "id" in customerIdRaw
          ? (customerIdRaw as { id: string }).id
          : null;
    if (!customerId) {
      return current;
    }

    await upsertSubscriptionFromStripe(userId, best, customerId, db);
    return (
      (await db.subscription.findUnique({ where: { userId } })) ?? current ?? null
    );
  } catch (e) {
    console.warn("[subscription-service] reconcileAdvisorSubscriptionWithStripe failed:", e);
    return current;
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
  if (!SELF_SERVE_TIERS.includes(tier as SelfServeTier)) {
    throw new Error(`Billing is not configured for tier ${tier}.`);
  }
  const selfServeTier = tier as SelfServeTier;
  const envKey = tierEnvKey(selfServeTier, billingCycle);
  const priceId = getPriceIdForTier(tier, billingCycle);
  if (!priceId) {
    throw new Error(
      `Missing ${envKey} for ${tier} ${billingCycle}. Set this Stripe price ID in the environment — legacy fallbacks are not supported.`
    );
  }
  return priceId;
}
