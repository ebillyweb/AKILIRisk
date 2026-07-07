import { Page, Text, View } from "@react-pdf/renderer";
import { executiveStyles } from "../executive-styles";
import { EnhancedPageFooter } from "./EnhancedPageFooter";
import { DraftWatermark } from "./DraftWatermark";
import type { RecommendationSummary } from "../executive-report-types";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

interface AdvisorRecommendationsPageProps {
  recommendationSummary: RecommendationSummary;
  reportingPeriodLabel: string;
  branding: AdvisorBrandingData | null;
  companyName: string;
  draft: boolean;
}

/**
 * Recommendation status counts with stacked horizontal bar breakdown (D-05).
 * Donut-style breakdown approximated via stacked horizontal View bar (D-14 -- no SVG).
 * A4 content = 451pt.
 */
export function AdvisorRecommendationsPage({
  recommendationSummary,
  reportingPeriodLabel,
  branding,
  draft,
}: AdvisorRecommendationsPageProps) {
  const {
    total,
    completed,
    inProgress,
    deferred,
    open,
    completionPct,
  } = recommendationSummary;

  const BAR_WIDTH = 451;

  // Segment widths for the stacked bar (proportional to total, min 0)
  const safeTotal = total > 0 ? total : 1;
  const completedW = Math.round((completed / safeTotal) * BAR_WIDTH);
  const inProgressW = Math.round((inProgress / safeTotal) * BAR_WIDTH);
  const deferredW = Math.round((deferred / safeTotal) * BAR_WIDTH);
  const openW = BAR_WIDTH - completedW - inProgressW - deferredW;

  return (
    <Page size="A4" style={executiveStyles.page}>
      <Text style={executiveStyles.sectionTitle}>
        Advisor Recommendations
      </Text>
      <Text style={[executiveStyles.bodyText, { marginBottom: 16 }]}>
        Summary of recommendation status for the reporting period.
      </Text>

      {/* Completion percentage -- prominent display */}
      <View style={{ alignItems: "center", marginBottom: 20 }}>
        <Text
          style={{
            fontSize: 48,
            fontWeight: "bold",
            color: "#1a1a2e",
            lineHeight: 1.1,
          }}
        >
          {Math.round(completionPct)}%
        </Text>
        <Text style={[executiveStyles.bodyText, { color: "#6b7280" }]}>
          completion rate (excluding deferred)
        </Text>
      </View>

      {/* Stacked horizontal bar (D-14 -- react-pdf View primitives, no SVG) */}
      {total > 0 && (
        <View>
          <View
            style={[
              executiveStyles.stackedBar,
              { width: BAR_WIDTH, marginBottom: 8 },
            ]}
          >
            {completedW > 0 && (
              <View
                style={{
                  width: completedW,
                  height: 16,
                  backgroundColor: "#059669",
                }}
              />
            )}
            {inProgressW > 0 && (
              <View
                style={{
                  width: inProgressW,
                  height: 16,
                  backgroundColor: "#3b82f6",
                }}
              />
            )}
            {deferredW > 0 && (
              <View
                style={{
                  width: deferredW,
                  height: 16,
                  backgroundColor: "#9ca3af",
                }}
              />
            )}
            {openW > 0 && (
              <View
                style={{
                  width: openW,
                  height: 16,
                  backgroundColor: "#e5e7eb",
                }}
              />
            )}
          </View>

          {/* Legend row */}
          <View style={{ flexDirection: "row", marginBottom: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginRight: 16 }}>
              <View style={{ width: 10, height: 10, backgroundColor: "#059669", marginRight: 4 }} />
              <Text style={{ fontSize: 9, color: "#374151" }}>Completed</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", marginRight: 16 }}>
              <View style={{ width: 10, height: 10, backgroundColor: "#3b82f6", marginRight: 4 }} />
              <Text style={{ fontSize: 9, color: "#374151" }}>In Progress</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", marginRight: 16 }}>
              <View style={{ width: 10, height: 10, backgroundColor: "#9ca3af", marginRight: 4 }} />
              <Text style={{ fontSize: 9, color: "#374151" }}>Deferred</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ width: 10, height: 10, backgroundColor: "#e5e7eb", marginRight: 4 }} />
              <Text style={{ fontSize: 9, color: "#374151" }}>Open</Text>
            </View>
          </View>
        </View>
      )}

      {/* Count metrics grid */}
      <View style={executiveStyles.metricGrid}>
        <View style={executiveStyles.metricItem}>
          <Text style={executiveStyles.metricLabel}>Total</Text>
          <Text style={executiveStyles.metricValue}>{total}</Text>
        </View>
        <View style={executiveStyles.metricItem}>
          <Text style={executiveStyles.metricLabel}>Completed</Text>
          <Text style={[executiveStyles.metricValue, { color: "#059669" }]}>
            {completed}
          </Text>
        </View>
        <View style={executiveStyles.metricItem}>
          <Text style={executiveStyles.metricLabel}>In Progress</Text>
          <Text style={[executiveStyles.metricValue, { color: "#3b82f6" }]}>
            {inProgress}
          </Text>
        </View>
        <View style={executiveStyles.metricItem}>
          <Text style={executiveStyles.metricLabel}>Open</Text>
          <Text style={executiveStyles.metricValue}>{open}</Text>
        </View>
        <View style={executiveStyles.metricItem}>
          <Text style={executiveStyles.metricLabel}>Deferred</Text>
          <Text style={[executiveStyles.metricValue, { color: "#9ca3af" }]}>
            {deferred}
          </Text>
        </View>
      </View>

      <Text style={executiveStyles.reportingPeriodText}>
        Reporting Period: {reportingPeriodLabel}
      </Text>

      <EnhancedPageFooter branding={branding ?? undefined} />
      {draft ? <DraftWatermark /> : null}
    </Page>
  );
}
