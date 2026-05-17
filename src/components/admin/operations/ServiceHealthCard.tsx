import { Card, CardContent } from "@/components/ui/card";
import {
  StatusDot,
  statusBadgeText,
} from "@/components/admin/operations/StatusCard";
import type { ServiceHealth } from "@/lib/admin/operations-health";

/**
 * One service tile. Used for the "Core services" grid (app / database /
 * auth). Always renders the status dot + label + short detail line.
 */
export function ServiceHealthCard({ service }: { service: ServiceHealth }) {
  return (
    <Card className="border-border/80">
      <CardContent className="flex flex-col gap-2 pt-6">
        <div className="flex items-center gap-2">
          <StatusDot status={service.status} className="size-2.5" />
          <p className="editorial-kicker">{statusBadgeText(service.status)}</p>
        </div>
        <p className="text-base font-semibold leading-tight">{service.label}</p>
        <p className="text-xs text-muted-foreground">{service.description}</p>
        {service.detail ? (
          <p className="mt-1 text-xs text-muted-foreground">{service.detail}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
