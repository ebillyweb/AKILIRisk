/**
 * Deterministic risk-signals fixture contract.
 *
 * Seeded by `node scripts/seed-risk-signals-fixtures.js` (requires
 * `seed-advisor-test-data.js` first). Playwright smokes in
 * `tests/smoke/risk-signals-data.spec.ts` assert UI matches these values.
 */

export const RISK_SIGNALS_FIXTURE = {
  clientAEmail: "risk-signals-a@test.local",
  clientBEmail: "risk-signals-b@test.local",
  /** Unique titles — used to prove advisor feed tenant isolation in the UI. */
  signalTitleA: "RS-FIXTURE-A: Critical governance",
  signalTitleB: "RS-FIXTURE-B: Critical governance",
  /** Older than SIGNAL_FEED_WINDOW_DAYS — must not appear in advisor feed. */
  signalTitleAStale: "RS-FIXTURE-A: Stale (outside 90-day window)",
  dedupeKeys: {
    aCritical: "rs-fixture-a-gov-critical",
    bCritical: "rs-fixture-b-gov-critical",
    aStale: "rs-fixture-a-gov-critical-stale",
  },
  assessmentIds: {
    a: "rs-fixture-asmt-a",
    b: "rs-fixture-asmt-b",
  },
  /**
   * Per-tenant exposure for fixture clients only (advisor2 has no other clients).
   */
  tenantB: {
    familiesWithAssessment: 1,
    familiesAtRisk: 0,
    criticalIndicators: 0,
  },
  /**
   * Minimum contribution from fixture client A on top of any other seeded clients.
   */
  tenantAMin: {
    familiesAtRisk: 1,
    criticalIndicators: 1,
  },
  advisorFeed: {
    /** Visible risk rows on /advisor/signals for advisor@test.com */
    advisorAVisibleTitles: ["RS-FIXTURE-A: Critical governance"],
    advisorAHiddenTitles: [
      "RS-FIXTURE-B: Critical governance",
      "RS-FIXTURE-A: Stale (outside 90-day window)",
    ],
    advisorBVisibleTitles: ["RS-FIXTURE-B: Critical governance"],
    advisorBHiddenTitles: [
      "RS-FIXTURE-A: Critical governance",
      "RS-FIXTURE-A: Stale (outside 90-day window)",
    ],
  },
} as const;
