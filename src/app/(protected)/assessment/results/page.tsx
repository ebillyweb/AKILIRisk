"use client";

/**
 * Assessment Results Page
 *
 * Displays completed assessment results with score, risk drivers, and action plan.
 * Calculates score on first visit if not already computed.
 */

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAssessmentStore } from "@/lib/assessment/store";
import { resolveScoringPillar } from "@/lib/assessment/scoring-pillar";
import { ScoreDisplay } from "@/components/assessment/ScoreDisplay";
import { RiskDrivers } from "@/components/assessment/RiskDrivers";
import { ActionPlan } from "@/components/assessment/ActionPlan";
import { FacilitatedRecommendations } from "@/components/assessment/FacilitatedRecommendations";
import { DeliverablePhaseBanner } from "@/components/deliverable/DeliverablePhaseBanner";
import { deliverableBannerBrandingProps } from "@/lib/client/deliverable-banner-branding";
import { useBrandingOptional } from "@/components/providers/BrandingProvider";
import { actionPlanDepthForPhase } from "@/lib/assessment/plan-depth";
import type { ClientFacilitatedRecommendation } from "@/lib/client/assessment-recommendations";
import type { DeliverablePhase, PortfolioEngagementStatus } from "@prisma/client";
import { DownloadSection } from "@/components/reports/DownloadSection";
import { TemplateList } from "@/components/reports/TemplateList";
import { Button } from "@/components/ui/button";
import { Loader2, Shield } from "lucide-react";
import { format } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { scopeEmphasisLabel } from "@/lib/assessment/customization";
import { pillarDisplayName as getPillarDisplayName, normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import { usePlatformPillarCatalog } from "@/lib/hooks/usePlatformPillarCatalog";
import { MATURITY_SCALE_MAX } from "@/lib/assessment/maturity-scale";
import type { RiskLevel } from "@/lib/assessment/types";

interface ScoreData {
  score: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  breakdown: Array<{
    categoryId: string;
    categoryName: string;
    score: number;
    weight: number;
    maxScore: number;
  }>;
  missingControls: Array<{
    questionId: string;
    category: string;
    description: string;
    severity: "high" | "medium" | "low";
    recommendation: string;
    maturityScore?: number;
    remediationPriority?: number;
    riskRelevance?: string;
  }>;
  pillarNarratives?: string[];
  completedAt: string;
  customization?: {
    isCustomized: boolean;
    focusAreaCount: number;
    includedPillarCount?: number;
    emphasisMultiplier: number;
  };
}

export default function AssessmentResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pillarParam = searchParams.get("pillar");
  const { data: catalog = [] } = usePlatformPillarCatalog();
  const { assessmentId, markPillarComplete, currentPillar, completedPillars } = useAssessmentStore();
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  /** Pillar we actually loaded/scored (may differ from `currentPillar` if store was stale). */
  const [resultsPillar, setResultsPillar] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReadyForRedirects, setIsReadyForRedirects] = useState(false);
  const [deliverablePhase, setDeliverablePhase] = useState<DeliverablePhase | null>(
    null,
  );
  const [facilitatedRecommendations, setFacilitatedRecommendations] = useState<
    ClientFacilitatedRecommendation[]
  >([]);
  const [deliverableMeta, setDeliverableMeta] = useState<{
    upsellTriggersFired: string[] | null;
    previewEnteredAt: string | null;
    profileEnteredAt: string | null;
    engagement: {
      status: PortfolioEngagementStatus;
      meetingScheduledAt: Date | null;
      meetingAt: Date | null;
    } | null;
  } | null>(null);
  const bannerBranding = deliverableBannerBrandingProps(
    useBrandingOptional()?.branding ?? null,
  );

  useEffect(() => {
    const timer = setTimeout(() => setIsReadyForRedirects(true), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isReadyForRedirects) {
      return;
    }

    async function loadScore() {
      if (!assessmentId) {
        router.push("/assessment");
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const targetPillar = normalizePillarSlug(
          pillarParam ?? (await resolveScoringPillar(assessmentId, currentPillar))
        );

        // Try to fetch existing score for the current pillar
        let response = await fetch(`/api/assessment/${assessmentId}/score?pillar=${targetPillar}`);

        if (response.status === 404) {
          // No score exists yet, trigger calculation
          response = await fetch(`/api/assessment/${assessmentId}/score`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pillar: targetPillar }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to calculate score");
          }
        } else if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to load score");
        }

        const data = await response.json();
        setResultsPillar(targetPillar);
        setScoreData(data);

        const recResponse = await fetch(
          `/api/assessment/${assessmentId}/recommendations`,
        );
        if (recResponse.ok) {
          const recData = (await recResponse.json()) as {
            deliverablePhase: DeliverablePhase;
            recommendations: ClientFacilitatedRecommendation[];
            upsellTriggersFired: string[] | null;
            previewEnteredAt: string | null;
            profileEnteredAt: string | null;
            engagement: {
              status: PortfolioEngagementStatus;
              meetingScheduledAt: string | null;
              meetingAt: string | null;
            } | null;
          };
          setDeliverablePhase(recData.deliverablePhase);
          setFacilitatedRecommendations(recData.recommendations);
          setDeliverableMeta({
            upsellTriggersFired: recData.upsellTriggersFired,
            previewEnteredAt: recData.previewEnteredAt,
            profileEnteredAt: recData.profileEnteredAt,
            engagement: recData.engagement
              ? {
                  status: recData.engagement.status,
                  meetingScheduledAt: recData.engagement.meetingScheduledAt
                    ? new Date(recData.engagement.meetingScheduledAt)
                    : null,
                  meetingAt: recData.engagement.meetingAt
                    ? new Date(recData.engagement.meetingAt)
                    : null,
                }
              : null,
          });
        }

        // Mark pillar as complete in store
        markPillarComplete(targetPillar);
      } catch (err) {
        console.error("Error loading score:", err);
        setError(err instanceof Error ? err.message : "Failed to load results");
      } finally {
        setIsLoading(false);
      }
    }

    loadScore();
  }, [assessmentId, router, markPillarComplete, currentPillar, isReadyForRedirects, pillarParam]);

  if (isLoading || !isReadyForRedirects) {
    const loadingPillar = normalizePillarSlug(pillarParam ?? currentPillar ?? "governance");
    const loadingLabel = getPillarDisplayName(loadingPillar, catalog);

    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-brand mx-auto" />
          <p className="text-muted-foreground">Calculating your {loadingLabel} assessment results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="max-w-2xl w-full space-y-4">
          <Alert variant="destructive">
            <AlertTitle>Unable to load results</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="flex gap-3">
            <Button
              onClick={() => router.push("/assessment")}
              variant="outline"
              className="flex-1"
            >
              Return to Assessment
            </Button>
            <Button
              onClick={() => window.location.reload()}
              className="flex-1"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!scoreData || !assessmentId) {
    return null;
  }

  // Calculate answered percentage from breakdown
  const totalQuestions = scoreData.breakdown.reduce(
    (sum, cat) => sum + cat.weight,
    0
  );
  const answeredCount = scoreData.breakdown.reduce(
    (sum, cat) => sum + (cat.score > 0 ? cat.weight : 0),
    0
  );
  const answeredPercentage = (answeredCount / totalQuestions) * 100;

  const targetPillar = normalizePillarSlug(
    resultsPillar ?? pillarParam ?? currentPillar ?? "governance"
  );
  const pillarLabel = getPillarDisplayName(targetPillar, catalog);

  const isCyberOnlyScore =
    scoreData.breakdown.length === 1 && scoreData.breakdown[0]?.categoryId === "cyber-digital";
  const scoreRubric = isCyberOnlyScore ? "cyber" : "governance";
  const planDepth = deliverablePhase
    ? actionPlanDepthForPhase(deliverablePhase)
    : "profile";
  const phaseLabel =
    deliverablePhase === "PORTFOLIO"
      ? "Risk Portfolio"
      : deliverablePhase === "PROFILE"
        ? "Risk Profile"
        : "Results";

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {deliverablePhase && deliverableMeta && assessmentId ? (
        <DeliverablePhaseBanner
          assessmentId={assessmentId}
          phase={deliverablePhase}
          upsellTriggersFired={deliverableMeta.upsellTriggersFired}
          engagement={deliverableMeta.engagement}
          previewEnteredAt={
            deliverableMeta.previewEnteredAt
              ? new Date(deliverableMeta.previewEnteredAt)
              : null
          }
          profileEnteredAt={
            deliverableMeta.profileEnteredAt
              ? new Date(deliverableMeta.profileEnteredAt)
              : null
          }
          advisorTeamLabel={bannerBranding.advisorTeamLabel}
          brandHex={bannerBranding.brandHex}
        />
      ) : null}

      <section className="hero-surface rounded-[1.75rem] p-6 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div className="space-y-3">
            <p className="editorial-kicker">{phaseLabel}</p>
            <h1 className="text-4xl font-semibold text-balance sm:text-5xl">
              {pillarLabel} assessment results
            </h1>
            <p className="text-sm leading-7 text-muted-foreground sm:text-base">
              Completed on {format(new Date(scoreData.completedAt), "MMMM d, yyyy 'at' h:mm a")}
            </p>
            {scoreData.customization?.isCustomized && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                <span>
                  Advisor-customized assessment —{" "}
                  {scopeEmphasisLabel(
                    scoreData.customization.focusAreaCount,
                    scoreData.customization.includedPillarCount ??
                      scoreData.customization.focusAreaCount,
                  ).toLowerCase()}
                </span>
              </div>
            )}
          </div>

          <Card className="bg-background/60">
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
              <div>
                <p className="editorial-kicker">Overall Score</p>
                <p className="mt-2 text-3xl font-semibold">
                  {scoreData.score.toFixed(1)} / {MATURITY_SCALE_MAX}
                </p>
              </div>
              <div>
                <p className="editorial-kicker">Completion</p>
                <p className="mt-2 text-3xl font-semibold">{Math.round(answeredPercentage)}%</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card>
        <CardContent className="pt-8">
          <ScoreDisplay
            score={scoreData.score}
            riskLevel={scoreData.riskLevel}
            breakdown={scoreData.breakdown}
            answeredPercentage={answeredPercentage}
            scoreRubric={scoreRubric}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardContent className="pt-8">
            <RiskDrivers
              missingControls={scoreData.missingControls}
              riskLevel={scoreData.riskLevel}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-8">
            <ActionPlan
              missingControls={scoreData.missingControls}
              pillarName={pillarLabel}
              riskLevel={scoreData.riskLevel.toLowerCase() as RiskLevel}
              scoreRubric={scoreRubric}
              pillarNarratives={scoreData.pillarNarratives ?? []}
              planDepth={planDepth}
            />
          </CardContent>
        </Card>
      </div>

      {deliverablePhase && facilitatedRecommendations.length > 0 ? (
        <Card>
          <CardContent className="pt-8">
            <FacilitatedRecommendations
              recommendations={facilitatedRecommendations}
              deliverablePhase={deliverablePhase}
            />
          </CardContent>
        </Card>
      ) : null}

      {targetPillar === "family-governance" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardContent className="pt-8">
              <DownloadSection assessmentId={assessmentId} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-8">
              <TemplateList assessmentId={assessmentId} />
            </CardContent>
          </Card>
        </div>
      )}

      <section className="flex flex-col gap-3 border-t section-divider pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Button
          onClick={() => router.push("/assessment")}
          variant="outline"
        >
          Review Answers
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row">
          {(() => {
            // Check if there's another pillar to complete
            const allPillars = ["family-governance", "identity-risk"];
            const incompletePillar = allPillars.find(p => !completedPillars.includes(p));

            if (incompletePillar && incompletePillar !== targetPillar) {
              const nextPillarName = incompletePillar === "identity-risk" ? "Identity Risk" : "Comprehensive Risk";
              return (
                <Button
                  onClick={() => router.push("/assessment")}
                  variant="outline"
                >
                  Continue to {nextPillarName}
                </Button>
              );
            }
            return null;
          })()}
          <Button
            onClick={() => router.push("/dashboard")}
          >
            Return to Dashboard
          </Button>
        </div>
      </section>
    </div>
  );
}
