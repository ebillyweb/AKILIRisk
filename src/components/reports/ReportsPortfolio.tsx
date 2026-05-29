import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight, FileDown, FileText, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ClientReportGroup } from "@/lib/reports/portfolio-types";

function statusVariant(
  status: string
): "success" | "outline" | "secondary" {
  if (status === "PUBLISHED") return "success";
  if (status === "DRAFT") return "outline";
  return "secondary";
}

export function ReportsPortfolio({ groups }: { groups: ClientReportGroup[] }) {
  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 py-12 text-center">
        <FileText className="w-8 h-8 mx-auto mb-3 opacity-50 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">No reports in your portfolio yet</p>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
          After a client completes an assessment, open their pipeline record to create and publish
          a risk profile report.
        </p>
        <Button variant="outline" size="sm" className="mt-4" asChild>
          <Link href="/advisor/pipeline">Open pipeline</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const needsPublish = group.hasDraft && !group.hasPublished;
        return (
          <Card key={group.clientId} className="border-border/70 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{group.clientName}</CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-2">
                    <span>
                      {group.reports.length} {group.reports.length === 1 ? "version" : "versions"}
                    </span>
                    {group.completedAt ? (
                      <>
                        <span aria-hidden>·</span>
                        <span>
                          Assessed {format(new Date(group.completedAt), "MMM d, yyyy")}
                        </span>
                      </>
                    ) : null}
                    {needsPublish ? (
                      <Badge variant="warning" className="h-5 text-[10px]">
                        Draft ready to publish
                      </Badge>
                    ) : group.hasPublished ? (
                      <Badge variant="success" className="h-5 text-[10px]">
                        Published
                      </Badge>
                    ) : null}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={group.listHref}>All versions</Link>
                  </Button>
                  {group.hasDraft ? (
                    <Button size="sm" asChild>
                      <Link href={group.editHref} className="inline-flex items-center gap-1.5">
                        <Pencil className="h-3.5 w-3.5" />
                        Edit draft
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
                {group.reports.map((report) => (
                  <li
                    key={report.reportId}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-medium">v{report.version}</span>
                        <Badge variant={statusVariant(report.status)} className="h-5 text-[10px]">
                          {report.status.toLowerCase()}
                        </Badge>
                        <Badge variant="outline" className="h-5 text-[10px]">
                          {report.templateChoice}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {report.publishedAt
                          ? `Published ${format(new Date(report.publishedAt), "MMM d, yyyy 'at' p")}`
                          : `Updated ${format(new Date(report.updatedAt), "MMM d, yyyy 'at' p")}`}
                        {report.hasExecutiveSummary ? " · executive summary set" : null}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      {report.editHref ? (
                        <Button variant="outline" size="sm" asChild>
                          <Link href={report.editHref} className="inline-flex items-center gap-1.5">
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Link>
                        </Button>
                      ) : null}
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={report.pdfHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5"
                        >
                          <FileDown className="h-3.5 w-3.5" />
                          PDF
                        </a>
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link
                          href={group.listHref}
                          className="inline-flex items-center gap-1 text-xs"
                        >
                          Details
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
