"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAssessmentStore } from "@/lib/assessment/store";
import { useAssessmentPersistHydrated } from "@/lib/hooks/useAssessmentPersistHydrated";
import { useHouseholdProfile } from "@/lib/hooks/useHouseholdProfile";
import {
  useAllPillarQuestions,
  useAssessmentPillarDefinitions,
  useAssessmentPillarScores,
} from "@/lib/hooks/useAssessmentPillars";
import { PillarCard } from "@/components/assessment/PillarCard";
import { OverallProgress } from "@/components/assessment/ProgressBar";
import { CustomizationBanner } from "@/components/assessment/CustomizationBanner";
import { AssessmentScopeBanner } from "@/components/assessment/AssessmentScopeBanner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Clock } from "lucide-react";
import toast from "react-hot-toast";
import { getVisibleQuestions } from "@/lib/assessment/branching";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import type { CustomizationConfig } from "@/lib/assessment/customization";
import { normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import {
  isNarrowAssessmentScope,
} from "@/lib/assessment/included-pillars";
import { scopedPillarCatalog } from "@/lib/assessment/pillar-registry";
import { usePlatformPillarCatalog } from "@/lib/hooks/usePlatformPillarCatalog";
import type { RiskLevel } from "@/lib/assessment/types";

/**
 * Assessment Hub — entry point for advisor-scoped pillar domains.
 */
function AssessmentHubPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scopeExcluded = searchParams.get("scope") === "excluded";
  const store = useAssessmentStore();
  const persistHydrated = useAssessmentPersistHydrated();
  const { data: catalog = [] } = usePlatformPillarCatalog();
  const { pillars: pillarDefinitions, isLoading: catalogLoading } =
    useAssessmentPillarDefinitions();
  const [isInitializing, setIsInitializing] = useState(true);
  const { profile } = useHouseholdProfile();
  const { questionsByPillarId, isLoading: questionsLoading } = useAllPillarQuestions();
  const { data: pillarScores = [] } = useAssessmentPillarScores(store.assessmentId);

  const scoredPillarIds = useMemo(
    () => new Set(pillarScores.map((s) => normalizePillarSlug(s.pillar))),
    [pillarScores]
  );

  const FETCH_TIMEOUT_MS = 12_000;
  const { data: assessmentData, isError: assessmentFetchError } = useQuery({
    queryKey: ["assessment", store.assessmentId],
    queryFn: async () => {
      if (!store.assessmentId) return null;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      try {
        const response = await fetch(`/api/assessment/${store.assessmentId}`, {
          signal: controller.signal,
        });

        if (response.status === 404) {
          store.resetAssessment();
          return null;
        }

        if (!response.ok) {
          throw new Error("Failed to fetch assessment");
        }

        return response.json();
      } finally {
        clearTimeout(timeoutId);
      }
    },
    enabled: !!store.assessmentId && !store.isHydrated,
    retry: 1,
  });

  const { data: summaryAccess } = useQuery({
    queryKey: ["assessment-summary-access"],
    queryFn: async () => {
      const response = await fetch("/api/assessment/summary-access");
      if (!response.ok) {
        throw new Error("Failed to fetch summary access");
      }
      return response.json() as Promise<{
        canViewRiskPreview: boolean;
        canViewSummary: boolean;
        allPillarsComplete: boolean;
        advisorPublishedProfile: boolean;
        includedPillars: string[];
        actionPlanEnabled: boolean;
      }>;
    },
    staleTime: 30_000,
  });

  const { data: customizationConfig } = useQuery<CustomizationConfig>({
    queryKey: ["assessment-customization"],
    queryFn: async () => {
      const response = await fetch("/api/assessment/customization");
      if (!response.ok) throw new Error("Failed to fetch customization config");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!persistHydrated) return;

    if (assessmentData && !store.isHydrated) {
      store.loadFromServer(assessmentData);
      store.setHydrated(true);
    }

    if (!store.assessmentId && !store.isHydrated) {
      store.setHydrated(true);
    }

    if (assessmentFetchError && store.assessmentId && !store.isHydrated) {
      store.setHydrated(true);
    }

    const t = setTimeout(() => setIsInitializing(false), 0);
    return () => clearTimeout(t);
  }, [assessmentData, assessmentFetchError, persistHydrated, store]);

  const LOADING_MAX_MS = 15_000;
  useEffect(() => {
    const id = setTimeout(() => {
      store.setHydrated(true);
      setIsInitializing(false);
    }, LOADING_MAX_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const createAssessmentMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to create assessment");
      return response.json();
    },
    onError: () => {
      toast.error("Failed to start assessment");
    },
  });

  const navigateToPillar = (pillarSlug: string, questionIndex: number) => {
    store.setCurrentPosition(pillarSlug, questionIndex);
    router.push(`/assessment/${pillarSlug}/${questionIndex}`);
  };

  const ensureAssessmentAndGo = (pillarSlug: string, questionIndex: number) => {
    if (store.assessmentId) {
      navigateToPillar(pillarSlug, questionIndex);
      return;
    }
    createAssessmentMutation.mutate(undefined, {
      onSuccess: (data) => {
        store.setAssessmentId(data.id);
        navigateToPillar(pillarSlug, questionIndex);
      },
    });
  };

  const resolveResumeIndex = (pillarSlug: string): number => {
    const serverPillar = assessmentData?.currentPillar
      ? normalizePillarSlug(assessmentData.currentPillar)
      : null;
  const serverIndex =
      typeof assessmentData?.currentQuestionIndex === "number"
        ? assessmentData.currentQuestionIndex
        : null;

    if (serverPillar === pillarSlug && serverIndex != null && serverIndex >= 0) {
      return serverIndex;
    }

    if (store.currentPillar === pillarSlug && store.currentQuestionIndex != null) {
      return store.currentQuestionIndex;
    }

    return 0;
  };

  const handleStartAssessment = (pillarSlug: string) => {
    ensureAssessmentAndGo(pillarSlug, 0);
  };

  const handleContinueAssessment = (pillarSlug: string) => {
    store.cleanOrphanedAnswers();
    ensureAssessmentAndGo(pillarSlug, resolveResumeIndex(pillarSlug));
  };

  const includedPillars = useMemo(
    () => summaryAccess?.includedPillars ?? [],
    [summaryAccess?.includedPillars],
  );
  const includedPillarSet = useMemo(
    () => new Set(includedPillars.map(normalizePillarSlug)),
    [includedPillars],
  );
  const narrowScope =
    catalog.length > 0 && isNarrowAssessmentScope(includedPillars, catalog);
  const scopedDomainLabel = narrowScope
    ? `${includedPillars.length} risk domain${includedPillars.length === 1 ? "" : "s"}`
    : "Six risk domains";

  const assessmentPillars = useMemo(
    () =>
      pillarDefinitions
        .filter((pillar) => includedPillarSet.has(pillar.slug))
        .map((pillar) => ({
          pillar,
          questions: questionsByPillarId.get(pillar.slug) ?? [],
        })),
    [pillarDefinitions, questionsByPillarId, includedPillarSet],
  );

  const pillarStats = assessmentPillars.map(({ pillar, questions }) => {
    const pillarSlug = pillar.slug;

    const getPillarStatus = (): "not-started" | "in-progress" | "completed" => {
      if (!store.assessmentId) return "not-started";
      if (scoredPillarIds.has(pillarSlug)) return "completed";

      const answeredQuestions = questions.filter((q) => {
        const answer = store.answers[q.id];
        return answer !== undefined && answer !== null;
      });

      return answeredQuestions.length > 0 ? "in-progress" : "not-started";
    };

    const visibleQuestions = getVisibleQuestions(store.answers, questions, profile);
    const questionsAnswered = visibleQuestions.filter((q) => {
      const answer = store.answers[q.id];
      return answer !== undefined && answer !== null;
    }).length;
    const totalQuestions = visibleQuestions.length || questions.length;

    const scoreRow = pillarScores.find(
      (s) => normalizePillarSlug(s.pillar) === pillarSlug
    );

    return {
      pillar,
      status: getPillarStatus(),
      questionsAnswered,
      totalQuestions,
      estimatedDuration: pillar.estimatedMinutes,
      score: scoreRow?.score,
      riskLevel: scoreRow?.riskLevel?.toLowerCase() as RiskLevel | undefined,
    };
  });

  const completedPillarSlugs = pillarStats
    .filter((p) => p.status === "completed")
    .map((p) => p.pillar.slug);

  const focusAreaCount = customizationConfig?.emphasisAreas.length ?? 0;

  const resumePillar = pillarStats.find((p) => p.status === "in-progress");
  const nextPillar = pillarStats.find((p) => p.status === "not-started");
  const allPillarsComplete =
    summaryAccess?.allPillarsComplete ??
    (completedPillarSlugs.length === includedPillars.length &&
      includedPillars.every((id) =>
        completedPillarSlugs.includes(normalizePillarSlug(id)),
      ));

  const progressPillars = useMemo(
    () =>
      scopedPillarCatalog(catalog, includedPillars).map((pillar) => ({
        id: pillar.id,
        label: pillar.name,
      })),
    [catalog, includedPillars],
  );

  if (
    isInitializing ||
    catalogLoading ||
    questionsLoading ||
    (store.assessmentId && !store.isHydrated)
  ) {
    return (
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="space-y-4">
          <div className="h-8 w-64 rounded bg-secondary animate-pulse" />
          <div className="h-4 w-96 rounded bg-secondary animate-pulse" />
        </div>
        <div className="h-24 rounded-[1.5rem] bg-secondary animate-pulse" />
        <div className="h-64 rounded-[1.5rem] bg-secondary animate-pulse" />
      </div>
    );
  }

  const serverResumePillar = assessmentData?.currentPillar
    ? normalizePillarSlug(assessmentData.currentPillar)
    : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 sm:space-y-8">
      <section className="hero-surface rounded-[1.75rem] p-4 sm:p-8">
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <div className="rounded-full border section-divider bg-background/65 px-3 py-1.5">
            {scopedDomainLabel}
          </div>
          <div className="rounded-full border section-divider bg-background/65 px-3 py-1.5">
            Autosave enabled
          </div>
          <div className="rounded-full border section-divider bg-background/65 px-3 py-1.5">
            Advisory-style results
          </div>
        </div>
      </section>

      {scopeExcluded ? (
        <Alert variant="warning">
          <AlertTitle className="text-lg font-semibold">
            Domain not in your scope
          </AlertTitle>
          <AlertDescription>
            That risk domain is not part of your advisor&apos;s selected
            assessment scope. Choose one of the domains below to continue.
          </AlertDescription>
        </Alert>
      ) : null}

      <AssessmentScopeBanner includedPillars={includedPillars} />

      {store.assessmentId && pillarStats.some((p) => p.status === "in-progress") && (
        <Alert variant="info">
          <AlertTitle className="text-lg font-semibold">Welcome back</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              Continue from your last saved position
              {serverResumePillar
                ? ` (${pillarDefinitions.find((p) => p.slug === serverResumePillar)?.name ?? serverResumePillar})`
                : ""}
              . Progress is saved automatically.
            </p>
            {store.lastSaved && (
              <p className="text-sm flex items-center gap-2">
                <Clock className="h-3 w-3" />
                Last saved {formatDistanceToNow(new Date(store.lastSaved), { addSuffix: true })}
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {store.assessmentId && (
        <Card className="bg-background/55">
          <CardContent className="pt-6">
            <OverallProgress
              completedPillars={completedPillarSlugs}
              totalPillars={includedPillars.length}
              currentPillar={store.currentPillar || serverResumePillar || undefined}
              pillars={progressPillars}
            />
          </CardContent>
        </Card>
      )}

      {customizationConfig?.isCustomized && (
        <CustomizationBanner
          advisorName={customizationConfig.advisorName}
          focusAreaCount={focusAreaCount}
          estimatedMinutes={includedPillars.length * 12}
        />
      )}

      <section className="space-y-4">
        <div className="space-y-2">
          <p className="editorial-kicker">Risk domains</p>
          <h2 className="text-3xl font-semibold text-foreground">
            Household risk domains
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2" data-testid="assessment-pillar-grid">
          {pillarStats.map(
            ({ pillar, status, questionsAnswered, totalQuestions, score, riskLevel }) => (
              <PillarCard
                key={pillar.id}
                pillar={pillar}
                status={status}
                questionsAnswered={questionsAnswered}
                totalQuestions={totalQuestions}
                score={score}
                riskLevel={riskLevel}
                onClick={
                  status === "not-started"
                    ? () => handleStartAssessment(pillar.slug)
                    : () => handleContinueAssessment(pillar.slug)
                }
              />
            )
          )}

          <Card
            className="md:col-span-2 bg-background/55"
            data-testid="assessment-next-step"
          >
            <CardContent className="flex w-full flex-col items-start gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-2xl space-y-2">
                <p className="editorial-kicker">Next step</p>
                {allPillarsComplete ? (
                  <p className="text-base leading-7 text-muted-foreground">
                    {summaryAccess?.canViewSummary
                      ? narrowScope
                        ? `All ${includedPillars.length} selected risk domains are scored. Review your results and action plan, or download your report.`
                        : "All risk domains are scored. Review your results and action plan, or download your report."
                      : narrowScope
                        ? `All ${includedPillars.length} selected risk domains are scored. View your Risk Preview now. Your full Risk Profile and action plan will be available once your advisor publishes it.`
                        : "All risk domains are scored. View your Risk Preview now. Your full Risk Profile and action plan will be available once your advisor publishes it."}
                  </p>
                ) : resumePillar ? (
                  <p className="text-base leading-7 text-muted-foreground">
                    Continue your assessment to receive tailored recommendations for each domain.
                  </p>
                ) : (
                  <p className="text-base leading-7 text-muted-foreground">
                    {narrowScope
                      ? `Begin with any selected risk domain. Each saves progress independently; complete all ${includedPillars.length} to finish the assessment.`
                      : "Begin with any risk domain. Each saves progress independently; complete all risk domains to finish the assessment."}
                  </p>
                )}
              </div>

              <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:flex-row">
                {allPillarsComplete ? (
                  <>
                    {summaryAccess?.canViewSummary ? (
                      <>
                        <Button size="lg" onClick={() => router.push("/assessment/results")}>
                          View results
                        </Button>
                        {summaryAccess.actionPlanEnabled !== false ? (
                          <Button
                            variant="outline"
                            size="lg"
                            onClick={() => router.push("/dashboard/action-plan")}
                          >
                            View action plan
                          </Button>
                        ) : null}
                      </>
                    ) : summaryAccess?.canViewRiskPreview ? (
                      <Button size="lg" onClick={() => router.push("/assessment/risk-preview")}>
                        View risk preview
                      </Button>
                    ) : (
                      <Button
                        size="lg"
                        disabled
                        title={
                          narrowScope
                            ? `Complete all ${includedPillars.length} selected risk domains to continue`
                            : "Complete all risk domains to continue"
                        }
                      >
                        View risk preview
                      </Button>
                    )}
                    <Button variant="outline" size="lg" onClick={() => router.push("/dashboard")}>
                      Dashboard
                    </Button>
                  </>
                ) : resumePillar ? (
                  <Button
                    size="lg"
                    onClick={() => handleContinueAssessment(resumePillar.pillar.slug)}
                    disabled={createAssessmentMutation.isPending}
                  >
                    {createAssessmentMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Starting...
                      </>
                    ) : (
                      `Continue ${resumePillar.pillar.name}`
                    )}
                  </Button>
                ) : nextPillar ? (
                  <Button
                    size="lg"
                    onClick={() => handleStartAssessment(nextPillar.pillar.slug)}
                    disabled={createAssessmentMutation.isPending}
                  >
                    {createAssessmentMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Starting...
                      </>
                    ) : (
                      `Begin with ${nextPillar.pillar.name}`
                    )}
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

export default function AssessmentHubPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="h-8 w-64 rounded bg-secondary animate-pulse" />
          <div className="h-64 rounded-[1.5rem] bg-secondary animate-pulse" />
        </div>
      }
    >
      <AssessmentHubPageContent />
    </Suspense>
  );
}
