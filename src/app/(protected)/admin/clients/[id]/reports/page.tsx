import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, FileDown, FileText, History } from "lucide-react";
import { notFound } from "next/navigation";

import { requireAdminRole } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { decryptUserEmail } from "@/lib/auth/user-email";
import { getReportListForClient } from "@/lib/reports/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RepublishButton } from "@/components/reports/RepublishButton";

/**
 * §4.5 commit 3 (BRD §4.5) — admin "Reports for client" view.
 *
 * Same per-version list the advisor sees, with two additions:
 *   • Republish button on PUBLISHED rows (admin-only path that builds a
 *     fresh snapshot from current data and supersedes the old). Bug-
 *     frozen-in-amber escape hatch — see §6 of the design proposal.
 *   • Audit-log entity-history link per row, jumping into the existing
 *     /admin/audit-log/entity/Report/[reportId] page.
 *
 * Compare-versions diff UI is deferred (§7 of the design proposal,
 * sign-off confirmed). Until that follow-up commit lands, the
 * audit-log entity history is the canonical "what changed" view.
 */
export default async function AdminClientReportsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminRole();
  const { id: clientId } = await params;

  const client = await prisma.user.findUnique({
    where: { id: clientId },
    select: { emailCiphertext: true, name: true, role: true },
  });
  if (!client || client.role !== "USER") notFound();

  const list = await getReportListForClient(clientId);
  const clientLabel = client.name || decryptUserEmail(client.emailCiphertext);

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <Link
          href="/admin/clients"
          className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to clients
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Reports — {clientLabel}</h1>
        <p className="mt-2 text-muted-foreground">
          Per-version history for the client&apos;s latest assessment. Republish
          rebuilds the snapshot from current data and supersedes the old —
          use it after a scoring fix that needs to refresh the frozen
          numbers without losing the original record.
        </p>
      </div>

      {!list || list.reports.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <FileText className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p>No reports for this client.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Versions ({list.reports.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {list.reports.map((r) => {
                const variant: "secondary" | "success" | "outline" =
                  r.status === "PUBLISHED"
                    ? "success"
                    : r.status === "DRAFT"
                      ? "outline"
                      : "secondary";
                return (
                  <li
                    key={r.id}
                    className="space-y-3 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">v{r.version}</span>
                          <Badge variant={variant}>{r.status}</Badge>
                          <Badge variant="outline" className="text-xs">
                            {r.templateChoice}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {r.publishedAt
                            ? `Published ${format(r.publishedAt, "MMM d, yyyy 'at' p")}`
                            : `Created ${format(r.createdAt, "MMM d, yyyy 'at' p")}`}
                          {r.hasExecutiveSummary
                            ? " · executive summary set"
                            : null}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link
                            href={`/admin/audit-log/entity/Report/${r.id}`}
                          >
                            <History className="w-4 h-4 mr-2" />
                            Audit history
                          </Link>
                        </Button>
                        {r.status !== "DRAFT" ? (
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={`/api/reports/by-id/${r.id}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <FileDown className="w-4 h-4 mr-2" />
                              Download
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    {r.status === "PUBLISHED" && list.assessmentId ? (
                      <RepublishButton
                        assessmentId={list.assessmentId}
                        currentVersion={r.version}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
