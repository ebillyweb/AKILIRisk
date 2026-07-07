#!/usr/bin/env node
/**
 * Delete the preview.akilirisk.com Stripe webhook on whichever test account
 * STRIPE_SECRET_KEY points at. Use this on the *duplicate* sandbox only.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/delete-stripe-preview-webhook.mjs
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/delete-stripe-preview-webhook.mjs --dry-run
 */
import Stripe from "stripe";

const PREVIEW_WEBHOOK_URL = "https://preview.akilirisk.com/api/webhooks/stripe";
const dryRun = process.argv.includes("--dry-run");

const key = process.env.STRIPE_SECRET_KEY?.trim();
if (!key) {
  console.error("Set STRIPE_SECRET_KEY to the duplicate sandbox's sk_test_… key.");
  process.exit(1);
}

const stripe = new Stripe(key, { apiVersion: "2026-02-25.clover" });

const account = await stripe.accounts.retrieve();
console.log(`Account: ${account.id} (${account.settings?.dashboard?.display_name ?? "unnamed"})`);

const { data: endpoints } = await stripe.webhookEndpoints.list({ limit: 20 });
const matches = endpoints.filter((ep) => ep.url === PREVIEW_WEBHOOK_URL);

if (matches.length === 0) {
  console.log(`No webhook endpoint for ${PREVIEW_WEBHOOK_URL} on this account.`);
  process.exit(0);
}

for (const ep of matches) {
  console.log(`Found ${ep.id} status=${ep.status} created=${new Date(ep.created * 1000).toISOString()}`);
  if (dryRun) {
    console.log(`[dry-run] would delete ${ep.id}`);
    continue;
  }
  await stripe.webhookEndpoints.del(ep.id);
  console.log(`Deleted ${ep.id}`);
}
