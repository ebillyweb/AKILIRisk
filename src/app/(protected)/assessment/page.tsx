"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAssessmentStore } from "@/lib/assessment/store";
import { useHouseholdProfile } from "@/lib/hooks/useHouseholdProfile";
import {
  useAllPillarQuestions,
  useAssessmentPillarDefinitions,
  useAssessmentPillarScores,
} from "@/lib/hooks/useAssessmentPillars";
import { PillarCard } from "@/components/assessment/PillarCard";
import { OverallProgress } from "@/components/assessment/ProgressBar";
import { CustomizationBanner } from "@/components/assessment/CustomizationBanner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Clock } from "lucide-react";
import toast from "react-hot-toast";
import { getVisibleQuestions } from "@/lib/assessment/branching";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import type { CustomizationConfig } from "@/lib/assessment/customization";
import { ASSESSMENT_PILLAR_IDS, normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import type { RiskLevel } from "@/lib/assessment/types";

/**
 * Assessment Hub — six-pillar entry point with server-authoritative resume.
 */
export default function AssessmentHubPage() {
  const router = useRouter();
  const store = useAssessmentStore();
  const pillarDefinitions = useAssessmentPillarDefinitions();
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
  }, [assessmentData, assessmentFetchError, store]);

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

  const assessmentPillars = useMemo(
    () =>
      pillarDefinitions.map((pillar) => ({
        pillar,
        questions: questionsByPillarId.get(pillar.slug) ?? [],
      })),
    [pillarDefinitions, questionsByPillarId]
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

  if (
    isInitializing ||
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
            Six risk pillars
          </div>
          <div className="rounded-full border section-divider bg-background/65 px-3 py-1.5">
            Autosave enabled
          </div>
          <div className="rounded-full border section-divider bg-background/65 px-3 py-1.5">
            Advisory-style results
          </div>
        </div>
      </section>

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
              totalPillars={ASSESSMENT_PILLAR_IDS.length}
              currentPillar={store.currentPillar || serverResumePillar || undefined}
            />
          </CardContent>
        </Card>
      )}

      {customizationConfig?.isCustomized && (
        <CustomizationBanner
          advisorName={customizationConfig.advisorName}
          focusAreaCount={focusAreaCount}
          estimatedMinutes={ASSESSMENT_PILLAR_IDS.length * 12}
        />
      )}

      <section className="space-y-4">
        <div className="space-y-2">
          <p className="editorial-kicker">Assessment pillars</p>
          <h2 className="text-3xl font-semibold">Household risk domains</h2>
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
        </div>
      </section>

      <section className="hero-surface rounded-[1.75rem] border-t section-divider p-6 sm:p-8">
        <div className="flex flex-col items-start gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className="editorial-kicker">Next step</p>
            {completedPillarSlugs.length === ASSESSMENT_PILLAR_IDS.length ? (
              <p className="text-base leading-7 text-muted-foreground">
                All six pillars are scored. Review your results and download your report once
                your advisor publishes it.
              </p>
            ) : pillarStats.some((p) => p.status === "in-progress") ? (
              <p className="text-base leading-7 text-muted-foreground">
                Continue your assessment to receive tailored recommendations for each domain.
              </p>
            ) : (
              <p className="text-base leading-7 text-muted-foreground">
                Begin with any pillar. Each domain saves progress independently; complete all
                six to finish the assessment.
              </p>
            )}
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            {completedPillarSlugs.length === ASSESSMENT_PILLAR_IDS.length ? (
              <>
                <Button size="lg" onClick={() => router.push("/assessment/results")}>
                  View results
                </Button>
                <Button variant="outline" size="lg" onClick={() => router.push("/dashboard")}>
                  Dashboard
                </Button>
              </>
            ) : (() => {
              const resumePillar =
                (serverResumePillar &&
                  pillarStats.find((p) => p.pillar.slug === serverResumePillar)) ||
                pillarStats.find((p) => p.status === "in-progress");

              if (resumePillar) {
                return (
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
                );
              }

              return (
                <Button
                  size="lg"
                  onClick={() => handleStartAssessment("governance")}
                  disabled={createAssessmentMutation.isPending}
                >
                  {createAssessmentMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Starting...
                    </>
                  ) : (
                    "Begin with Governance"
                  )}
                </Button>
              );
            })()}
          </div>
        </div>
      </section>
    </div>
  );
}
