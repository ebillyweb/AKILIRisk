import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  StatusDot,
  statusBadgeText,
} from "@/components/admin/operations/StatusCard";
import type { ServiceHealth } from "@/lib/admin/operations-health";

/**
 * External-dependency list. We deliberately don't make outbound probes
 * here — instead each row reports whether the integration is configured
 * (env vars present) and points readers to the failed-integrations
 * panel below for the actual failure signal.
 */
export function DependencyStatusList({
  dependencies,
}: {
  dependencies: ServiceHealth[];
}) {
  return (
    <Card className="border-border/80">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold tracking-tight">
          External dependencies
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Third-party services this platform integrates with. We do not poll
          provider APIs from this dashboard — &ldquo;Configured&rdquo; means the
          credentials are present in this environment; live failure signal is
          surfaced below.
        </p>
      </CardHeader>
      <CardContent>
        <ul role="list" className="divide-y divide-border/60">
          {dependencies.map((dep) => (
            <li
              key={dep.id}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <StatusDot status={dep.status} className="size-2.5" />
                  <span className="text-sm font-medium text-foreground">
                    {dep.label}
                  </span>
                  <Badge
                    variant={dep.configured ? "outline" : "secondary"}
                    className="text-[0.6rem]"
                  >
                    {dep.configured ? "Configured" : "Not configured"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {dep.description}
                </p>
                {dep.detail ? (
                  <p className="text-xs text-muted-foreground/90">
                    {dep.detail}
                  </p>
                ) : null}
              </div>
              <div className="shrink-0 self-start sm:self-center">
                <Badge variant="outline" className="text-[0.6rem]">
                  {statusBadgeText(dep.status)}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
