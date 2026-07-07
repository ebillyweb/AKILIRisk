"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { pillarDefinitionFor } from "@/lib/assessment/pillar-registry";
import { usePlatformPillarCatalog } from "@/lib/hooks/usePlatformPillarCatalog";
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
  const { data: catalog = [] } = usePlatformPillarCatalog();
  const [isCalculating, setIsCalculating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Safety net: if scoring hangs, surface a manual "Back to assessment" button
  // so the advisor is never stranded on the "Calculating results" spinner.
  const [showManualExit, setShowManualExit] = useState(false);

  const goToNextAssessment = useCallback(
    (allPillarsScored?: boolean) => {
      if (allPillarsScored) {
        router.push(facilitatedPreviewPath(sessionId));
      } else {
        // Resume routing sends the advisor straight into the next unscored
        // domain instead of dropping them back on the hub to pick manually.
        router.push(facilitatedAssessmentHubPath(sessionId, { resume: true }));
      }
    },
    [router, sessionId],
  );

  const runScoreCalculation = useCallback(async () => {
    try {
      setIsCalculating(true);
      setShowManualExit(false);
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
        goToNextAssessment(data.allPillarsScored);
      }, 1500);
    } catch (err) {
      setIsCalculating(false);
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  }, [assessmentId, currentPillar, sessionId, goToNextAssessment]);

  useEffect(() => {
    void runScoreCalculation();
  }, [runScoreCalculation]);

  // Reveal the manual escape hatch if we're still calculating after ~8s.
  useEffect(() => {
    if (!isCalculating) return;
    const timer = setTimeout(() => setShowManualExit(true), 8000);
    return () => clearTimeout(timer);
  }, [isCalculating]);

  const pillarLabel = currentPillar
    ? pillarDefinitionFor(currentPillar, catalog).name
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
          {isCalculating && showManualExit ? (
            <div className="space-y-2 pt-2">
              <p className="text-xs text-muted-foreground">
                Taking longer than expected. Your answers are saved — you can
                head back and continue.
              </p>
              <Button
                variant="outline"
                onClick={() => router.push(facilitatedAssessmentHubPath(sessionId, { resume: true }))}
              >
                Back to assessment
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
