"use client";

import { use, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

import { NavigationButtons } from "@/components/assessment/NavigationButtons";
import { QuestionCard } from "@/components/assessment/QuestionCard";
import { SectionProgress } from "@/components/assessment/ProgressBar";
import { Card, CardContent } from "@/components/ui/card";
import { getPersonalizedText } from "@/lib/assessment/personalization";
import { hasDocumentUploadFiles } from "@/lib/assessment/question-upload";
import {
  isAssessmentPillarId,
  normalizePillarSlug,
  pillarDefinitionFor,
} from "@/lib/assessment/pillar-registry";
import { isPillarInAssessmentScope } from "@/lib/assessment/included-pillars";
import { useAssessmentStore } from "@/lib/assessment/store";
import { useAutoSave } from "@/lib/hooks/useAutoSave";
import { useAssessmentNavigation } from "@/lib/hooks/useAssessmentNavigation";
import { useHouseholdProfile } from "@/lib/hooks/useHouseholdProfile";
import {
  useAssessmentPillarScores,
  usePillarQuestions,
} from "@/lib/hooks/useAssessmentPillars";
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
}

export function FacilitatedQuestionView({
  sessionId,
  assessmentId,
  includedPillars,
  pillarSlug: rawSlug,
  questionIndex,
}: FacilitatedQuestionViewProps) {
  const router = useRouter();
  const pillarSlug = normalizePillarSlug(rawSlug);
  const { answers, setHouseholdProfile, skippedQuestions, setAssessmentId } =
    useAssessmentStore();
  const { profile } = useHouseholdProfile();
  const { data: pillarQuestionData, isLoading: questionsLoading } =
    usePillarQuestions(pillarSlug);
  const pillarQuestions = pillarQuestionData?.questions ?? [];
  const currentPillar = pillarDefinitionFor(pillarSlug);

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

  useEffect(() => {
    setAssessmentId(assessmentId);
  }, [assessmentId, setAssessmentId]);

  useEffect(() => {
    setHouseholdProfile(profile);
  }, [profile, setHouseholdProfile]);

  useEffect(() => {
    if (rawSlug !== pillarSlug && isAssessmentPillarId(pillarSlug)) {
      router.replace(facilitatedAssessmentQuestionPath(sessionId, pillarSlug, questionIndex));
    }
  }, [rawSlug, pillarSlug, questionIndex, router, sessionId]);

  useEffect(() => {
    if (!isPillarInAssessmentScope(pillarSlug, includedPillars)) {
      router.replace(facilitatedAssessmentHubPath(sessionId));
    }
  }, [includedPillars, pillarSlug, router, sessionId]);

  useEffect(() => {
    if (questionsLoading || visibleQuestions.length === 0) return;
    if (questionIndex < 0 || questionIndex >= visibleQuestions.length) {
      router.push(facilitatedAssessmentQuestionPath(sessionId, pillarSlug, 0));
    }
  }, [questionIndex, visibleQuestions.length, pillarSlug, router, questionsLoading, sessionId]);

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

  if (questionsLoading || !currentQuestion) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        Loading question…
      </div>
    );
  }

  const currentAnswer = answers[currentQuestion.id];
  const personalizedText = getPersonalizedText(currentQuestion, profile);
  const pillarHasScore = pillarScores.some(
    (score) => normalizePillarSlug(score.pillar) === pillarSlug,
  );

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

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <section className="hero-surface rounded-[1.75rem] p-4 sm:p-8">
        <SectionProgress
          answeredCount={progress.answered}
          totalCount={progress.total}
          pillarName={currentPillar.name}
          reviewingQuestion={
            pillarHasScore
              ? { index: currentIndex + 1, total: visibleQuestions.length }
              : undefined
          }
        />
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
    />
  );
}
