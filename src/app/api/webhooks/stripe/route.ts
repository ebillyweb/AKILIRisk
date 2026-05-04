import { NextResponse } from "next/server";
import type Stripe from "stripe";
import type { WebhookProcessStatus } from "@prisma/client";

import { getInvoiceSubscriptionId } from "@/lib/billing/stripe-invoice";
import {
  appendSubscriptionAuditLog,
  upsertSubscriptionFromStripe,
} from "@/lib/billing/subscription-service";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

async function resolveUserIdForSubscription(
  sub: Stripe.Subscription
): Promise<string | null> {
  if (typeof sub.metadata?.userId === "string" && sub.metadata.userId.length > 0) {
    return sub.metadata.userId;
  }
  const row = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: sub.id },
    select: { userId: true },
  });
  return row?.userId ?? null;
}

/** Throw if the inbound event predates the most recent webhook we already
 *  applied to this subscription. Stripe doesn't guarantee ordering across
 *  retries; without this check, a stale `customer.subscription.updated`
 *  arriving after a newer one would clobber current state.
 *
 *  Returns true when we should proceed; false when the caller should skip
 *  the upsert and mark the event IGNORED. */
async function isEventNewerThanCurrent(
  userId: string,
  eventCreatedAt: Date
): Promise<boolean> {
  const existing = await prisma.subscription.findUnique({
    where: { userId },
    select: { lastStripeEventAt: true },
  });
  if (!existing?.lastStripeEventAt) return true;
  return eventCreatedAt >= existing.lastStripeEventAt;
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Dedupe gate. `processedAt != null` means a previous attempt reached a
  // terminal outcome (PROCESSED or IGNORED) — re-running would be a no-op
  // at best, a double-mutation at worst. FAILED rows leave processedAt
  // null so Stripe's retry can take another swing.
  const prior = await prisma.stripeWebhookEvent.findUnique({
    where: { id: event.id },
    select: { processedAt: true },
  });
  if (prior?.processedAt) {
    return NextResponse.json({ received: true, deduped: true });
  }

  const eventCreatedAt = new Date(event.created * 1000);

  // Record the attempt before running any handler logic. Upsert because
  // a previous FAILED attempt may have left a row behind; we reset it to
  // RECEIVED so the in-flight retry can take it through to a terminal state.
  await prisma.stripeWebhookEvent.upsert({
    where: { id: event.id },
    create: {
      id: event.id,
      eventType: event.type,
      eventCreated: eventCreatedAt,
      status: "RECEIVED",
    },
    update: {
      status: "RECEIVED",
      receivedAt: new Date(),
      processedAt: null,
    },
  });

  let outcome: WebhookProcessStatus = "PROCESSED";

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") {
          outcome = "IGNORED";
          break;
        }
        const userId = session.client_reference_id ?? session.metadata?.userId;
        const customerIdRaw = session.customer;
        const customerId =
          typeof customerIdRaw === "string"
            ? customerIdRaw
            : customerIdRaw && typeof customerIdRaw === "object" && "id" in customerIdRaw
              ? (customerIdRaw as { id: string }).id
              : null;
        const subRef = session.subscription;
        const subId =
          typeof subRef === "string"
            ? subRef
            : subRef && typeof subRef === "object" && "id" in subRef
              ? (subRef as { id: string }).id
              : null;
        if (!userId || !customerId || !subId) {
          outcome = "IGNORED";
          break;
        }

        if (!(await isEventNewerThanCurrent(userId, eventCreatedAt))) {
          outcome = "IGNORED";
          break;
        }

        const stripe = getStripe();
        const sub = await stripe.subscriptions.retrieve(subId, {
          expand: ["latest_invoice"],
        });
        await upsertSubscriptionFromStripe(userId, sub, customerId, prisma, eventCreatedAt);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerIdRaw = sub.customer;
        const customerId =
          typeof customerIdRaw === "string"
            ? customerIdRaw
            : customerIdRaw && typeof customerIdRaw === "object" && "id" in customerIdRaw
              ? (customerIdRaw as { id: string }).id
              : null;
        if (!customerId) {
          outcome = "IGNORED";
          break;
        }

        const userId = await resolveUserIdForSubscription(sub);
        if (!userId) {
          outcome = "IGNORED";
          break;
        }

        if (!(await isEventNewerThanCurrent(userId, eventCreatedAt))) {
          outcome = "IGNORED";
          break;
        }

        await upsertSubscriptionFromStripe(userId, sub, customerId, prisma, eventCreatedAt);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = getInvoiceSubscriptionId(invoice);
        if (!subId) {
          outcome = "IGNORED";
          break;
        }

        const stripe = getStripe();
        const sub = await stripe.subscriptions.retrieve(subId, {
          expand: ["latest_invoice"],
        });
        const customerIdRaw = sub.customer;
        const customerId =
          typeof customerIdRaw === "string"
            ? customerIdRaw
            : customerIdRaw && typeof customerIdRaw === "object" && "id" in customerIdRaw
              ? (customerIdRaw as { id: string }).id
              : null;
        if (!customerId) {
          outcome = "IGNORED";
          break;
        }

        const userId = await resolveUserIdForSubscription(sub);
        if (!userId) {
          outcome = "IGNORED";
          break;
        }

        if (!(await isEventNewerThanCurrent(userId, eventCreatedAt))) {
          outcome = "IGNORED";
          break;
        }

        const row = await upsertSubscriptionFromStripe(
          userId,
          sub,
          customerId,
          prisma,
          eventCreatedAt
        );
        await appendSubscriptionAuditLog(prisma, row.id, "payment_failed", {
          metadata: {
            invoiceId: invoice.id,
            amountDue: invoice.amount_due,
          },
        });
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = getInvoiceSubscriptionId(invoice);
        if (!subId) {
          outcome = "IGNORED";
          break;
        }

        const stripe = getStripe();
        const sub = await stripe.subscriptions.retrieve(subId, {
          expand: ["latest_invoice"],
        });
        const customerIdRaw = sub.customer;
        const customerId =
          typeof customerIdRaw === "string"
            ? customerIdRaw
            : customerIdRaw && typeof customerIdRaw === "object" && "id" in customerIdRaw
              ? (customerIdRaw as { id: string }).id
              : null;
        if (!customerId) {
          outcome = "IGNORED";
          break;
        }

        const userId = await resolveUserIdForSubscription(sub);
        if (!userId) {
          outcome = "IGNORED";
          break;
        }

        if (!(await isEventNewerThanCurrent(userId, eventCreatedAt))) {
          outcome = "IGNORED";
          break;
        }

        await upsertSubscriptionFromStripe(userId, sub, customerId, prisma, eventCreatedAt);
        break;
      }
      default:
        // Unhandled event type. We still record it in StripeWebhookEvent so
        // we have an audit trail of what Stripe sent us; processedAt is set
        // (terminal) so a redelivery dedupes immediately.
        outcome = "IGNORED";
        break;
    }
  } catch (e) {
    outcome = "FAILED";
    console.error("Stripe webhook handler error:", e);
    // Mark FAILED in finally; Stripe's retry will see processedAt=null and
    // re-run. Return 5xx so Stripe knows to retry.
    await prisma.stripeWebhookEvent.update({
      where: { id: event.id },
      data: { status: outcome, processedAt: null },
    });
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  await prisma.stripeWebhookEvent.update({
    where: { id: event.id },
    data: {
      status: outcome,
      // Both PROCESSED and IGNORED are terminal — set processedAt so the
      // dedupe gate at the top short-circuits future redeliveries.
      processedAt: new Date(),
    },
  });

  return NextResponse.json({ received: true });
}
