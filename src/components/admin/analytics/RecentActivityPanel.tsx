import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RecentActivityRow } from "@/lib/admin/analytics-metrics";

/**
 * Recent product activity from the audit log — user create / soft-delete,
 * intake submit/approve/reject, report publish, etc. Pure aggregate
 * shape (no actor or target identifiers) for the analytics dashboard.
 */
export function RecentActivityPanel({
  rows,
}: {
  rows: RecentActivityRow[];
}) {
  return (
    <Card className="border-border/80">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold tracking-tight">
          Recent product activity
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Latest 10 product-level events recorded in the audit log. Actor /
          target identifiers are not displayed here — see{" "}
          <code>/admin/audit-log</code> for the full row with redacted hashes.
        </p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/70 bg-muted/30 px-4 py-6 text-center text-xs text-muted-foreground">
            No recent product events yet.
          </p>
        ) : (
          <ul role="list" className="divide-y divide-border/60">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {humanizeAction(row.action)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.entityType}
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
  );
}

function humanizeAction(action: string): string {
  switch (action) {
    case "user.create":
      return "User created";
    case "user.soft_delete":
      return "User soft-deleted";
    case "user.restore":
      return "User restored";
    case "intake.submit":
      return "Intake submitted";
    case "intake.approve":
      return "Intake approved";
    case "intake.reject":
      return "Intake rejected";
    case "report.publish":
      return "Report published";
    case "assessment.rescore":
      return "Assessment re-scored";
    case "recommendation.create":
      return "Recommendation added";
    case "invite.send":
      return "Invitation sent";
    default:
      return action;
  }
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toUTCString().slice(5, 22);
}
