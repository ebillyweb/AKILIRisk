import { execSync } from "node:child_process";
import { test, expect } from "@playwright/test";
import Stripe from "stripe";
import { PLAYWRIGHT_REPO_ROOT } from "../helpers/repo-root";

/**
 * Webhook idempotency + signature gating on `/api/webhooks/stripe`.
 *
 * Requirements:
 *  - `STRIPE_WEBHOOK_SECRET` must be set in BOTH the test runner's
 *    environment AND the deployed app's environment, with the same value.
 *    Without it we can't forge a valid signature, so we skip the whole
 *    file with a visible reason rather than passing silently.
 *  - The deployed app's webhook route must accept POST /api/webhooks/stripe.
 *
 * Coverage:
 *  - Idempotency: same event.id delivered twice → second call returns
 *    `deduped: true` (regression for the "no idempotency table" round-4 finding).
 *  - Bad signature: returns 400 and does NOT create a StripeWebhookEvent
 *    row (signature is the gate to even processing).
 *
 * Out of scope here (require staging-DB Subscription mutation, fragile):
 *  - Ordering: stale event arriving after newer one is dropped. Helper
 *    function `isEventNewerThanCurrent` is exercised via the new
 *    integration path; deferred unit/integration coverage to a follow-up
 *    that uses a dedicated test fixture user.
 *  - Status mapping: unknown Stripe status fails closed. Covered by the
 *    pure-function map in `src/lib/billing/stripe-status.ts` — would
 *    benefit from a vitest unit test, not a smoke test.
 */

const WEBHOOK_PATH = "/api/webhooks/stripe";
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

function playwrightBaseHostname(): string {
  try {
    return new URL(
      process.env.PLAYWRIGHT_BASE_URL ?? "https://preview.akilirisk.com"
    ).hostname;
  } catch {
    return "preview.akilirisk.com";
  }
}

/** Remote preview/staging often omits STRIPE_WEBHOOK_SECRET; local secret cannot fix 500 from the server. */
function stripeWebhookRemoteE2EAllowed(): boolean {
  const h = playwrightBaseHostname();
  const isLocal = h === "localhost" || h === "127.0.0.1";
  if (isLocal) return true;
  return process.env.E2E_STRIPE_WEBHOOK_REMOTE === "1";
}
const TEST_RUN_ID = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const TEST_EVENT_ID_PREFIX = `evt_test_${TEST_RUN_ID}`;

// `stripe` is already a runtime dep (used by the route). We initialize a
// dummy client just for `webhooks.generateTestHeaderString` — no real
// API key needed for that call.
const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY?.trim() || "sk_test_smoke_unused",
  { apiVersion: "2025-09-30.clover" }
);

interface FakeStripeEventOptions {
  /** Stripe event.id. Must start with `evt_test_` so the cleanup helper
   *  will delete it; we enforce that with the prefix above. */
  id: string;
  /** event.type. Use a non-subscription type so the route hits `default:`
   *  and we don't write to the Subscription table. */
  type?: string;
  /** Unix-seconds event.created timestamp. */
  createdAt?: number;
}

function buildFakeEvent({ id, type = "ping", createdAt }: FakeStripeEventOptions) {
  return {
    id,
    object: "event",
    api_version: "2025-09-30.clover",
    created: createdAt ?? Math.floor(Date.now() / 1000),
    type,
    data: { object: { id, object: "ping" } },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
  };
}

async function postEvent(
  request: import("@playwright/test").APIRequestContext,
  rawBody: string,
  signature: string
) {
  return request.post(WEBHOOK_PATH, {
    data: rawBody,
    headers: {
      "stripe-signature": signature,
      "content-type": "application/json",
    },
  });
}

