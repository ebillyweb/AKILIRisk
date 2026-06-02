"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowLeft, Mail, Calendar, ExternalLink, BarChart3, FileText, CheckCircle } from "lucide-react";

import { setClientIntakeWaiver } from "@/lib/actions/advisor-intake-waiver-actions";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { WorkflowTimeline } from "./WorkflowTimeline";
import { DocumentRequirements } from "./DocumentRequirements";
import { ClientAuthControls } from "./ClientAuthControls";
import { getStageLabel } from "@/lib/pipeline/status";
import type { ClientDetail, ClientWorkflowStage } from "@/lib/pipeline/types";
import { paletteForRiskLevel } from "@/lib/assessment/risk-color-palette";
import { RiskHeatMap } from "@/components/assessment/RiskHeatMap";
import { TemplateList } from "@/components/reports/TemplateList";

interface ClientDetailViewProps {
  detail: ClientDetail;
}

function getStageBadgeVariant(stage: ClientWorkflowStage) {
  switch (stage) {
    case 'INVITED':
    case 'REGISTERED':
      return 'info' as const;
    case 'INTAKE_IN_PROGRESS':
    case 'ASSESSMENT_IN_PROGRESS':
    case 'DOCUMENTS_REQUIRED':
      return 'warning' as const;
    case 'INTAKE_COMPLETE':
    case 'ASSESSMENT_COMPLETE':
    case 'COMPLETE':
      return 'success' as const;
    default:
      return 'outline' as const;
  }
}

/**
 * Round-10: derived from the canonical RISK_LEVEL_PALETTE
 * (`src/lib/assessment/risk-color-palette.ts`) so the per-pillar heat map
 * (rendered just below) and the overall-risk badge use matching color
 * vocabulary. Pre-round-10 used `green-50/600` for low and `red-50/600`
 * for high; the canonical palette uses emerald for low and orange for
 * high (reserves red for critical).
 */
function getRiskLevelColor(riskLevel: string) {
  const palette = paletteForRiskLevel(riskLevel);
  return `${palette.text} ${palette.bg}`;
}

function isIntakeFinished(detail: ClientDetail['intakeDetails']) {
  if (!detail) return false;
  return (
    detail.submittedAt != null ||
    detail.status === 'SUBMITTED' ||
    detail.status === 'COMPLETED'
  );
}

