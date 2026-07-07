import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ServiceHealthCard } from "@/components/admin/operations/ServiceHealthCard";
import type { BackgroundJobsHealth } from "@/lib/admin/provisioning-health";

export function BackgroundJobsSection({
  backgroundJobs,
}: {
  backgroundJobs: BackgroundJobsHealth;
}) {
  const { metrics } = backgroundJobs;

  return (
    <section aria-labelledby="ops-background" className="space-y-3">
      <header className="space-y-1">
        <h2
          id="ops-background"
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          Background jobs
        </h2>
        <p className="text-sm text-muted-foreground">
          Enterprise provisioning queue, Redis connectivity, and worker auth.
          Probed on each page load.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ServiceHealthCard service={backgroundJobs.redis} />
        <ServiceHealthCard service={backgroundJobs.cronSecret} />
        <ServiceHealthCard service={backgroundJobs.enterpriseProvision} />
      </div>

      <Card className="border-border/80">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base font-semibold tracking-tight">
              Provisioning queue metrics
            </CardTitle>
            <Badge variant="outline" className="text-[0.6rem] font-mono uppercase">
              {metrics.mode === "queue" ? "BullMQ" : "Legacy HTTP"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
            <Metric label="Waiting" value={metrics.jobCounts?.waiting ?? "—"} />
            <Metric label="Active" value={metrics.jobCounts?.active ?? "—"} />
            <Metric label="Delayed" value={metrics.jobCounts?.delayed ?? "—"} />
            <Metric label="Failed" value={metrics.jobCounts?.failed ?? "—"} />
            <Metric
              label="PROVISIONING"
              value={metrics.provisioningFirms}
              highlight={metrics.provisioningFirms > 0}
            />
            <Metric
              label="Stuck"
              value={metrics.stuckProvisioningFirms}
              highlight={metrics.stuckProvisioningFirms > 0}
              warn
            />
          </dl>
          {metrics.oldestProvisioningAt ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Oldest PROVISIONING firm since{" "}
              <time dateTime={metrics.oldestProvisioningAt}>
                {new Date(metrics.oldestProvisioningAt).toUTCString()}
              </time>
              .
            </p>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

function Metric({
  label,
  value,
  highlight = false,
  warn = false,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
  warn?: boolean;
}) {
  const tone =
    warn && typeof value === "number" && value > 0
      ? "text-destructive"
      : highlight
        ? "text-foreground"
        : "text-muted-foreground";

  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`font-mono text-base font-semibold ${tone}`}>{value}</dd>
    </div>
  );
}
