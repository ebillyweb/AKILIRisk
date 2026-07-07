'use client';

import { use, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAssessmentStore } from '@/lib/assessment/store';
import { useAssessmentNavigation } from '@/lib/hooks/useAssessmentNavigation';
import { useAutoSave } from '@/lib/hooks/useAutoSave';
import { useHouseholdProfile } from '@/lib/hooks/useHouseholdProfile';
import { usePillarQuestions, useAssessmentPillarScores } from '@/lib/hooks/useAssessmentPillars';
import { getPersonalizedText } from '@/lib/assessment/personalization';
import { hasDocumentUploadFiles } from '@/lib/assessment/question-upload';
import { QuestionCard } from '@/components/assessment/QuestionCard';
import { NavigationButtons } from '@/components/assessment/NavigationButtons';
import { QuestionQuickNav } from '@/components/assessment/QuestionQuickNav';
import { SectionProgress } from '@/components/assessment/ProgressBar';
import { SkipToLastUnansweredQuestion } from '@/components/assessment/SkipToLastUnansweredQuestion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { CustomizationConfig } from '@/lib/assessment/customization';
import {
  isAssessmentPillarId,
  normalizePillarSlug,
  pillarDefinitionFor,
} from '@/lib/assessment/pillar-registry';
import { isPillarInAssessmentScope } from '@/lib/assessment/included-pillars';
import { usePlatformPillarCatalog } from '@/lib/hooks/usePlatformPillarCatalog';

interface QuestionPageProps {
  params: Promise<{
    pillarSlug: string;
    questionIndex: string;
  }>;
}

