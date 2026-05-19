import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { FailedIntegrationRow } from "@/lib/admin/operations-health";

export function IntegrationsFailedPanel({
  failedIntegrations,
}: {
  failedIntegrations: FailedIntegrationRow[];
}) {
  return (
    <Card className="border-border/80">
      <CardHeader className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold tracking-tight">
            Recent integration failures
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Stripe webhook events that failed processing in the last 7 days. For
            authentication failures and full dependency probes, see{" "}
            <Link href="/admin/operations" className="text-primary underline-offset-4 hover:underline">
              Operations Health
            </Link>
            .
          </p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0" asChild>
          <Link href="/admin/operations">API health dashboard</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {failedIntegrations.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
            No failed integrations in the last 7 days.
          </p>
        ) : (
          <ul role="list" className="divide-y divide-border/60">
            {failedIntegrations.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium text-foreground">{row.source}</p>
                  <p className="font-mono text-xs text-muted-foreground">{row.message}</p>
                </div>
                <time
                  dateTime={row.occurredAt}
                  className="shrink-0 text-xs text-muted-foreground sm:text-right"
                >
                  {new Date(row.occurredAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </time>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
