"use server";

import type { BillingCycle, SubscriptionTier } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdvisorSession, getAdvisorProfileOrThrow } from "@/lib/advisor/auth";
import { isBillingEnabled } from "@/lib/billing/config";
import { TIER_LIMITS } from "@/lib/billing/constants";
import {
  checkClientLimitForAdvisorProfile,
  reconcileAdvisorSubscriptionWithStripe,
  upsertSubscriptionFromStripe,
  validateCheckoutPrice,
} from "@/lib/billing/subscription-service";
import { resolveBillingContext } from "@/lib/enterprise/billing-context";
import {
  canAccessAdvisorBilling,
  getEnterpriseBillingSummary,
  type EnterpriseBillingSummary,
} from "@/lib/enterprise/billing-details";
import { prisma } from "@/lib/db";
import { resolvePublicAppUrl } from "@/lib/public-app-url";
import { getStripe } from "@/lib/stripe";

const checkoutSchema = z.object({
  tier: z.enum(["STARTER", "GROWTH", "PROFESSIONAL"]),
  billingCycle: z.enum(["MONTHLY", "ANNUAL"]),
});

export type BillingActionError = { success: false; error: string };
export type BillingCheckoutResult =
  | { success: true; url: string }
  | BillingActionError;
export type BillingPortalResult =
  | { success: true; url: string }
  | BillingActionError;

export type SwitchPlanResult = { success: true } | BillingActionError;

/**
 * Change an existing Stripe subscription's price (upgrade, downgrade, or monthly/annual switch).
 * Uses proration; does not apply when there is no active Stripe subscription (use Checkout instead).
 */
export async function switchSubscriptionPlan(
  input: unknown
): Promise<SwitchPlanResult> {
  try {
    if (!isBillingEnabled()) {
      return { success: false, error: "Billing is disabled." };
    }
    const { userId } = await requireAdvisorSession();
    await getAdvisorProfileOrThrow(userId);

    const parsed = checkoutSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Invalid plan selection." };
    }

    const { tier, billingCycle } = parsed.data;
    const tierEnum = tier as SubscriptionTier;
    const cycleEnum = billingCycle as BillingCycle;

    const row = await prisma.subscription.findUnique({
      where: { userId },
    });
    if (!row?.stripeSubscriptionId || !row.stripeCustomerId) {
      return {
        success: false,
        error: "No active Stripe subscription to update. Use Subscribe to add a plan.",
      };
    }

    const priceId = validateCheckoutPrice(tierEnum, cycleEnum);
    const stripe = getStripe();

    const stripeSub = await stripe.subscriptions.retrieve(row.stripeSubscriptionId, {
      expand: ["items.data"],
    });

    if (stripeSub.status === "canceled") {
      return {
        success: false,
        error: "This subscription has ended. Choose a plan to subscribe again.",
      };
    }

    const itemId = stripeSub.items.data[0]?.id;
    if (!itemId) {
      return { success: false, error: "Could not read subscription items from Stripe." };
    }

    const nextMeta: Record<string, string> = {
      ...(stripeSub.metadata ?? {}),
    };
    nextMeta.userId = userId;
    nextMeta.tier = tierEnum;
    nextMeta.billing_cycle = cycleEnum;

    const updated = await stripe.subscriptions.update(row.stripeSubscriptionId, {
      items: [{ id: itemId, price: priceId }],
      proration_behavior: "create_prorations",
      metadata: nextMeta,
    });

    await upsertSubscriptionFromStripe(userId, updated, row.stripeCustomerId);
    revalidatePath("/advisor/billing");
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Plan change failed";
    return { success: false, error: message };
  }
}

