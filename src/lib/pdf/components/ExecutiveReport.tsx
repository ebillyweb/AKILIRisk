import { Document } from "@react-pdf/renderer";
import { createBrandedPDFMetadata } from "@/lib/pdf/branding-integration";
import { EnhancedReportCover } from "./EnhancedReportCover";
import { ExecutiveReadinessPage } from "./ExecutiveReadinessPage";
import { OverallRiskProfilePage } from "./OverallRiskProfilePage";
import { ScoreDeltaPage } from "./ScoreDeltaPage";
import { ImplementationProgressPage } from "./ImplementationProgressPage";
import { TopPrioritiesPage } from "./TopPrioritiesPage";
import { AdvisorRecommendationsPage } from "./AdvisorRecommendationsPage";
import { NextStepsPage } from "./NextStepsPage";
import { AdvisorBriefPages } from "./AdvisorBriefPages";
import type { ExecutiveReportSnapshot } from "@/lib/pdf/executive-report-types";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

interface ExecutiveReportDocumentProps {
  snapshot: ExecutiveReportSnapshot;
  branding: AdvisorBrandingData | null;
  /** "client" = client-facing PDF; "advisor" = Advisor Brief (adds internal pages). */
  variant: "client" | "advisor";
  draft: boolean;
  /** Pre-built PDF metadata from createBrandedPDFMetadata. */
  documentMetadata?: ReturnType<typeof createBrandedPDFMetadata>;
}

/**
 * Top-level Document component for Executive Reports and Advisor Briefs.
 *
 * Section ordering per D-08 narrative arc:
 * 1. Cover (EnhancedReportCover -- REUSED branded cover)
 * 2. Executive Readiness (always -- D-05)
 * 3. Overall Risk Profile (always -- D-05, per-pillar only, NO composite -- D-09)
 * 4. Score Delta (conditional: data or zero-state -- D-07)
 * 5. Top Priorities (always -- D-05)
 * 6. Implementation Progress (conditional: data or zero-state -- D-07)
 * 7. Advisor Recommendations (always -- D-05)
 * 8. Next Steps (always -- D-05)
 * 9. Advisor Brief pages (variant === "advisor" ONLY -- D-17, D-18)
 *
 * CRITICAL (D-17, Pitfall 2): variant prop controls page inclusion, NOT snapshot
 * field presence. advisorNotes/meetingAgenda/discussionPrompts may exist in the
 * snapshot but are never rendered in client variant.
 */
export function ExecutiveReportDocument({
  snapshot,
  branding,
  variant,
  draft,
  documentMetadata,
}: ExecutiveReportDocumentProps) {
  const companyName =
    branding?.brandName || branding?.advisorFirmName || "Akili Risk";

  const meta = documentMetadata ?? createBrandedPDFMetadata(branding ?? undefined);

  const { reportingPeriod, clientName } = snapshot;

  // Shared props passed to every section page
  const pageProps = {
    branding,
    companyName,
    draft,
    reportingPeriodLabel: reportingPeriod.label,
  };

  return (
    <Document
      title={meta.title}
      author={meta.author}
      subject={meta.subject}
      creator={meta.creator}
      producer={meta.producer}
      keywords={meta.keywords}
      creationDate={meta.creationDate}
    >
      {/* Page 1: Branded cover (REUSE EnhancedReportCover) */}
      <EnhancedReportCover
        assessmentDate={reportingPeriod.label}
        completionPercentage={100}
        overallScore={0}
        riskLevel="N/A"
        clientName={clientName}
        reportType="Executive Risk Report"
        branding={branding ?? undefined}
      />

      {/* Page 2: Executive Readiness (always -- D-05) */}
      <ExecutiveReadinessPage
        executiveReadiness={snapshot.executiveReadiness}
        clientName={clientName}
        {...pageProps}
      />

      {/* Page 3: Overall Risk Profile -- per-pillar, NO composite (D-09) */}
      <OverallRiskProfilePage
        pillarReadiness={snapshot.pillarReadiness}
        {...pageProps}
      />

      {/* Page 4: Score Delta -- data view or zero-state (D-07) */}
      <ScoreDeltaPage scoreDelta={snapshot.scoreDelta} {...pageProps} />

      {/* Page 5: Top Priorities (always -- D-05) */}
      <TopPrioritiesPage
        topPriorities={snapshot.topPriorities}
        {...pageProps}
      />

      {/* Page 6: Implementation Progress -- data view or zero-state (D-07) */}
      <ImplementationProgressPage
        engagementSummary={snapshot.engagementSummary}
        {...pageProps}
      />

      {/* Page 7: Advisor Recommendations (always -- D-05) */}
      <AdvisorRecommendationsPage
        recommendationSummary={snapshot.recommendationSummary}
        {...pageProps}
      />

      {/* Page 8: Next Steps (always -- D-05, D-24) */}
      <NextStepsPage nextSteps={snapshot.nextSteps} {...pageProps} />

      {/* Advisor Brief pages -- ONLY for advisor variant (D-17, D-18).
          NEVER rendered for client variant -- variant prop is the gate, not field presence. */}
      {variant === "advisor" ? (
        <AdvisorBriefPages
          advisorNotes={snapshot.advisorNotes}
          meetingAgenda={snapshot.meetingAgenda}
          discussionPrompts={snapshot.discussionPrompts}
          {...pageProps}
        />
      ) : null}
    </Document>
  );
}
