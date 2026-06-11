"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { pillarDefinitionFor } from "@/lib/assessment/pillar-registry";
import { resolveScoringPillar } from "@/lib/assessment/scoring-pillar";
import { syncStoreAnswersToServer } from "@/lib/assessment/sync-store-responses";
import { useAssessmentStore } from "@/lib/assessment/store";
import { facilitatedAssessmentHubPath, facilitatedPreviewPath } from "@/lib/facilitated/paths";

interface FacilitatedAssessmentCompleteProps {
  sessionId: string;
  assessmentId: string;
}

export function FacilitatedAssessmentComplete({
  sessionId,
  assessmentId,
}: FacilitatedAssessmentCompleteProps) {
  const router = useRouter();
  const { currentPillar } = useAssessmentStore();
  const [isCalculating, setIsCalculating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const runScoreCalculation = useCallback(async () => {
    try {
      setIsCalculating(true);
      setError(null);

      const pillar = await resolveScoringPillar(assessmentId, currentPillar);
      const store = useAssessmentStore.getState();

      await syncStoreAnswersToServer(assessmentId, {
        answers: store.answers,
        skippedQuestions: store.skippedQuestions,
        questionBank: store.familyGovernanceQuestionBank ?? [],
        currentPillar: store.currentPillar,
      }, { facilitatedSessionId: sessionId });

      const response = await fetch(`/api/assessment/${assessmentId}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pillar, facilitatedSessionId: sessionId }),
      });

      const data = (await response.json()) as { error?: string; allPillarsScored?: boolean };

      if (!response.ok) {
        throw new Error(data.error || "Failed to calculate score");
      }

      setTimeout(() => {
        if (data.allPillarsScored) {
          router.push(facilitatedPreviewPath(sessionId));
        } else {
          router.push(facilitatedAssessmentHubPath(sessionId));
        }
      }, 1500);
    } catch (err) {
      setIsCalculating(false);
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  }, [assessmentId, currentPillar, router, sessionId]);

  useEffect(() => {
    void runScoreCalculation();
  }, [runScoreCalculation]);

  const pillarLabel = currentPillar
    ? pillarDefinitionFor(currentPillar).name
    : "pillar";

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Card>
          <CardContent className="space-y-4 p-8 text-center">
            <AlertCircle className="mx-auto size-12 text-red-500" />
            <p className="text-lg font-semibold">Calculation error</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <div className="flex justify-center gap-2">
              <Button onClick={() => void runScoreCalculation()}>Try again</Button>
              <Button
                variant="outline"
                onClick={() => router.push(facilitatedAssessmentHubPath(sessionId))}
              >
                Back to assessment
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Card>
        <CardContent className="space-y-4 p-8 text-center">
          {isCalculating ? (
            <Loader2 className="mx-auto size-12 animate-spin text-primary" />
          ) : (
            <CheckCircle className="mx-auto size-12 text-emerald-500" />
          )}
          <h1 className="text-2xl font-semibold">
            {isCalculating ? "Calculating results" : "Section complete"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isCalculating
              ? `Scoring ${pillarLabel.toLowerCase()}…`
              : "Returning to the assessment hub…"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
