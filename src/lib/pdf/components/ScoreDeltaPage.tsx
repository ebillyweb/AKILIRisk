import { Page, Text, View } from "@react-pdf/renderer";
import { executiveStyles, riskLevelHex } from "../executive-styles";
import { EnhancedPageFooter } from "./EnhancedPageFooter";
import { DraftWatermark } from "./DraftWatermark";
import type { ScoreDeltaSummary } from "../executive-report-types";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

interface ScoreDeltaPageProps {
  scoreDelta: ScoreDeltaSummary | null;
  reportingPeriodLabel: string;
  branding: AdvisorBrandingData | null;
  companyName: string;
  draft: boolean;
}

/**
 * Score delta per pillar with WHY attribution (D-12, D-13).
 * Two modes: data view when scoreDelta !== null; zero-state when null (D-07).
 * All visualizations use native react-pdf View/Text primitives (D-14).
 *
 * A4 content = 451pt. Column widths below sum to 451.
 */
export function ScoreDeltaPage({
  scoreDelta,
  reportingPeriodLabel,
  branding,
  draft,
}: ScoreDeltaPageProps) {
  const COL_PILLAR = 110;
  const COL_PREV = 55;
  const COL_CURR = 55;
  const COL_DELTA = 55;
  const COL_TREND = 40;
  const COL_DRIVERS = 136;

  return (
    <Page size="A4" style={executiveStyles.page}>
      <Text style={executiveStyles.sectionTitle}>Risk Score Trends</Text>

      {scoreDelta === null ? (
        /* Zero-state (D-07) -- no empty pages */
        <Text style={executiveStyles.zeroStateText}>
          Score comparison will become available after your next reassessment.
          This report will show how your risk profile has evolved since the
          initial baseline assessment.
        </Text>
      ) : (
        <>
          <Text style={[executiveStyles.bodyText, { marginBottom: 16 }]}>
            Comparison against the previous assessment. Key drivers explain why
            scores changed (D-13).
          </Text>

          {/* Overall direction summary */}
          <View style={{ marginBottom: 20 }}>
            <Text style={executiveStyles.subSectionTitle}>
              Overall Direction:{" "}
              <Text
                style={
                  scoreDelta.overallDirection === "improved"
                    ? executiveStyles.deltaPositive
                    : scoreDelta.overallDirection === "regressed"
                    ? executiveStyles.deltaNegative
                    : executiveStyles.deltaUnchanged
                }
              >
                {scoreDelta.overallDirection.charAt(0).toUpperCase() +
                  scoreDelta.overallDirection.slice(1)}
              </Text>
            </Text>
          </View>

          {/* Key drivers */}
          {scoreDelta.keyDrivers.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={executiveStyles.subSectionTitle}>Key Drivers</Text>
              {scoreDelta.keyDrivers.map((driver, idx) => (
                <View key={idx} style={executiveStyles.listItem}>
                  <Text style={executiveStyles.listBullet}>&#10003;</Text>
                  <Text style={executiveStyles.listText}>{driver}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Per-pillar table */}
          <View style={executiveStyles.tableHeaderRow}>
            <Text
              style={[executiveStyles.tableHeaderCell, { width: COL_PILLAR }]}
            >
              Domain
            </Text>
            <Text
              style={[executiveStyles.tableHeaderCell, { width: COL_PREV }]}
            >
              Previous
            </Text>
            <Text
              style={[executiveStyles.tableHeaderCell, { width: COL_CURR }]}
            >
              Current
            </Text>
            <Text
              style={[executiveStyles.tableHeaderCell, { width: COL_DELTA }]}
            >
              Delta
            </Text>
            <Text
              style={[executiveStyles.tableHeaderCell, { width: COL_TREND }]}
            >
              Trend
            </Text>
            <Text
              style={[executiveStyles.tableHeaderCell, { width: COL_DRIVERS }]}
            >
              Primary Drivers
            </Text>
          </View>

          {scoreDelta.deltas.map((delta, idx) => {
            const deltaVal = delta.delta;
            const isPositive = deltaVal > 0;
            const isNegative = deltaVal < 0;
            const deltaStyle = isPositive
              ? executiveStyles.deltaPositive
              : isNegative
              ? executiveStyles.deltaNegative
              : executiveStyles.deltaUnchanged;

            // Trend arrow as text (D-14 -- no SVG/icons)
            const trendChar = isPositive
              ? "\u25B2"
              : isNegative
              ? "\u25BC"
              : "\u2014";

            const attributionText =
              delta.attribution && delta.attribution.length > 0
                ? delta.attribution.slice(0, 2).join(", ")
                : "—";

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
                    { width: COL_PILLAR, fontWeight: "bold" },
                  ]}
                >
                  {delta.pillar}
                </Text>
                <Text
                  style={[executiveStyles.tableCell, { width: COL_PREV }]}
                >
                  {delta.previousScore !== null
                    ? delta.previousScore.toFixed(1)
                    : "—"}
                </Text>
                <Text
                  style={[executiveStyles.tableCell, { width: COL_CURR }]}
                >
                  {delta.currentScore.toFixed(1)}
                </Text>
                <Text style={[executiveStyles.tableCell, deltaStyle, { width: COL_DELTA }]}>
                  {isPositive ? "+" : ""}
                  {deltaVal.toFixed(1)}
                </Text>
                <Text
                  style={[executiveStyles.tableCell, deltaStyle, { width: COL_TREND }]}
                >
                  {trendChar}
                </Text>
                <Text
                  style={[
                    executiveStyles.tableCell,
                    { width: COL_DRIVERS, fontSize: 9 },
                  ]}
                >
                  {attributionText}
                </Text>
              </View>
            );
          })}
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
