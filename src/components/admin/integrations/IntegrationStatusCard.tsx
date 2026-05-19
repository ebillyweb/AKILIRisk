import type { LucideIcon } from "lucide-react";
import {
  Cloud,
  CreditCard,
  Database,
  Globe,
  Mail,
  Server,
  Shield,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  StatusDot,
  statusBadgeText,
} from "@/components/admin/operations/StatusCard";
import type { IntegrationRow } from "@/lib/admin/integrations-view";
import { cn } from "@/lib/utils";

const INTEGRATION_ICONS: Record<string, LucideIcon> = {
  app: Server,
  database: Database,
  auth: Shield,
  stripe: CreditCard,
  openai: Sparkles,
  resend: Mail,
  s3: Cloud,
  "white-label-dns": Globe,
};

function formatCheckedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function IntegrationStatusCard({ integration }: { integration: IntegrationRow }) {
  const Icon = INTEGRATION_ICONS[integration.id] ?? Server;

  return (
    <Card
      className={cn(
        "hero-surface border-border/80 shadow-sm transition-shadow hover:shadow-md",
        integration.category === "core" && "ring-1 ring-primary/5"
      )}
    >
      <CardContent className="flex flex-col gap-3 pt-6">
        <IntegrationCardHeader integration={integration} Icon={Icon} />
        <div className="space-y-0.5">
          <p className="text-sm font-semibold leading-tight text-foreground">
            {integration.name}
          </p>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {integration.category === "core" ? "Core platform" : "External service"}
          </p>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          {integration.description}
        </p>
        {integration.detail ? (
          <p className="text-xs text-muted-foreground/90">{integration.detail}</p>
        ) : null}
        <p className="mt-auto text-[11px] text-muted-foreground">
          Last checked{" "}
          <time dateTime={integration.lastCheckedAt}>
            {formatCheckedAt(integration.lastCheckedAt)}
          </time>
        </p>
      </CardContent>
    </Card>
  );
}

function IntegrationCardHeader({
  integration,
  Icon,
}: {
  integration: IntegrationRow;
  Icon: LucideIcon;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-muted-foreground">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <Badge
          variant={integration.configured ? "outline" : "secondary"}
          className="text-[0.6rem]"
        >
          {integration.configured ? "Configured" : "Not configured"}
        </Badge>
        <Badge variant="outline" className="gap-1 text-[0.6rem]">
          <StatusDot status={integration.status} className="size-1.5" />
          {statusBadgeText(integration.status)}
        </Badge>
      </div>
    </div>
  );
}
