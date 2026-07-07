import { requireAdminRole } from "@/lib/admin/auth";
import { getOperationsHealthSnapshot } from "@/lib/admin/operations-health";
import { BackgroundJobsSection } from "@/components/admin/operations/BackgroundJobsSection";
import { StatusCard } from "@/components/admin/operations/StatusCard";
import { ServiceHealthCard } from "@/components/admin/operations/ServiceHealthCard";
import { DependencyStatusList } from "@/components/admin/operations/DependencyStatusList";
import { RecentErrorList } from "@/components/admin/operations/RecentErrorList";

/**
 * `/admin/operations` — Operational Health Dashboard.
 *
 * Admin-gated (`requireAdminRole`: ADMIN or SUPER_ADMIN). Answers the
 * question "is the platform healthy and are the core services online?"
 *
 * This page intentionally does NOT mix in business metrics — see
 * `/admin/analytics` for those. Visual hierarchy:
 *
 *   1. Overall platform status hero (top).
 *   2. Core services grid (app / database / auth).
 *   3. Background jobs (Redis queue, CRON_SECRET, enterprise provisioning).
 *   4. External dependencies list.
 *   5. Recent errors + failed integrations.
 *   5. Footer with build + last-successful-check timestamp.
 *
 * Force dynamic rendering — every load takes a fresh DB round-trip
 * for the snapshot, and we want operators to see live state.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminOperationsPage() {
  await requireAdminRole();

  let snapshotErr: unknown = null;
  let snapshot: Awaited<ReturnType<typeof getOperationsHealthSnapshot>> | null =
    null;
  try {
    snapshot = await getOperationsHealthSnapshot();
  } catch (err) {
    snapshotErr = err;
  }

  if (!snapshot) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <PageHeader />
        <div
          role="alert"
          className="rounded-xl border border-dashed border-destructive/50 bg-destructive/5 p-6 text-sm text-destructive"
        >
          <p className="font-medium">Failed to build the health snapshot.</p>
          <p className="mt-1 text-xs text-destructive/80">
            {snapshotErr instanceof Error
              ? snapshotErr.message.slice(0, 240)
              : "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader />

      <StatusCard
        status={snapshot.overall}
        generatedAt={snapshot.generatedAt}
        environment={snapshot.environment}
        build={snapshot.build}
      />

      <section aria-labelledby="ops-core" className="space-y-3">
        <header className="space-y-1">
          <h2
            id="ops-core"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            Core services
          </h2>
          <p className="text-sm text-muted-foreground">
            Services this application directly depends on. Probed live on each
            page load.
          </p>
        </header>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ServiceHealthCard service={snapshot.core.app} />
          <ServiceHealthCard service={snapshot.core.database} />
          <ServiceHealthCard service={snapshot.core.auth} />
        </div>
      </section>

      <BackgroundJobsSection backgroundJobs={snapshot.backgroundJobs} />

      <section aria-labelledby="ops-deps" className="space-y-3">
        <header className="space-y-1">
          <h2
            id="ops-deps"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            External dependencies
          </h2>
          <p className="text-sm text-muted-foreground">
            Third-party integrations probed on each load. Unconfigured rows show
            as &ldquo;Unknown&rdquo;; Stripe webhook failures also appear below.
          </p>
        </header>
        <DependencyStatusList dependencies={snapshot.dependencies} />
      </section>

      <section aria-labelledby="ops-incidents" className="space-y-3">
        <header className="space-y-1">
          <h2
            id="ops-incidents"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            Recent incidents
          </h2>
          <p className="text-sm text-muted-foreground">
            Authentication failures (audit log, last 24 h) and Stripe webhook
            processing failures (last 7 d).
          </p>
        </header>
        <RecentErrorList
          recentErrors={snapshot.recentErrors}
          failedIntegrations={snapshot.failedIntegrations}
        />
      </section>

      <footer className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-xs text-muted-foreground sm:px-6">
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div>
            <dt className="font-semibold">Last health check</dt>
            <dd className="font-mono">
              {snapshot.lastSuccessfulHealthCheck
                ? new Date(
                    snapshot.lastSuccessfulHealthCheck
                  ).toUTCString()
                : "Never (database probe failed)"}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Platform</dt>
            <dd className="font-mono">{snapshot.platform}</dd>
          </div>
          <div>
            <dt className="font-semibold">Build committed</dt>
            <dd className="font-mono">
              {formatBuildCommitted(snapshot.build.committedAt)}
            </dd>
          </div>
        </dl>
      </footer>
    </div>
  );
}

function formatBuildCommitted(committedAt: string | null): string {
  if (!committedAt) return "Unavailable (git metadata not embedded at build)";
  const parsed = new Date(committedAt);
  if (Number.isNaN(parsed.getTime())) return "Unavailable (invalid commit date)";
  return parsed.toUTCString();
}

function PageHeader() {
  return (
    <div>
      <h1 className="text-3xl font-bold">Operations</h1>
      <p className="mt-2 text-muted-foreground">
        Platform health, core service status, and recent failures. For
        product / customer metrics, see{" "}
        <code>/admin/analytics</code>.
      </p>
    </div>
  );
}
