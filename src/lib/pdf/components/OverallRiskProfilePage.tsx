import { Page, Text, View } from "@react-pdf/renderer";
import { executiveStyles, riskLevelHex, impactLevelColor } from "../executive-styles";
import { EnhancedPageFooter } from "./EnhancedPageFooter";
import { DraftWatermark } from "./DraftWatermark";
import type { PillarReadiness } from "../executive-report-types";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

interface OverallRiskProfilePageProps {
  pillarReadiness: PillarReadiness[];
  reportingPeriodLabel: string;
  branding: AdvisorBrandingData | null;
  companyName: string;
  draft: boolean;
}

/**
 * Per risk domain risk profile table (D-09 -- NO composite score).
 * Visualizations use native react-pdf View/Text primitives only (D-14).
 * A4 content width = 451pt; column widths sum to 451.
 */
export function OverallRiskProfilePage({
  pillarReadiness,
  reportingPeriodLabel,
  branding,
  draft,
}: OverallRiskProfilePageProps) {
  // Column widths (total = 451)
  const COL_PILLAR = 160;
  const COL_SCORE = 55;
  const COL_PROGRESS = 120;
  const COL_RISK = 70;
  const COL_IMPACT = 46;

  return (
    <Page size="A4" style={executiveStyles.page}>
      <Text style={executiveStyles.sectionTitle}>Overall Risk Profile</Text>
      <Text style={[executiveStyles.bodyText, { marginBottom: 20 }]}>
        Per risk domain assessment of risk exposure across all domains.
      </Text>

      {/* Table header */}
      <View style={executiveStyles.tableHeaderRow}>
        <Text style={[executiveStyles.tableHeaderCell, { width: COL_PILLAR }]}>
          Domain
        </Text>
        <Text style={[executiveStyles.tableHeaderCell, { width: COL_SCORE }]}>
          Score
        </Text>
        <Text style={[executiveStyles.tableHeaderCell, { width: COL_PROGRESS }]}>
          {/* empty -- progress bar column */}
        </Text>
        <Text style={[executiveStyles.tableHeaderCell, { width: COL_RISK }]}>
          Risk Level
        </Text>
        <Text style={[executiveStyles.tableHeaderCell, { width: COL_IMPACT }]}>
          Impact
        </Text>
      </View>

      {pillarReadiness.length === 0 ? (
        <Text style={executiveStyles.zeroStateText}>
          No risk domain scores are available yet. Complete an assessment to see your
          per-domain risk profile.
        </Text>
      ) : (
        pillarReadiness.map((pillar, idx) => {
          const fillPct = Math.min(Math.max(pillar.score / 10, 0), 1);
          const hexColor = riskLevelHex(pillar.riskLevel);
          const impactColor = impactLevelColor(pillar.impactLevel);

          return (
            <View
              key={idx}
              style={[
                executiveStyles.tableRow,
                idx % 2 === 1 ? { backgroundColor: "#f9fafb" } : {},
              ]}
            >
              {/* Domain name */}
              <Text
                style={[
                  executiveStyles.tableCell,
                  { width: COL_PILLAR, fontWeight: "bold" },
                ]}
              >
                {pillar.pillarLabel}
              </Text>

              {/* Score to 1 decimal */}
              <Text style={[executiveStyles.tableCell, { width: COL_SCORE }]}>
                {pillar.score.toFixed(1)}/10
              </Text>

              {/* Progress bar (native View -- D-14, no SVG) */}
              <View
                style={[
                  executiveStyles.progressBarTrack,
                  { width: COL_PROGRESS - 8, marginRight: 8 },
                ]}
              >
                <View
                  style={[
                    executiveStyles.progressBarFill,
                    {
                      width: Math.round(fillPct * (COL_PROGRESS - 8)),
                      backgroundColor: hexColor,
                    },
                  ]}
                />
              </View>

              {/* Risk level badge */}
              <View style={{ width: COL_RISK }}>
                <View
                  style={[
                    executiveStyles.impactBadge,
                    { backgroundColor: hexColor },
                  ]}
                >
                  <Text style={executiveStyles.impactBadgeText}>
                    {pillar.riskLevel.toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Impact level badge */}
              <View style={{ width: COL_IMPACT }}>
                <View
                  style={[
                    executiveStyles.impactBadge,
                    { backgroundColor: impactColor },
                  ]}
                >
                  <Text style={executiveStyles.impactBadgeText}>
                    {pillar.impactLevel}
                  </Text>
                </View>
              </View>
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
