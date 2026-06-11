"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Users } from "lucide-react";
import { AssessmentDomainsSelector } from "./AssessmentDomainsSelector";
import { EmphasisAreasSelector } from "./EmphasisAreasSelector";
import { PillarRecommendationsPanel } from "./PillarRecommendationsPanel";
import { ApprovalActions } from "./ApprovalActions";
import type { IntakeReviewData } from "@/lib/advisor/types";
import type { PillarRecommendation } from "@/lib/intake/pillar-recommendations";
import {
  strongRecommendationPillarIds,
} from "@/lib/intake/pillar-recommendations";

interface ReviewSidebarProps {
  interviewId: string;
  approval: IntakeReviewData["approval"];
  householdProfileCount: number;
  pillarRecommendations: PillarRecommendation[];
}

export function ReviewSidebar({
  interviewId,
  approval,
  householdProfileCount,
  pillarRecommendations,
}: ReviewSidebarProps) {
  const locked =
    approval?.status === "APPROVED" || approval?.status === "REJECTED";

  const suggestedIds = useMemo(
    () => strongRecommendationPillarIds(pillarRecommendations),
    [pillarRecommendations],
  );

  const initialIncluded = useMemo(() => {
    if (approval?.includedPillars?.length) return approval.includedPillars;
    if (suggestedIds.length > 0) return suggestedIds;
    return approval?.focusAreas?.length ? approval.focusAreas : [];
  }, [approval, suggestedIds]);

  const [selectedDomains, setSelectedDomains] = useState<string[]>(initialIncluded);
  const [selectedEmphasis, setSelectedEmphasis] = useState<string[]>(
    approval?.focusAreas?.length &&
      approval.includedPillars?.length &&
      approval.focusAreas.length < approval.includedPillars.length
      ? approval.focusAreas
      : [],
  );
  const [notes, setNotes] = useState(approval?.notes || "");

  useEffect(() => {
    queueMicrotask(() => {
      setSelectedDomains(initialIncluded);
      setNotes(approval?.notes || "");
      if (approval?.includedPillars?.length && approval.focusAreas?.length) {
        const emphasisSubset =
          approval.focusAreas.length < approval.includedPillars.length
            ? approval.focusAreas
            : [];
        setSelectedEmphasis(emphasisSubset);
      }
    });
  }, [approval, initialIncluded]);

  const handleSelectRecommended = useCallback(() => {
    const strong = strongRecommendationPillarIds(pillarRecommendations);
    const moderate = pillarRecommendations
      .filter((r) => r.strength === "moderate")
      .map((r) => r.pillarId);
    setSelectedDomains([...new Set([...strong, ...moderate])]);
  }, [pillarRecommendations]);

  const handleScrollToQuestion = useCallback((questionId: string) => {
    const el = document.getElementById(`intake-question-${questionId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const recommendedForDomains = useMemo(
    () =>
      pillarRecommendations
        .filter((r) => r.strength === "strong")
        .map((r) => r.pillarId),
    [pillarRecommendations],
  );

  return (
    <div className="space-y-8">
      <div className="flex gap-3 rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
        <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 space-y-0.5 text-sm">
          <p className="font-medium text-foreground">Household directory</p>
          {householdProfileCount > 0 ? (
            <p className="leading-relaxed text-muted-foreground">
              <a
                href="#household-directory"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                {householdProfileCount}{" "}
                {householdProfileCount === 1 ? "profile" : "profiles"}
              </a>
              <span> in the main column.</span>
            </p>
          ) : (
            <p className="text-muted-foreground">
              No household profiles on file yet.
            </p>
          )}
        </div>
      </div>

      {!locked ? (
        <PillarRecommendationsPanel
          recommendations={pillarRecommendations}
          onSelectRecommended={handleSelectRecommended}
          onScrollToQuestion={handleScrollToQuestion}
        />
      ) : null}

      <AssessmentDomainsSelector
        selectedDomains={selectedDomains}
        onChange={setSelectedDomains}
        disabled={locked}
        recommendedIds={recommendedForDomains}
      />

      <EmphasisAreasSelector
        includedDomains={selectedDomains}
        selectedEmphasis={selectedEmphasis}
        onChange={setSelectedEmphasis}
        disabled={locked}
      />

      <div className="border-t border-border/80 pt-6">
        <ApprovalActions
          interviewId={interviewId}
          approvalId={approval?.id}
          currentStatus={approval?.status}
          selectedIncludedPillars={selectedDomains}
          selectedEmphasisAreas={selectedEmphasis}
          notes={notes}
          onNotesChange={setNotes}
          disabled={false}
        />
      </div>
    </div>
  );
}
