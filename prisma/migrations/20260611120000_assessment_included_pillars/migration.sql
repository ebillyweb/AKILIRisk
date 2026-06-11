-- Epic 5.11 Phase 1: scoped assessments + intake pillar tags

ALTER TABLE "Assessment" ADD COLUMN "included_pillars" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Legacy rows: explicit all-six scope (empty array still resolves to all six in app code).
UPDATE "Assessment"
SET "included_pillars" = ARRAY[
  'governance',
  'cyber-digital',
  'physical-security',
  'insurance',
  'geographic-environmental',
  'reputational-social'
]::TEXT[]
WHERE cardinality("included_pillars") = 0;

ALTER TABLE "questions" ADD COLUMN "related_pillar_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
