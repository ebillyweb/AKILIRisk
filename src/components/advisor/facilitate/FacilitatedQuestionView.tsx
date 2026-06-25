"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { NavigationButtons } from "@/components/assessment/NavigationButtons";
import { QuestionCard } from "@/components/assessment/QuestionCard";
import { SectionProgress } from "@/components/assessment/ProgressBar";
import { SkipToLastUnansweredQuestion } from "@/components/assessment/SkipToLastUnansweredQuestion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getPersonalizedText } from "@/lib/assessment/personalization";
import type { HouseholdProfile } from "@/lib/assessment/personalization";
import { hasDocumentUploadFiles } from "@/lib/assessment/question-upload";
import {
  isAssessmentPillarId,
  normalizePillarSlug,
  pillarDefinitionFor,
} from "@/lib/assessment/pillar-registry";
import { isPillarInAssessmentScope } from "@/lib/assessment/included-pillars";
import {
  resolveResumeQuestionIndexForPillar,
} from "@/lib/assessment/resolve-resume-index";
import { useAssessmentStore } from "@/lib/assessment/store";
import { useAutoSave } from "@/lib/hooks/useAutoSave";
import { useAssessmentNavigation } from "@/lib/hooks/useAssessmentNavigation";
import {
  useAssessmentPillarScores,
  usePillarQuestions,
} from "@/lib/hooks/useAssessmentPillars";
import { usePlatformPillarCatalog } from "@/lib/hooks/usePlatformPillarCatalog";
import { useFacilitatedAssessmentHydration } from "@/lib/hooks/useFacilitatedAssessmentHydration";
import {
  facilitatedAssessmentCompletePath,
  facilitatedAssessmentHubPath,
  facilitatedAssessmentQuestionPath,
} from "@/lib/facilitated/paths";

interface FacilitatedQuestionViewProps {
  sessionId: string;
  assessmentId: string;
  includedPillars: string[];
  pillarSlug: string;
  questionIndex: number;
  householdProfile?: HouseholdProfile | null;
}

