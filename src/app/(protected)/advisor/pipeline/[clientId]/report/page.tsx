import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, FileDown, Pencil, FileText } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getReportListForClient } from "@/lib/reports/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { redirect, notFound } from "next/navigation";

/**
 * §4.5 commit 3 (BRD §4.5) — advisor "Reports" view per client. Lists
 * every Report row for the client's latest assessment (DRAFT + PUBLISHED
 * + SUPERSEDED) with download / edit affordances.
 *
 * Auth: requires an ACTIVE ClientAdvisorAssignment from the calling
 * advisor to the client (otherwise 404 — opaque, mirrors the
 * authorization shape of /advisor/pipeline/[clientId]).
 */
export default async function AdvisorReportListPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if (session.user.role !== "ADVISOR" && session.user.role !== "ADMIN") {
    notFound();
  }

  // Active-assignment gate. Admins skip.
  if (session.user.role === "ADVISOR") {
    const advisor = await prisma.advisorProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!advisor) notFound();
    const assignment = await prisma.clientAdvisorAssignment.findFirst({
      where: { advisorId: advisor.id, clientId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!assignment) notFound();
  }

  const list = await getReportListForClient(clientId);

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <Link
          href={`/advisor/pipeline/${clientId}`}
          className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to client
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="mt-2 text-muted-foreground">
          Versioned reports for this client&apos;s latest assessment. Drafts are
          editable; published versions are immutable; superseded versions are
          preserved for history.
        </p>
      </div>

      {!list || list.reports.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <FileText className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p>
              No reports yet. Once the client&apos;s assessment is scored, a
              draft is created automatically — visit{" "}
              <Link
                href={`/advisor/pipeline/${clientId}/report/edit`}
                className="text-primary hover:underline"
              >
                Edit Draft
              </Link>{" "}
              to author and publish the first version.
            </p>
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
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
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
                    <div className="flex items-center gap-2">
                      {r.status === "DRAFT" ? (
                        <Button variant="outline" size="sm" asChild>
                          <Link
                            href={`/advisor/pipeline/${clientId}/report/edit`}
                          >
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit Draft
                          </Link>
                        </Button>
                      ) : null}
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
                    </div>
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