test.describe("stripe webhook endpoint", () => {
  test.skip(
    !WEBHOOK_SECRET.trim() || !stripeWebhookRemoteE2EAllowed(),
    !WEBHOOK_SECRET.trim()
      ? "STRIPE_WEBHOOK_SECRET must be set in the test environment (matching the deployed app's value) to forge valid signatures"
      : "Stripe webhook e2e uses localhost by default: set PLAYWRIGHT_BASE_URL=http://localhost:3000 with STRIPE_WEBHOOK_SECRET on the app, or set E2E_STRIPE_WEBHOOK_REMOTE=1 when the remote deployment has the same secret"
  );

  test.afterAll(() => {
    // Best-effort cleanup of any rows we created. Prefix-scoped so we
    // never touch real Stripe event ids.
    try {
      execSync(
        `node scripts/delete-stripe-webhook-events.js ${TEST_EVENT_ID_PREFIX}`,
        { stdio: "pipe", cwd: PLAYWRIGHT_REPO_ROOT, env: process.env }
      );
    } catch (e) {
      console.warn("[stripe-webhook spec] cleanup helper failed:", e);
    }
  });

  test("same event.id delivered twice → second call is deduped (no double-processing)", async ({
    request,
  }) => {
    const eventId = `${TEST_EVENT_ID_PREFIX}_dedupe`;
    const fakeEvent = buildFakeEvent({ id: eventId });
    const rawBody = JSON.stringify(fakeEvent);

    const signature = stripe.webhooks.generateTestHeaderString({
      payload: rawBody,
      secret: WEBHOOK_SECRET,
    });

    // First delivery: signature verified, event recorded, hits default:
    // arm (unhandled type), terminal outcome IGNORED.
    const first = await postEvent(request, rawBody, signature);
    expect(first.status(), await first.text()).toBe(200);
    const firstBody = (await first.json()) as { received?: boolean; deduped?: boolean };
    expect(firstBody.received).toBe(true);
    expect(firstBody.deduped, "first delivery shouldn't be deduped").toBeFalsy();

    // Second delivery: same event.id → dedupe gate fires. Body should
    // include `deduped: true` so a redelivery is observable in logs.
    const second = await postEvent(request, rawBody, signature);
    expect(second.status()).toBe(200);
    const secondBody = (await second.json()) as { received?: boolean; deduped?: boolean };
    expect(secondBody.received).toBe(true);
    expect(secondBody.deduped, "second delivery should be deduped").toBe(true);
  });

  test("bad signature → 400 and no StripeWebhookEvent row created", async ({
    request,
  }) => {
    const eventId = `${TEST_EVENT_ID_PREFIX}_badsig`;
    const fakeEvent = buildFakeEvent({ id: eventId });
    const rawBody = JSON.stringify(fakeEvent);

    // A signature constructed with the wrong secret. Stripe's verifier
    // computes HMAC-SHA256 over `<timestamp>.<payload>`; the wrong secret
    // produces a header whose digest doesn't match.
    const badSignature = stripe.webhooks.generateTestHeaderString({
      payload: rawBody,
      secret: "whsec_wrong_secret_for_test",
    });

    const resp = await postEvent(request, rawBody, badSignature);
    expect(resp.status()).toBe(400);

    // Replay the same event.id with a VALID signature. If the bad-signature
    // call had wrongly written a StripeWebhookEvent row, the replay's
    // dedupe gate would short-circuit; instead we expect first-time
    // processing (received: true, deduped falsy). That asserts no row was
    // created on the bad-signature call.
    const goodSignature = stripe.webhooks.generateTestHeaderString({
      payload: rawBody,
      secret: WEBHOOK_SECRET,
    });
    const replay = await postEvent(request, rawBody, goodSignature);
    expect(replay.status()).toBe(200);
    const replayBody = (await replay.json()) as { received?: boolean; deduped?: boolean };
    expect(replayBody.received).toBe(true);
    expect(
      replayBody.deduped,
      "bad-signature call must NOT have created a dedupe row"
    ).toBeFalsy();
  });
});
