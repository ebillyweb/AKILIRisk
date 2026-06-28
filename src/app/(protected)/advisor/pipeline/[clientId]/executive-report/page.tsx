import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, FileDown, Pencil, FileText, Plus } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { isAdvisorHubNavRole } from "@/lib/auth-roles";
import { prisma } from "@/lib/db";
import { getExecutiveReportListForClient } from "@/lib/reports/executive-report-queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildSignInHref } from "@/lib/auth/sign-in-routes";

/**
 * Phase 25: Advisor executive report list page per client.
 *
 * Auth: requires isAdvisorHubNavRole + ACTIVE ClientAdvisorAssignment
 * (ADVISOR role). Admins bypass assignment check. All failures return notFound()
 * (opaque — mirrors the pattern in /advisor/pipeline/[clientId]/report/page.tsx).
 */
export default async function AdvisorExecutiveReportListPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      buildSignInHref({
        callbackUrl: `/advisor/pipeline/${clientId}/executive-report`,
      })
    );
  }
  if (!isAdvisorHubNavRole(session.user.role)) {
    notFound();
  }

  // Resolve advisorProfileId. Admins use any active assignment for the client.
  let advisorProfileId: string;

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
    advisorProfileId = advisor.id;
  } else {
    // Admin: resolve any active assignment to get an advisorProfileId.
    const assignment = await prisma.clientAdvisorAssignment.findFirst({
      where: { clientId, status: "ACTIVE" },
      select: { advisorId: true },
    });
    if (!assignment) notFound();
    advisorProfileId = assignment.advisorId;
  }

  const [reports, hasCompletedAssessment] = await Promise.all([
    getExecutiveReportListForClient(clientId, advisorProfileId),
    prisma.assessment.findFirst({
      where: { userId: clientId, status: "COMPLETED" },
      select: { id: true },
    }).then(Boolean),
  ]);

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

      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Executive Reports</h1>
          <p className="mt-2 text-muted-foreground">
            Generate executive-grade reports combining risk assessment, recommendations, and progress
            tracking.
          </p>
        </div>
        {hasCompletedAssessment && (
          <Button asChild>
            <Link href={`/advisor/pipeline/${clientId}/executive-report/edit`}>
              <Plus className="w-4 h-4 mr-2" />
              Generate Report
            </Link>
          </Button>
        )}
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <FileText className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p className="mb-4">No executive reports yet.</p>
            {hasCompletedAssessment ? (
              <Button asChild>
                <Link href={`/advisor/pipeline/${clientId}/executive-report/edit`}>
                  <Plus className="w-4 h-4 mr-2" />
                  Generate First Report
                </Link>
              </Button>
            ) : (
              <p className="text-sm">
                A completed assessment is required before generating executive reports.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Versions ({reports.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {reports.map((r) => {
                const badgeVariant: "secondary" | "success" | "outline" =
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
                        <Badge variant={badgeVariant}>{r.status}</Badge>
                        {r.hasAdvisorNotes && (
                          <Badge variant="outline" className="text-xs">
                            has notes
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Period:{" "}
                        {format(r.reportingPeriodStart, "MMM d, yyyy")} &ndash;{" "}
                        {format(r.reportingPeriodEnd, "MMM d, yyyy")}
                        {r.publishedAt
                          ? ` · Published ${format(r.publishedAt, "MMM d, yyyy")}`
                          : ` · Created ${format(r.createdAt, "MMM d, yyyy")}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.status === "DRAFT" && (
                        <>
                          <Button variant="outline" size="sm" asChild>
                            <Link
                              href={`/advisor/pipeline/${clientId}/executive-report/edit`}
                            >
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit Draft
                            </Link>
                          </Button>
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={`/api/reports/executive/${r.id}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <FileDown className="w-4 h-4 mr-2" />
                              Preview PDF
                            </a>
                          </Button>
                        </>
                      )}
                      {r.status === "PUBLISHED" && (
                        <>
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={`/api/reports/executive/${r.id}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <FileDown className="w-4 h-4 mr-2" />
                              Download Report
                            </a>
                          </Button>
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={`/api/reports/executive/${r.id}/pdf?variant=advisor`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <FileDown className="w-4 h-4 mr-2" />
                              Advisor Brief
                            </a>
                          </Button>
                        </>
                      )}
                      {r.status === "SUPERSEDED" && (
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={`/api/reports/executive/${r.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <FileDown className="w-4 h-4 mr-2" />
                            Download Report
                          </a>
                        </Button>
                      )}
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