export function ClientDetailView({ detail }: ClientDetailViewProps) {
  const { client, timeline, documentRequirements, intakeDetails, assessmentDetails, advisorAssignment } = detail;
  const displayName = client.name || 'Unnamed Client';
  const intakeFinished =
    isIntakeFinished(intakeDetails) || advisorAssignment.intakeWaivedAt != null;
  const router = useRouter();
  const [waiverPending, startWaiverTransition] = useTransition();

  function runWaiver(waive: boolean) {
    startWaiverTransition(async () => {
      const result = await setClientIntakeWaiver(client.id, waive);
      if (result.success) {
        router.refresh();
      }
    });
  }

  return (
    <div className="container mx-auto py-6">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/advisor/pipeline"
          className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Pipeline
        </Link>
      </div>

      {/* Client Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">{displayName}</h1>
            <div className="flex items-center gap-4 text-muted-foreground">
              <div className="flex items-center gap-1">
                <Mail className="w-4 h-4" />
                <span>{client.email}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>Assigned {format(client.assignedAt, 'MMM d, yyyy')}</span>
              </div>
            </div>
          </div>

          <div className="text-right space-y-2">
            <Badge variant={getStageBadgeVariant(client.stage)} className="text-sm">
              {getStageLabel(client.stage)}
            </Badge>
            <div className="text-sm text-muted-foreground">
              Last activity {formatDistanceToNow(client.lastActivity, { addSuffix: true })}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Workflow Progress</span>
            <span className="font-medium">{client.progress}%</span>
          </div>
          <Progress value={client.progress} className="h-2" />
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Workflow Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Workflow Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WorkflowTimeline events={timeline} currentStage={client.stage} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Governance intake requirement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Clients normally complete intake before the assessment unlocks. Waive this only when
                you are intentionally skipping the interview for this household.
              </p>
              {advisorAssignment.intakeWaivedAt ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Badge variant="secondary">Intake waived</Badge>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Waived {formatDistanceToNow(new Date(advisorAssignment.intakeWaivedAt), { addSuffix: true })}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={waiverPending}
                    onClick={() => runWaiver(false)}
                  >
                    Require intake again
                  </Button>
                </div>
              ) : intakeFinished ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Badge variant="success">Intake completed</Badge>
                    {intakeDetails?.submittedAt && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Submitted {formatDistanceToNow(new Date(intakeDetails.submittedAt), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                  {client.awaitingIntakeReview && client.intakeReviewInterviewId && (
                    <Button asChild variant="outline">
                      <Link href={`/advisor/review/${client.intakeReviewInterviewId}`}>
                        Review intake
                      </Link>
                    </Button>
                  )}
                </div>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={waiverPending}
                  onClick={() => runWaiver(true)}
                >
                  Allow assessment without intake
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Intake Summary */}
          {intakeDetails && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Intake Interview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Status</p>
                    <Badge variant={intakeFinished ? 'success' : 'secondary'}>
                      {intakeFinished ? 'Complete' : 'In Progress'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Progress</p>
                    {intakeFinished ? (
                      <div>
                        <p className="text-lg font-semibold">Submitted</p>
                        <p className="text-xs text-muted-foreground">
                          {intakeDetails.responseCount}/{intakeDetails.totalQuestions} responses on file
                        </p>
                      </div>
                    ) : (
                      <p className="text-lg font-semibold">
                        {intakeDetails.responseCount}/{intakeDetails.totalQuestions}
                      </p>
                    )}
                  </div>
                  {intakeDetails.submittedAt && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Submitted</p>
                      <p className="text-sm">{format(intakeDetails.submittedAt, 'MMM d, yyyy')}</p>
                    </div>
                  )}
                  {intakeFinished && intakeDetails.responseCount > 0 && (
                    <div>
                      <Link
                        href={`/advisor/review/${intakeDetails.interviewId}`}
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Review Responses
                      </Link>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Assessment Summary */}
          {assessmentDetails && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Risk Assessment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Status</p>
                      <Badge variant={assessmentDetails.status === 'COMPLETED' ? 'success' : 'secondary'}>
                        {assessmentDetails.status === 'COMPLETED' ? 'Complete' : 'In Progress'}
                      </Badge>
                    </div>
                    {assessmentDetails.score !== null && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Risk Score</p>
                        <p className="text-lg font-semibold">{assessmentDetails.score}</p>
                      </div>
                    )}
                    {assessmentDetails.riskLevel && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Risk Level</p>
                        <span className={`text-sm px-2 py-1 rounded-full font-medium ${getRiskLevelColor(assessmentDetails.riskLevel)}`}>
                          {assessmentDetails.riskLevel}
                        </span>
                      </div>
                    )}
                    {assessmentDetails.completedAt && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Completed</p>
                        <p className="text-sm">{format(assessmentDetails.completedAt, 'MMM d, yyyy')}</p>
                      </div>
                    )}
                  </div>

                  {/* Risk by domain (round-10 / B1 — BRD §4.3 heat map). */}
                  <div>
                    <h4 className="text-sm font-medium mb-3">Risk by domain</h4>
                    <RiskHeatMap
                      mode="single-client"
                      pillarScores={assessmentDetails.pillarScores.map((p) => ({
                        pillar: p.pillar,
                        score: p.score,
                        riskLevel: p.riskLevel,
                      }))}
                    />
                  </div>

                  {assessmentDetails.completedAt && (
                    <div className="flex flex-wrap items-center gap-4 pt-2">
                      <Link
                        href={`/advisor/analytics/${client.id}`}
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        <BarChart3 className="w-3 h-3" />
                        View Full Analytics
                      </Link>
                      {assessmentDetails.id && (
                        // US-46c: deep-link into the per-answer review surface
                        // where advisors leave answer-level advisory notes.
                        <Link
                          href={`/advisor/pipeline/${client.id}/assessment/${assessmentDetails.id}`}
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          <FileText className="w-3 h-3" />
                          Review answers
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {assessmentDetails?.id && assessmentDetails.pillarScores.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Policy documents</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-muted-foreground">
                  Download Word policies per risk pillar, pre-filled with this
                  household&apos;s scores and gaps. Member references use
                  anonymized labels only.
                </p>
                <TemplateList
                  assessmentId={assessmentDetails.id}
                  variant="advisor"
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Round-11 commit 4 (BRD §5.1.AUTH): client sign-in management
              — email reassignment + magic-link re-issue. Server actions
              ownership-gated through ClientAdvisorAssignment. */}
          <ClientAuthControls clientId={client.id} currentEmail={client.email} />

          {/* Document Requirements */}
          <DocumentRequirements clientId={client.id} requirements={documentRequirements} />

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/advisor/pipeline">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Pipeline
                </Link>
              </Button>

              {assessmentDetails?.completedAt && (
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href={`/advisor/analytics/${client.id}`}>
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Client Analytics
                  </Link>
                </Button>
              )}

              {/* §4.5 commit 3: link to the versioned report view instead
                  of inline-downloading the latest published. The list page
                  surfaces every version + the Edit Draft + Publish flow. */}
              {assessmentDetails?.id && assessmentDetails.score !== null && (
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href={`/advisor/pipeline/${client.id}/report`}>
                    <FileText className="w-4 h-4 mr-2" />
                    Reports
                  </Link>
                </Button>
              )}

              {intakeDetails && intakeFinished && (
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href={`/advisor/review/${intakeDetails.interviewId}`}>
                    <FileText className="w-4 h-4 mr-2" />
                    Review Intake
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}