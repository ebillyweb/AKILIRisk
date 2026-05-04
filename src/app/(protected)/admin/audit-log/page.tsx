import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AUDIT_ACTIONS,
  writeAudit,
} from "@/lib/audit/audit-log";
import {
  countAuditLog,
  listAuditLog,
  lookupActorDisplay,
  type AuditLogFilter,
} from "@/lib/audit/queries";
import { formatAuditDiffSummary } from "@/lib/audit/format-summary";
import { getAuditAdminActorOrNull } from "@/lib/audit/admin-gate";

const PAGE_SIZE = 50;
const DEFAULT_LOOKBACK_DAYS = 7;

type SearchParams = {
  actorUserId?: string;
  action?: string | string[];
  entityType?: string;
  entityId?: string;
  from?: string;
  to?: string;
  cursor?: string;
};

function parseDateOrNull(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toFilter(sp: SearchParams): AuditLogFilter {
  const actions = sp.action
    ? Array.isArray(sp.action)
      ? sp.action
      : [sp.action]
    : [];
  const from =
    parseDateOrNull(sp.from) ??
    new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const to = parseDateOrNull(sp.to);
  return {
    actorUserId: sp.actorUserId?.trim() || null,
    actions,
    entityType: sp.entityType?.trim() || null,
    entityId: sp.entityId?.trim() || null,
    from,
    to,
  };
}

function exportHref(sp: SearchParams): string {
  const params = new URLSearchParams();
  if (sp.actorUserId) params.set("actorUserId", sp.actorUserId);
  if (sp.action) {
    const arr = Array.isArray(sp.action) ? sp.action : [sp.action];
    for (const a of arr) params.append("action", a);
  }
  if (sp.entityType) params.set("entityType", sp.entityType);
  if (sp.entityId) params.set("entityId", sp.entityId);
  if (sp.from) params.set("from", sp.from);
  if (sp.to) params.set("to", sp.to);
  const qs = params.toString();
  return `/api/admin/audit-log/export${qs ? `?${qs}` : ""}`;
}

function nextPageHref(sp: SearchParams, cursor: string): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v === undefined) continue;
    if (k === "cursor") continue;
    if (Array.isArray(v)) {
      for (const vv of v) params.append(k, vv);
    } else {
      params.set(k, v);
    }
  }
  params.set("cursor", cursor);
  return `/admin/audit-log?${params.toString()}`;
}

function actionShortName(action: string): string {
  // "user.create" → "User · Create"
  const [entity, verb] = action.split(".");
  if (!verb) return action;
  const fmt = (s: string) =>
    s
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  return `${fmt(entity)} · ${fmt(verb)}`;
}

