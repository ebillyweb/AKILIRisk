#!/usr/bin/env node
/**
 * Push Stripe + billing toggles from a local env file into the linked Vercel project
 * for Preview (one Git branch) and Development only — never Production.
 *
 * Prerequisites: `npx vercel link` in the repo; logged-in CLI (`vercel login`).
 *
 * Usage:
 *   node scripts/sync-vercel-stripe-env.mjs
 *   node scripts/sync-vercel-stripe-env.mjs --file=.env.production   # explicit source file
 *   node scripts/sync-vercel-stripe-env.mjs --dry-run
 *   node scripts/sync-vercel-stripe-env.mjs --include-webhook   # also sync STRIPE_WEBHOOK_SECRET → Preview only
 *
 * Env:
 *   VERCEL_SYNC_PREVIEW_BRANCH=staging   # default: staging
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const DEFAULT_KEYS = [
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_PRICE_ESSENTIALS_MONTHLY",
  "STRIPE_PRICE_ESSENTIALS_ANNUAL",
  "STRIPE_PRICE_PROFESSIONAL_MONTHLY",
  "STRIPE_PRICE_PROFESSIONAL_ANNUAL",
  "STRIPE_PRICE_BUSINESS_MONTHLY",
  "STRIPE_PRICE_BUSINESS_ANNUAL",
  "STRIPE_PRICE_PLATINUM_MONTHLY",
  "STRIPE_PRICE_PLATINUM_ANNUAL",
  "STRIPE_SECRET_KEY",
  "BILLING_GRACE_PERIOD_DAYS",
  "DEFAULT_MIGRATION_TIER",
  "ENABLE_BILLING_FEATURES",
];

function usage() {
  console.log(`Usage: node scripts/sync-vercel-stripe-env.mjs [options]

Options:
  --file=<path>              Source env file (default: .env.local)
  --preview-branch=<name>    Vercel Preview Git branch target (default: staging or VERCEL_SYNC_PREVIEW_BRANCH)
  --include-webhook          Also sync STRIPE_WEBHOOK_SECRET to Preview (branch) only
  --dry-run                  Print npx vercel … commands without running
  --help                     Show this message

Does not modify Production. STRIPE_WEBHOOK_SECRET is omitted by default (local stripe listen
secret ≠ Dashboard signing secret for https://your-preview…/api/webhooks/stripe).`);
}

function parseArgs(argv) {
  const out = {
    file: null,
    previewBranch: process.env.VERCEL_SYNC_PREVIEW_BRANCH?.trim() || "staging",
    dryRun: false,
    includeWebhook: false,
    help: false,
  };
  for (const a of argv) {
    if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--include-webhook") out.includeWebhook = true;
    else if (a.startsWith("--file=")) {
      const v = a.slice("--file=".length).trim();
      out.file = v || null;
    }
    else if (a.startsWith("--preview-branch="))
      out.previewBranch = a.slice("--preview-branch=".length).trim() || out.previewBranch;
  }
  return out;
}

/** Minimal KEY=value / KEY="value" parser; skips blanks and # comments. */
function parseEnvFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  /** @type {Map<string, string>} */
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

function resolveSourceEnvPath(cwd, explicitFile) {
  if (explicitFile) return path.resolve(cwd, explicitFile);
  return path.resolve(cwd, ".env.local");
}

function wantsSensitive(key, env) {
  if (env !== "preview") return false;
  return key === "STRIPE_SECRET_KEY" || key === "STRIPE_WEBHOOK_SECRET";
}

/**
 * @param {string[]} vercelArgs arguments after `vercel` (e.g. ['env','update',...])
 * @param {{ dryRun: boolean; cwd: string }} opts
 */
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

/**
 * Update if present; otherwise add.
 * @param {{ key: string; value: string; env: 'preview' | 'development'; branch?: string; dryRun: boolean; cwd: string }} p
 */
function upsert(p) {
  const { key, value, env, branch, dryRun, cwd } = p;
  const mid = branch ? [env, branch] : [env];
  const sensitive = wantsSensitive(key, env);
  const sensFlag = sensitive ? ["--sensitive"] : [];

  const updateBase = ["env", "update", key, ...mid, "--yes", ...sensFlag, "--value", value];
  const addBase = ["env", "add", key, ...mid, "--yes", ...sensFlag, "--value", value];

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
const keys = [...DEFAULT_KEYS];
if (opts.includeWebhook) keys.push("STRIPE_WEBHOOK_SECRET");

const envPath = resolveSourceEnvPath(cwd, opts.file);
if (!fs.existsSync(envPath)) {
  console.error(`File not found: ${envPath}`);
  process.exit(1);
}

const map = parseEnvFile(envPath);

let missing = false;
for (const key of keys) {
  if (!map.has(key)) {
    console.error(`Missing ${key} in ${envPath}`);
    missing = true;
  }
}
if (missing) process.exit(1);

console.log(
  `Syncing ${keys.length} key(s) from ${path.relative(cwd, envPath)} → Vercel Preview (${opts.previewBranch}) + Development` +
    (opts.includeWebhook ? " (STRIPE_WEBHOOK_SECRET → Preview only)" : "")
);

for (const key of keys) {
  const value = map.get(key);
  if (key === "STRIPE_WEBHOOK_SECRET") {
    upsert({
      key,
      value,
      env: "preview",
      branch: opts.previewBranch,
      dryRun: opts.dryRun,
      cwd,
    });
    continue;
  }
  upsert({
    key,
    value,
    env: "preview",
    branch: opts.previewBranch,
    dryRun: opts.dryRun,
    cwd,
  });
  upsert({ key, value, env: "development", dryRun: opts.dryRun, cwd });
}

console.log(opts.dryRun ? "Dry run complete." : "Done.");
