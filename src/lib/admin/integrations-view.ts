import "server-only";

import type {
  FailedIntegrationRow,
  HealthStatus,
  OperationsHealthSnapshot,
  ServiceHealth,
} from "@/lib/admin/operations-health";

export type IntegrationCategory = "core" | "external";

export interface IntegrationRow {
  id: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  status: HealthStatus;
  configured: boolean;
  detail?: string;
  /** ISO timestamp — snapshot time for env-only rows; live probe time for core DB. */
  lastCheckedAt: string;
}

export interface IntegrationsSummary {
  total: number;
  healthy: number;
  degraded: number;
  failed: number;
  unknown: number;
}

export interface IntegrationsView {
  generatedAt: string;
  summary: IntegrationsSummary;
  integrations: IntegrationRow[];
  failedIntegrations: FailedIntegrationRow[];
}

function serviceToRow(
  service: ServiceHealth,
  category: IntegrationCategory,
  fallbackCheckedAt: string
): IntegrationRow {
  return {
    id: service.id,
    name: service.label,
    description: service.description,
    category,
    status: service.status,
    configured: service.configured,
    detail: service.detail,
    lastCheckedAt: service.probedAt ?? fallbackCheckedAt,
  };
}

function stripeFailureCount(rows: FailedIntegrationRow[]): number {
  return rows.filter((r) => r.source.toLowerCase().includes("stripe")).length;
}

function applyStripeFailureSignal(
  integrations: IntegrationRow[],
  failedIntegrations: FailedIntegrationRow[]
): IntegrationRow[] {
  const count = stripeFailureCount(failedIntegrations);
  if (count === 0) return integrations;

  return integrations.map((row) => {
    if (row.id !== "stripe") return row;
    const nextStatus: HealthStatus =
      row.status === "down" || row.status === "degraded"
        ? row.status
        : count >= 3
          ? "down"
          : "degraded";
    return {
      ...row,
      status: nextStatus,
      detail: `${count} Stripe webhook failure${count === 1 ? "" : "s"} in the last 7 days.`,
    };
  });
}

function summarize(integrations: IntegrationRow[]): IntegrationsSummary {
  const summary: IntegrationsSummary = {
    total: integrations.length,
    healthy: 0,
    degraded: 0,
    failed: 0,
    unknown: 0,
  };

  for (const row of integrations) {
    switch (row.status) {
      case "healthy":
        summary.healthy += 1;
        break;
      case "degraded":
        summary.degraded += 1;
        break;
      case "down":
        summary.failed += 1;
        break;
      case "unknown":
      default:
        summary.unknown += 1;
        break;
    }
  }

  return summary;
}

/**
 * Integration registry for `/admin/integrations`.
 *
 * Reuses {@link getOperationsHealthSnapshot} — core and external services are
 * live-probed; Stripe webhook failures can further degrade the Stripe row.
 */
export function buildIntegrationsView(
  snapshot: OperationsHealthSnapshot
): IntegrationsView {
  const fallbackCheckedAt = snapshot.generatedAt;
  const coreRows: IntegrationRow[] = [
    serviceToRow(snapshot.core.app, "core", fallbackCheckedAt),
    serviceToRow(snapshot.core.database, "core", fallbackCheckedAt),
    serviceToRow(snapshot.core.auth, "core", fallbackCheckedAt),
  ];
  const externalRows: IntegrationRow[] = snapshot.dependencies.map((dep) =>
    serviceToRow(dep, "external", fallbackCheckedAt)
  );

  const integrations = applyStripeFailureSignal(
    [...coreRows, ...externalRows],
    snapshot.failedIntegrations
  );

  return {
    generatedAt: snapshot.generatedAt,
    summary: summarize(integrations),
    integrations,
    failedIntegrations: snapshot.failedIntegrations,
  };
}
