"use client";

import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowLeft, BarChart3, FileText, CheckCircle, ClipboardList } from "lucide-react";

import { cn } from "@/lib/utils";
import { STALE_SCORES_COPY } from "@/lib/advisor/assessment-lifecycle-copy";
import { ClientAssessmentLifecycleToolbar } from "@/components/assessment/ClientAssessmentLifecycleToolbar";
import { RequestRescoreButton } from "@/components/assessment/RequestRescoreButton";
import { IntakeWaiverScopePanel } from "@/components/pipeline/IntakeWaiverScopePanel";
import { ExportIntakePdfButton } from "@/components/advisor/ExportIntakePdfButton";
import { ExportAssessmentPdfButton } from "@/components/advisor/ExportAssessmentPdfButton";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FieldHelp } from "@/components/ui/field-help";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { WorkflowTimeline } from "./WorkflowTimeline";
import { DocumentRequirements } from "./DocumentRequirements";
import { ClientAuthControls } from "./ClientAuthControls";
import { ClientWorkflowStatusControls } from "./ClientWorkflowStatusControls";
import { RestartIntakeButton } from "./RestartIntakeButton";
import { ManualCompletionButton } from "./ManualCompletionButton";
import { AssessmentWaiverButton } from "./AssessmentWaiverButton";
import { PermanentDeleteClientButton } from "./PermanentDeleteClientButton";
import { restartIntakeBlockedMessage } from "@/lib/intake/restart-intake-copy";
import { PipelineProcessStateLabel } from "./PipelineProcessStateLabel";
import type { ClientDetail } from "@/lib/pipeline/types";
import { isDeliverableProfilePublished } from "@/lib/assessment/plan-depth";
import { paletteForRiskLevel } from "@/lib/assessment/risk-color-palette";
import { resolveAdvisorClientPipelineLabels } from "@/lib/pipeline/client-display";
import { resolveAdvisorAssessmentNextStep } from "@/lib/pipeline/advisor-next-step";
import { PSEUDONYMOUS_CLIENT_LABELING_NOTE } from "@/lib/advisor/pii-policy";
import { RiskHeatMap } from "@/components/assessment/RiskHeatMap";
import { TemplateList } from "@/components/reports/TemplateList";
import { SIDEBAR_ACTION_BTN } from "@/components/pipeline/sidebar-action-button";

