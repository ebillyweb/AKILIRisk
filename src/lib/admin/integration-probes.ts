import "server-only";

import dns from "node:dns/promises";
import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import Stripe from "stripe";
import { resolveAwsCredentials } from "@/lib/s3/aws-credentials";
import type { HealthStatus, ServiceHealth } from "@/lib/admin/operations-health";

/** Per-probe wall-clock budget (ms). */
export const INTEGRATION_PROBE_TIMEOUT_MS = 6000;

export type IntegrationProbeStatus =
  | "healthy"
  | "degraded"
  | "down"
  | "not_configured"
  | "unknown";

export interface IntegrationProbeResult {
  id: string;
  status: IntegrationProbeStatus;
  message?: string;
  checkedAt: string;
}

const INTEGRATION_LABELS: Record<
  string,
  Pick<ServiceHealth, "label" | "description">
> = {
  stripe: {
    label: "Stripe (billing)",
    description: "Subscription billing + webhook ingestion",
  },
  openai: {
    label: "OpenAI",
    description: "Intake transcription + question text-to-speech",
  },
  resend: {
    label: "Resend (email)",
    description: "Transactional outbound mail",
  },
  s3: {
    label: "Object storage (S3)",
    description: "Intake audio + document uploads",
  },
  "white-label-dns": {
    label: "White-label DNS",
    description: "Advisor subdomain CNAME targets and apex domain",
  },
};

function checkedNow(): string {
  return new Date().toISOString();
}

