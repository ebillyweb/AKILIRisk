"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { AssessmentScopeBanner } from "@/components/assessment/AssessmentScopeBanner";
import { OverallProgress } from "@/components/assessment/ProgressBar";
import { PillarCard } from "@/components/assessment/PillarCard";
import { Button } from "@/components/ui/button";
import { getVisibleQuestions } from "@/lib/assessment/branching";
import {
  DEFAULT_INCLUDED_PILLARS,
  isNarrowAssessmentScope,
  resolveIncludedPillars,
} from "@/lib/assessment/included-pillars";
import { normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import {
  firstUnansweredQuestionIndex,
  resolveResumePillarSlug,
} from "@/lib/assessment/resolve-resume-index";
import { useAssessmentStore } from "@/lib/assessment/store";
import {
  useAllPillarQuestions,
  useAssessmentPillarDefinitions,
  useAssessmentPillarScores,
} from "@/lib/hooks/useAssessmentPillars";
import { usePlatformPillarCatalog } from "@/lib/hooks/usePlatformPillarCatalog";
import { scopedPillarCatalog } from "@/lib/assessment/pillar-registry";
import { useFacilitatedAssessmentHydration } from "@/lib/hooks/useFacilitatedAssessmentHydration";
import type { HouseholdProfile } from "@/lib/assessment/personalization";
import {
  facilitatedAssessmentQuestionPath,
  facilitatedPreviewPath,
} from "@/lib/facilitated/paths";
import type { RiskLevel } from "@/lib/assessment/types";

interface FacilitatedAssessmentHubProps {
  sessionId: string;
  assessmentId: string;
  includedPillars: string[];
  householdProfile?: HouseholdProfile | null;
}

export function FacilitatedAssessmentHub({
  sessionId,
  assessmentId,
  includedPillars: includedPillarsProp,
  householdProfile = null,
}: FacilitatedAssessmentHubProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldAutoResume = searchParams.get("resume") === "1";

  const answers = useAssessmentStore((s) => s.answers);
  const skippedQuestions = useAssessmentStore((s) => s.skippedQuestions);
  const currentPillar = useAssessmentStore((s) => s.currentPillar);
  const setHouseholdProfile = useAssessmentStore((s) => s.setHouseholdProfile);
  const setCurrentPosition = useAssessmentStore((s) => s.setCurrentPosition);

  const { data: catalog = [] } = usePlatformPillarCatalog();
  const { pillars: pillarDefinitions, isLoading: catalogLoading } =
    useAssessmentPillarDefinitions(includedPillarsProp);
  const { questionsByPillarId, isLoading: questionsLoading } = useAllPillarQuestions(
    includedPillarsProp,
    {
      facilitatedSessionId: sessionId,
      assessmentId,
    },
  );
  const { data: pillarScores = [] } = useAssessmentPillarScores(assessmentId, {
    facilitatedSessionId: sessionId,
  });
  const [didAutoResume, setDidAutoResume] = useState(false);
  const didAutoResumeRef = useRef(false);

  const includedPillars = useMemo(
    () =>
      resolveIncludedPillars(
        includedPillarsProp.length ? includedPillarsProp : [...DEFAULT_INCLUDED_PILLARS],
        catalog,
      ),
    [includedPillarsProp, catalog],
  );
  const includedSet = useMemo(
    () => new Set(includedPillars.map(normalizePillarSlug)),
    [includedPillars],
  );
  const narrowScope =
    catalog.length > 0 && isNarrowAssessmentScope(includedPillars, catalog);

  const progressPillars = useMemo(
    () =>
      scopedPillarCatalog(catalog, includedPillars).map((pillar) => ({
        id: pillar.id,
        label: pillar.name,
      })),
    [catalog, includedPillars],
  );

  const { data: assessmentData, isLoading: assessmentLoading } = useQuery({
    queryKey: ["facilitated-assessment", assessmentId, sessionId],
    queryFn: async () => {
      const res = await fetch(
        `/api/assessment/${assessmentId}?facilitatedSessionId=${encodeURIComponent(sessionId)}`,
      );
      if (!res.ok) throw new Error("Failed to load assessment");
      return res.json();
    },
    enabled: !!assessmentId,
  });

  const { isReady: assessmentSynced } = useFacilitatedAssessmentHydration(
    assessmentId,
    assessmentData,
    assessmentLoading,
  );

  useEffect(() => {
    setHouseholdProfile(householdProfile);
  }, [householdProfile, setHouseholdProfile]);

  const scoredPillarIds = useMemo(
    () => new Set(pillarScores.map((s) => normalizePillarSlug(s.pillar))),
    [pillarScores],
  );

  const assessmentPillars = useMemo(
    () =>
      pillarDefinitions
        .filter((p) => includedSet.has(p.slug))
        .map((pillar) => ({
          pillar,
          questions: questionsByPillarId.get(pillar.slug) ?? [],
        })),
    [pillarDefinitions, includedSet, questionsByPillarId],
  );

  const pillarStats = useMemo(
    () =>
      assessmentPillars.map(({ pillar, questions }) => {
        const pillarSlug = pillar.slug;
        const visibleQuestions = getVisibleQuestions(answers, questions, householdProfile);
        const questionsAnswered = visibleQuestions.filter((q) => {
          const answer = answers[q.id];
          return answer !== undefined && answer !== null;
        }).length;
        const totalQuestions = visibleQuestions.length || questions.length;
        const scoreRow = pillarScores.find(
          (s) => normalizePillarSlug(s.pillar) === pillarSlug,
        );

        let status: "not-started" | "in-progress" | "completed" = "not-started";
        if (scoredPillarIds.has(pillarSlug)) status = "completed";
        else if (questionsAnswered > 0) status = "in-progress";

        return {
          pillar,
          status,
          questionsAnswered,
          totalQuestions,
          estimatedDuration: pillar.estimatedMinutes,
          score: scoreRow?.score,
          riskLevel: scoreRow?.riskLevel?.toLowerCase() as RiskLevel | undefined,
        };
      }),
    [answers, assessmentPillars, householdProfile, pillarScores, scoredPillarIds],
  );

  const resumePillarSlug = useMemo(
    () =>
      resolveResumePillarSlug(
        pillarStats.map((stat) => ({
          slug: stat.pillar.slug,
          status: stat.status,
        })),
        assessmentData,
        currentPillar,
      ),
    [assessmentData, currentPillar, pillarStats],
  );

  const resolveQuestionIndex = (pillarSlug: string) => {
    const pillarQs = questionsByPillarId.get(pillarSlug) ?? [];
    const visible = getVisibleQuestions(answers, pillarQs, householdProfile);
    // Enter/resume a pillar at its FIRST unanswered question. For a brand-new
    // assessment this is question 1; jumping to the last unanswered question
    // dropped users at the end of the section.
    return firstUnansweredQuestionIndex(visible, answers, skippedQuestions);
  };

  const goToPillar = (pillarSlug: string, questionIndex?: number) => {
    const index = questionIndex ?? resolveQuestionIndex(pillarSlug);
    setCurrentPosition(pillarSlug, index);
    router.push(facilitatedAssessmentQuestionPath(sessionId, pillarSlug, index));
  };

  useEffect(() => {
    if (!shouldAutoResume || !assessmentSynced || questionsLoading || didAutoResumeRef.current) {
      return;
    }
    didAutoResumeRef.current = true;

    if (!resumePillarSlug) {
      setDidAutoResume(true);
      return;
    }

    const stat = pillarStats.find((p) => p.pillar.slug === resumePillarSlug);
    if (!stat || stat.status === "completed") {
      setDidAutoResume(true);
      return;
    }

    const store = useAssessmentStore.getState();
    const pillarQuestions = questionsByPillarId.get(resumePillarSlug) ?? [];
    const visibleQuestions = getVisibleQuestions(
      store.answers,
      pillarQuestions,
      householdProfile,
    );
    const index = firstUnansweredQuestionIndex(
      visibleQuestions,
      store.answers,
      store.skippedQuestions,
    );
    setCurrentPosition(resumePillarSlug, index);
    router.replace(
      facilitatedAssessmentQuestionPath(sessionId, resumePillarSlug, index, {
        resume: true,
      }),
    );
    setDidAutoResume(true);
  }, [
    shouldAutoResume,
    assessmentSynced,
    questionsLoading,
    resumePillarSlug,
    assessmentData,
    householdProfile,
    questionsByPillarId,
    router,
    sessionId,
    setCurrentPosition,
    pillarStats,
  ]);

  const completedCount = pillarStats.filter((p) => p.status === "completed").length;
  const allComplete = completedCount === includedPillars.length;

  if (!assessmentSynced || catalogLoading || questionsLoading || (shouldAutoResume && !didAutoResume)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      {narrowScope && <AssessmentScopeBanner includedPillars={includedPillars} />}

      <OverallProgress
        completedPillars={pillarStats
          .filter((p) => p.status === "completed")
          .map((p) => p.pillar.slug)}
        totalPillars={includedPillars.length}
        pillars={progressPillars}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pillarStats.map((stat) => (
          <PillarCard
            key={stat.pillar.slug}
            pillar={stat.pillar}
            status={stat.status}
            questionsAnswered={stat.questionsAnswered}
            totalQuestions={stat.totalQuestions}
            score={stat.score}
            riskLevel={stat.riskLevel}
            onClick={() => {
              if (stat.status === "completed") {
                goToPillar(stat.pillar.slug, 0);
              } else {
                goToPillar(stat.pillar.slug);
              }
            }}
          />
        ))}
      </div>

      {allComplete && (
        <div className="flex justify-end">
          <Button onClick={() => router.push(facilitatedPreviewPath(sessionId))}>
            View risk preview
          </Button>
        </div>
      )}
    </div>
  );
}
