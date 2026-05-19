import "server-only";

import {
  integrationProbesToDependencies,
  runIntegrationProbes,
} from "@/lib/admin/integration-probes";
import { prisma } from "@/lib/db";

/**
 * Operations health aggregation for `/admin/operations`.
 *
 * Every helper here returns plain data — no secrets, tokens, connection
 * strings, or any environment variable value is ever included in the
 * shape. Configured-vs-not is surfaced as a boolean so the dashboard can
 * truthfully say "Configured" vs "Not checked" instead of asserting
 * health for a dependency we have no signal about.
 *
 * Severity model:
 *   healthy  — checked and responding normally
 *   degraded — checked and partially impaired (slow, elevated failures)
 *   down     — checked and not responding (or failing every check)
 *   unknown  — not checked: dependency not configured, or check would
 *              require leaking a secret to a 3rd party we don't trust.
 *
 * Server-only. Admin-gated at the page layer.
 */

export type HealthStatus = "healthy" | "degraded" | "down" | "unknown";

export interface ServiceHealth {
  /** Stable id for `key={}` and css hooks. */
  id: string;
  /** Human label rendered on the card. */
  label: string;
  /** Short one-line description: what this dependency is. */
  description: string;
  status: HealthStatus;
  /** Optional short status message (e.g. "Responded in 24 ms"). */
  detail?: string;
  /** Whether the dependency is configured in this environment. When
   *  false we surface "unknown" and explain that the integration is
   *  not configured rather than implying it's healthy. */
  configured: boolean;
  /** ISO timestamp of the last outbound probe for this row (when probed). */
  probedAt?: string;
}

export interface FailedIntegrationRow {
  id: string;
  source: string;
  /** ISO timestamp of when the failure was recorded. */
  occurredAt: string;
  message: string;
}

export interface RecentErrorRow {
  id: string;
  action: string;
  /** ISO timestamp. */
  occurredAt: string;
  detail?: string;
}

export interface OperationsHealthSnapshot {
  /** Wall-clock time the snapshot was assembled (server-side). */
  generatedAt: string;
  environment: "development" | "preview" | "production" | "unknown";
  /** Whether this is the Vercel preview/prod platform (informational). */
  platform: "vercel" | "node" | "unknown";
  /** Deployment / build version string when known. Never the full commit
   *  body — at most a short SHA + branch ref. */
  build: {
    shortSha: string | null;
    ref: string | null;
    /** Commit timestamp from Vercel env (if set). */
    committedAt: string | null;
  };
  /** Roll-up across coreServices for the hero tile. */
  overall: HealthStatus;
  /** Application / API runtime — this Next.js process. */
  core: {
    app: ServiceHealth;
    database: ServiceHealth;
    auth: ServiceHealth;
  };
  /** External dependencies (Stripe, OpenAI, Resend, S3, white-label DNS).
   *  Actively probed on each snapshot via {@link runIntegrationProbes}. */
  dependencies: ServiceHealth[];
  /** StripeWebhookEvent rows with status=FAILED (last 7 days). */
  failedIntegrations: FailedIntegrationRow[];
  /** Auth-failure / magic-link-failure audit rows (last 24 h) — the
   *  closest thing the platform has to a structured error stream. */
  recentErrors: RecentErrorRow[];
  /** ISO timestamp of the most recent successful database round-trip
   *  during this snapshot. Null on database failure. */
  lastSuccessfulHealthCheck: string | null;
}

// ── Environment & build ───────────────────────────────────────────────────

function resolveEnvironment(): OperationsHealthSnapshot["environment"] {
  // VERCEL_ENV is set on Vercel deploys; falls back to NODE_ENV locally.
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === "production") return "production";
  if (vercelEnv === "preview") return "preview";
  if (vercelEnv === "development") return "development";

  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === "production") return "production";
  if (nodeEnv === "development") return "development";
  return "unknown";
}

function resolvePlatform(): OperationsHealthSnapshot["platform"] {
  if (process.env.VERCEL === "1" || process.env.VERCEL_ENV) return "vercel";
  return "node";
}

function resolveBuild(): OperationsHealthSnapshot["build"] {
  // VERCEL_GIT_COMMIT_SHA is the full SHA when on Vercel — surface only
  // the first 7 chars. VERCEL_GIT_COMMIT_REF is the branch / tag ref.
  const fullSha = process.env.VERCEL_GIT_COMMIT_SHA ?? null;
  const shortSha = fullSha ? fullSha.slice(0, 7) : null;
  const ref = process.env.VERCEL_GIT_COMMIT_REF ?? null;
  const committedAt = process.env.VERCEL_GIT_COMMIT_AUTHOR_DATE ?? null;
  return { shortSha, ref, committedAt };
}

// ── Database probe ────────────────────────────────────────────────────────