export function FacilitatedQuestionView({
  sessionId,
  assessmentId,
  includedPillars,
  pillarSlug: rawSlug,
  questionIndex,
  householdProfile = null,
}: FacilitatedQuestionViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldAutoResume = searchParams.get("resume") === "1";
  const [resumeReady, setResumeReady] = useState(!shouldAutoResume);
  const pillarSlug = normalizePillarSlug(rawSlug);
  const { answers, setHouseholdProfile, skippedQuestions, setCurrentPosition } =
    useAssessmentStore();
  const { data: pillarQuestionData, isLoading: questionsLoading, isError: questionsError } =
    usePillarQuestions(pillarSlug, {
      facilitatedSessionId: sessionId,
      assessmentId,
    });
  const pillarQuestions = pillarQuestionData?.questions ?? [];
  const { data: catalog = [] } = usePlatformPillarCatalog();
  const currentPillar = pillarDefinitionFor(pillarSlug, catalog);

  const navPaths = useMemo(
    () => ({
      hub: facilitatedAssessmentHubPath(sessionId),
      pillarQuestion: (slug: string, index: number) =>
        facilitatedAssessmentQuestionPath(sessionId, slug, index),
      pillarComplete: facilitatedAssessmentCompletePath(sessionId),
    }),
    [sessionId],
  );

  const {
    currentQuestion,
    currentIndex,
    goNext,
    goBack,
    canGoBack,
    isLastQuestion,
    progress,
    visibleQuestions,
    branchingChange,
  } = useAssessmentNavigation(pillarSlug, questionIndex, {
    questions: pillarQuestions,
    paths: navPaths,
  });

  const { saveAnswer, flushPendingSaves, isSaving } = useAutoSave(assessmentId, {
    facilitatedSessionId: sessionId,
  });
  const { data: pillarScores = [] } = useAssessmentPillarScores(assessmentId, {
    facilitatedSessionId: sessionId,
  });

  const { data: assessmentData, isLoading: assessmentLoading, isError: assessmentError } =
    useQuery({
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

  const pillarHasScore = useMemo(
    () =>
      pillarScores.some(
        (score) => normalizePillarSlug(score.pillar) === pillarSlug,
      ),
    [pillarScores, pillarSlug],
  );

  useEffect(() => {
    setHouseholdProfile(householdProfile);
  }, [householdProfile, setHouseholdProfile]);

  useEffect(() => {
    if (!shouldAutoResume) {
      setResumeReady(true);
      return;
    }
    if (pillarHasScore || !assessmentSynced || questionsLoading) {
      return;
    }
    setResumeReady(true);
    if (searchParams.get("resume") === "1") {
      router.replace(facilitatedAssessmentQuestionPath(sessionId, pillarSlug, questionIndex));
    }
  }, [
    shouldAutoResume,
    pillarHasScore,
    assessmentSynced,
    questionsLoading,
    questionIndex,
    pillarSlug,
    router,
    sessionId,
    searchParams,
  ]);

  useEffect(() => {
    if (rawSlug !== pillarSlug && catalog.length > 0 && isAssessmentPillarId(pillarSlug, catalog)) {
      router.replace(facilitatedAssessmentQuestionPath(sessionId, pillarSlug, questionIndex));
    }
  }, [rawSlug, pillarSlug, questionIndex, router, sessionId, catalog]);

  useEffect(() => {
    if (catalog.length === 0) return;
    if (!isPillarInAssessmentScope(pillarSlug, includedPillars, catalog)) {
      router.replace(facilitatedAssessmentHubPath(sessionId));
    }
  }, [includedPillars, pillarSlug, router, sessionId, catalog]);

  useEffect(() => {
    if (pillarHasScore) return;
    if (questionsLoading || visibleQuestions.length === 0) return;
    if (questionIndex < 0 || questionIndex >= visibleQuestions.length) {
      const resumeIndex = resolveResumeQuestionIndexForPillar(
        pillarSlug,
        pillarQuestions,
        householdProfile,
        {
          answers,
          skippedQuestions,
          currentPillar: useAssessmentStore.getState().currentPillar,
          currentQuestionIndex: useAssessmentStore.getState().currentQuestionIndex,
        },
        assessmentData,
      );
      router.replace(
        facilitatedAssessmentQuestionPath(sessionId, pillarSlug, resumeIndex),
      );
    }
  }, [
    questionIndex,
    visibleQuestions.length,
    pillarSlug,
    router,
    questionsLoading,
    sessionId,
    pillarQuestions,
    householdProfile,
    answers,
    skippedQuestions,
    assessmentData,
    pillarHasScore,
  ]);

  useEffect(() => {
    if (!branchingChange || branchingChange.newlyVisible.length === 0) return;
    void (async () => {
      await flushPendingSaves();
      const newlyVisibleIndex = visibleQuestions.findIndex((q) =>
        branchingChange.newlyVisible.includes(q.id),
      );
      if (newlyVisibleIndex !== -1) {
        router.push(
          facilitatedAssessmentQuestionPath(sessionId, pillarSlug, newlyVisibleIndex),
        );
      }
    })();
  }, [branchingChange, visibleQuestions, pillarSlug, router, flushPendingSaves, sessionId]);

  if (questionsError || assessmentError) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Unable to load this assessment question. Return to the hub and try again.
        </p>
        <Button asChild variant="outline">
          <Link href={facilitatedAssessmentHubPath(sessionId)}>Back to assessment</Link>
        </Button>
      </div>
    );
  }

  if (questionsLoading || !assessmentSynced || !resumeReady || !currentQuestion) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        Loading question…
      </div>
    );
  }

  const currentAnswer = answers[currentQuestion.id];
  const personalizedText = getPersonalizedText(currentQuestion, householdProfile);

  const handleAnswer = (answer: unknown) => {
    saveAnswer({
      questionId: currentQuestion.id,
      pillar: pillarSlug,
      subCategory: currentQuestion.subCategory,
      answer,
      currentQuestionIndex: questionIndex,
    });
  };

  const handleSkip = () => {
    const nextIndex = currentIndex + 1;
    saveAnswer({
      questionId: currentQuestion.id,
      pillar: pillarSlug,
      subCategory: currentQuestion.subCategory,
      answer: null,
      skipped: true,
      currentQuestionIndex: nextIndex,
    });
    void (async () => {
      await flushPendingSaves();
      goNext();
    })();
  };

  const handleNext = () => {
    if (
      currentQuestion.required &&
      (currentAnswer === null || currentAnswer === undefined) &&
      !skippedQuestions.includes(currentQuestion.id)
    ) {
      return;
    }
    if (
      currentQuestion.type === "document-upload" &&
      currentQuestion.required &&
      !hasDocumentUploadFiles(currentAnswer)
    ) {
      return;
    }
    void (async () => {
      await flushPendingSaves();
      goNext();
    })();
  };

  const isQuestionSkipped = skippedQuestions.includes(currentQuestion.id);
  const isValid =
    isQuestionSkipped ||
    (currentQuestion.type === "document-upload"
      ? hasDocumentUploadFiles(currentAnswer)
      : !currentQuestion.required ||
        (currentAnswer !== null && currentAnswer !== undefined));

  const handleBack = () => {
    void (async () => {
      await flushPendingSaves();
      goBack();
    })();
  };

  const handleJumpToLastUnanswered = (targetIndex: number) => {
    setCurrentPosition(pillarSlug, targetIndex);
    router.push(facilitatedAssessmentQuestionPath(sessionId, pillarSlug, targetIndex));
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <section className="hero-surface rounded-[1.75rem] p-4 sm:p-8">
        <SectionProgress
          answeredCount={progress.answered}
          totalCount={progress.total}
          pillarName={currentPillar.name}
          activeQuestion={
            pillarHasScore
              ? undefined
              : { index: currentIndex + 1, total: visibleQuestions.length }
          }
          reviewingQuestion={
            pillarHasScore
              ? { index: currentIndex + 1, total: visibleQuestions.length }
              : undefined
          }
        />
        {!pillarHasScore ? (
          <SkipToLastUnansweredQuestion
            currentIndex={currentIndex}
            visibleQuestions={visibleQuestions}
            answers={answers}
            skippedQuestions={skippedQuestions}
            onJump={handleJumpToLastUnanswered}
          />
        ) : null}
      </section>

      <Card>
        <CardContent className="space-y-6 p-4 sm:p-8">
          <QuestionCard
            question={currentQuestion}
            personalizedText={personalizedText}
            currentAnswer={currentAnswer}
            onAnswer={handleAnswer}
            onSkip={handleSkip}
            isSkipped={isQuestionSkipped}
            questionPosition={{
              index: currentIndex + 1,
              total: visibleQuestions.length,
            }}
            moduleName={currentPillar.name}
            assessmentId={assessmentId}
          />

          <NavigationButtons
            onBack={handleBack}
            onNext={handleNext}
            canGoBack={canGoBack}
            isLastQuestion={isLastQuestion}
            isValid={isValid}
            isSaving={isSaving}
          />
        </CardContent>
      </Card>
    </div>
  );
}

/** Page wrapper that unwraps async params for App Router. */
export function FacilitatedQuestionPage(props: {
  params: Promise<{
    sessionId: string;
    pillarSlug: string;
    questionIndex: string;
  }>;
  assessmentId: string;
  includedPillars: string[];
  householdProfile?: HouseholdProfile | null;
}) {
  const resolved = use(props.params);
  const questionIndex = parseInt(resolved.questionIndex, 10);

  return (
    <FacilitatedQuestionView
      sessionId={resolved.sessionId}
      assessmentId={props.assessmentId}
      includedPillars={props.includedPillars}
      pillarSlug={resolved.pillarSlug}
      questionIndex={questionIndex}
      householdProfile={props.householdProfile}
    />
  );
}
