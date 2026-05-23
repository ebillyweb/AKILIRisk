'use client';

import { use, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAssessmentStore } from '@/lib/assessment/store';
import { useAssessmentNavigation } from '@/lib/hooks/useAssessmentNavigation';
import { useAutoSave } from '@/lib/hooks/useAutoSave';
import { useHouseholdProfile } from '@/lib/hooks/useHouseholdProfile';
import { usePillarQuestions } from '@/lib/hooks/useAssessmentPillars';
import { getPersonalizedText } from '@/lib/assessment/personalization';
import { QuestionCard } from '@/components/assessment/QuestionCard';
import { NavigationButtons } from '@/components/assessment/NavigationButtons';
import { SectionProgress } from '@/components/assessment/ProgressBar';
import { Card, CardContent } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import type { CustomizationConfig } from '@/lib/assessment/customization';
import {
  isAssessmentPillarId,
  normalizePillarSlug,
  pillarDefinitionFor,
} from '@/lib/assessment/pillar-registry';

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

  const { assessmentId, answers, setHouseholdProfile } = useAssessmentStore();
  const { profile } = useHouseholdProfile();
  const { data: pillarQuestionData, isLoading: questionsLoading } =
    usePillarQuestions(pillarSlug);

  const pillarQuestions = pillarQuestionData?.questions ?? [];
  const currentPillar = pillarDefinitionFor(pillarSlug);

  useQuery<CustomizationConfig>({
    queryKey: ['assessment-customization'],
    queryFn: async () => {
      const response = await fetch('/api/assessment/customization');
      if (!response.ok) throw new Error('Failed to fetch customization config');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const {
    currentQuestion,
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

  useEffect(() => {
    setHouseholdProfile(profile);
  }, [profile, setHouseholdProfile]);

  const { saveAnswer, isSaving } = useAutoSave(assessmentId);

  useEffect(() => {
    if (rawSlug !== pillarSlug && isAssessmentPillarId(pillarSlug)) {
      router.replace(`/assessment/${pillarSlug}/${questionIndex}`);
    }
  }, [rawSlug, pillarSlug, questionIndex, router]);

  useEffect(() => {
    if (!isAssessmentPillarId(pillarSlug)) {
      router.replace('/assessment');
    }
  }, [pillarSlug, router]);

  useEffect(() => {
    if (!assessmentId) {
      router.push('/assessment');
    }
  }, [assessmentId, router]);

  useEffect(() => {
    if (questionsLoading || visibleQuestions.length === 0) return;
    if (questionIndex < 0 || questionIndex >= visibleQuestions.length) {
      router.push(`/assessment/${pillarSlug}/0`);
    }
  }, [questionIndex, visibleQuestions.length, pillarSlug, router, questionsLoading]);

  useEffect(() => {
    if (branchingChange && branchingChange.newlyVisible.length > 0) {
      const firstNewlyVisibleId = branchingChange.newlyVisible[0];
      const newlyVisibleIndex = visibleQuestions.findIndex((q) => q.id === firstNewlyVisibleId);

      if (newlyVisibleIndex !== -1) {
        router.push(`/assessment/${pillarSlug}/${newlyVisibleIndex}`);
      }
    }
  }, [branchingChange, visibleQuestions, pillarSlug, router]);

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
    saveAnswer({
      questionId: currentQuestion.id,
      pillar: pillarSlug,
      subCategory: currentQuestion.subCategory,
      answer: null,
      skipped: true,
      currentQuestionIndex: questionIndex,
    });
    goNext();
  };

  const handleNext = () => {
    if (currentQuestion.required && (currentAnswer === null || currentAnswer === undefined)) {
      return;
    }
    goNext();
  };

  const isValid =
    !currentQuestion.required ||
    (currentAnswer !== null && currentAnswer !== undefined);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="hero-surface rounded-[1.75rem] p-4 sm:p-8">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <SectionProgress
            answeredCount={progress.answered}
            totalCount={progress.total}
            pillarName={currentPillar.name}
          />

          <Card className="hidden bg-background/60 sm:block">
            <CardContent className="grid gap-3 pt-6 sm:grid-cols-3">
              <div>
                <p className="editorial-kicker">Question</p>
                <p className="mt-2 text-xl font-semibold">
                  {questionIndex + 1} / {visibleQuestions.length}
                </p>
              </div>
              <div>
                <p className="editorial-kicker">Status</p>
                <p className="mt-2 text-xl font-semibold">
                  {currentQuestion.required ? 'Required' : 'Optional'}
                </p>
              </div>
              <div>
                <p className="editorial-kicker">Autosave</p>
                <p className="mt-2 text-xl font-semibold">{isSaving ? 'Saving' : 'Active'}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card className="overflow-hidden">
        <CardContent className="space-y-6 pt-6 sm:space-y-8 sm:pt-8">
          <QuestionCard
            question={currentQuestion}
            personalizedText={personalizedText}
            currentAnswer={currentAnswer}
            onAnswer={handleAnswer}
            onSkip={!currentQuestion.required ? handleSkip : undefined}
            questionPosition={{
              index: questionIndex + 1,
              total: visibleQuestions.length,
            }}
            moduleName={currentPillar.name}
          />

          <NavigationButtons
            onBack={goBack}
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
