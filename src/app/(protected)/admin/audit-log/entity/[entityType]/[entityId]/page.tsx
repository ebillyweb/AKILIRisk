import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import {
  AUDIT_ACTIONS,
  writeAudit,
} from "@/lib/audit/audit-log";
import {
  listAuditLog,
  lookupActorDisplay,
} from "@/lib/audit/queries";
import { formatAuditDiffSummary } from "@/lib/audit/format-summary";
import { getAuditAdminActorOrNull } from "@/lib/audit/admin-gate";
import { lookupEntityDisplay } from "@/lib/admin/entity-history-helpers";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { notFound } from "next/navigation";

/**
 * /admin/audit-log/entity/[entityType]/[entityId]
 *
 * C2 (BRD §7.2): per-entity history timeline. Reuses the round-8 unified
 * audit query (`listAuditLog`) with the existing entityType + entityId
 * filter; this page is just a focused render. Linked from "View history"
 * on every entity edit page (question bank, intake questions,
 * recommendations, recommendation rules, etc.).
 *
 * Same admin-only / 404-on-non-admin posture as the main audit log.
 * Same fire-and-forget meta-audit row so a rogue admin browsing entity
 * histories still leaves a trace.
 */

const ENTITY_HISTORY_PAGE_SIZE = 100;

export default async function EntityHistoryPage({
  params,
}: {
  params: Promise<{ entityType: string; entityId: string }>;
}) {
  const actor = await getAuditAdminActorOrNull();
  if (!actor) notFound();

  const { entityType, entityId } = await params;

  const [{ rows }, displayInfo] = await Promise.all([
    listAuditLog({ entityType, entityId }, { take: ENTITY_HISTORY_PAGE_SIZE, offset: 0 }),
    lookupEntityDisplay(entityType, entityId),
  ]);

  const actorMap = await lookupActorDisplay(rows.map((r) => r.actorUserId));

  // Meta-audit (fire-and-forget, same pattern as the main audit-log page).
  void writeAudit({
    actor: { userId: actor.userId, role: "ADMIN", email: actor.email },
    action: AUDIT_ACTIONS.DATA_ACCESS_AUDIT_LOG_VIEW,
    entityType: "AuditLog",
    entityId: null,
    metadata: {
      view: "entity-history",
      targetEntityType: entityType,
      targetEntityId: entityId,
      rowCount: rows.length,
    },
  });

  // Build the back-to-main-log link with this entity's filter pre-applied
  // so admins can compare across entities without retyping filters.
  const mainLogHref = `/admin/audit-log?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/audit-log"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to audit log
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{entityType}</p>
          <h1 className="text-2xl font-bold mt-1">{displayInfo.displayName}</h1>
          <p className="text-xs text-muted-foreground font-mono mt-2">{entityId}</p>
        </div>
        <div className="flex flex-col gap-2 items-end">
          {displayInfo.editHref ? (
            <Link
              href={displayInfo.editHref}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Edit entity
            </Link>
          ) : null}
          <Link
            href={mainLogHref}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" />
            View in main log
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            History timeline ({rows.length}{rows.length === ENTITY_HISTORY_PAGE_SIZE ? "+" : ""} events)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No audit events recorded for this {entityType}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Time (UTC)</th>
                    <th className="py-2 pr-3">Actor</th>
                    <th className="py-2 pr-3">Action</th>
                    <th className="py-2 pr-3">Diff summary</th>
                    <th className="py-2 pr-3">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const display = row.actorUserId ? actorMap.get(row.actorUserId) : null;
                    const summary = formatAuditDiffSummary(row.beforeData, row.afterData);
                    return (
                      <tr key={row.id} className="border-b border-border/50 align-top last:border-0">
                        <td className="py-2 pr-3 font-mono text-xs whitespace-nowrap">
                          {row.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                        </td>
                        <td className="py-2 pr-3 text-xs">
                          {display ? (
                            <span title={row.actorUserId ?? ""}>{display.email}</span>
                          ) : row.actorEmailHash ? (
                            <span className="font-mono text-muted-foreground" title="actor user-row missing">
                              #{row.actorEmailHash}
                            </span>
                          ) : (
                            <Badge variant="secondary">system</Badge>
                          )}
                          {row.actorRole ? (
                            <span className="ml-1 text-muted-foreground">({row.actorRole})</span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3 font-mono text-xs">{row.action}</td>
                        <td className="py-2 pr-3 text-xs">{summary || "—"}</td>
                        <td className="py-2 pr-3 text-xs">
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {row.source}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