async function probeDatabase(): Promise<ServiceHealth & { rttMs: number | null }> {
  const start = Date.now();
  try {
    // Cheapest cross-DB round-trip. No PII, no row reads.
    await prisma.$queryRaw`SELECT 1`;
    const rttMs = Date.now() - start;
    return {
      id: "database",
      label: "Database",
      description: "PostgreSQL primary (Prisma)",
      configured: true,
      status: rttMs > 1500 ? "degraded" : "healthy",
      detail:
        rttMs > 1500
          ? `Responded in ${rttMs} ms — slower than usual`
          : `Responded in ${rttMs} ms`,
      rttMs,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Database probe failed";
    return {
      id: "database",
      label: "Database",
      description: "PostgreSQL primary (Prisma)",
      configured: true,
      status: "down",
      detail: redactConnectionDetails(message),
      rttMs: null,
    };
  }
}

/**
 * Strip anything that might leak a connection string from a Prisma /
 * pg error message before surfacing it on the dashboard.
 */
function redactConnectionDetails(message: string): string {
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "postgres://[redacted]")
    .replace(/password=[^\s"';&]+/gi, "password=[redacted]")
    .slice(0, 240);
}

// ── Auth dependency probe ─────────────────────────────────────────────────

function probeAuth(): ServiceHealth {
  // The auth runtime is in-process (Auth.js). We can't probe a remote
  // dependency; the meaningful signal is whether AUTH_SECRET is set.
  // We never log or display the value — only the boolean.
  const secretConfigured = Boolean(process.env.AUTH_SECRET);
  return {
    id: "auth",
    label: "Identity / Auth",
    description: "Auth.js session + credentials provider",
    configured: secretConfigured,
    status: secretConfigured ? "healthy" : "down",
    detail: secretConfigured
      ? "AUTH_SECRET configured; in-process runtime."
      : "AUTH_SECRET is not set — sign-in will fail.",
  };
}

// ── Failed integrations & recent errors ──────────────────────────────────

async function loadFailedIntegrations(): Promise<FailedIntegrationRow[]> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rows = await prisma.stripeWebhookEvent.findMany({
      where: {
        status: "FAILED",
        receivedAt: { gte: sevenDaysAgo },
      },
      orderBy: { receivedAt: "desc" },
      take: 10,
      select: {
        id: true,
        eventType: true,
        receivedAt: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      source: "Stripe webhook",
      occurredAt: r.receivedAt.toISOString(),
      message: r.eventType,
    }));
  } catch {
    // If the table doesn't exist or DB is down we just surface nothing
    // — the dashboard's empty state ("No failed integrations") is the
    // honest answer in that case. The DB outage itself is reflected on
    // the database tile.
    return [];
  }
}

async function loadRecentErrors(): Promise<RecentErrorRow[]> {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await prisma.auditLog.findMany({
      where: {
        action: {
          in: [
            "auth.signin_failure",
            "auth.mfa_challenge_failure",
            "auth.magic_link_failure",
          ],
        },
        createdAt: { gte: oneDayAgo },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        action: true,
        createdAt: true,
        metadata: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      occurredAt: r.createdAt.toISOString(),
      // metadata may contain an arbitrary JSON blob; we only surface a
      // short, safe "reason" string when present. The audit redactor
      // (writeAudit) already strips PII before persistence.
      detail: extractAuditReason(r.metadata),
    }));
  } catch {
    return [];
  }
}

function extractAuditReason(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== "object") return undefined;
  const m = metadata as Record<string, unknown>;
  if (typeof m.reason === "string") return m.reason.slice(0, 160);
  return undefined;
}

// ── Public aggregator ─────────────────────────────────────────────────────

function rollUpOverall(
  ...statuses: HealthStatus[]
): HealthStatus {
  if (statuses.some((s) => s === "down")) return "down";
  if (statuses.some((s) => s === "degraded")) return "degraded";
  if (statuses.every((s) => s === "healthy")) return "healthy";
  return "unknown";
}

export async function getOperationsHealthSnapshot(): Promise<OperationsHealthSnapshot> {
  // Database first — it's the only probe with a real round-trip; if it
  // fails we still want to render the rest of the page.
  const dbResult = await probeDatabase();
  const auth = probeAuth();
  const app: ServiceHealth = {
    id: "app",
    label: "Application API",
    description: "Next.js runtime (this server)",
    configured: true,
    status: "healthy",
    detail: "This response was produced by the app — the runtime is up.",
  };

  // Run DB-backed listings and outbound integration probes in parallel.
  // Each helper swallows its own errors so a single probe never blocks the page.
  const [failedIntegrations, recentErrors, probeResults] = await Promise.all([
    loadFailedIntegrations(),
    loadRecentErrors(),
    runIntegrationProbes(),
  ]);
  const dependencies = integrationProbesToDependencies(probeResults);

  // Strip the rttMs helper field before returning so the public shape
  // stays narrow.
  const { rttMs: _rttMs, ...databaseHealth } = dbResult;
  void _rttMs;

  return {
    generatedAt: new Date().toISOString(),
    environment: resolveEnvironment(),
    platform: resolvePlatform(),
    build: resolveBuild(),
    overall: rollUpOverall(
      app.status,
      databaseHealth.status,
      auth.status,
      ...dependencies.map((d) => d.status)
    ),
    core: { app, database: databaseHealth, auth },
    dependencies,
    failedIntegrations,
    recentErrors,
    lastSuccessfulHealthCheck:
      databaseHealth.status === "down" ? null : new Date().toISOString(),
  };
}
