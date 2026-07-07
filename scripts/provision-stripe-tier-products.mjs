#!/usr/bin/env node
/**
 * Create (or reuse) Stripe Products + recurring Prices for AKILI modular tiers:
 * Essentials, Professional, Business, Platinum — monthly and annual.
 *
 * Annual prices apply a 2-month discount vs 12× monthly (pay for 10 months).
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/provision-stripe-tier-products.mjs
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/provision-stripe-tier-products.mjs --dry-run
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/provision-stripe-tier-products.mjs --live
 *
 * Prints .env lines to paste into `.env.local` / Vercel.
 */

import process from "node:process";

const TIERS = [
  {
    key: "ESSENTIALS",
    productName: "Essentials",
    description: "Assessment + Reports + Client Plan",
    monthlyCents: 14900,
  },
  {
    key: "PROFESSIONAL",
    productName: "Professional",
    description: "Advisor customization + Enterprise overlays",
    monthlyCents: 29900,
  },
  {
    key: "BUSINESS",
    productName: "Business",
    description: "Implementation tracking + milestones",
    monthlyCents: 49900,
  },
  {
    key: "PLATINUM",
    productName: "Platinum",
    description: "Continuous monitoring + reassessments + analytics",
    monthlyCents: 79900,
  },
];

function parseArgs(argv) {
  return {
    dryRun: argv.includes("--dry-run"),
    live: argv.includes("--live"),
    help: argv.includes("--help") || argv.includes("-h"),
  };
}

async function stripeRequest(secretKey, path, body, method = "POST") {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error?.message || `Stripe ${path} failed (${res.status})`);
  }
  return json;
}

async function findProductByName(secretKey, name) {
  const list = await stripeRequest(
    secretKey,
    `/products?limit=100&active=true`,
    null,
    "GET"
  );
  return (list.data || []).find(
    (p) => String(p.name || "").toLowerCase() === name.toLowerCase()
  );
}

async function findPrice(secretKey, productId, interval) {
  const list = await stripeRequest(
    secretKey,
    `/prices?product=${productId}&active=true&limit=100`,
    null,
    "GET"
  );
  return (list.data || []).find(
    (p) => p.recurring?.interval === interval && p.type === "recurring"
  );
}

async function ensureProduct(secretKey, { productName, description }, dryRun) {
  const existing = await findProductByName(secretKey, productName);
  if (existing) {
    console.log(`Product exists: ${productName} (${existing.id})`);
    return existing.id;
  }
  if (dryRun) {
    console.log(`[dry-run] would create product: ${productName}`);
    return `prod_dry_${productName.toLowerCase()}`;
  }
  const created = await stripeRequest(secretKey, "/products", {
    name: productName,
    description,
    "metadata[tier_key]": productName.toLowerCase(),
  });
  console.log(`Created product: ${productName} (${created.id})`);
  return created.id;
}

async function ensurePrice(
  secretKey,
  { productId, unitAmount, interval, nickname },
  dryRun
) {
  const existing = await findPrice(secretKey, productId, interval);
  if (existing?.unit_amount === unitAmount) {
    console.log(`Price exists: ${nickname} (${existing.id})`);
    return existing.id;
  }
  if (existing) {
    console.warn(
      `Price mismatch for ${nickname}; existing ${existing.id} has ${existing.unit_amount}, wanted ${unitAmount}. Create a new price in Dashboard or archive the old one.`
    );
    return existing.id;
  }
  if (dryRun) {
    console.log(`[dry-run] would create price: ${nickname} $${unitAmount / 100}/${interval}`);
    return `price_dry_${nickname}`;
  }
  const created = await stripeRequest(secretKey, "/prices", {
    product: productId,
    currency: "usd",
    unit_amount: String(unitAmount),
    "recurring[interval]": interval,
    nickname,
  });
  console.log(`Created price: ${nickname} (${created.id})`);
  return created.id;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log("See script header for usage.");
    process.exit(0);
  }

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    console.error("Set STRIPE_SECRET_KEY (sk_test_… or sk_live_…).");
    process.exit(1);
  }
  if (opts.live && !secretKey.startsWith("sk_live_")) {
    console.error("--live requires sk_live_…");
    process.exit(1);
  }
  if (!opts.live && secretKey.startsWith("sk_live_")) {
    console.warn("Using live key without --live flag.");
  }

  /** @type {Record<string, string>} */
  const envOut = {};

  for (const tier of TIERS) {
    const productId = await ensureProduct(
      secretKey,
      tier,
      opts.dryRun
    );
    const monthlyId = await ensurePrice(
      secretKey,
      {
        productId,
        unitAmount: tier.monthlyCents,
        interval: "month",
        nickname: `${tier.productName} monthly`,
      },
      opts.dryRun
    );
    const annualCents = tier.monthlyCents * 10;
    const annualId = await ensurePrice(
      secretKey,
      {
        productId,
        unitAmount: annualCents,
        interval: "year",
        nickname: `${tier.productName} annual`,
      },
      opts.dryRun
    );
    envOut[`STRIPE_PRICE_${tier.key}_MONTHLY`] = monthlyId;
    envOut[`STRIPE_PRICE_${tier.key}_ANNUAL`] = annualId;
  }

  console.log("\n# Paste into .env.local / Vercel:\n");
  for (const [key, value] of Object.entries(envOut)) {
    console.log(`${key}="${value}"`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
