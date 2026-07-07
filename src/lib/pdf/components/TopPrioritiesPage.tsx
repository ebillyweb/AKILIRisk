import { Page, Text, View } from "@react-pdf/renderer";
import { executiveStyles, impactLevelColor } from "../executive-styles";
import { EnhancedPageFooter } from "./EnhancedPageFooter";
import { DraftWatermark } from "./DraftWatermark";
import type { TopPriorityItem } from "../executive-report-types";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

interface TopPrioritiesPageProps {
  topPriorities: TopPriorityItem[];
  reportingPeriodLabel: string;
  branding: AdvisorBrandingData | null;
  companyName: string;
  draft: boolean;
}

/**
 * Top risk priorities table sorted by impact level (D-05).
 * Columns: Name, Category, Impact Level (badge), Status.
 * A4 content = 451pt; column widths sum to 451.
 */
export function TopPrioritiesPage({
  topPriorities,
  reportingPeriodLabel,
  branding,
  draft,
}: TopPrioritiesPageProps) {
  const COL_NAME = 180;
  const COL_CAT = 110;
  const COL_IMPACT = 80;
  const COL_STATUS = 81;

  return (
    <Page size="A4" style={executiveStyles.page}>
      <Text style={executiveStyles.sectionTitle}>Top Risk Priorities</Text>
      <Text style={[executiveStyles.bodyText, { marginBottom: 16 }]}>
        Open and in-progress recommendations ranked by impact level.
      </Text>

      {/* Table header */}
      <View style={executiveStyles.tableHeaderRow}>
        <Text style={[executiveStyles.tableHeaderCell, { width: COL_NAME }]}>
          Recommendation
        </Text>
        <Text style={[executiveStyles.tableHeaderCell, { width: COL_CAT }]}>
          Category
        </Text>
        <Text style={[executiveStyles.tableHeaderCell, { width: COL_IMPACT }]}>
          Impact Level
        </Text>
        <Text style={[executiveStyles.tableHeaderCell, { width: COL_STATUS }]}>
          Status
        </Text>
      </View>

      {topPriorities.length === 0 ? (
        <Text style={executiveStyles.zeroStateText}>
          No open priorities at this time. All active recommendations have been
          completed or deferred.
        </Text>
      ) : (
        topPriorities.map((item, idx) => {
          const impactColor = impactLevelColor(item.impactLevel);
          return (
            <View
              key={idx}
              style={[
                executiveStyles.tableRow,
                idx % 2 === 1 ? { backgroundColor: "#f9fafb" } : {},
              ]}
            >
              <Text
                style={[
                  executiveStyles.tableCell,
                  { width: COL_NAME, fontWeight: "bold" },
                ]}
              >
                {item.name}
              </Text>
              <Text style={[executiveStyles.tableCell, { width: COL_CAT }]}>
                {item.category}
              </Text>
              <View style={{ width: COL_IMPACT }}>
                <View
                  style={[
                    executiveStyles.impactBadge,
                    { backgroundColor: impactColor },
                  ]}
                >
                  <Text style={executiveStyles.impactBadgeText}>
                    {item.impactLevel}
                  </Text>
                </View>
              </View>
              <Text style={[executiveStyles.tableCell, { width: COL_STATUS }]}>
                {item.status}
              </Text>
            </View>
          );
        })
      )}

      <Text style={executiveStyles.reportingPeriodText}>
        Reporting Period: {reportingPeriodLabel}
      </Text>

      <EnhancedPageFooter branding={branding ?? undefined} />
      {draft ? <DraftWatermark /> : null}
    </Page>
  );
}
