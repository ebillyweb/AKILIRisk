'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAssessmentStore } from '@/lib/assessment/store';
import { pillarDefinitionFor } from '@/lib/assessment/pillar-registry';
import { usePlatformPillarCatalog } from '@/lib/hooks/usePlatformPillarCatalog';
import { resolveScoringPillar } from '@/lib/assessment/scoring-pillar';
import { syncStoreAnswersToServer } from '@/lib/assessment/sync-store-responses';
import { useAssessmentPersistHydrated } from '@/lib/hooks/useAssessmentPersistHydrated';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Assessment Completion Page
 *
 * Transition page after completing all questions.
 * Triggers score calculation and redirects to results page.
 */

export default function AssessmentCompletePage() {
  const router = useRouter();
  const { assessmentId, currentPillar } = useAssessmentStore();
  const { data: catalog = [] } = usePlatformPillarCatalog();
  const persistHydrated = useAssessmentPersistHydrated();
  const [isCalculating, setIsCalculating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReadyForRedirects, setIsReadyForRedirects] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsReadyForRedirects(true), 0);
    return () => clearTimeout(timer);
  }, []);

  const runScoreCalculation = useCallback(async () => {
    if (!assessmentId) {
      router.push('/assessment');
      return;
    }

    try {
      setIsCalculating(true);
      setError(null);

      const pillar = await resolveScoringPillar(assessmentId, currentPillar);
      const store = useAssessmentStore.getState();

      let includedPillars: string[] | undefined;
      try {
        const scopeRes = await fetch("/api/assessment/summary-access");
        if (scopeRes.ok) {
          const scope = (await scopeRes.json()) as { includedPillars?: string[] };
          if (scope.includedPillars?.length) {
            includedPillars = scope.includedPillars;
          }
        }
      } catch {
        // Scope filter is best-effort; currentPillar filtering still applies.
      }

      await syncStoreAnswersToServer(assessmentId, {
        answers: store.answers,
        skippedQuestions: store.skippedQuestions,
        questionBank: store.familyGovernanceQuestionBank ?? [],
        currentPillar: store.currentPillar ?? pillar,
        includedPillars,
      });

      const response = await fetch(`/api/assessment/${assessmentId}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pillar }),
      });

      const data = (await response.json()) as {
        error?: string;
        canViewSummary?: boolean;
      };

      if (!response.ok) {
        throw new Error(data.error || 'Failed to calculate score');
      }

      setTimeout(() => {
        if (data.canViewSummary) {
          router.push(`/assessment/results?pillar=${encodeURIComponent(pillar)}`);
          return;
        }
        router.push('/assessment');
      }, 2000);
    } catch (err) {
      setIsCalculating(false);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }, [assessmentId, currentPillar, router]);

  useEffect(() => {
    if (!isReadyForRedirects || !persistHydrated) {
      return;
    }

    void runScoreCalculation();
  }, [isReadyForRedirects, persistHydrated, runScoreCalculation]);

  const handleRetry = () => {
    void runScoreCalculation();
  };

  if (error) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="max-w-2xl mx-auto w-full">
          <Card>
            <CardContent className="space-y-6 p-8 text-center sm:p-12">
            <div className="flex justify-center">
              <AlertCircle className="h-16 w-16 text-red-500" />
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-foreground">
                Calculation Error
              </h1>
              <p className="text-muted-foreground">
                {error}
              </p>
            </div>

            <Alert variant="destructive" className="text-left">
              <AlertTitle>What went wrong?</AlertTitle>
              <AlertDescription>
                {error.includes('50%') ? (
                  <p>
                    You need to complete at least 50% of the assessment questions to receive a score.
                    Please return to the assessment and answer more questions.
                  </p>
                ) : error.includes('No saved answers found') ? (
                  <p>
                    Your answers are not available in this browser session. Return to the assessment,
                    re-answer the questions, then complete the section again.
                  </p>
                ) : (
                  <p>
                    There was an issue calculating your score. This could be due to incomplete data
                    or a temporary server issue.
                  </p>
                )}
              </AlertDescription>
            </Alert>

            <div className="flex gap-3 justify-center pt-4">
              <Button
                onClick={handleRetry}
                variant="default"
              >
                Try Again
              </Button>
              <Button
                onClick={() => router.push('/assessment')}
                variant="outline"
              >
                Return to Assessment
              </Button>
            </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!isReadyForRedirects || !persistHydrated) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-brand mx-auto" />
          <p className="text-sm text-muted-foreground">Preparing your assessment summary...</p>
        </div>
      </div>
    );
  }

  const pillarLabel = currentPillar
    ? pillarDefinitionFor(currentPillar, catalog).name
    : 'pillar';

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="max-w-2xl mx-auto w-full">
        <Card>
          <CardContent className="space-y-6 p-8 text-center sm:p-12">
          <div className="flex justify-center">
            {isCalculating ? (
              <Loader2 className="h-16 w-16 text-brand animate-spin" />
            ) : (
              <CheckCircle className="h-16 w-16 text-emerald-500" />
            )}
          </div>

          <div className="space-y-2">
            <p className="editorial-kicker">Assessment Processing</p>
            <h1 className="text-3xl font-semibold text-foreground">
              {isCalculating ? 'Calculating Your Results' : 'Assessment Complete'}
            </h1>
            <p className="text-muted-foreground">
              {isCalculating
                ? 'Saving your responses and calculating your risk domain score...'
                : 'This section is complete. Return to the assessment hub to continue other risk domains.'}
            </p>
          </div>

          {isCalculating && (
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center justify-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
                <span>Calculating {pillarLabel.toLowerCase()} score</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" style={{ animationDelay: '150ms' }} />
                <span>Identifying risk drivers</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" style={{ animationDelay: '300ms' }} />
                <span>Preparing summary for advisor review</span>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground pt-4">
            This will only take a moment...
          </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
