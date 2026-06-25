"use client";

import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowLeft, Mail, Calendar, BarChart3, FileText, CheckCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { IntakeWaiverScopePanel } from "@/components/pipeline/IntakeWaiverScopePanel";
import { ExportIntakePdfButton } from "@/components/advisor/ExportIntakePdfButton";
import { ExportAssessmentPdfButton } from "@/components/advisor/ExportAssessmentPdfButton";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { WorkflowTimeline } from "./WorkflowTimeline";
import { DocumentRequirements } from "./DocumentRequirements";
import { ClientAuthControls } from "./ClientAuthControls";
import { ClientWorkflowStatusControls } from "./ClientWorkflowStatusControls";
import { getStageLabel } from "@/lib/pipeline/status";
import type { ClientDetail, ClientWorkflowStage } from "@/lib/pipeline/types";
import { isDeliverableProfilePublished } from "@/lib/assessment/plan-depth";
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
  const { client, timeline, documentRequirements, intakeDetails, assessmentDetails, advisorAssignment, assessmentDomains } = detail;
  const displayName = client.name || 'Unnamed Client';
  const assignmentActive = advisorAssignment.status === "ACTIVE";
  const intakeWaived = advisorAssignment.intakeWaivedAt != null;
  const intakeSubmitted = isIntakeFinished(intakeDetails);
  const assessmentCompleted = assessmentDetails?.status === "COMPLETED";
  const assessmentStarted = assessmentDetails != null;
  const intakeNeedsAdvisorReview =
    client.awaitingIntakeReview && !assessmentCompleted;
  const intakeReviewId =
    intakeDetails?.interviewId ?? client.intakeReviewInterviewId ?? null;
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

      {!assignmentActive ? (
        <Alert className="mb-6 border-muted-foreground/30 bg-muted/40">
          <AlertTitle>Workflow inactive</AlertTitle>
          <AlertDescription>
            This client is not in your active pipeline. History is read-only until you restore
            the workflow.
          </AlertDescription>
        </Alert>
      ) : null}

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
                Intake
              </CardTitle>
              <p className="text-sm font-normal text-muted-foreground">
                Clients complete governance intake before the assessment unlocks.
                Waive only when you are intentionally skipping the interview for
                this household.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {intakeWaived ? (
                <IntakeWaiverScopePanel
                  clientId={client.id}
                  assignmentActive={assignmentActive}
                  intakeWaived
                  intakeWaivedAt={advisorAssignment.intakeWaivedAt}
                  includedPillars={advisorAssignment.includedPillars}
                  focusAreas={advisorAssignment.focusAreas}
                  assessmentDomains={assessmentDomains}
                  showWaiverAction={false}
                  waiverLocked={assessmentStarted}
                />
              ) : intakeDetails ? (
                <>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Status</p>
                      <Badge
                        variant={
                          intakeNeedsAdvisorReview
                            ? "warning"
                            : intakeSubmitted
                              ? "success"
                              : "secondary"
                        }
                        className="mt-1"
                      >
                        {intakeNeedsAdvisorReview
                          ? "Awaiting your review"
                          : intakeSubmitted && assessmentCompleted
                            ? "Complete"
                            : intakeSubmitted
                              ? "Submitted"
                              : "In progress"}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Progress</p>
                      <p className="mt-1 text-lg font-semibold leading-none">
                        {intakeDetails.responseCount}/{intakeDetails.totalQuestions}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">responses on file</p>
                    </div>
                    {intakeDetails.submittedAt && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Submitted</p>
                        <p className="mt-1 text-sm">
                          {format(intakeDetails.submittedAt, "MMM d, yyyy")}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(intakeDetails.submittedAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:flex-wrap">
                    {intakeReviewId && intakeSubmitted && intakeDetails.responseCount > 0 && (
                      <Button
                        asChild
                        variant={intakeNeedsAdvisorReview ? "default" : "outline"}
                        className="sm:w-auto"
                      >
                        <Link href={`/advisor/review/${intakeReviewId}`}>
                          {intakeNeedsAdvisorReview
                            ? "Review intake"
                            : "View intake responses"}
                        </Link>
                      </Button>
                    )}
                    {intakeReviewId && intakeSubmitted && intakeDetails.responseCount > 0 ? (
                      <ExportIntakePdfButton
                        interviewId={intakeReviewId}
                        className="sm:w-auto"
                      />
                    ) : null}
                    {!intakeSubmitted ? (
                      <IntakeWaiverScopePanel
                        clientId={client.id}
                        assignmentActive={assignmentActive}
                        intakeWaived={false}
                        intakeWaivedAt={null}
                        includedPillars={advisorAssignment.includedPillars}
                        focusAreas={advisorAssignment.focusAreas}
                        assessmentDomains={assessmentDomains}
                        showWaiverAction
                        waiverLocked={assessmentStarted}
                      />
                    ) : null}
                  </div>
                </>
              ) : (
                <IntakeWaiverScopePanel
                  clientId={client.id}
                  assignmentActive={assignmentActive}
                  intakeWaived={false}
                  intakeWaivedAt={null}
                  includedPillars={advisorAssignment.includedPillars}
                  focusAreas={advisorAssignment.focusAreas}
                  assessmentDomains={assessmentDomains}
                  showWaiverAction
                  waiverLocked={assessmentStarted}
                />
              )}
            </CardContent>
          </Card>

          {/* Assessment Summary */}
          {assessmentDetails && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Risk Assessment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {client.needsRescore && assessmentDetails.answersChangedAfterCompleteAt ? (
                  <Alert variant="warning">
                    <AlertTitle>Reassessment needed</AlertTitle>
                    <AlertDescription>
                      This client changed assessment answers after completion
                      {assessmentDetails.version
                        ? ` (currently scored as v${assessmentDetails.version})`
                        : ""}
                      . Answers were updated{" "}
                      {formatDistanceToNow(
                        new Date(assessmentDetails.answersChangedAfterCompleteAt),
                        { addSuffix: true },
                      )}
                      . Request a platform re-score so scores, recommendations, and
                      published reports reflect the latest responses.
                    </AlertDescription>
                  </Alert>
                ) : null}
                <div className="grid grid-cols-2 gap-4 rounded-xl border border-border/80 bg-muted/20 p-4 md:grid-cols-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Status</p>
                    <Badge
                      variant={assessmentDetails.status === "COMPLETED" ? "success" : "secondary"}
                      className="mt-1"
                    >
                      {assessmentDetails.status === "COMPLETED" ? "Complete" : "In progress"}
                    </Badge>
                  </div>
                  {assessmentDetails.score !== null && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Risk score</p>
                      <p className="mt-1 text-2xl font-semibold leading-none tabular-nums">
                        {assessmentDetails.score}
                      </p>
                    </div>
                  )}
                  {assessmentDetails.riskLevel && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Risk level</p>
                      <Badge
                        variant="outline"
                        className={cn("mt-1 uppercase", getRiskLevelColor(assessmentDetails.riskLevel))}
                      >
                        {assessmentDetails.riskLevel}
                      </Badge>
                    </div>
                  )}
                  {assessmentDetails.completedAt && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Completed</p>
                      <p className="mt-1 text-sm">
                        {format(assessmentDetails.completedAt, "MMM d, yyyy")}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="mb-3 text-sm font-medium">Risk by domain</h4>
                  <RiskHeatMap
                    mode="single-client"
                    pillarScores={assessmentDetails.pillarScores.map((p) => ({
                      pillar: p.pillar,
                      score: p.score,
                      riskLevel: p.riskLevel,
                    }))}
                    catalog={detail.pillarCatalog}
                  />
                </div>

                {assessmentDetails.completedAt && (
                  <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:flex-wrap">
                    <Button variant="outline" className="justify-center sm:w-auto" asChild>
                      <Link href={`/advisor/analytics/${client.id}`}>
                        <BarChart3 className="mr-2 h-4 w-4" />
                        View full analytics
                      </Link>
                    </Button>
                    {assessmentDetails.id && (
                      <Button variant="outline" className="justify-center sm:w-auto" asChild>
                        <Link
                          href={`/advisor/pipeline/${client.id}/assessment/${assessmentDetails.id}`}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Review answers
                        </Link>
                      </Button>
                    )}
                    {assessmentDetails.id &&
                    assessmentDetails.status === "COMPLETED" ? (
                      <ExportAssessmentPdfButton
                        assessmentId={assessmentDetails.id}
                        className="justify-center sm:w-auto"
                      />
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {assessmentDetails?.id &&
            assessmentDetails.pillarScores.length > 0 &&
            isDeliverableProfilePublished(assessmentDetails.deliverablePhase) && (
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
          {assignmentActive ? (
            <ClientAuthControls clientId={client.id} currentEmail={client.email} />
          ) : null}

          {/* Document Requirements */}
          {assignmentActive ? (
            <DocumentRequirements clientId={client.id} requirements={documentRequirements} />
          ) : null}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ClientWorkflowStatusControls
                clientId={client.id}
                status={advisorAssignment.status}
              />

              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href={assignmentActive ? "/advisor/pipeline" : "/advisor/pipeline?inactive=1"}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {assignmentActive ? "Back to Pipeline" : "Back to inactive clients"}
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

            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}