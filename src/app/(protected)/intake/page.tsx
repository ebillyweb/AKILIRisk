import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth";
import {
  getActiveIntakeInterviewAction,
  getLatestIntakeInterviewAction,
  startIntakeInterview,
} from "@/lib/actions/intake-actions";
import { getClientIntakeGateState } from "@/lib/client/intake-gate";
import { getClientAssessmentSummaryAccess } from "@/lib/client/assessment-summary-gate";
import { prisma } from "@/lib/db";
import { loadIntakeScriptQuestions } from "@/lib/intake/load-intake-script";
import { buildSignInHref } from "@/lib/auth/sign-in-routes";

/**
 * Intake Landing Page
 *
 * Entry point for family governance intake interviews. Checks for existing active
 * interviews and provides a clear starting point with expectations.
 */

export default async function IntakePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(buildSignInHref({ callbackUrl: "/intake" }));
  }

  const gate = await getClientIntakeGateState(session.user.id);

  // Check for existing active interview
  const activeResult = await getActiveIntakeInterviewAction();

  if (activeResult.success && activeResult.interview) {
    redirect(`/intake/interview`);
  }

  const latestResult = await getLatestIntakeInterviewAction();
  if (
    latestResult.success &&
    latestResult.interview?.status === "SUBMITTED"
  ) {
    redirect("/intake/complete");
  }

  if (gate.intakeWaived && !gate.hasSubmittedInterview) {
    const latestAssessment = await prisma.assessment.findFirst({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      select: { status: true },
    });
    const assessmentComplete = latestAssessment?.status === "COMPLETED";
    const assessmentInProgress = latestAssessment?.status === "IN_PROGRESS";

    let assessmentHref = "/assessment";
    if (assessmentComplete) {
      const summaryAccess = await getClientAssessmentSummaryAccess(session.user.id);
      if (summaryAccess.canViewSummary) {
        assessmentHref = "/assessment/results";
      } else if (summaryAccess.canViewRiskPreview) {
        assessmentHref = "/assessment/risk-preview";
      }
    }

    const ctaLabel = assessmentComplete
      ? "Review completed assessment"
      : assessmentInProgress
        ? "Continue assessment"
        : "Begin assessment";

    return (
      <div className="max-w-2xl mx-auto py-8 sm:py-12">
        <div className="space-y-8">
          <Card className="p-6 sm:p-8 space-y-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-primary" aria-hidden />
              </div>
              <div className="space-y-2">
                <Badge variant="secondary">Intake waived</Badge>
                <h2 className="text-xl font-medium">
                  {assessmentComplete
                    ? "Your assessment is complete"
                    : "You can skip the intake interview"}
                </h2>
                <p className="text-muted-foreground max-w-md">
                  {assessmentComplete
                    ? "Your advisor waived the intake interview. Review your completed personal risk profile and any published results."
                    : "Your advisor waived the family governance intake interview for your household. You can go straight to the personal risk profile when you are ready."}
                </p>
              </div>
            </div>

            <div className="border-t pt-6 space-y-4">
              <Button size="lg" className="w-full" asChild>
                <Link href={assessmentHref}>
                  {ctaLabel}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                If you have questions about this step, contact your advisor.
              </p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Source the count from the same loader the wizard uses so the landing
  // copy stays in sync if questions are added/hidden in the pillar bank.
  const intakeQuestions = await loadIntakeScriptQuestions();
  const questionCount = intakeQuestions.length;

  // Server action to start a new interview
  async function handleStartInterview() {
    "use server";

    const result = await startIntakeInterview();

    if (result.success) {
      redirect("/intake/interview");
    }

    // If there's an error, the page will re-render
    // In production, we'd want better error handling here
  }

  return (
    <div className="max-w-2xl mx-auto py-8 sm:py-12">
      <div className="space-y-8">
        {/* Interview Overview Card */}
        <Card className="p-6 sm:p-8 space-y-6">
          <div className="space-y-4">
            <h2 className="text-xl font-medium">What to Expect</h2>
            <div className="space-y-3 text-muted-foreground">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-primary rounded-full shrink-0" />
                <span>{questionCount} focused questions about your family&apos;s governance approach</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-primary rounded-full shrink-0" />
                <span>Audio responses that give your advisor rich context</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-primary rounded-full shrink-0" />
                <span>One question at a time with clear progress tracking</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-primary rounded-full shrink-0" />
                <span>Automatic saving - you can pause and resume anytime</span>
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm font-medium text-muted-foreground">ESTIMATED TIME</span>
              <span className="text-2xl font-semibold">10-15 min</span>
            </div>

            <form action={handleStartInterview} className="space-y-4">
              <Button type="submit" size="lg" className="w-full">
                Begin Interview
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Your browser will request microphone access to record your responses.
              </p>
            </form>
          </div>
        </Card>

        {/* Additional Context */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Your responses will be reviewed by a qualified advisor to customize your personal risk profile.
          </p>
        </div>
      </div>
    </div>
  );
}
