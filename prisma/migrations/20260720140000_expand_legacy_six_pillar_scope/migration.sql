-- 1) Finish AI pillar rename if Preview/prod still has the pre-rename slug/code
--    (idempotent — no-ops when already renamed).
UPDATE "pillars"
SET "slug" = 'ai-emerging-tech'
WHERE "slug" = 'family-governance-behavioral';

UPDATE "categories"
SET "code" = '10_ai'
WHERE "code" = '10_family_governance';

-- Scope arrays may still carry the old slug after a partial rename.
UPDATE "Assessment"
SET "included_pillars" = array_replace("included_pillars", 'family-governance-behavioral', 'ai-emerging-tech')
WHERE 'family-governance-behavioral' = ANY("included_pillars");

UPDATE "IntakeApproval"
SET "included_pillars" = array_replace("included_pillars", 'family-governance-behavioral', 'ai-emerging-tech')
WHERE 'family-governance-behavioral' = ANY("included_pillars");

UPDATE "InviteCode"
SET "included_pillars" = array_replace("included_pillars", 'family-governance-behavioral', 'ai-emerging-tech')
WHERE 'family-governance-behavioral' = ANY("included_pillars");

UPDATE "ClientAdvisorAssignment"
SET "included_pillars" = array_replace("included_pillars", 'family-governance-behavioral', 'ai-emerging-tech')
WHERE 'family-governance-behavioral' = ANY("included_pillars");

UPDATE "ClientAdvisorAssignment"
SET "focus_areas" = array_replace("focus_areas", 'family-governance-behavioral', 'ai-emerging-tech')
WHERE "focus_areas" IS NOT NULL
  AND 'family-governance-behavioral' = ANY("focus_areas");

UPDATE "InviteCode"
SET "focus_areas" = array_replace("focus_areas", 'family-governance-behavioral', 'ai-emerging-tech')
WHERE "focus_areas" IS NOT NULL
  AND 'family-governance-behavioral' = ANY("focus_areas");

-- 2) Expand engagements still locked to the original Belvedere six domains
--    to the full active platform catalog (10). Intentional narrower scopes
--    (cardinality ≠ 6 or a different set of six) are left alone.
--    Arrays are compared as sets via @> / <@ so order does not matter.

DO $$
DECLARE
  legacy_six text[] := ARRAY[
    'governance',
    'cyber-digital',
    'physical-security',
    'insurance',
    'geographic-environmental',
    'reputational-social'
  ];
  full_ten text[] := ARRAY[
    'governance',
    'cyber-digital',
    'physical-security',
    'insurance',
    'geographic-environmental',
    'reputational-social',
    'liquidity-cash',
    'tax-exposure',
    'estate-succession',
    'ai-emerging-tech'
  ];
BEGIN
  UPDATE "Assessment"
  SET "included_pillars" = full_ten
  WHERE cardinality("included_pillars") = 6
    AND "included_pillars" @> legacy_six
    AND "included_pillars" <@ legacy_six;

  UPDATE "IntakeApproval"
  SET "included_pillars" = full_ten
  WHERE cardinality("included_pillars") = 6
    AND "included_pillars" @> legacy_six
    AND "included_pillars" <@ legacy_six;

  UPDATE "InviteCode"
  SET "included_pillars" = full_ten
  WHERE cardinality("included_pillars") = 6
    AND "included_pillars" @> legacy_six
    AND "included_pillars" <@ legacy_six;

  UPDATE "ClientAdvisorAssignment"
  SET "included_pillars" = full_ten
  WHERE cardinality("included_pillars") = 6
    AND "included_pillars" @> legacy_six
    AND "included_pillars" <@ legacy_six;

  -- Expand focus_areas only when it was the same full legacy-six lock-in
  -- (not when focus was intentionally narrower within the six).
  UPDATE "ClientAdvisorAssignment"
  SET "focus_areas" = full_ten
  WHERE cardinality("focus_areas") = 6
    AND "focus_areas" @> legacy_six
    AND "focus_areas" <@ legacy_six;

  UPDATE "InviteCode"
  SET "focus_areas" = full_ten
  WHERE cardinality("focus_areas") = 6
    AND "focus_areas" @> legacy_six
    AND "focus_areas" <@ legacy_six;

  UPDATE "IntakeApproval"
  SET "focusAreas" = full_ten
  WHERE cardinality("focusAreas") = 6
    AND "focusAreas" @> legacy_six
    AND "focusAreas" <@ legacy_six;
END $$;
