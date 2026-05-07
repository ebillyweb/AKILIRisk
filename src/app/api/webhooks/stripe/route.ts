import { NextResponse } from "next/server";
import { Prisma, type WebhookProcessStatus } from "@prisma/client";
import type Stripe from "stripe";

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

/**
 * Atomically claim this event for processing.
 *
 * Returns:
 *   - "claimed" → we own this event and should run the handler. The
 *     StripeWebhookEvent row is in RECEIVED state.
 *   - "deduped" → another delivery already terminated (PROCESSED/IGNORED)
 *     or is currently in-flight (RECEIVED). Caller should return 200 with
 *     `deduped: true`. The handler must NOT run.
 *
 * Round-6 fix: replaces the prior read-then-upsert dedupe gate, which had a
 * TOCTOU race — two simultaneous redeliveries could both pass the
 * `prior?.processedAt` check, both reset the row to RECEIVED, and both run
 * the handler in parallel. The new shape uses INSERT-or-fail semantics:
 * the unique primary key on `id` (Stripe's event.id) gives us atomic
 * claiming for free, and the FAILED-row reclaim is a conditional updateMany
 * that ensures only one in-flight retry can win.
 */
async function claimWebhookEvent(
  eventId: string,
  eventType: string,
  eventCreatedAt: Date
): Promise<"claimed" | "deduped"> {
  try {
    await prisma.stripeWebhookEvent.create({
      data: {
        id: eventId,
        eventType,
        eventCreated: eventCreatedAt,
        status: "RECEIVED",
      },
    });
    return "claimed";
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      // Row already exists. Atomically reclaim it if and only if the
      // previous attempt has reached a non-terminal state we're allowed
      // to retake:
      //
      //   • status = FAILED — a previous handler threw; Stripe's retry
      //     can re-run.
      //   • status = RECEIVED with stale receivedAt — the previous
      //     handler crashed (OOM kill, function timeout) before it
      //     could mark the row PROCESSED/IGNORED/FAILED. Without this
      //     branch the row would sit in RECEIVED forever and every
      //     redelivery would dedupe, silently dropping the event.
      //
      // PROCESSED and IGNORED are terminal — both leave processedAt
      // set, and we want subsequent redeliveries to dedupe. RECEIVED
      // rows younger than the threshold are presumed in-flight from a
      // concurrent retry and dedupe correctly.
      //
      // The threshold should comfortably exceed our worst-case handler
      // latency. Vercel's Hobby/Pro function timeout is 60s/300s; 5
      // minutes is a safe cushion.
      const STALE_RECEIVED_MS = 5 * 60 * 1000;
      const staleCutoff = new Date(Date.now() - STALE_RECEIVED_MS);
      const reclaim = await prisma.stripeWebhookEvent.updateMany({
        where: {
          id: eventId,
          OR: [
            { status: "FAILED" },
            { status: "RECEIVED", receivedAt: { lt: staleCutoff } },
          ],
        },
        data: {
          status: "RECEIVED",
          receivedAt: new Date(),
          processedAt: null,
        },
      });
      if (reclaim.count === 0) {
        return "deduped";
      }
      return "claimed";
    }
    throw err;
  }
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

  const eventCreatedAt = new Date(event.created * 1000);

  // Atomic dedupe + claim. See claimWebhookEvent comment.
  const claim = await claimWebhookEvent(event.id, event.type, eventCreatedAt);
  if (claim === "deduped") {
    return NextResponse.json({ received: true, deduped: true });
  }

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

        const stripe = getStripe();
        const sub = await stripe.subscriptions.retrieve(subId, {
          expand: ["latest_invoice"],
        });
        const result = await upsertSubscriptionFromStripe(
          userId,
          sub,
          customerId,
          prisma,
          eventCreatedAt
        );
        if (!result.applied) {
          // Stale event — a newer one already advanced the subscription's
          // lastStripeEventAt. Mark IGNORED and exit; nothing to redo.
          outcome = "IGNORED";
        }
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

        const result = await upsertSubscriptionFromStripe(
          userId,
          sub,
          customerId,
          prisma,
          eventCreatedAt
        );
        if (!result.applied) {
          outcome = "IGNORED";
        }
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

        const result = await upsertSubscriptionFromStripe(
          userId,
          sub,
          customerId,
          prisma,
          eventCreatedAt
        );
        if (!result.applied) {
          outcome = "IGNORED";
          break;
        }
        // Only append the audit log when the subscription update actually
        // applied. A stale payment_failed event shouldn't add a misleading
        // audit row to a subscription that has since recovered.
        await appendSubscriptionAuditLog(prisma, result.row.id, "payment_failed", {
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

        const result = await upsertSubscriptionFromStripe(
          userId,
          sub,
          customerId,
          prisma,
          eventCreatedAt
        );
        if (!result.applied) {
          outcome = "IGNORED";
        }
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
    // Mark FAILED in finally; Stripe's retry will see a FAILED row and
    // re-claim it via claimWebhookEvent's reclaim path. Return 5xx so
    // Stripe knows to retry.
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
      // Both PROCESSED and IGNORED are terminal — set processedAt so a
      // redelivery dedupes via claimWebhookEvent's RECEIVED-skip path.
      processedAt: new Date(),
    },
  });

  return NextResponse.json({ received: true });
}
