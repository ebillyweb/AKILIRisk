-- C2 (BRD §7.2): track when an admin re-scored an assessment so the
-- timestamp can surface on the per-client view + PDF report. Pure
-- additive migration — single nullable DateTime, no defaults, no
-- backfill needed (NULL means "never re-scored" which is true of every
-- existing row).
--
-- Pairs with the new rescoreAssessment / rescoreAssessmentsBulk admin
-- actions in src/lib/actions/admin-rescore-actions.ts. The Assessment
-- model already has a `version` Int @default(1) column (round-1) which
-- the rescore action increments on each successful run.

ALTER TABLE "Assessment"
  ADD COLUMN "lastRescoredAt" TIMESTAMP(3);
