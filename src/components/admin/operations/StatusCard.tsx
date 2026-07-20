import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { HealthStatus } from "@/lib/admin/operations-health";

/**
 * Hero "Overall platform status" card for /admin/operations.
 *
 * Renders the roll-up status plus environment + build metadata. Kept
 * deliberately calm — no loud colors. A subtle status dot does the
 * coloration; the variant pills stay neutral.
 */

export function StatusCard({
  status,
  generatedAt,
  environment,
  build,
}: {
  status: HealthStatus;
  generatedAt: string;
  environment: "development" | "preview" | "production" | "unknown";
  build: { shortSha: string | null; ref: string | null; committedAt: string | null };
}) {
  const label = statusLabel(status);
  const message = statusHeroMessage(status);

  return (
    <Card
      className="border-border/80"
      data-testid="ops-overall-status"
      data-status={status}
      data-environment={environment}
    >
      <CardContent className="flex flex-col gap-6 pt-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <StatusDot status={status} className="size-3" />
            <p className="editorial-kicker">Overall platform status</p>
            <Badge variant="outline" className="font-mono">
              {environment.toUpperCase()}
            </Badge>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {label}
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            {message}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:max-w-xs sm:text-right">
          <DTRow term="Build">
            {build.shortSha ? (
              <span className="font-mono">{build.shortSha}</span>
            ) : (
              <span className="text-muted-foreground">unknown</span>
            )}
          </DTRow>
          <DTRow term="Branch / ref">
            {build.ref ? (
              <span className="font-mono">{build.ref}</span>
            ) : (
              <span className="text-muted-foreground">unknown</span>
            )}
          </DTRow>
          <DTRow term="Snapshot">
            <span className="font-mono">
              {new Date(generatedAt).toUTCString().slice(5, 22)}
            </span>
          </DTRow>
        </dl>
      </CardContent>
    </Card>
  );
}

function DTRow({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="min-w-0 truncate text-foreground">{children}</dd>
    </>
  );
}

function statusLabel(status: HealthStatus): string {
  switch (status) {
    case "healthy":
      return "All core services healthy";
    case "degraded":
      return "Operating with degraded service";
    case "down":
      return "One or more core services down";
    case "unknown":
    default:
      return "Health unknown";
  }
}

function statusHeroMessage(status: HealthStatus): string {
  switch (status) {
    case "healthy":
      return "All core services are responding normally. External dependencies are configured but not actively probed from this dashboard.";
    case "degraded":
      return "At least one core service is slow or partially impaired. Recent failures are surfaced below — review and check provider dashboards for the affected dependency.";
    case "down":
      return "A core service is not responding. The dashboard below shows which one. Application requests may fail until the dependency recovers.";
    case "unknown":
    default:
      return "Some checks could not be run. Configured dependencies are listed below; missing signals are shown as Unknown rather than implied healthy.";
  }
}

export function StatusDot({
  status,
  className,
}: {
  status: HealthStatus;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block shrink-0 rounded-full",
        statusDotClass(status),
        className
      )}
    />
  );
}

export function statusDotClass(status: HealthStatus): string {
  switch (status) {
    case "healthy":
      return "bg-emerald-500";
    case "degraded":
      return "bg-amber-500";
    case "down":
      return "bg-rose-500";
    case "unknown":
    default:
      return "bg-muted-foreground/50";
  }
}

export function statusBadgeText(status: HealthStatus): string {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "degraded":
      return "Degraded";
    case "down":
      return "Down";
    case "unknown":
    default:
      return "Unknown";
  }
}
