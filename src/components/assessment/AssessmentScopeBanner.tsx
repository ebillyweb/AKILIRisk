"use client";

import {
  formatIncludedPillarNames,
  isNarrowAssessmentScope,
} from "@/lib/assessment/included-pillars";
import { usePlatformPillarCatalog } from "@/lib/hooks/usePlatformPillarCatalog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type AssessmentScopeBannerProps = {
  includedPillars: string[];
};

/** Epic 5.11 US-72: surfaces advisor-selected assessment domains on the hub. */
export function AssessmentScopeBanner({
  includedPillars,
}: AssessmentScopeBannerProps) {
  const { data: catalog = [] } = usePlatformPillarCatalog();

  if (!catalog.length || !isNarrowAssessmentScope(includedPillars, catalog)) {
    return null;
  }

  const domainLabel =
    includedPillars.length === 1 ? "domain" : "domains";
  const names = formatIncludedPillarNames(includedPillars, catalog);

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
