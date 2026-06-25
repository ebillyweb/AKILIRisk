import { Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import {
  buildHeatMapCells,
  formatHeatMapScore,
  type PillarScoreInput,
} from "@/lib/assessment/heat-map-data";
import { starterPillarCatalog, type PillarCatalogEntry } from "@/lib/methodology/pillar-catalog";
import { DraftWatermark } from "./DraftWatermark";

/**
 * PDF version of the round-10 / B1 risk heat map. Single-client mode only —
 * portfolio-grid in a per-client PDF report would be off-scope.
 *
 * Same data + same canonical RISK_LEVEL_PALETTE as the web component
 * (src/components/assessment/RiskHeatMap.tsx) so the report and the
 * advisor-portal view stay visually consistent.
 *
 * Layout: 2 rows × 3 columns. Each cell shows the domain name, the
 * risk-level label, and the maturity score inline (per round-10 sign-off:
 * inline scores in every cell, not behind hover, since PDFs can't hover).
 */

interface RiskHeatMapPdfProps {
  pillarScores: ReadonlyArray<PillarScoreInput>;
  companyName: string;
  /** §4.5 commit 3: see DraftWatermark. */
  draft?: boolean;
  catalog?: readonly PillarCatalogEntry[];
}

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: "Helvetica",
  },
  header: {
    fontSize: 10,
    color: "#6b7280",
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: "#6b7280",
    marginBottom: 16,
  },
  bannerUnassessed: {
    padding: 10,
    backgroundColor: "#f3f4f6",
    borderRadius: 4,
    marginBottom: 12,
    fontSize: 10,
    color: "#374151",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cell: {
    width: "31.5%",
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderStyle: "solid",
    marginBottom: 8,
  },
  pillarName: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 2,
  },
  riskLabel: {
    fontSize: 9,
    marginBottom: 2,
  },
  scoreText: {
    fontSize: 9,
    fontFamily: "Courier",
    opacity: 0.85,
  },
});

export function RiskHeatMapPdf({
  pillarScores,
  companyName,
  draft,
  catalog = starterPillarCatalog(),
}: RiskHeatMapPdfProps) {
  const cells = buildHeatMapCells(pillarScores, { catalog });
  const allUnassessed = cells.every((c) => c.level === "unassessed");

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.header}>{companyName}</Text>
      <Text style={styles.title}>Risk by Domain</Text>
      <Text style={styles.subtitle}>
        Risk-level snapshot across the six assessed domains. Color and label
        reflect the configured risk-tier cutoffs (see Admin → Risk thresholds).
      </Text>

      {allUnassessed ? (
        <Text style={styles.bannerUnassessed}>
          No scored assessment yet. The heat map will populate once an
          assessment is completed.
        </Text>
      ) : null}

      <View style={styles.grid}>
        {cells.map((cell) => (
          <View
            key={cell.pillarId}
            style={[
              styles.cell,
              {
                backgroundColor: cell.palette.hex + "1f", // ~12% alpha for soft fill
                borderColor: cell.palette.hex,
              },
            ]}
          >
            <Text style={[styles.pillarName, { color: cell.palette.hex }]}>
              {cell.pillarName}
            </Text>
            <Text style={styles.riskLabel}>{cell.palette.label}</Text>
            <Text style={styles.scoreText}>
              {formatHeatMapScore(cell.score)}
            </Text>
          </View>
        ))}
      </View>
      {draft ? <DraftWatermark /> : null}
    </Page>
  );
}
