-- Epic 5.11 Phase 2: advisor pillar scope on intake approval

ALTER TABLE "IntakeApproval" ADD COLUMN "included_pillars" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "IntakeApproval" ADD COLUMN "pillar_recommendations" JSONB;

-- Backfill approved rows: scope from focus areas when set, else all six.
UPDATE "IntakeApproval"
SET "included_pillars" = CASE
  WHEN cardinality("focusAreas") > 0 THEN "focusAreas"
  ELSE ARRAY[
    'governance',
    'cyber-digital',
    'physical-security',
    'insurance',
    'geographic-environmental',
    'reputational-social'
  ]::TEXT[]
END
WHERE status = 'APPROVED' AND cardinality("included_pillars") = 0;