function notConfigured(id: string, message: string): IntegrationProbeResult {
  return {
    id,
    status: "not_configured",
    message,
    checkedAt: checkedNow(),
  };
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} probe timed out after ${ms}ms`)),
      ms
    );
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function isStripeAuthError(err: unknown): boolean {
  const StripeAuth = Stripe.errors?.StripeAuthenticationError;
  if (StripeAuth && err instanceof StripeAuth) return true;
  if (
    err &&
    typeof err === "object" &&
    "statusCode" in err &&
    (err as { statusCode?: number }).statusCode === 401
  ) {
    return true;
  }
  const message = err instanceof Error ? err.message : String(err);
  return /invalid api key|authentication/i.test(message);
}

function sanitizeProbeError(err: unknown): string {
  const raw = err instanceof Error ? err.message : "Probe failed";
  return raw
    .replace(/sk_[a-zA-Z0-9]+/g, "[redacted]")
    .replace(/re_[a-zA-Z0-9]+/g, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .slice(0, 240);
}

export async function probeStripe(): Promise<IntegrationProbeResult> {
  const id = "stripe";
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    return notConfigured(id, "STRIPE_SECRET_KEY is not set.");
  }

  const checkedAt = checkedNow();
  try {
    const stripe = new Stripe(key, {
      typescript: true,
      timeout: INTEGRATION_PROBE_TIMEOUT_MS,
      maxNetworkRetries: 0,
    });
    await withTimeout(
      stripe.balance.retrieve(),
      INTEGRATION_PROBE_TIMEOUT_MS,
      "Stripe"
    );
    return {
      id,
      status: "healthy",
      message: "Stripe API accepted credentials (balance.retrieve).",
      checkedAt,
    };
  } catch (err) {
    if (isStripeAuthError(err)) {
      return {
        id,
        status: "down",
        message: "Stripe rejected the API key (authentication failed).",
        checkedAt,
      };
    }
    return {
      id,
      status: "degraded",
      message: sanitizeProbeError(err),
      checkedAt,
    };
  }
}

export async function probeOpenAI(): Promise<IntegrationProbeResult> {
  const id = "openai";
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return notConfigured(id, "OPENAI_API_KEY is not set.");
  }

  const checkedAt = checkedNow();
  try {
    const response = await withTimeout(
      fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(INTEGRATION_PROBE_TIMEOUT_MS),
      }),
      INTEGRATION_PROBE_TIMEOUT_MS,
      "OpenAI"
    );

    if (response.status === 401 || response.status === 403) {
      return {
        id,
        status: "down",
        message: `OpenAI API returned ${response.status} (invalid or revoked key).`,
        checkedAt,
      };
    }
    if (!response.ok) {
      return {
        id,
        status: "degraded",
        message: `OpenAI API returned HTTP ${response.status}.`,
        checkedAt,
      };
    }
    return {
      id,
      status: "healthy",
      message: "OpenAI API accepted credentials (models list).",
      checkedAt,
    };
  } catch (err) {
    return {
      id,
      status: "degraded",
      message: sanitizeProbeError(err),
      checkedAt,
    };
  }
}

export async function probeResend(): Promise<IntegrationProbeResult> {
  const id = "resend";
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    return notConfigured(id, "RESEND_API_KEY is not set.");
  }

  const checkedAt = checkedNow();
  try {
    const response = await withTimeout(
      fetch("https://api.resend.com/domains", {
        method: "GET",
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(INTEGRATION_PROBE_TIMEOUT_MS),
      }),
      INTEGRATION_PROBE_TIMEOUT_MS,
      "Resend"
    );

    if (response.status === 401 || response.status === 403) {
      return {
        id,
        status: "down",
        message: `Resend API returned ${response.status} (invalid or revoked key).`,
        checkedAt,
      };
    }
    if (!response.ok) {
      return {
        id,
        status: "degraded",
        message: `Resend API returned HTTP ${response.status}.`,
        checkedAt,
      };
    }
    return {
      id,
      status: "healthy",
      message: "Resend API accepted credentials (domains list).",
      checkedAt,
    };
  } catch (err) {
    return {
      id,
      status: "degraded",
      message: sanitizeProbeError(err),
      checkedAt,
    };
  }
}

function resolveS3BucketName(): string | undefined {
  return (
    process.env.S3_BRANDING_BUCKET?.trim() ||
    process.env.S3_BUCKET_NAME?.trim() ||
    undefined
  );
}

function resolveS3Region(): string {
  return (
    process.env.S3_BRANDING_REGION?.trim() ||
    process.env.S3_DOCUMENTS_REGION?.trim() ||
    process.env.AWS_REGION?.trim() ||
    "us-east-2"
  );
}

function s3Configured(): boolean {
  const bucket = resolveS3BucketName();
  if (!bucket) return false;
  if (resolveAwsCredentials()) return true;
  // Vercel / ECS may use the default credential chain without explicit keys.
  if (process.env.VERCEL === "1" || process.env.AWS_EXECUTION_ENV) return true;
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID?.trim() &&
      process.env.AWS_SECRET_ACCESS_KEY?.trim()
  );
}

export async function probeS3(): Promise<IntegrationProbeResult> {
  const id = "s3";
  const bucket = resolveS3BucketName();
  if (!bucket) {
    return notConfigured(
      id,
      "S3_BRANDING_BUCKET or S3_BUCKET_NAME is not set."
    );
  }
  if (!s3Configured()) {
    return notConfigured(
      id,
      "Bucket is set but AWS credentials are not available for probing."
    );
  }

  const checkedAt = checkedNow();
  const region = resolveS3Region();
  const client = new S3Client({
    region,
    followRegionRedirects: true,
    credentials: resolveAwsCredentials(),
    requestChecksumCalculation: "WHEN_REQUIRED",
  });

  try {
    await withTimeout(
      client.send(new HeadBucketCommand({ Bucket: bucket })),
      INTEGRATION_PROBE_TIMEOUT_MS,
      "S3"
    );
    return {
      id,
      status: "healthy",
      message: `S3 bucket "${bucket}" is reachable (HeadBucket).`,
      checkedAt,
    };
  } catch (err) {
    const message = sanitizeProbeError(err);
    const accessDenied =
      /accessdenied|403|not authorized|invalidaccesskeyid/i.test(message);
    const notFound = /nosuchbucket|404|not found/i.test(message);
    if (accessDenied || notFound) {
      return {
        id,
        status: "down",
        message,
        checkedAt,
      };
    }
    return {
      id,
      status: "degraded",
      message,
      checkedAt,
    };
  }
}

export async function probeWhiteLabelDns(): Promise<IntegrationProbeResult> {
  const id = "white-label-dns";
  const domain = process.env.PRODUCTION_DOMAIN?.trim();
  if (!domain) {
    return notConfigured(
      id,
      "PRODUCTION_DOMAIN is not set — subdomain claim API will fail fast."
    );
  }

  const checkedAt = checkedNow();
  const limits =
    "Per-advisor CNAME verification is not checked here; only apex env + DNS/HTTP reachability.";

  try {
    await withTimeout(
      dns.lookup(domain),
      INTEGRATION_PROBE_TIMEOUT_MS,
      "DNS"
    );
  } catch (err) {
    return {
      id,
      status: "down",
      message: `DNS lookup failed for ${domain}: ${sanitizeProbeError(err)} ${limits}`,
      checkedAt,
    };
  }

  const apexUrl = domain.startsWith("http") ? domain : `https://${domain}`;
  try {
    const response = await withTimeout(
      fetch(apexUrl, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(INTEGRATION_PROBE_TIMEOUT_MS),
      }),
      INTEGRATION_PROBE_TIMEOUT_MS,
      "HTTP"
    );
    if (response.status >= 500) {
      return {
        id,
        status: "degraded",
        message: `Apex ${domain} resolves but HTTP HEAD returned ${response.status}. ${limits}`,
        checkedAt,
      };
    }
    return {
      id,
      status: "healthy",
      message: `PRODUCTION_DOMAIN (${domain}) resolves and responds to HTTP HEAD. ${limits}`,
      checkedAt,
    };
  } catch (err) {
    return {
      id,
      status: "degraded",
      message: `DNS OK for ${domain}; HTTP HEAD failed: ${sanitizeProbeError(err)}. ${limits}`,
      checkedAt,
    };
  }
}

