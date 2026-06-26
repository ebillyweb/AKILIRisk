#!/usr/bin/env node
/**
 * 1) Calls Stripe CLI (`stripe prices list --live`) to discover live Price IDs
 *    for products named Essentials, Professional, Business, and Platinum (monthly + annual).
 * 2) Upserts those plus live API keys to Vercel **Production** only.
 *
 * Prerequisites:
 *   - `stripe` on PATH (Stripe CLI)
 *   - `npx vercel link` and `vercel login`
 *   - A **live** secret key with permission to list prices (restricted keys need read on Prices)
 *
 * Required (either env or --secrets-file=):
 *   STRIPE_SECRET_KEY   sk_live_…  (also used as `--api-key` for the CLI)
 *   STRIPE_LIVE_PUBLISHABLE_KEY   pk_live_…
 *
 * Optional:
 *   STRIPE_LIVE_WEBHOOK_SECRET   whsec_…  (Dashboard signing secret for prod webhook URL)
 *   --include-webhook            Also push STRIPE_LIVE_WEBHOOK_SECRET / STRIPE_WEBHOOK_SECRET from file
 *   --secrets-file=<path>        Parse STRIPE_SECRET_KEY / NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY / STRIPE_WEBHOOK_SECRET
 *                                 (must be **live** values for production)
 *   --dry-run
 *   --help
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const TIER_BY_PRODUCT = {
  essentials: "ESSENTIALS",
  professional: "PROFESSIONAL",
  business: "BUSINESS",
  platinum: "PLATINUM",
  // Legacy product names during migration
  starter: "ESSENTIALS",
  growth: "PROFESSIONAL",
};

function usage() {
  console.log(`Usage: node scripts/sync-vercel-stripe-live-production.mjs [options]

Requires STRIPE_SECRET_KEY + STRIPE_LIVE_PUBLISHABLE_KEY in the environment, or a
--secrets-file= path containing live STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.

Options:
  --secrets-file=<path>   Load live keys from this dotenv file (sk_live / pk_live)
  --include-webhook       Also sync STRIPE_WEBHOOK_SECRET (from env or secrets file)
  --dry-run
  --help

Example:
  STRIPE_SECRET_KEY=sk_live_xxx STRIPE_LIVE_PUBLISHABLE_KEY=pk_live_xxx \\
    node scripts/sync-vercel-stripe-live-production.mjs --dry-run`);
}

function parseArgs(argv) {
  const out = {
    secretsFile: null,
    dryRun: false,
    includeWebhook: false,
    help: false,
  };
  for (const a of argv) {
    if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--include-webhook") out.includeWebhook = true;
    else if (a.startsWith("--secrets-file="))
      out.secretsFile = a.slice("--secrets-file=".length);
  }
  return out;
}

function parseEnvFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const map = new Map();
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    map.set(key, val);
  }
  return map;
}

/** @param {string} skLive */
function fetchLivePricesJson(skLive) {
  const out = execFileSync(
    "stripe",
    [
      "prices",
      "list",
      "--live",
      "--api-key",
      skLive,
      "--limit",
      "100",
      "--expand",
      "data.product",
      "--color",
      "off",
    ],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }
  );
  return JSON.parse(out);
}

/**
 * @param {*} listJson
 * @returns {Record<string, string>}
 */
function pricesToStripePriceEnv(listJson) {
  /** @type {Record<string, string>} */
  const out = {};
  const seen = new Set();
  for (const row of listJson.data || []) {
    if (!row?.id || row.active !== true) continue;
    if (row.livemode !== true) {
      console.warn("Skipping non-live price:", row.id);
      continue;
    }
    const product = row.product;
    const rawName =
      typeof product === "object" && product && "name" in product
        ? String(product.name || "").trim().toLowerCase()
        : "";
    const tier = TIER_BY_PRODUCT[rawName];
    if (!tier) continue;
    const interval = row.recurring?.interval;
    const cycle =
      interval === "month" ? "MONTHLY" : interval === "year" ? "ANNUAL" : null;
    if (!cycle) continue;
    const envKey = `STRIPE_PRICE_${tier}_${cycle}`;
    if (seen.has(envKey)) {
      console.warn("Duplicate live price for", envKey, "- keeping first:", out[envKey], "ignoring", row.id);
      continue;
    }
    seen.add(envKey);
    out[envKey] = row.id;
  }
  return out;
}

