import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  RecentErrorRow,
  FailedIntegrationRow,
} from "@/lib/admin/operations-health";

/**
 * Two-section list rendered under the dependency grid:
 *   - Recent errors  → curated audit-log failure rows (sign-in / MFA /
 *     magic link failures from the last 24 h).
 *   - Failed integrations → StripeWebhookEvent rows with status=FAILED.
 *
 * Each list has an honest empty state so an empty platform doesn't
 * look like a dashboard outage.
 */

export function RecentErrorList({
  recentErrors,
  failedIntegrations,
}: {
  recentErrors: RecentErrorRow[];
  failedIntegrations: FailedIntegrationRow[];
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card className="border-border/80">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold tracking-tight">
            Recent errors
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Authentication and access-control failures from the audit log
            (last 24 hours). Application exceptions are captured in your
            log aggregator, not here.
          </p>
        </CardHeader>
        <CardContent>
          {recentErrors.length === 0 ? (
            <EmptyState label="No recorded failures in the last 24 hours." />
          ) : (
            <ul role="list" className="divide-y divide-border/60">
              {recentErrors.map((err) => (
                <li
                  key={err.id}
                  className="flex items-start justify-between gap-3 py-3 text-sm"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-mono text-xs text-foreground">
                      {err.action}
                    </p>
                    {err.detail ? (
                      <p className="text-xs text-muted-foreground">
                        {err.detail}
                      </p>
                    ) : null}
                  </div>
                  <time
                    dateTime={err.occurredAt}
                    className="shrink-0 text-xs text-muted-foreground"
                  >
                    {formatTimestamp(err.occurredAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold tracking-tight">
            Failed integrations
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Webhook deliveries the integration handler failed to process in
            the last 7 days. Stripe will retry FAILED events automatically.
          </p>
        </CardHeader>
        <CardContent>
          {failedIntegrations.length === 0 ? (
            <EmptyState label="No failed integrations in the last 7 days." />
          ) : (
            <ul role="list" className="divide-y divide-border/60">
              {failedIntegrations.map((row) => (
                <li
                  key={row.id}
                  className="flex items-start justify-between gap-3 py-3 text-sm"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-medium text-foreground">{row.source}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {row.message}
                    </p>
                  </div>
                  <time
                    dateTime={row.occurredAt}
                    className="shrink-0 text-xs text-muted-foreground"
                  >
                    {formatTimestamp(row.occurredAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <p className="rounded-lg border border-dashed border-border/70 bg-muted/30 px-4 py-6 text-center text-xs text-muted-foreground">
      {label}
    </p>
  );
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toUTCString().slice(5, 22);
}
