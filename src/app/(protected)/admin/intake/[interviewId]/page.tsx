import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AdminIntakeReviewView } from "@/components/admin/AdminIntakeReviewView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getIntakeInterviewForAdminReview } from "@/lib/admin/intake-review-queries";

export default async function AdminIntakeReviewPage({
  params,
}: {
  params: Promise<{ interviewId: string }>;
}) {
  const { interviewId } = await params;
  const data = await getIntakeInterviewForAdminReview(interviewId);
  if (!data) notFound();

  const { interview } = data;
  const submittedLabel = interview.submittedAt
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(interview.submittedAt)
      )
    : "Not submitted";

  return (
    <div className="space-y-6" data-testid="admin-intake-review-page">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/intake" className="inline-flex items-center gap-2">
            <ArrowLeft className="size-4" aria-hidden />
            Intake interviews
          </Link>
        </Button>
        <Badge variant="outline">{interview.status}</Badge>
      </div>

      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          {interview.user.name ?? interview.user.email}
        </h1>
        <p className="text-sm text-muted-foreground">{interview.user.email}</p>
        <p className="text-sm text-muted-foreground">Submitted {submittedLabel}</p>
      </div>

      <p className="text-sm text-muted-foreground">
        Review client intake answers and attach platform-admin notes for the advisory team.
        Notes are visible only to platform admins and do not change answers or scores.
      </p>

      <AdminIntakeReviewView data={data} />
    </div>
  );
}