function runVercel(vercelArgs, opts) {
  const full = ["vercel", ...vercelArgs];
  if (opts.dryRun) {
    const a = [...vercelArgs];
    const vi = a.lastIndexOf("--value");
    if (vi !== -1) a.splice(vi, 2, "--value", "<redacted>");
    console.log("[dry-run] npx vercel", a.join(" "));
    return;
  }
  execFileSync("npx", full, { stdio: "inherit", cwd: opts.cwd });
}

function wantsSensitive(key) {
  return key === "STRIPE_SECRET_KEY" || key === "STRIPE_WEBHOOK_SECRET";
}

/** @param {{ key: string; value: string; dryRun: boolean; cwd: string }} p */
function upsertProduction(p) {
  const { key, value, dryRun, cwd } = p;
  const sens = wantsSensitive(key) ? ["--sensitive"] : [];
  const updateBase = ["env", "update", key, "production", "--yes", ...sens, "--value", value];
  const addBase = ["env", "add", key, "production", "--yes", ...sens, "--value", value];
  try {
    runVercel(updateBase, { dryRun, cwd });
  } catch {
    runVercel(addBase, { dryRun, cwd });
  }
}

const opts = parseArgs(process.argv.slice(2));
if (opts.help) {
  usage();
  process.exit(0);
}

const cwd = process.cwd();
/** @type {Map<string, string>} */
let fromFile = new Map();
if (opts.secretsFile) {
  const fp = path.resolve(cwd, opts.secretsFile);
  if (!fs.existsSync(fp)) {
    console.error("Secrets file not found:", fp);
    process.exit(1);
  }
  fromFile = parseEnvFile(fp);
}

const skLive =
  process.env.STRIPE_SECRET_KEY?.trim() ||
  fromFile.get("STRIPE_SECRET_KEY")?.trim() ||
  "";
const pkLive =
  process.env.STRIPE_LIVE_PUBLISHABLE_KEY?.trim() ||
  fromFile.get("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY")?.trim() ||
  "";

if (!skLive.startsWith("sk_live_")) {
  console.error(
    "Set STRIPE_SECRET_KEY (sk_live_…) or provide --secrets-file= with live STRIPE_SECRET_KEY."
  );
  process.exit(1);
}
if (!pkLive.startsWith("pk_live_")) {
  console.error(
    "Set STRIPE_LIVE_PUBLISHABLE_KEY (pk_live_…) or provide --secrets-file= with live NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY."
  );
  process.exit(1);
}

console.log("Fetching live Stripe prices via CLI…");
const listJson = fetchLivePricesJson(skLive);
const priceEnv = pricesToStripePriceEnv(listJson);

const requiredKeys = [
  "STRIPE_PRICE_ESSENTIALS_MONTHLY",
  "STRIPE_PRICE_ESSENTIALS_ANNUAL",
  "STRIPE_PRICE_PROFESSIONAL_MONTHLY",
  "STRIPE_PRICE_PROFESSIONAL_ANNUAL",
  "STRIPE_PRICE_BUSINESS_MONTHLY",
  "STRIPE_PRICE_BUSINESS_ANNUAL",
  "STRIPE_PRICE_PLATINUM_MONTHLY",
  "STRIPE_PRICE_PLATINUM_ANNUAL",
];
const missing = requiredKeys.filter((k) => !priceEnv[k]);
if (missing.length) {
  console.error(
    "Could not map live prices for:",
    missing.join(", "),
    "\nEnsure Stripe live products are named Essentials, Professional, Business, and Platinum (check Dashboard)."
  );
  process.exit(1);
}

console.log(
  "Mapped live prices:",
  requiredKeys.map((k) => `${k}=${priceEnv[k]}`).join(", ")
);

const toPush = {
  STRIPE_SECRET_KEY: skLive,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: pkLive,
  ...priceEnv,
};

if (opts.includeWebhook) {
  const wh =
    process.env.STRIPE_LIVE_WEBHOOK_SECRET?.trim() ||
    fromFile.get("STRIPE_WEBHOOK_SECRET")?.trim() ||
    "";
  if (!wh.startsWith("whsec_")) {
    console.error("Use STRIPE_LIVE_WEBHOOK_SECRET or STRIPE_WEBHOOK_SECRET in secrets file (whsec_…).");
    process.exit(1);
  }
  toPush.STRIPE_WEBHOOK_SECRET = wh;
}

console.log(
  `Upserting ${Object.keys(toPush).length} variable(s) to Vercel Production` +
    (opts.dryRun ? " (dry-run)" : "") +
    "…"
);

for (const [key, value] of Object.entries(toPush)) {
  upsertProduction({ key, value, dryRun: opts.dryRun, cwd });
}

console.log(opts.dryRun ? "Dry run complete." : "Done.");