const PROBE_RUNNERS: Array<() => Promise<IntegrationProbeResult>> = [
  probeStripe,
  probeOpenAI,
  probeResend,
  probeS3,
  probeWhiteLabelDns,
];

/**
 * Run all external integration probes in parallel. Individual probe failures
 * never reject the aggregate — they surface as `unknown` on that row.
 */
export async function runIntegrationProbes(): Promise<IntegrationProbeResult[]> {
  const settled = await Promise.allSettled(
    PROBE_RUNNERS.map((run) => run())
  );

  return settled.map((result, index) => {
    const fallbackId = [
      "stripe",
      "openai",
      "resend",
      "s3",
      "white-label-dns",
    ][index];
    if (result.status === "fulfilled") return result.value;
    return {
      id: fallbackId,
      status: "unknown",
      message: sanitizeProbeError(result.reason),
      checkedAt: checkedNow(),
    };
  });
}

export function probeResultToServiceHealth(
  probe: IntegrationProbeResult
): ServiceHealth {
  const meta = INTEGRATION_LABELS[probe.id];
  const configured = probe.status !== "not_configured";

  let status: HealthStatus;
  switch (probe.status) {
    case "healthy":
      status = "healthy";
      break;
    case "degraded":
      status = "degraded";
      break;
    case "down":
      status = "down";
      break;
    case "not_configured":
    case "unknown":
    default:
      status = "unknown";
      break;
  }

  return {
    id: probe.id,
    label: meta?.label ?? probe.id,
    description: meta?.description ?? "External integration",
    configured,
    status,
    detail: probe.message,
    probedAt: probe.checkedAt,
  };
}

export function integrationProbesToDependencies(
  probes: IntegrationProbeResult[]
): ServiceHealth[] {
  const order = ["stripe", "openai", "resend", "s3", "white-label-dns"];
  const byId = new Map(probes.map((p) => [p.id, probeResultToServiceHealth(p)]));
  return order
    .map((id) => byId.get(id))
    .filter((row): row is ServiceHealth => row !== undefined);
}
