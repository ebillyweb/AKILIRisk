import { Document } from "@react-pdf/renderer";
import { ReportCover } from "./ReportCover";
import { ExecutiveSummary } from "./ExecutiveSummary";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { RecommendationsSection } from "./RecommendationsSection";
import { HouseholdComposition } from "./HouseholdComposition";
import { GovernanceRecommendations } from "./GovernanceRecommendations";
import { RiskHeatMapPdf } from "./RiskHeatMap";
import type { PillarScoreInput } from "@/lib/assessment/heat-map-data";

interface CategoryScore {
  name: string;
  score: number;
  maxScore: number;
  subcategoryCount: number;
}

interface MissingControl {
  category: string;
  subcategory: string;
  description: string;
  recommendation: string;
  severity: "high" | "medium" | "low";
  /** §4.5 commit 1: free-form advisor commentary attached to a specific
   *  recommendation (`AssessmentRecommendation.advisorNotes`). Optional —
   *  the legacy `pillarScore.missingControls` fallback path emits rows
   *  without this field. */
  advisorNotes?: string;
}

interface AssessmentReportData {
  score: number;
  riskLevel: string;
  breakdown: CategoryScore[];
  missingControls: MissingControl[];
  assessmentDate: string;
  completionPercentage: number;
  categoryCount: number;
  missingControlsCount: number;
  /** Round-10 / B1 (BRD §4.3): per-pillar input for the heat-map page.
   *  Optional so existing callers that don't yet pass it still produce a
   *  valid report (the heat-map page is omitted when missing or empty). */
  pillarScores?: PillarScoreInput[];
}

// Round-11 commit 2.2 (BRD §5.1 amendment): demographic-only PDF input.
// fullName + age dropped upstream; the PDF builder now passes
// displayLabel + birthYear + sex straight through.
interface HouseholdProfile {
  members: Array<{
    displayLabel: string;
    relationship: string;
    birthYear: number | null;
    sex: string | null;
    governanceRoles: string[];
    isResident: boolean;
  }>;
}

interface AdvisorBranding {
  firmName?: string;
  logoUrl?: string;
}

interface PdfDocumentMetadata {
  title?: string;
  author?: string;
  creator?: string;
  producer?: string;
  subject?: string;
  keywords?: string;
  creationDate?: Date;
}

interface AssessmentReportProps {
  data: AssessmentReportData;
  householdProfile?: HouseholdProfile;
  advisorBranding?: AdvisorBranding;
  /** Merged onto <Document /> (e.g. from createBrandedPDFMetadata) */
  documentMetadata?: PdfDocumentMetadata;
}

export function AssessmentReport({
  data,
  householdProfile,
  advisorBranding,
  documentMetadata,
}: AssessmentReportProps) {
  const companyName = advisorBranding?.firmName || "Akili Risk";

  return (
    <Document
      title={documentMetadata?.title ?? "Family Governance Assessment Report"}
      author={
        documentMetadata?.author ??
        advisorBranding?.firmName ??
        "AKILI Risk Intelligence"
      }
      subject={
        documentMetadata?.subject ?? "Confidential Governance Assessment"
      }
      creator={documentMetadata?.creator ?? "AKILI Assessment Platform"}
      producer={documentMetadata?.producer}
      keywords={documentMetadata?.keywords}
      creationDate={documentMetadata?.creationDate}
    >
      {/* Page 1: Cover */}
      <ReportCover
        assessmentDate={data.assessmentDate}
        completionPercentage={data.completionPercentage}
        overallScore={data.score}
        riskLevel={data.riskLevel}
        advisorBranding={advisorBranding}
      />

      {/* Page 2: Executive Summary */}
      <ExecutiveSummary
        score={data.score}
        riskLevel={data.riskLevel}
        categoryCount={data.categoryCount}
        missingControlsCount={data.missingControlsCount}
        companyName={companyName}
      />

      {/* Round-10 / B1 (BRD §4.3): Risk by Domain heat map. Sits between
          the Executive Summary (single overall score) and the per-category
          drill-down so the reader gets a one-page snapshot of the pillar
          breakdown before diving into specifics. Omitted when pillar
          scores aren't supplied (legacy callers). */}
      {data.pillarScores && data.pillarScores.length > 0 ? (
        <RiskHeatMapPdf
          pillarScores={data.pillarScores}
          companyName={companyName}
        />
      ) : null}

      {/* Household Composition (if household profile exists) */}
      {householdProfile && householdProfile.members.length > 0 && (
        <HouseholdComposition
          members={householdProfile.members}
          companyName={companyName}
        />
      )}

      {/* Page 4: Category Breakdown */}
      <CategoryBreakdown breakdown={data.breakdown} companyName={companyName} />

      {/* Page 5+: Recommendations */}
      <RecommendationsSection
        missingControls={data.missingControls}
        companyName={companyName}
      />

      {/* Page 6+: Governance Recommendations (if household profile has governance roles) */}
      {householdProfile &&
        householdProfile.members.some((m) => m.governanceRoles.length > 0) && (
          <GovernanceRecommendations
            members={householdProfile.members}
            missingControls={data.missingControls}
            companyName={companyName}
          />
        )}
    </Document>
  );
}