interface ClientDetailViewProps {
  detail: ClientDetail;
  canSkipIntake?: boolean;
  documentRequirementsEnabled?: boolean;
  actionPlanEnabled?: boolean;
  /** Enterprise OWNER/ADMIN can permanently delete clients in their firm */
  canPermanentlyDelete?: boolean;
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

export function ClientDetailView({
  detail,
  canSkipIntake = false,
  documentRequirementsEnabled = true,
  actionPlanEnabled = true,
  canPermanentlyDelete = false,
}: ClientDetailViewProps) {
  const { client, timeline, documentRequirements, intakeDetails, assessmentDetails, advisorAssignment, assessmentDomainPicker, restartIntake } = detail;
  const assessmentDomains = assessmentDomainPicker.domains;
  const clientLabels = resolveAdvisorClientPipelineLabels(client);
  const assignmentActive = advisorAssignment.status === "ACTIVE";
  const intakeWaived = advisorAssignment.intakeWaivedAt != null;
  const intakeSubmitted = isIntakeFinished(intakeDetails);
  const assessmentCompleted = assessmentDetails?.status === "COMPLETED";
  const assessmentStarted = assessmentDetails != null;
  const intakeNeedsAdvisorReview =
    client.awaitingIntakeReview && !assessmentCompleted;
  const intakeReviewId =
    intakeDetails?.interviewId ?? client.intakeReviewInterviewId ?? null;
  const restartIntakeBlockedReason = restartIntake.blockedReason
    ? restartIntakeBlockedMessage(restartIntake.blockedReason)
    : undefined;
  const assessmentNextStep = resolveAdvisorAssessmentNextStep({
    clientId: client.id,
    assessmentId: assessmentDetails?.id,
    assessmentStatus: assessmentDetails?.status,
    deliverablePhase: assessmentDetails?.deliverablePhase,
    documentsNeeded: client.documentsNeeded,
    actionPlanEnabled,
  });
  const nextStepAlertClass =
    assessmentNextStep?.tone === "primary"
      ? "border-brand/30 bg-brand/5"
      : assessmentNextStep?.tone === "success"
        ? "border-emerald-500/30 bg-emerald-500/5"
        : "border-border bg-muted/30";
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <Link
          href="/advisor/pipeline"
          className="inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="mr-1.5 size-4" />
          Back to Pipeline
        </Link>
      </div>

      {!assignmentActive ? (
        <Alert className="mb-6 border-muted-foreground/30 bg-muted/40">
          <AlertTitle className="flex items-center gap-2">
            Your workflow is inactive
            <FieldHelp helpKey="pipeline-assignment-workflow" />
          </AlertTitle>
          <AlertDescription>
            This household is not in your active pipeline. Their account and
            history are kept, and another advisor may still have an active
            workflow with them. Use Restore to pipeline below to resume your
            work — history stays read-only until then.
          </AlertDescription>
        </Alert>
      ) : null}

      {assignmentActive && assessmentNextStep ? (
        <Alert
          className={cn("mb-6", nextStepAlertClass)}
          data-tour="pipeline-assessment-next-step"
        >
          <AlertTitle className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {assessmentNextStep.kicker}
            </span>
            <span>{assessmentNextStep.title}</span>
          </AlertTitle>
          <AlertDescription className="mt-2 space-y-3">
            <p>{assessmentNextStep.detail}</p>
            <Button
              asChild
              variant={assessmentNextStep.tone === "primary" ? "default" : "outline"}
              className="sm:w-auto"
            >
              <Link href={assessmentNextStep.href}>{assessmentNextStep.ctaLabel}</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Client Header */}
      <div className="mb-8" data-tour="pipeline-client-header">
        <div className="space-y-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{clientLabels.headline}</h1>
            <PipelineProcessStateLabel
              stage={client.stage}
              documentRequirementsEnabled={documentRequirementsEnabled}
              stalled={client.stalled}
            />
          </div>

          <p className="text-sm text-muted-foreground">
            {[
              clientLabels.metaEmail,
              `Assigned ${format(client.assignedAt, "MMM d, yyyy")}`,
              `Active ${formatDistanceToNow(client.lastActivity, { addSuffix: true })}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          {clientLabels.pseudonymous ? (
            <p className="text-sm leading-snug text-muted-foreground">
              {PSEUDONYMOUS_CLIENT_LABELING_NOTE}
            </p>
          ) : null}

          <div className="flex items-center gap-3 pt-1">
            <Progress
              value={client.progress}
              className="h-1.5 flex-1"
              aria-label={`Workflow progress ${client.progress}%`}
            />
            <span className="text-sm tabular-nums text-muted-foreground">{client.progress}%</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Workflow Timeline */}
          <Card data-tour="pipeline-workflow-timeline">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Workflow Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WorkflowTimeline
                events={timeline}
                currentStage={client.stage}
                documentRequirementsEnabled={documentRequirementsEnabled}
              />
            </CardContent>
          </Card>

          <Card data-tour="pipeline-intake">
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
                  assessmentDomainPicker={assessmentDomainPicker}
                  showWaiverAction={false}
                  canManageWaiverScope={canSkipIntake}
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
                        assessmentDomainPicker={assessmentDomainPicker}
                        showWaiverAction={canSkipIntake}
                        canManageWaiverScope={canSkipIntake}
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
                  assessmentDomainPicker={assessmentDomainPicker}
                  showWaiverAction={canSkipIntake}
                  canManageWaiverScope={canSkipIntake}
                  waiverLocked={assessmentStarted}
                />
              )}
            </CardContent>
          </Card>

          {/* Assessment Summary */}
          {assessmentDetails && (
            <Card data-tour="pipeline-assessment">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Risk Assessment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {client.staleScores && assessmentDetails.answersChangedAfterCompleteAt ? (
                  <Alert
                    variant="warning"
                    data-tour="pipeline-stale-scores-alert"
                  >
                    <AlertTitle className="flex items-center gap-1.5">
                      {STALE_SCORES_COPY.alertTitle}
                      <FieldHelp
                        helpKey="assessment-stale-scores-alert"
                        triggerLabel="Re-score vs reassessment"
                      />
                    </AlertTitle>
                    <AlertDescription className="space-y-3">
                      <p>
                        {STALE_SCORES_COPY.alertDescription}
                        {assessmentDetails.version
                          ? ` Currently scored as v${assessmentDetails.version}.`
                          : ""}{" "}
                        Answers were updated{" "}
                        {formatDistanceToNow(
                          new Date(assessmentDetails.answersChangedAfterCompleteAt),
                          { addSuffix: true },
                        )}
                        .
                      </p>
                      <RequestRescoreButton assessmentId={assessmentDetails.id} />
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
                    includedPillarIds={advisorAssignment.includedPillars}
                  />
                </div>

                {assessmentDetails.completedAt && (
                  <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:flex-wrap">
                    {assessmentDetails.status === "COMPLETED" &&
                    !isDeliverableProfilePublished(assessmentDetails.deliverablePhase) ? (
                      <Button variant="default" className="justify-center sm:w-auto" asChild>
                        <Link href={`/advisor/pipeline/${client.id}/report`}>
                          <FileText className="mr-2 h-4 w-4" />
                          Publish Risk Profile
                        </Link>
                      </Button>
                    ) : null}
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
                          {assessmentDetails.status === "COMPLETED"
                            ? "Review answers"
                            : "Review in-progress answers"}
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

                {!assessmentDetails.completedAt && assessmentDetails.id ? (
                  <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:flex-wrap">
                    <Button variant="default" className="justify-center sm:w-auto" asChild>
                      <Link
                        href={`/advisor/pipeline/${client.id}/assessment/${assessmentDetails.id}`}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Review in-progress answers
                      </Link>
                    </Button>
                  </div>
                ) : null}

                {assessmentDetails.id ? (
                  <ClientAssessmentLifecycleToolbar
                    assessmentId={assessmentDetails.id}
                    assessmentStatus={assessmentDetails.status}
                    showStaleScoresActions={false}
                    reassessmentEnabled={detail.assessmentLifecycle.reassessmentEnabled}
                    targetedQuestionCount={detail.assessmentLifecycle.targetedQuestionCount}
                  />
                ) : null}
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
            <ClientAuthControls
              clientId={client.id}
              currentEmail={client.email}
              pseudonymousLabeling={clientLabels.pseudonymous}
            />
          ) : null}

          {/* Document Requirements */}
          {assignmentActive && documentRequirementsEnabled ? (
            <div data-tour="pipeline-documents">
              <DocumentRequirements clientId={client.id} requirements={documentRequirements} />
            </div>
          ) : null}

          {/* Quick Actions */}
          <Card data-tour="pipeline-quick-actions">
            <CardHeader className="px-4 sm:px-5">
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-4 sm:px-5">
              <ClientWorkflowStatusControls
                clientId={client.id}
                status={advisorAssignment.status}
              />

              {assignmentActive ? (
                <ManualCompletionButton
                  clientId={client.id}
                  manuallyCompletedAt={advisorAssignment.manuallyCompletedAt}
                />
              ) : null}

              {assignmentActive ? (
                <AssessmentWaiverButton
                  clientId={client.id}
                  assessmentWaivedAt={advisorAssignment.assessmentWaivedAt}
                  intakeComplete={intakeSubmitted || intakeWaived}
                  assessmentStarted={assessmentStarted}
                />
              ) : null}

              {assignmentActive ? (
                <RestartIntakeButton
                  clientId={client.id}
                  disabled={!restartIntake.allowed}
                  disabledReason={restartIntakeBlockedReason}
                />
              ) : null}

              <Button variant="outline" className={SIDEBAR_ACTION_BTN} asChild>
                <Link href={assignmentActive ? "/advisor/pipeline" : "/advisor/pipeline?inactive=1"}>
                  <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
                  {assignmentActive ? "Back to Pipeline" : "Back to inactive clients"}
                </Link>
              </Button>

              {assessmentDetails?.completedAt && (
                <Button variant="outline" className={SIDEBAR_ACTION_BTN} asChild>
                  <Link href={`/advisor/analytics/${client.id}`}>
                    <BarChart3 className="h-3.5 w-3.5 shrink-0" />
                    Client Analytics
                  </Link>
                </Button>
              )}

              {assessmentDetails?.completedAt && actionPlanEnabled ? (
                <Button variant="outline" className={SIDEBAR_ACTION_BTN} asChild>
                  <Link href={`/advisor/clients/${client.id}/guidance`}>
                    <ClipboardList className="h-3.5 w-3.5 shrink-0" />
                    Client Guidance
                  </Link>
                </Button>
              ) : null}

              {/* §4.5 commit 3: link to the versioned report view instead
                  of inline-downloading the latest published. The list page
                  surfaces every version + the Edit Draft + Publish flow. */}
              {assessmentDetails?.id && assessmentDetails.score !== null && (
                <Button
                  variant={
                    assessmentDetails.status === "COMPLETED" &&
                    !isDeliverableProfilePublished(assessmentDetails.deliverablePhase)
                      ? "default"
                      : "outline"
                  }
                  className={SIDEBAR_ACTION_BTN}
                  asChild
                >
                  <Link href={`/advisor/pipeline/${client.id}/report`}>
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    {assessmentDetails.status === "COMPLETED" &&
                    !isDeliverableProfilePublished(assessmentDetails.deliverablePhase)
                      ? "Publish Risk Profile"
                      : "Reports"}
                  </Link>
                </Button>
              )}

              {canPermanentlyDelete ? (
                <PermanentDeleteClientButton
                  clientId={client.id}
                  clientName={clientLabels.headline}
                />
              ) : null}

            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}