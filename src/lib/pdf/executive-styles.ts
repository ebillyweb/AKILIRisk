import { StyleSheet } from "@react-pdf/renderer";

/**
 * Phase 25: Executive Report PDF StyleSheet.
 *
 * Extends the base styles.ts pattern with executive-specific additions.
 * A4 page content width = 595pt - 2*72pt padding = 451pt.
 *
 * Anti-pattern (Pitfall 6): avoid percentage widths in nested flex --
 * use explicit numeric widths derived from 451pt content area.
 */
export const executiveStyles = StyleSheet.create({
  // -------------------------------------------------------------------------
  // Page
  // -------------------------------------------------------------------------
  page: {
    fontFamily: "Helvetica",
    fontSize: 11,
    paddingTop: 72,
    paddingBottom: 72,
    paddingHorizontal: 72,
    lineHeight: 1.5,
    color: "#374151",
  },

  // -------------------------------------------------------------------------
  // Section headings
  // -------------------------------------------------------------------------
  sectionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1a1a2e",
    marginBottom: 20,
  },

  subSectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1a1a2e",
    marginBottom: 12,
  },

  sectionSubtitle: {
    fontSize: 13,
    color: "#374151",
    marginBottom: 16,
  },

  // -------------------------------------------------------------------------
  // Body text
  // -------------------------------------------------------------------------
  bodyText: {
    fontSize: 11,
    color: "#374151",
    lineHeight: 1.5,
    marginBottom: 8,
  },

  zeroStateText: {
    fontSize: 11,
    color: "#6b7280",
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 32,
    marginBottom: 32,
  },

  // -------------------------------------------------------------------------
  // Executive Readiness tier badge
  // -------------------------------------------------------------------------
  tierBadgeContainer: {
    alignSelf: "flex-start",
    marginBottom: 24,
  },

  tierBadge: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 4,
    alignSelf: "flex-start",
  },

  tierBadgeText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
  },

  tierDeveloping: {
    backgroundColor: "#dc2626",
  },

  tierMature: {
    backgroundColor: "#d97706",
  },

  tierAdvanced: {
    backgroundColor: "#059669",
  },

  // -------------------------------------------------------------------------
  // Progress bars (react-pdf View primitives -- no SVG)
  // -------------------------------------------------------------------------
  progressBarTrack: {
    height: 8,
    backgroundColor: "#e5e7eb",
    marginVertical: 4,
    flexDirection: "row",
    borderRadius: 4,
    overflow: "hidden",
  },

  progressBarFill: {
    height: 8,
    borderRadius: 4,
  },

  // -------------------------------------------------------------------------
  // Score delta colors
  // -------------------------------------------------------------------------
  deltaPositive: {
    color: "#059669",
    fontWeight: "bold",
  },

  deltaNegative: {
    color: "#dc2626",
    fontWeight: "bold",
  },

  deltaUnchanged: {
    color: "#6b7280",
  },

  // -------------------------------------------------------------------------
  // Table primitives (A4 content = 451pt)
  // -------------------------------------------------------------------------
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 8,
    alignItems: "center",
  },

  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: "#1a1a2e",
    paddingVertical: 8,
    backgroundColor: "#f9fafb",
  },

  tableHeaderCell: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#1a1a2e",
  },

  tableCell: {
    fontSize: 10,
    color: "#374151",
  },

  // -------------------------------------------------------------------------
  // Impact / risk level badges
  // -------------------------------------------------------------------------
  impactBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    alignSelf: "flex-start",
  },

  impactBadgeText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#ffffff",
  },

  impactCritical: {
    backgroundColor: "#dc2626",
  },

  impactHigh: {
    backgroundColor: "#f97316",
  },

  impactMedium: {
    backgroundColor: "#d97706",
  },

  impactLow: {
    backgroundColor: "#059669",
  },

  // -------------------------------------------------------------------------
  // Metric grid (stacked horizontal stats)
  // -------------------------------------------------------------------------
  metricGrid: {
    flexDirection: "row",
    marginVertical: 16,
  },

  metricItem: {
    flex: 1,
    textAlign: "center",
    padding: 12,
    backgroundColor: "#f9fafb",
    margin: 3,
  },

  metricLabel: {
    fontSize: 9,
    color: "#6b7280",
    marginBottom: 4,
    textAlign: "center",
  },

  metricValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1a1a2e",
    textAlign: "center",
  },

  // -------------------------------------------------------------------------
  // Lists
  // -------------------------------------------------------------------------
  listItem: {
    flexDirection: "row",
    marginBottom: 8,
  },

  listBullet: {
    width: 16,
    fontSize: 11,
    color: "#374151",
  },

  listText: {
    flex: 1,
    fontSize: 11,
    color: "#374151",
    lineHeight: 1.5,
  },

  // -------------------------------------------------------------------------
  // Domain label rows (Highest Risk / Strongest domains)
  // -------------------------------------------------------------------------
  domainRow: {
    flexDirection: "row",
    marginBottom: 6,
    alignItems: "center",
  },

  domainDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
    marginTop: 2,
  },

  domainLabel: {
    fontSize: 11,
    color: "#374151",
  },

  // -------------------------------------------------------------------------
  // Stacked horizontal bar (recommendation status breakdown -- D-14)
  // -------------------------------------------------------------------------
  stackedBar: {
    height: 16,
    flexDirection: "row",
    borderRadius: 4,
    overflow: "hidden",
    marginVertical: 8,
  },

  // -------------------------------------------------------------------------
  // Section divider
  // -------------------------------------------------------------------------
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    marginVertical: 16,
  },

  // -------------------------------------------------------------------------
  // Advisor Brief internal header
  // -------------------------------------------------------------------------
  advisorBriefHeader: {
    fontSize: 10,
    color: "#9ca3af",
    textAlign: "center",
    marginBottom: 24,
    letterSpacing: 1,
  },

  // -------------------------------------------------------------------------
  // Reporting period footer line (D-24)
  // -------------------------------------------------------------------------
  reportingPeriodText: {
    fontSize: 9,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 16,
  },
});

// -------------------------------------------------------------------------
// Color helpers for impact level and tier
// -------------------------------------------------------------------------

export function impactLevelColor(
  level: "Critical" | "High" | "Medium" | "Low"
): string {
  switch (level) {
    case "Critical":
      return "#dc2626";
    case "High":
      return "#f97316";
    case "Medium":
      return "#d97706";
    case "Low":
      return "#059669";
  }
}

export function tierBgColor(
  tier: "Developing" | "Mature" | "Advanced"
): string {
  switch (tier) {
    case "Developing":
      return "#dc2626";
    case "Mature":
      return "#d97706";
    case "Advanced":
      return "#059669";
  }
}

export function riskLevelHex(level: string): string {
  switch (level.toUpperCase()) {
    case "LOW":
      return "#10b981";
    case "MEDIUM":
      return "#f59e0b";
    case "HIGH":
      return "#f97316";
    case "CRITICAL":
      return "#dc2626";
    default:
      return "#9ca3af";
  }
}
