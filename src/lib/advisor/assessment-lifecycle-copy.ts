/** Advisor-facing labels for stale scores (post-completion answer edits). */
export const STALE_SCORES_COPY = {
  tableBadge: "Stale scores",
  alertTitle: "Scores out of date",
  alertDescription:
    "This client changed answers after the assessment was marked complete. Current scores, recommendations, and published reports may not match their latest responses. Use Re-score now to refresh results from their latest answers.",
  rescoreButton: "Re-score now",
} as const;

/** Advisor-facing labels for Phase 24 reassessment workflow. */
export const REASSESSMENT_COPY = {
  navCadenceLabel: "Reassessment cadence",
  pageTitle: "Reassessment cadence",
  pageSubtitle:
    "Track scheduled review cycles and start linked reassessments to measure client progress over time.",
  startButton: "Start reassessment",
  dialogTitle: "Choose reassessment type",
} as const;