const ALL_ACTIONS = Object.values(AUDIT_ACTIONS).sort();

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const actor = await getAuditAdminActorOrNull();
  if (!actor) {
    // 404 for non-admin / unauthenticated. Existence-leak avoidance per the
    // round-7 design — same posture as /api/intake/[id]/audio/[questionId].
    notFound();
  }

  const sp = await searchParams;
  const filter = toFilter(sp);

  const [{ rows, nextCursor }, totalCount] = await Promise.all([
    listAuditLog(filter, { take: PAGE_SIZE, cursor: sp.cursor ?? null }),
    countAuditLog(filter),
  ]);

  const actorMap = await lookupActorDisplay(rows.map((r) => r.actorUserId));

  // Meta-audit. Fire-and-forget: page render shouldn't wait. Records WHO
  // viewed the audit log with WHAT filter — stops a rogue admin from
  // browsing without leaving a trace.
  void writeAudit({
    actor: { userId: actor.userId, role: "ADMIN", email: actor.email },
    action: AUDIT_ACTIONS.DATA_ACCESS_AUDIT_LOG_VIEW,
    entityType: "AuditLog",
    entityId: null,
    metadata: {
      rowCount: rows.length,
      totalMatching: totalCount,
      filterParams: {
        actorUserId: filter.actorUserId ?? null,
        actionCount: filter.actions?.length ?? 0,
        entityType: filter.entityType ?? null,
        entityId: filter.entityId ?? null,
        fromIso: filter.from?.toISOString() ?? null,
        toIso: filter.to?.toISOString() ?? null,
      },
    },
  });

  const selectedActions = new Set(filter.actions ?? []);
  const fromIso = filter.from?.toISOString().slice(0, 16) ?? "";
  const toIso = filter.to?.toISOString().slice(0, 16) ?? "";

  return (
    <div className="space-y-6" data-testid="admin-audit-log-page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-lg font-semibold tracking-tight">
            Audit log{" "}
            <span className="font-normal text-muted-foreground">
              ({totalCount.toLocaleString()})
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            BRD §5.4 — user activity, configuration changes, and sensitive
            data-access events. Default window: last {DEFAULT_LOOKBACK_DAYS} days.
          </p>
        </div>
        <Button asChild className="shrink-0 self-start sm:self-auto">
          <a
            href={exportHref(sp)}
            data-testid="audit-log-export-link"
            // Browser triggers a download; the route streams CSV.
            download
          >
            Download CSV
          </a>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form
            method="get"
            action="/admin/audit-log"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            data-testid="audit-log-filter-form"
          >
            <div className="space-y-1.5">
              <Label htmlFor="actorUserId">Actor user id</Label>
              <Input
                id="actorUserId"
                name="actorUserId"
                placeholder="cuid…"
                defaultValue={filter.actorUserId ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="entityType">Entity type</Label>
              <Input
                id="entityType"
                name="entityType"
                placeholder="User, AssessmentBankQuestion, …"
                defaultValue={filter.entityType ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="entityId">Entity id</Label>
              <Input
                id="entityId"
                name="entityId"
                placeholder="row id"
                defaultValue={filter.entityId ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="from">From (UTC)</Label>
              <Input
                id="from"
                name="from"
                type="datetime-local"
                defaultValue={fromIso}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to">To (UTC)</Label>
              <Input
                id="to"
                name="to"
                type="datetime-local"
                defaultValue={toIso}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
              <Label>Actions</Label>
              <div className="grid max-h-48 grid-cols-1 gap-1.5 overflow-y-auto rounded border p-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
                {ALL_ACTIONS.map((a) => (
                  <label key={a} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      name="action"
                      value={a}
                      defaultChecked={selectedActions.has(a)}
                    />
                    <span className="font-mono">{a}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/audit-log">Reset</Link>
              </Button>
              <Button type="submit" size="sm">
                Apply filters
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-sm text-muted-foreground">
              No audit events match these filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm" data-testid="audit-log-table">
              <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Time (UTC)</th>
                  <th className="px-3 py-2 text-left">Actor</th>
                  <th className="px-3 py-2 text-left">Action</th>
                  <th className="px-3 py-2 text-left">Entity</th>
                  <th className="px-3 py-2 text-left">Diff</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const display = row.actorUserId
                    ? actorMap.get(row.actorUserId)
                    : null;
                  const summary = formatAuditDiffSummary(
                    row.beforeData,
                    row.afterData
                  );
                  return (
                    <tr
                      key={row.id}
                      className="border-b align-top hover:bg-muted/30"
                      data-testid="audit-log-row"
                      data-action={row.action}
                      data-entity-id={row.entityId ?? ""}
                    >
                      <td className="px-3 py-2 font-mono text-xs">
                        {row.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                      </td>
                      <td className="px-3 py-2">
                        {display ? (
                          <span title={row.actorUserId ?? ""}>{display.email}</span>
                        ) : row.actorEmailHash ? (
                          <span className="font-mono text-xs text-muted-foreground" title="User row missing — showing email hash only">
                            #{row.actorEmailHash}
                          </span>
                        ) : (
                          <Badge variant="secondary">system</Badge>
                        )}
                        {row.actorRole ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({row.actorRole})
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        <span title={row.action}>{actionShortName(row.action)}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {row.entityType}
                        {row.entityId ? (
                          <span className="text-muted-foreground"> · {row.entityId}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <details>
                          <summary className="cursor-pointer text-xs">{summary}</summary>
                          <div className="mt-2 grid gap-2 lg:grid-cols-2">
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground">before</div>
                              <pre className="mt-1 max-h-64 overflow-auto rounded bg-muted/40 p-2 text-xs">
                                {row.beforeData === null
                                  ? "null"
                                  : JSON.stringify(row.beforeData, null, 2)}
                              </pre>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground">after</div>
                              <pre className="mt-1 max-h-64 overflow-auto rounded bg-muted/40 p-2 text-xs">
                                {row.afterData === null
                                  ? "null"
                                  : JSON.stringify(row.afterData, null, 2)}
                              </pre>
                            </div>
                            {row.metadata !== null ? (
                              <div className="lg:col-span-2">
                                <div className="text-xs font-semibold text-muted-foreground">metadata</div>
                                <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted/40 p-2 text-xs">
                                  {JSON.stringify(row.metadata, null, 2)}
                                </pre>
                              </div>
                            ) : null}
                            {row.ipAddress || row.userAgent ? (
                              <div className="lg:col-span-2 text-xs text-muted-foreground">
                                {row.ipAddress ? <span>IP: {row.ipAddress}</span> : null}
                                {row.ipAddress && row.userAgent ? " · " : null}
                                {row.userAgent ? <span>UA: {row.userAgent}</span> : null}
                              </div>
                            ) : null}
                          </div>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {nextCursor ? (
        <div className="flex justify-end">
          <Button asChild variant="outline" size="sm">
            <Link href={nextPageHref(sp, nextCursor)}>Next page →</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