export async function createCheckoutSession(
  input: unknown
): Promise<BillingCheckoutResult> {
  try {
    if (!isBillingEnabled()) {
      return { success: false, error: "Billing is disabled." };
    }
    const { userId } = await requireAdvisorSession();
    const profile = await getAdvisorProfileOrThrow(userId);

    const parsed = checkoutSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Invalid plan selection." };
    }

    const { tier, billingCycle } = parsed.data;
    const priceId = validateCheckoutPrice(
      tier as SubscriptionTier,
      billingCycle as BillingCycle
    );

    const existing = await prisma.subscription.findUnique({
      where: { userId },
    });

    const base = await resolvePublicAppUrl();
    const successUrl = `${base}/advisor/billing?checkout=success`;
    const cancelUrl = `${base}/advisor/billing?checkout=cancel`;
    try {
      new URL(successUrl);
      new URL(cancelUrl);
    } catch {
      return {
        success: false,
        error:
          "Billing redirect URL is invalid. Open the app from your real site URL (not an IP or stale tab), and set AUTH_URL in Vercel to https://your-domain.com with no trailing path.",
      };
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
      metadata: {
        userId,
        tier,
        billing_cycle: billingCycle,
      },
      subscription_data: {
        metadata: {
          userId,
          tier,
          billing_cycle: billingCycle,
        },
      },
      ...(existing?.stripeCustomerId
        ? { customer: existing.stripeCustomerId }
        : { customer_email: profile.user.email ?? undefined }),
    });

    if (!session.url) {
      return { success: false, error: "Could not start checkout session." };
    }

    return { success: true, url: session.url };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Checkout failed";
    const hint =
      /url/i.test(message) && process.env.VERCEL === "1"
        ? " Check AUTH_URL / NEXT_PUBLIC_URL in Vercel (full https:// URL, no quotes or line breaks)."
        : "";
    return { success: false, error: message + hint };
  }
}

