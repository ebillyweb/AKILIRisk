#!/usr/bin/env npx tsx
/**
 * Copy an enterprise firm's configuration from Preview → Production.
 *
 * Copies branding, team access policies, methodology (pillars, questions, intake,
 * narratives, recommendation rules, solution customizations), and household profiles
 * policy. Does NOT copy billing, seats, memberships, clients, or subdomain DNS.
 *
 * The enterprise must already exist on both databases with the same slug.
 *
 * Usage:
 *   npm run copy:enterprise-settings -- --slug=belvedere --dry-run
 *   npm run copy:enterprise-settings -- --slug=belvedere --confirm-production
 *   npm run copy:enterprise-settings -- --slug=belvedere --confirm-production --sync-members
 *
 * Env files (repo root):
 *   --source-env=.env.preview       (default)
 *   --target-env=.env.production    (default)
 *
 * Or set SOURCE_DATABASE_URL / TARGET_DATABASE_URL directly.
 *
 * Safety:
 *   Production writes require --confirm-production (or CONFIRM_PRODUCTION=1).
 *   Use --dry-run first to inspect counts.
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  copyEnterpriseSettings,
  type CopyEnterpriseSettingsResult,
} from "./lib/copy-enterprise-settings";
import { requireEnvFileValue } from "./lib/parse-env-file";
import {
  createPrismaClient,
  disconnectPrismaBundle,
} from "./lib/prisma-from-url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

type CliOptions = {
  slug: string;
  dryRun: boolean;
  confirmProduction: boolean;
  syncMembers: boolean;
  skipLogo: boolean;
  sourceEnvPath: string;
  targetEnvPath: string;
  sourceDatabaseUrl?: string;
  targetDatabaseUrl?: string;
};

function parseArgs(argv: string[]): CliOptions {
  let slug = process.env.ENTERPRISE_SLUG?.trim() ?? "";
  let dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
  let confirmProduction =
    process.env.CONFIRM_PRODUCTION === "1" || process.env.CONFIRM_PRODUCTION === "true";
  let syncMembers = false;
  let skipLogo = false;
  let sourceEnvPath = resolve(repoRoot, ".env.preview");
  let targetEnvPath = resolve(repoRoot, ".env.production");
  let sourceDatabaseUrl = process.env.SOURCE_DATABASE_URL?.trim();
  let targetDatabaseUrl = process.env.TARGET_DATABASE_URL?.trim();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--confirm-production") {
      confirmProduction = true;
    } else if (arg === "--sync-members") {
      syncMembers = true;
    } else if (arg === "--skip-logo") {
      skipLogo = true;
    } else if (arg.startsWith("--slug=")) {
      slug = arg.slice("--slug=".length).trim();
    } else if (arg === "--slug" && argv[i + 1]) {
      slug = argv[++i]!.trim();
    } else if (arg.startsWith("--source-env=")) {
      sourceEnvPath = resolve(repoRoot, arg.slice("--source-env=".length));
    } else if (arg.startsWith("--target-env=")) {
      targetEnvPath = resolve(repoRoot, arg.slice("--target-env=".length));
    } else if (arg.startsWith("--source-database-url=")) {
      sourceDatabaseUrl = arg.slice("--source-database-url=".length).trim();
    } else if (arg.startsWith("--target-database-url=")) {
      targetDatabaseUrl = arg.slice("--target-database-url=".length).trim();
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!slug) {
    throw new Error("Missing required --slug=<enterprise-slug>");
  }

  return {
    slug,
    dryRun,
    confirmProduction,
    syncMembers,
    skipLogo,
    sourceEnvPath,
    targetEnvPath,
    sourceDatabaseUrl,
    targetDatabaseUrl,
  };
}

function printHelp(): void {
  console.log(`Copy enterprise settings from Preview to Production.

Options:
  --slug=<slug>                 Enterprise slug (required)
  --dry-run                     Preview counts only; no writes
  --confirm-production          Required to write to the target database
  --sync-members                Push firm methodology to active team advisors on target
  --skip-logo                   Do not copy logo object between S3 branding buckets
  --source-env=<path>           Source env file (default: .env.preview)
  --target-env=<path>           Target env file (default: .env.production)
  --source-database-url=<url>   Override source DATABASE_URL
  --target-database-url=<url>   Override target DATABASE_URL

Environment overrides:
  SOURCE_DATABASE_URL, TARGET_DATABASE_URL, ENTERPRISE_SLUG
  DRY_RUN=1, CONFIRM_PRODUCTION=1
`);
}

function maskDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = "***";
    return parsed.toString();
  } catch {
    return "<invalid-url>";
  }
}

function printSummary(result: CopyEnterpriseSettingsResult): void {
  console.log(JSON.stringify(result.summary, null, 2));
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const sourceUrl =
    options.sourceDatabaseUrl ??
    requireEnvFileValue(options.sourceEnvPath, "DATABASE_URL");
  const targetUrl =
    options.targetDatabaseUrl ??
    requireEnvFileValue(options.targetEnvPath, "DATABASE_URL");

  if (sourceUrl === targetUrl) {
    throw new Error("Source and target DATABASE_URL must differ");
  }

  if (!options.dryRun && !options.confirmProduction) {
    throw new Error(
      "Refusing to write to production without --confirm-production (or CONFIRM_PRODUCTION=1). Run with --dry-run first.",
    );
  }

  console.log(options.dryRun ? "--- DRY RUN ---" : "--- APPLY ---");
  console.log({
    slug: options.slug,
    source: maskDatabaseUrl(sourceUrl),
    target: maskDatabaseUrl(targetUrl),
    sourceEnv: options.sourceEnvPath,
    targetEnv: options.targetEnvPath,
    copyLogo: !options.skipLogo,
    syncMembers: options.syncMembers,
  });

  const source = createPrismaClient("preview", sourceUrl);
  const target = createPrismaClient("production", targetUrl);

  try {
    const result = await copyEnterpriseSettings({
      slug: options.slug,
      dryRun: options.dryRun,
      copyLogo: !options.skipLogo,
      syncMembers: options.syncMembers,
      source,
      target,
      sourceEnvPath: options.sourceEnvPath,
      targetEnvPath: options.targetEnvPath,
    });
    printSummary(result);
  } finally {
    await Promise.all([
      disconnectPrismaBundle(source),
      disconnectPrismaBundle(target),
    ]);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
