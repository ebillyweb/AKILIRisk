-- A2 (BRD §4.2 + §7.1): make Low/Medium/High risk-tier cutoffs configurable.
-- Three Int columns added to the existing PlatformSettings singleton row.
-- Defaults match the values previously hardcoded in
-- src/lib/assessment/governance-rubric.ts so behavior is unchanged on
-- first deploy.
--
-- Caveat (documented in code + admin UI helper text): PillarScore.riskLevel
-- is a persisted column. Existing scored assessments retain their previous
-- risk level until re-scored; threshold changes apply to NEW scoring runs
-- going forward. A separate "rescore all" admin action is out of scope for
-- this change.

ALTER TABLE "PlatformSettings"
  ADD COLUMN "riskThresholdLow"    INTEGER NOT NULL DEFAULT 80,
  ADD COLUMN "riskThresholdMedium" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN "riskThresholdHigh"   INTEGER NOT NULL DEFAULT 40;
