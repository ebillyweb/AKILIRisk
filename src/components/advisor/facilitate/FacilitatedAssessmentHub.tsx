"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { useAssessmentStore } from "@/lib/assessment/store";
import {
  useAllPillarQuestions,
  useAssessmentPillarDefinitions,
  useAssessmentPillarScores,
} from "@/lib/hooks/useAssessmentPillars";
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
  const store = useAssessmentStore();
  const pillarDefinitions = useAssessmentPillarDefinitions();
  const { questionsByPillarId, isLoading: questionsLoading } = useAllPillarQuestions({
    facilitatedSessionId: sessionId,
    assessmentId,
  });
  const { data: pillarScores = [] } = useAssessmentPillarScores(assessmentId, {
    facilitatedSessionId: sessionId,
  });
  const [ready, setReady] = useState(false);

  const includedPillars = useMemo(
    () => resolveIncludedPillars(includedPillarsProp.length ? includedPillarsProp : [...DEFAULT_INCLUDED_PILLARS]),
    [includedPillarsProp],
  );
  const includedSet = useMemo(
    () => new Set(includedPillars.map(normalizePillarSlug)),
    [includedPillars],
  );
  const narrowScope = isNarrowAssessmentScope(includedPillars);

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

  useEffect(() => {
    const prior = useAssessmentStore.getState();
    store.setAssessmentId(assessmentId);
    store.setHouseholdProfile(householdProfile);
    if (assessmentData && (!prior.isHydrated || prior.assessmentId !== assessmentId)) {
      store.loadFromServer(assessmentData);
      store.setHydrated(true);
    }
    if (!assessmentLoading) setReady(true);
  }, [assessmentData, assessmentId, assessmentLoading, householdProfile, store]);

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

  const pillarStats = assessmentPillars.map(({ pillar, questions }) => {
    const pillarSlug = pillar.slug;
    const visibleQuestions = getVisibleQuestions(store.answers, questions, householdProfile);
    const questionsAnswered = visibleQuestions.filter((q) => {
      const answer = store.answers[q.id];
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
  });

  const completedCount = pillarStats.filter((p) => p.status === "completed").length;
  const allComplete = completedCount === includedPillars.length;

  const goToPillar = (pillarSlug: string, index = 0) => {
    store.setCurrentPosition(pillarSlug, index);
    router.push(facilitatedAssessmentQuestionPath(sessionId, pillarSlug, index));
  };

  if (!ready || questionsLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      {narrowScope && (
        <AssessmentScopeBanner includedPillars={includedPillars} />
      )}

      <OverallProgress
        completedPillars={pillarStats
          .filter((p) => p.status === "completed")
          .map((p) => p.pillar.slug)}
        totalPillars={includedPillars.length}
        scopedPillarIds={includedPillars}
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
              } else if (stat.status === "in-progress") {
                goToPillar(stat.pillar.slug, store.currentQuestionIndex ?? 0);
              } else {
                goToPillar(stat.pillar.slug, 0);
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
