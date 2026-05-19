import Link from "next/link";
import { AlertTriangle, CheckCircle, Layers, Puzzle, XCircle } from "lucide-react";
import { requireSuperAdminRole } from "@/lib/admin/auth";
import { buildIntegrationsView } from "@/lib/admin/integrations-view";
import { getOperationsHealthSnapshot } from "@/lib/admin/operations-health";
import { MetricCard } from "@/components/admin/dashboard/MetricCard";
import { IntegrationStatusCard } from "@/components/admin/integrations/IntegrationStatusCard";
import { IntegrationsFailedPanel } from "@/components/admin/integrations/IntegrationsFailedPanel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminIntegrationsPage() {
  await requireSuperAdminRole();

  let loadError: unknown = null;
  let view: ReturnType<typeof buildIntegrationsView> | null = null;

  try {
    const snapshot = await getOperationsHealthSnapshot();
    view = buildIntegrationsView(snapshot);
  } catch (err) {
    loadError = err;
  }

  if (!view) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <PageHeader />
        <div
          role="alert"
          className="rounded-2xl border border-dashed border-destructive/50 bg-destructive/5 p-6 text-sm text-destructive"
        >
          <p className="font-medium">Unable to load integration status.</p>
          <p className="mt-1 text-xs text-destructive/80">
            {loadError instanceof Error
              ? loadError.message.slice(0, 240)
              : "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

  const { summary, integrations, failedIntegrations, generatedAt } = view;
  const coreIntegrations = integrations.filter((i) => i.category === "core");
  const externalIntegrations = integrations.filter((i) => i.category === "external");

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader generatedAt={generatedAt} />

      <section aria-labelledby="integrations-summary" className="space-y-3">
        <h2 id="integrations-summary" className="sr-only">
          Integration summary
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Total integrations"
            value={summary.total}
            icon={Layers}
            status="neutral"
            subtitle="Core + external services"
          />
          <MetricCard
            title="Healthy"
            value={summary.healthy}
            icon={CheckCircle}
            status="healthy"
            subtitle={
              summary.unknown > 0
                ? `${summary.unknown} not configured or unknown`
                : "Live probed"
            }
          />
          <MetricCard
            title="Degraded"
            value={summary.degraded}
            icon={AlertTriangle}
            status={summary.degraded > 0 ? "warning" : "neutral"}
          />
          <MetricCard
            title="Failed"
            value={summary.failed}
            icon={XCircle}
            status={summary.failed > 0 ? "critical" : "healthy"}
            subtitle={
              failedIntegrations.length > 0
                ? `${failedIntegrations.length} webhook failure(s) (7d)`
                : undefined
            }
          />
        </div>
      </section>

      <section aria-labelledby="integrations-core" className="space-y-3">
        <header className="space-y-1">
          <h2
            id="integrations-core"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            Core platform
          </h2>
          <p className="text-sm text-muted-foreground">
            Services probed on each page load. Database latency and auth
            configuration are checked live.
          </p>
        </header>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {coreIntegrations.map((integration) => (
            <IntegrationStatusCard key={integration.id} integration={integration} />
          ))}
        </div>
      </section>

      <section aria-labelledby="integrations-external" className="space-y-3">
        <header className="space-y-1">
          <h2
            id="integrations-external"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            External services
          </h2>
          <p className="text-sm text-muted-foreground">
            Third-party integrations probed on each page load (API keys are never
            displayed). Stripe webhook failures can further degrade the Stripe
            row below.
          </p>
        </header>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {externalIntegrations.map((integration) => (
            <IntegrationStatusCard key={integration.id} integration={integration} />
          ))}
        </div>
      </section>

      <section aria-labelledby="integrations-failures" className="space-y-3">
        <h2 id="integrations-failures" className="sr-only">
          Recent failures
        </h2>
        <IntegrationsFailedPanel failedIntegrations={failedIntegrations} />
      </section>

      <footer className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/30 px-4 py-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          Snapshot at{" "}
          <time dateTime={generatedAt} className="font-mono text-foreground">
            {new Date(generatedAt).toUTCString()}
          </time>
          . Outbound probes use server-side credentials only; keys are never
          shown in the UI.
        </p>
        <Link
          href="/admin/operations"
          className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
        >
          <Puzzle className="size-4" aria-hidden />
          Open operations health
        </Link>
      </footer>
    </div>
  );
}

function PageHeader({ generatedAt }: { generatedAt?: string }) {
  return (
    <header className="space-y-2">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        Integrations
      </h1>
      <p className="max-w-2xl text-lg text-muted-foreground">
        External service connections, configuration status, and recent failure
        signal for the AKILI platform.
      </p>
      {generatedAt ? (
        <p className="text-xs text-muted-foreground">
          Last refreshed{" "}
          <time dateTime={generatedAt}>
            {new Date(generatedAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </time>
        </p>
      ) : null}
    </header>
  );
}
