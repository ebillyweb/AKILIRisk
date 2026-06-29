import { describe, expect, it } from "vitest";
import { buildIntegrationsView } from "@/lib/admin/integrations-view";
import type { OperationsHealthSnapshot } from "@/lib/admin/operations-health";

function minimalSnapshot(
  overrides: Partial<OperationsHealthSnapshot> = {}
): OperationsHealthSnapshot {
  const base: OperationsHealthSnapshot = {
    generatedAt: "2026-05-18T12:00:00.000Z",
    environment: "development",
    platform: "node",
    build: { shortSha: null, ref: null, committedAt: null },
    overall: "healthy",
    core: {
      app: {
        id: "app",
        label: "Application API",
        description: "Next.js runtime",
        configured: true,
        status: "healthy",
      },
      database: {
        id: "database",
        label: "Database",
        description: "PostgreSQL",
        configured: true,
        status: "healthy",
        detail: "Responded in 12 ms",
      },
      auth: {
        id: "auth",
        label: "Identity / Auth",
        description: "Auth.js",
        configured: true,
        status: "healthy",
      },
    },
    dependencies: [
      {
        id: "stripe",
        label: "Stripe (billing)",
        description: "Billing",
        configured: true,
        status: "healthy",
        probedAt: "2026-05-18T12:00:00.000Z",
      },
      {
        id: "openai",
        label: "OpenAI",
        description: "AI",
        configured: false,
        status: "unknown",
      },
      {
        id: "resend",
        label: "Resend",
        description: "Email",
        configured: false,
        status: "unknown",
      },
      {
        id: "s3",
        label: "S3",
        description: "Storage",
        configured: false,
        status: "unknown",
      },
      {
        id: "white-label-dns",
        label: "White-label DNS",
        description: "DNS",
        configured: true,
        status: "healthy",
        probedAt: "2026-05-18T12:00:00.000Z",
      },
      {
        id: "upstash-redis",
        label: "Upstash Redis",
        description: "Queue",
        configured: false,
        status: "unknown",
      },
    ],
    failedIntegrations: [],
    recentErrors: [],
    lastSuccessfulHealthCheck: "2026-05-18T12:00:00.000Z",
    backgroundJobs: {
      redis: {
        id: "redis",
        label: "Redis (Upstash)",
        description: "Queue backend",
        configured: false,
        status: "unknown",
      },
      cronSecret: {
        id: "cron-secret",
        label: "Worker auth",
        description: "CRON_SECRET",
        configured: true,
        status: "healthy",
      },
      enterpriseProvision: {
        id: "enterprise-provision",
        label: "Enterprise provisioning",
        description: "Async setup",
        configured: true,
        status: "healthy",
      },
      metrics: {
        mode: "legacy",
        jobCounts: null,
        provisioningFirms: 0,
        stuckProvisioningFirms: 0,
        oldestProvisioningAt: null,
      },
    },
  };
  return { ...base, ...overrides };
}

describe("buildIntegrationsView", () => {
  it("counts core + external integrations including white-label DNS", () => {
    const view = buildIntegrationsView(minimalSnapshot());
    expect(view.summary.total).toBe(9);
    expect(view.integrations.some((i) => i.id === "white-label-dns")).toBe(true);
    expect(view.integrations.some((i) => i.id === "upstash-redis")).toBe(true);
    const stripe = view.integrations.find((i) => i.id === "stripe");
    expect(stripe?.lastCheckedAt).toBe("2026-05-18T12:00:00.000Z");
  });

  it("promotes Stripe to degraded when webhook failures exist", () => {
    const view = buildIntegrationsView(
      minimalSnapshot({
        dependencies: [
          {
            id: "stripe",
            label: "Stripe (billing)",
            description: "Billing",
            configured: true,
            status: "healthy",
          },
          {
            id: "openai",
            label: "OpenAI",
            description: "AI",
            configured: false,
            status: "unknown",
          },
          {
            id: "resend",
            label: "Resend",
            description: "Email",
            configured: false,
            status: "unknown",
          },
          {
            id: "s3",
            label: "S3",
            description: "Storage",
            configured: false,
            status: "unknown",
          },
          {
            id: "white-label-dns",
            label: "White-label DNS",
            description: "DNS",
            configured: true,
            status: "healthy",
          },
        ],
        failedIntegrations: [
          {
            id: "1",
            source: "Stripe webhook",
            occurredAt: "2026-05-18T11:00:00.000Z",
            message: "invoice.paid",
          },
        ],
      })
    );
    const stripe = view.integrations.find((i) => i.id === "stripe");
    expect(stripe?.status).toBe("degraded");
    expect(view.summary.degraded).toBeGreaterThanOrEqual(1);
  });
});
