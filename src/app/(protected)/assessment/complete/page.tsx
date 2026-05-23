'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAssessmentStore } from '@/lib/assessment/store';
import { resolveScoringPillar } from '@/lib/assessment/scoring-pillar';
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
  const [isCalculating, setIsCalculating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReadyForRedirects, setIsReadyForRedirects] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsReadyForRedirects(true), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isReadyForRedirects) {
      return;
    }

    if (!assessmentId) {
      router.push('/assessment');
      return;
    }

    // Trigger score calculation
    const calculateScore = async () => {
      try {
        setIsCalculating(true);
        setError(null);

        const pillar = await resolveScoringPillar(assessmentId, currentPillar);

        const response = await fetch(`/api/assessment/${assessmentId}/score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pillar }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to calculate score');
        }

        // Score calculated successfully, wait 2 seconds for effect then redirect
        setTimeout(() => {
          router.push(`/assessment/results?pillar=${encodeURIComponent(pillar)}`);
        }, 2000);
      } catch (err) {
        setIsCalculating(false);
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    };

    calculateScore();
  }, [assessmentId, currentPillar, router, isReadyForRedirects]);

  const handleRetry = () => {
    setError(null);
    setIsCalculating(true);
    window.location.reload();
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

  if (!isReadyForRedirects) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-brand mx-auto" />
          <p className="text-sm text-muted-foreground">Preparing your assessment summary...</p>
        </div>
      </div>
    );
  }

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
                ? 'Analyzing your governance structure and generating recommendations...'
                : 'Your results are ready.'}
            </p>
          </div>

          {isCalculating && (
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center justify-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
                <span>Calculating overall governance score</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" style={{ animationDelay: '150ms' }} />
                <span>Identifying risk drivers</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" style={{ animationDelay: '300ms' }} />
                <span>Generating action plan</span>
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