export async function createPortalSession(): Promise<BillingPortalResult> {
  try {
    if (!isBillingEnabled()) {
      return { success: false, error: "Billing is disabled." };
    }
    const { userId } = await requireAdvisorSession();
    await getAdvisorProfileOrThrow(userId);

    const billingCtx = await resolveBillingContext(userId);
    let stripeCustomerId: string | null = null;

    if (billingCtx?.kind === "enterprise") {
      if (billingCtx.role !== "OWNER") {
        return {
          success: false,
          error: "Only the firm owner can open the Stripe billing portal.",
        };
      }
      const enterprise = await prisma.advisorEnterprise.findUnique({
        where: { id: billingCtx.enterpriseId },
        select: {
          paymentMethod: true,
          subscription: { select: { stripeCustomerId: true } },
        },
      });
      if (enterprise?.paymentMethod !== "CARD") {
        return {
          success: false,
          error: "This firm is billed by wire transfer. Contact your account manager for billing changes.",
        };
      }
      stripeCustomerId = enterprise.subscription?.stripeCustomerId ?? null;
    } else {
      const sub = await prisma.subscription.findUnique({
        where: { userId },
        select: { stripeCustomerId: true },
      });
      stripeCustomerId = sub?.stripeCustomerId ?? null;
    }

    if (!stripeCustomerId) {
      return {
        success: false,
        error: "No Stripe customer on file. Subscribe first to manage billing.",
      };
    }

    const base = await resolvePublicAppUrl();
    const returnUrl = `${base}/advisor/billing`;
    try {
      new URL(returnUrl);
    } catch {
      return {
        success: false,
        error:
          "Billing return URL is invalid. Set AUTH_URL in Vercel to your public https origin (e.g. https://your-domain.com).",
      };
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    if (!session.url) {
      return { success: false, error: "Could not start billing portal session." };
    }

    return { success: true, url: session.url };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Portal session failed";
    const hint =
      /url/i.test(message) && process.env.VERCEL === "1"
        ? " Check AUTH_URL / NEXT_PUBLIC_URL in Vercel (full https:// URL, no quotes or line breaks)."
        : "";
    return { success: false, error: message + hint };
  }
}

export type SubscriptionDetailsDTO = {
  tier: SubscriptionTier;
  status: string;
  clientLimit: number;
  billingCycle: BillingCycle;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentClientCount: number;
  canAddClient: boolean;
};

export type BillingPageData =
  | {
      mode: "solo";
      subscription: SubscriptionDetailsDTO | null;
      invoices: BillingInvoiceDTO[];
    }
  | {
      mode: "enterprise";
      enterprise: EnterpriseBillingSummary;
      invoices: BillingInvoiceDTO[];
    }
  | { mode: "unavailable" };

export async function getBillingPageData(): Promise<
  { success: true; data: BillingPageData } | BillingActionError
> {
  try {
    const { userId } = await requireAdvisorSession();
    if (!(await canAccessAdvisorBilling(userId))) {
      return { success: true, data: { mode: "unavailable" } };
    }

    const billingCtx = await resolveBillingContext(userId);
    if (billingCtx?.kind === "enterprise") {
      const enterprise = await getEnterpriseBillingSummary(userId);
      if (!enterprise) {
        return { success: false, error: "Enterprise billing details unavailable." };
      }
      const invRes = await getBillingHistory();
      return {
        success: true,
        data: {
          mode: "enterprise",
          enterprise,
          invoices: invRes.success ? invRes.data : [],
        },
      };
    }

    const [subRes, invRes] = await Promise.all([
      getSubscriptionDetails(),
      getBillingHistory(),
    ]);
    if (!subRes.success) return subRes;
    return {
      success: true,
      data: {
        mode: "solo",
        subscription: subRes.data,
        invoices: invRes.success ? invRes.data : [],
      },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load billing";
    return { success: false, error: message };
  }
}

export async function getSubscriptionDetails(): Promise<
  | { success: true; data: SubscriptionDetailsDTO | null }
  | BillingActionError
> {
  try {
    const { userId } = await requireAdvisorSession();
    const profile = await getAdvisorProfileOrThrow(userId);

    const sub = await prisma.subscription.findUnique({
      where: { userId },
    });

    const reconciled = await reconcileAdvisorSubscriptionWithStripe(
      userId,
      profile.user.email ?? null,
      sub
    );

    const limitCheck = await checkClientLimitForAdvisorProfile(profile.id);

    if (!reconciled) {
      return {
        success: true,
        data: {
          tier: "STARTER",
          status: "NONE",
          clientLimit: TIER_LIMITS.STARTER,
          billingCycle: "MONTHLY",
          currentPeriodEnd: new Date().toISOString(),
          cancelAtPeriodEnd: false,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          currentClientCount: limitCheck.currentCount,
          canAddClient: limitCheck.canAddClient,
        },
      };
    }

    return {
      success: true,
      data: {
        tier: reconciled.tier,
        status: reconciled.status,
        clientLimit: reconciled.clientLimit,
        billingCycle: reconciled.billingCycle,
        currentPeriodEnd: reconciled.currentPeriodEnd.toISOString(),
        cancelAtPeriodEnd: reconciled.cancelAtPeriodEnd,
        stripeCustomerId: reconciled.stripeCustomerId,
        stripeSubscriptionId: reconciled.stripeSubscriptionId,
        currentClientCount: limitCheck.currentCount,
        canAddClient: limitCheck.canAddClient,
      },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load subscription";
    return { success: false, error: message };
  }
}

export type BillingInvoiceDTO = {
  id: string;
  number: string | null;
  status: string | null;
  amountPaid: number;
  currency: string;
  created: string;
  pdfUrl: string | null;
  hostedUrl: string | null;
};

export async function getBillingHistory(): Promise<
  { success: true; data: BillingInvoiceDTO[] } | BillingActionError
> {
  try {
    if (!isBillingEnabled()) {
      return { success: true, data: [] };
    }
    const { userId } = await requireAdvisorSession();
    await getAdvisorProfileOrThrow(userId);

    const billingCtx = await resolveBillingContext(userId);
    if (billingCtx?.kind === "enterprise") {
      let stripeCustomerId: string | null = null;
      if (billingCtx.role === "OWNER" || billingCtx.role === "ADMIN") {
        const sub = await prisma.subscription.findUnique({
          where: { enterpriseId: billingCtx.enterpriseId },
          select: { stripeCustomerId: true },
        });
        stripeCustomerId = sub?.stripeCustomerId ?? null;
      }
      if (!stripeCustomerId) {
        return { success: true, data: [] };
      }

      const stripe = getStripe();
      const invoices = await stripe.invoices.list({
        customer: stripeCustomerId,
        limit: 24,
      });

      const data: BillingInvoiceDTO[] = invoices.data.map((inv) => ({
        id: inv.id,
        number: inv.number,
        status: inv.status,
        amountPaid: inv.amount_paid,
        currency: inv.currency,
        created: new Date((inv.created ?? 0) * 1000).toISOString(),
        pdfUrl: inv.invoice_pdf ?? null,
        hostedUrl: inv.hosted_invoice_url ?? null,
      }));

      return { success: true, data };
    }

    const sub = await prisma.subscription.findUnique({
      where: { userId },
      select: { stripeCustomerId: true },
    });
    if (!sub?.stripeCustomerId) {
      return { success: true, data: [] };
    }

    const stripe = getStripe();
    const invoices = await stripe.invoices.list({
      customer: sub.stripeCustomerId,
      limit: 24,
    });

    const data: BillingInvoiceDTO[] = invoices.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      amountPaid: inv.amount_paid,
      currency: inv.currency,
      created: new Date((inv.created ?? 0) * 1000).toISOString(),
      pdfUrl: inv.invoice_pdf ?? null,
      hostedUrl: inv.hosted_invoice_url ?? null,
    }));

    return { success: true, data };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load invoices";
    return { success: false, error: message };
  }
}
