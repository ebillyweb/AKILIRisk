-- C1 (BRD §4.4): classify ServiceRecommendation by tier (Baseline vs
-- Enhanced), complexity, and implementation type. These three dimensions
-- are first-class catalog filters in the new admin recommendations editor;
-- they need column-level indexability rather than living in the existing
-- `metadata` JSON blob.
--
-- Migration is purely additive:
--   * `tier` defaults to BASELINE so existing seeded rows continue to look
--     like automated baseline recs (the recommendation engine surfaces
--     them today without any tier distinction; the column simply records
--     what they already are).
--   * `complexity` and `implementationType` are nullable so unset rows
--     render as "—" in admin filters; the existing seed scripts run
--     unchanged.
--
-- Engine compatibility: src/lib/assessment/engines/recommendation-engine.ts
-- never references these columns, so adding them is a no-op for the
-- matching engine. The admin editor and any future per-tier UI filters
-- are the only readers.

CREATE TYPE "RecommendationTier" AS ENUM ('BASELINE', 'ENHANCED');
CREATE TYPE "RecommendationComplexity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "ImplementationType" AS ENUM ('DIY', 'ADVISORY', 'HYBRID');

ALTER TABLE "ServiceRecommendation"
  ADD COLUMN "tier" "RecommendationTier" NOT NULL DEFAULT 'BASELINE',
  ADD COLUMN "complexity" "RecommendationComplexity",
  ADD COLUMN "implementationType" "ImplementationType";

-- Index `tier` so the admin "Baseline / Enhanced" filter is cheap on
-- catalogs of any reasonable size. complexity + implementationType are
-- low-cardinality + frequently combined with `tier` in filters; partial
-- composite index would be premature.
CREATE INDEX "ServiceRecommendation_tier_idx" ON "ServiceRecommendation" ("tier");
