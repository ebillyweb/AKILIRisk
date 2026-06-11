"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  formatIncludedPillarNames,
  isNarrowAssessmentScope,
} from "@/lib/assessment/included-pillars";

type AssessmentScopeBannerProps = {
  includedPillars: string[];
};

/** Epic 5.11 US-72: surfaces advisor-selected assessment domains on the hub. */
export function AssessmentScopeBanner({
  includedPillars,
}: AssessmentScopeBannerProps) {
  if (!isNarrowAssessmentScope(includedPillars)) {
    return null;
  }

  const domainLabel =
    includedPillars.length === 1 ? "domain" : "domains";
  const names = formatIncludedPillarNames(includedPillars);

  return (
    <Alert variant="info" data-testid="assessment-scope-banner">
      <AlertTitle className="text-lg font-semibold">
        Your assessment scope
      </AlertTitle>
      <AlertDescription>
        Your advisor selected {includedPillars.length} {domainLabel} for this
        engagement: {names}.
      </AlertDescription>
    </Alert>
  );
}
