"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";

import { AssessmentDomainsSelector } from "@/components/advisor/AssessmentDomainsSelector";
import { EmphasisAreasSelector } from "@/components/advisor/EmphasisAreasSelector";
import { PillarRecommendationsPanel } from "@/components/advisor/PillarRecommendationsPanel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { facilitatedApproveScope } from "@/lib/actions/facilitated-pillar-actions";
import type { PillarRecommendation } from "@/lib/intake/pillar-recommendations";
import type { AssessmentDomainOption } from "@/lib/advisor/assessment-domain-option";
import { resolveDefaultAssessmentDomainSelection } from "@/lib/advisor/assessment-domain-option";

import { strongRecommendationPillarIds } from "@/lib/intake/pillar-recommendations";

interface FacilitatedPillarSelectFormProps {
  sessionId: string;
  recommendations: PillarRecommendation[];
  assessmentDomains: AssessmentDomainOption[];
}

export function FacilitatedPillarSelectForm({
  sessionId,
  recommendations,
  assessmentDomains,
}: FacilitatedPillarSelectFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const availableDomainIds = useMemo(
    () => assessmentDomains.map((d) => d.id),
    [assessmentDomains],
  );
  const availableSet = useMemo(() => new Set(availableDomainIds), [availableDomainIds]);
  const suggestedIds = useMemo(
    () => strongRecommendationPillarIds(recommendations),
    [recommendations],
  );
  const [selectedDomains, setSelectedDomains] = useState<string[]>(() =>
    resolveDefaultAssessmentDomainSelection({
      availableDomainIds,
      suggestedIds,
    }),
  );
  const [selectedEmphasis, setSelectedEmphasis] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const handleSelectRecommended = useCallback(() => {
    const strong = strongRecommendationPillarIds(recommendations);
    const moderate = recommendations
      .filter((r) => r.strength === "moderate")
      .map((r) => r.pillarId);
    setSelectedDomains(
      [...new Set([...strong, ...moderate])].filter((id) => availableSet.has(id)),
    );
  }, [recommendations, availableSet]);

  const handleApprove = () => {
    if (selectedDomains.length === 0) {
      toast.error("Select at least one assessment domain");
      return;
    }
    startTransition(async () => {
      const result = await facilitatedApproveScope(sessionId, {
        includedPillars: selectedDomains,
        focusAreas: selectedEmphasis.length > 0 ? selectedEmphasis : selectedDomains,
        notes: notes.trim() || undefined,
      });
      if (result.success) {
        router.push(result.redirectTo);
        return;
      }
      if ("errors" in result && result.errors) {
        const first = Object.values(result.errors)[0]?.[0];
        toast.error(first ?? "Could not set scope");
        return;
      }
      toast.error(result.error ?? "Could not set scope");
    });
  };

  const recommendedForDomains = useMemo(
    () => recommendations.filter((r) => r.strength === "strong").map((r) => r.pillarId),
    [recommendations],
  );

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Choose assessment domains</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select which pillars to include in this live session. Recommendations are based on
            intake responses.
          </p>
        </div>

        <AssessmentDomainsSelector
          domains={assessmentDomains}
          selectedDomains={selectedDomains}
          onChange={setSelectedDomains}
          recommendedIds={recommendedForDomains}
        />

        <EmphasisAreasSelector
          domains={assessmentDomains}
          includedDomains={selectedDomains}
          selectedEmphasis={selectedEmphasis}
          onChange={setSelectedEmphasis}
        />

        <div className="space-y-2">
          <label htmlFor="facilitated-notes" className="text-sm font-medium">
            Session notes (optional)
          </label>
          <Textarea
            id="facilitated-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Notes for your records…"
          />
        </div>

        <Button type="button" size="lg" disabled={isPending} onClick={handleApprove}>
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            "Start assessment"
          )}
        </Button>
      </div>

      <aside>
        <PillarRecommendationsPanel
          recommendations={recommendations}
          onSelectRecommended={handleSelectRecommended}
          onScrollToQuestion={() => undefined}
        />
      </aside>
    </div>
  );
}
