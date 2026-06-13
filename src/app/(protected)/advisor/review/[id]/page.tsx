import { notFound } from "next/navigation";
import { Clock, FileText, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AdvisorHouseholdDirectory } from "@/components/advisor/AdvisorHouseholdDirectory";
import { AdvisorIntakeView } from "@/components/advisor/AdvisorIntakeView";
import { ReviewSidebar } from "@/components/advisor/ReviewSidebar";
import { getIntakeReviewDataForAdvisorPage } from "@/lib/advisor/intake-review-queries";
import { formatIntakeApprovalStatus } from "@/lib/intake/approval-status-label";

interface ReviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReviewPage({ params }: ReviewPageProps) {
  const { id } = await params;

  const data = await getIntakeReviewDataForAdvisorPage(id);
  if (!data) {
    notFound();
  }

  const { interview, approval, questions, householdMembers, pillarRecommendations } =
    data;

  // Format submission date
  const submittedAt = interview.submittedAt
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(interview.submittedAt))
    : "Not submitted";

  // Get status badge variant
  const getStatusVariant = (status?: string) => {
    switch (status) {
      case 'APPROVED': return 'success';
      case 'REJECTED': return 'warning';
      case 'IN_REVIEW': return 'info';
      case 'PENDING':
      default: return 'outline';
    }
  };

  const getApprovalStatusLabel = (status?: string) =>
    formatIntakeApprovalStatus(status);

  /** Client intake row status — separate from advisor approval (IntakeApproval). */
  const getIntakeCompletionLabel = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
      case 'COMPLETED':
        return 'Complete';
      case 'IN_PROGRESS':
        return 'In progress';
      case 'NOT_STARTED':
        return 'Not started';
      default:
        return status;
    }
  };

  // No refresh function needed - server actions handle revalidation

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
            
              <div className="h-6 w-px bg-border" />
              <h1 className="text-xl font-semibold">View intake</h1>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Advisor review</span>
              <Badge variant={getStatusVariant(approval?.status)}>
                {getApprovalStatusLabel(approval?.status)}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left column - Client info and transcript */}
          <div className="space-y-6 lg:col-span-7">
            {/* Client info header */}
            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold">
                    {interview.user.name || "Unnamed Client"}
                  </h2>
                  <p className="truncate text-muted-foreground">
                    {interview.user.email}
                  </p>
                </div>
              </div>

              <dl className="mt-5 grid gap-4 border-t border-border/60 pt-5 text-sm sm:grid-cols-3 sm:gap-6">
                <div className="min-w-0 space-y-1">
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-4 w-4 shrink-0" aria-hidden />
                    Submitted
                  </dt>
                  <dd className="font-medium leading-snug text-foreground">
                    {submittedAt}
                  </dd>
                </div>
                <div className="min-w-0 space-y-1">
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    <FileText className="h-4 w-4 shrink-0" aria-hidden />
                    Responses
                  </dt>
                  <dd className="font-medium text-foreground">
                    {interview.responses.length} of {questions.length}
                  </dd>
                </div>
                <div className="min-w-0 space-y-1">
                  <dt className="text-muted-foreground">Client intake</dt>
                  <dd>
                    <Badge
                      variant={
                        interview.status === "SUBMITTED" ||
                        interview.status === "COMPLETED"
                          ? "success"
                          : "outline"
                      }
                    >
                      {getIntakeCompletionLabel(interview.status)}
                    </Badge>
                  </dd>
                </div>
              </dl>
            </div>

            <AdvisorHouseholdDirectory members={householdMembers} />

            {/* Intake form: view each question (with Play question) and client response */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">View intake</h3>
                <span className="text-sm text-muted-foreground">
                  {interview.responses.length} of {questions.length} responses
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Read each question and listen to voice recordings where the client recorded an answer.
                Typed-only answers show the transcript without a recording.
              </p>

              <AdvisorIntakeView
                responses={interview.responses}
                questions={questions}
                totalQuestions={questions.length}
                clientUserId={interview.userId}
              />
            </div>
          </div>

          {/* Right column - Focus areas & approval */}
          <div className="lg:col-span-5">
            <div className="sticky top-24">
              <div className="rounded-xl border bg-card p-6 shadow-sm lg:p-7">
                <ReviewSidebar
                  interviewId={interview.id}
                  clientId={interview.userId}
                  approval={approval}
                  householdProfileCount={householdMembers.length}
                  pillarRecommendations={pillarRecommendations}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}