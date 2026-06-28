import { Page, Text, View } from "@react-pdf/renderer";
import { executiveStyles } from "../executive-styles";
import { EnhancedPageFooter } from "./EnhancedPageFooter";
import { DraftWatermark } from "./DraftWatermark";
import type { EngagementSummary } from "../executive-report-types";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

interface ImplementationProgressPageProps {
  engagementSummary: EngagementSummary | null;
  reportingPeriodLabel: string;
  branding: AdvisorBrandingData | null;
  companyName: string;
  draft: boolean;
}

/**
 * Implementation progress page (D-06 conditional section).
 * Two modes: data view when engagementSummary !== null; zero-state (D-07).
 * Progress bar uses native react-pdf View primitives (D-14).
 *
 * A4 content width = 451pt.
 */
export function ImplementationProgressPage({
  engagementSummary,
  reportingPeriodLabel,
  branding,
  draft,
}: ImplementationProgressPageProps) {
  const TRACK_WIDTH = 451;

  return (
    <Page size="A4" style={executiveStyles.page}>
      <Text style={executiveStyles.sectionTitle}>Implementation Progress</Text>

      {engagementSummary === null ? (
        /* Zero-state (D-07) */
        <Text style={executiveStyles.zeroStateText}>
          Implementation tracking will appear here once your advisor publishes
          an action plan and milestones are activated.
        </Text>
      ) : (
        <>
          {/* Milestone completion percentage -- prominent display */}
          <View style={{ alignItems: "center", marginBottom: 24 }}>
            <Text
              style={{
                fontSize: 48,
                fontWeight: "bold",
                color: "#1a1a2e",
                lineHeight: 1.1,
              }}
            >
              {Math.round(engagementSummary.milestoneCompletionPct)}%
            </Text>
            <Text style={[executiveStyles.bodyText, { color: "#6b7280" }]}>
              of milestones completed
            </Text>
          </View>

          {/* Progress bar (large, native View -- D-14) */}
          <View
            style={[
              executiveStyles.progressBarTrack,
              { height: 20, width: TRACK_WIDTH, borderRadius: 6, marginBottom: 24 },
            ]}
          >
            <View
              style={[
                executiveStyles.progressBarFill,
                {
                  height: 20,
                  borderRadius: 6,
                  width: Math.round(
                    (engagementSummary.milestoneCompletionPct / 100) *
                      TRACK_WIDTH
                  ),
                  backgroundColor:
                    engagementSummary.milestoneCompletionPct >= 75
                      ? "#059669"
                      : engagementSummary.milestoneCompletionPct >= 40
                      ? "#d97706"
                      : "#dc2626",
                },
              ]}
            />
          </View>

          {/* Count metrics */}
          <View style={executiveStyles.metricGrid}>
            <View style={executiveStyles.metricItem}>
              <Text style={executiveStyles.metricLabel}>Total Milestones</Text>
              <Text style={executiveStyles.metricValue}>
                {engagementSummary.totalMilestones}
              </Text>
            </View>
            <View style={executiveStyles.metricItem}>
              <Text style={executiveStyles.metricLabel}>Completed</Text>
              <Text
                style={[executiveStyles.metricValue, { color: "#059669" }]}
              >
                {engagementSummary.completedMilestones}
              </Text>
            </View>
            <View style={executiveStyles.metricItem}>
              <Text style={executiveStyles.metricLabel}>Overdue</Text>
              <Text
                style={[
                  executiveStyles.metricValue,
                  {
                    color:
                      engagementSummary.overdueMilestones > 0
                        ? "#dc2626"
                        : "#374151",
                  },
                ]}
              >
                {engagementSummary.overdueMilestones}
              </Text>
            </View>
            <View style={executiveStyles.metricItem}>
              <Text style={executiveStyles.metricLabel}>Remaining</Text>
              <Text style={executiveStyles.metricValue}>
                {engagementSummary.totalMilestones -
                  engagementSummary.completedMilestones}
              </Text>
            </View>
          </View>
        </>
      )}

      <Text style={executiveStyles.reportingPeriodText}>
        Reporting Period: {reportingPeriodLabel}
      </Text>

      <EnhancedPageFooter branding={branding ?? undefined} />
      {draft ? <DraftWatermark /> : null}
    </Page>
  );
}
