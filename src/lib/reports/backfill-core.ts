/**
 * §4.5 commit 3 (BRD §4.5) — pure core of the report-backfill script.
 *
 * Factored out of `scripts/backfill-reports.ts` so the per-assessment
 * processing path can be unit-tested without depending on the actual
 * Prisma client. The script wraps `processOneAssessment` in env loading,
 * pagination, audit-row writes, and a final summary log.
 *
 * Idempotency: the function checks for an existing Report row for the
 * assessment and skips when present, so re-running the script is a
 * no-op (returns `{ status: "skipped" }`).
 */

import type { ReportSnapshot } from "@/lib/pdf/build-report-snapshot";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

export interface BackfillDeps {
  /** Look up an Assessment + its most-recent PillarScore.calculatedAt
   *  (the timestamp we use as `publishedAt` on the synthetic v1 row).
   *  Returns null when the assessment has no scores or doesn't exist. */
  loadAssessment(assessmentId: string): Promise<{
    id: string;
    userId: string;
    latestCalculatedAt: Date | null;
  } | null>;
  /** True when at least one Report row exists for the assessment. */
  hasExistingReport(assessmentId: string): Promise<boolean>;
  /** Build the snapshot for the assessment. Wraps buildReportSnapshot. */
  buildSnapshot(assessmentId: string): Promise<ReportSnapshot>;
  /** Build the branding snapshot. Returns null when no active advisor. */
  buildBranding(assessmentId: string): Promise<AdvisorBrandingData | null>;
  /** Insert one PUBLISHED row at v=1 + one DRAFT row at v=2. */
  insertSyntheticPublishedAndDraft(input: {
    assessmentId: string;
    publishedAt: Date;
    snapshot: ReportSnapshot;
    branding: AdvisorBrandingData | null;
    templateChoice: "BELVEDERE" | "COBRANDED";
  }): Promise<{ publishedReportId: string }>;
}

export type BackfillResult =
  | { status: "skipped"; reason: "already_has_reports" | "no_pillar_scores" | "not_found" }
  | { status: "inserted"; publishedReportId: string };

/**
 * Process a single Assessment. Idempotent: returns `skipped` when a
 * Report row already exists. Throws on programming errors; never
 * partially writes (the synthetic publish + open-draft are paired in
 * `insertSyntheticPublishedAndDraft` which is expected to wrap them in
 * a transaction).
 */
export async function processOneAssessment(
  assessmentId: string,
  deps: BackfillDeps
): Promise<BackfillResult> {
  const assessment = await deps.loadAssessment(assessmentId);
  if (!assessment) {
    return { status: "skipped", reason: "not_found" };
  }
  if (assessment.latestCalculatedAt == null) {
    return { status: "skipped", reason: "no_pillar_scores" };
  }
  if (await deps.hasExistingReport(assessmentId)) {
    return { status: "skipped", reason: "already_has_reports" };
  }

  const snapshot = await deps.buildSnapshot(assessmentId);
  const branding = await deps.buildBranding(assessmentId);

  // Per the design proposal §5: COBRANDED when an active advisor is
  // resolved (branding non-null), else BELVEDERE.
  const templateChoice = branding ? "COBRANDED" : "BELVEDERE";

  const inserted = await deps.insertSyntheticPublishedAndDraft({
    assessmentId,
    publishedAt: assessment.latestCalculatedAt,
    snapshot,
    branding,
    templateChoice,
  });

  return { status: "inserted", publishedReportId: inserted.publishedReportId };
}