export default function QuestionPage({ params }: QuestionPageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const rawSlug = resolvedParams.pillarSlug;
  const pillarSlug = normalizePillarSlug(rawSlug);
  const questionIndex = parseInt(resolvedParams.questionIndex, 10);

  const { assessmentId, answers, setHouseholdProfile, skippedQuestions, setCurrentPosition } =
    useAssessmentStore();
  const { profile } = useHouseholdProfile();
  const { data: pillarQuestionData, isLoading: questionsLoading } =
    usePillarQuestions(pillarSlug);
  const { data: catalog = [] } = usePlatformPillarCatalog();

  const pillarQuestions = pillarQuestionData?.questions ?? [];
  const currentPillar = pillarDefinitionFor(pillarSlug, catalog);

  useQuery<CustomizationConfig>({
    queryKey: ['assessment-customization'],
    queryFn: async () => {
      const response = await fetch('/api/assessment/customization');
      if (!response.ok) throw new Error('Failed to fetch customization config');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: summaryAccess } = useQuery({
    queryKey: ['assessment-summary-access'],
    queryFn: async () => {
      const response = await fetch('/api/assessment/summary-access');
      if (!response.ok) throw new Error('Failed to fetch summary access');
      return response.json() as Promise<{ includedPillars: string[] }>;
    },
    staleTime: 30_000,
  });

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
  });

  const { data: pillarScores = [] } = useAssessmentPillarScores(assessmentId);
  const pillarHasScore = pillarScores.some(
    (score) => normalizePillarSlug(score.pillar) === pillarSlug,
  );
  const allVisibleAnswered =
    progress.total > 0 && progress.answered >= progress.total;
  const isReviewingPillar = pillarHasScore || allVisibleAnswered;

  useEffect(() => {
    setHouseholdProfile(profile);
  }, [profile, setHouseholdProfile]);

  const { saveAnswer, flushPendingSaves, isSaving } = useAutoSave(assessmentId);

  useEffect(() => {
    if (rawSlug !== pillarSlug && catalog.length > 0 && isAssessmentPillarId(pillarSlug, catalog)) {
      router.replace(`/assessment/${pillarSlug}/${questionIndex}`);
    }
  }, [rawSlug, pillarSlug, questionIndex, router, catalog]);

  useEffect(() => {
    if (catalog.length > 0 && !isAssessmentPillarId(pillarSlug, catalog)) {
      router.replace('/assessment');
    }
  }, [pillarSlug, router, catalog]);

  useEffect(() => {
    if (!assessmentId) {
      router.push('/assessment');
    }
  }, [assessmentId, router]);

  useEffect(() => {
    if (!summaryAccess?.includedPillars?.length || catalog.length === 0) return;
    if (!isPillarInAssessmentScope(pillarSlug, summaryAccess.includedPillars, catalog)) {
      router.replace('/assessment?scope=excluded');
    }
  }, [summaryAccess, pillarSlug, router, catalog]);

  useEffect(() => {
    if (questionsLoading || visibleQuestions.length === 0) return;
    if (questionIndex < 0 || questionIndex >= visibleQuestions.length) {
      router.push(`/assessment/${pillarSlug}/0`);
    }
  }, [questionIndex, visibleQuestions.length, pillarSlug, router, questionsLoading]);

  useEffect(() => {
    if (!branchingChange || branchingChange.newlyVisible.length === 0) return;

    void (async () => {
      await flushPendingSaves();

      const newlyVisibleIndex = visibleQuestions.findIndex((q) =>
        branchingChange.newlyVisible.includes(q.id)
      );

      if (newlyVisibleIndex !== -1) {
        router.push(`/assessment/${pillarSlug}/${newlyVisibleIndex}`);
      }
    })();
  }, [branchingChange, visibleQuestions, pillarSlug, router, flushPendingSaves]);

  if (questionsLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-muted-foreground">Loading questions…</div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-muted-foreground">Loading question…</div>
      </div>
    );
  }

  const currentAnswer = answers[currentQuestion.id];
  const isQuestionSkipped = skippedQuestions.includes(currentQuestion.id);
  const personalizedText = getPersonalizedText(currentQuestion, profile);

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
    // If the question already has an answer, "Skip" simply advances and keeps
    // the saved answer. Only record a real skip (which clears the response) when
    // the question is still unanswered.
    const hasAnswer = currentAnswer !== null && currentAnswer !== undefined;
    if (!hasAnswer) {
      saveAnswer({
        questionId: currentQuestion.id,
        pillar: pillarSlug,
        subCategory: currentQuestion.subCategory,
        answer: null,
        skipped: true,
        currentQuestionIndex: currentIndex + 1,
      });
    }
    void (async () => {
      await flushPendingSaves();
      goNext();
    })();
  };

  const handleNext = () => {
    if (
      currentQuestion.required &&
      !isQuestionSkipped &&
      (currentAnswer === null || currentAnswer === undefined)
    ) {
      return;
    }
    void (async () => {
      await flushPendingSaves();
      goNext();
    })();
  };

  const handleBack = () => {
    void (async () => {
      await flushPendingSaves();
      goBack();
    })();
  };

  const handleJumpToLastUnanswered = (targetIndex: number) => {
    setCurrentPosition(pillarSlug, targetIndex);
    router.push(`/assessment/${pillarSlug}/${targetIndex}`);
  };

  const isValid =
    currentQuestion.type === "document-upload"
      ? hasDocumentUploadFiles(currentAnswer) || isQuestionSkipped
      : !currentQuestion.required ||
        (currentAnswer !== null && currentAnswer !== undefined);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="hero-surface rounded-[1.75rem] p-4 sm:p-8">
        <div className="mb-4 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => {
              void (async () => {
                await flushPendingSaves();
                router.push('/assessment');
              })();
            }}
          >
            <X className="h-4 w-4" />
            {isReviewingPillar ? "Exit review" : "Save & exit"}
          </Button>
        </div>
        <SectionProgress
          answeredCount={progress.answered}
          totalCount={progress.total}
          pillarName={currentPillar.name}
          activeQuestion={
            isReviewingPillar
              ? undefined
              : { index: currentIndex + 1, total: visibleQuestions.length }
          }
          reviewingQuestion={
            isReviewingPillar
              ? {
                  index: currentIndex + 1,
                  total: visibleQuestions.length,
                }
              : undefined
          }
        />
        {!isReviewingPillar ? (
          <SkipToLastUnansweredQuestion
            currentIndex={currentIndex}
            visibleQuestions={visibleQuestions}
            answers={answers}
            skippedQuestions={skippedQuestions}
            onJump={handleJumpToLastUnanswered}
          />
        ) : null}
      </section>

      <QuestionQuickNav
        onBack={handleBack}
        onSkip={handleSkip}
        onNext={handleNext}
        canGoBack={canGoBack}
        isLastQuestion={isLastQuestion}
        isSaving={isSaving}
        showSkip={
          !isReviewingPillar &&
          !currentQuestion.required &&
          currentQuestion.type !== "document-upload"
        }
      />

      <Card className="overflow-hidden">
        <CardContent className="space-y-6 pt-6 sm:space-y-8 sm:pt-8">
          <QuestionCard
            question={currentQuestion}
            personalizedText={personalizedText}
            currentAnswer={currentAnswer}
            onAnswer={handleAnswer}
            onSkip={
              currentQuestion.type === "document-upload" || !currentQuestion.required
                ? handleSkip
                : undefined
            }
            isSkipped={isQuestionSkipped}
            questionPosition={{
              index: currentIndex + 1,
              total: visibleQuestions.length,
            }}
            moduleName={currentPillar.name}
            assessmentId={assessmentId ?? undefined}
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
