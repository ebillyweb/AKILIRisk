-- F2 / BRD §4.1 — rename four risk-area IDs to match BRD-domain wording.
--
-- The four drifted IDs (left) are renamed to the BRD-aligned IDs (right):
--
--   cybersecurity                   → cyber-digital
--   financial-asset-protection      → insurance
--   environmental-geographic-risk   → geographic-environmental
--   lifestyle-behavioral-risk       → reputational-social
--
-- `governance` and `physical-security` are unchanged.
--
-- Idempotent: each UPDATE filters by the OLD id, so re-running the
-- migration is a no-op once values have been flipped. Safe under
-- concurrent reads — the rename is logically atomic per row.
--
-- Storage points covered:
--   1. AssessmentBankQuestion.riskAreaId       (plain string)
--   2. AssessmentResponse.pillar               (plain string, scoring pillar)
--   3. AssessmentResponse.subCategory          (plain string; some rows mirror the riskAreaId)
--   4. PillarScore.pillar                      (plain string, FK-shaped)
--   5. PillarConfiguration.pillarId            (plain string, unique)
--   6. SubCategoryConfiguration.pillarId       (plain string)
--   7. RecommendationRule.triggerConditions    (JSONB array, condition[].pillarId)
--   8. RecommendationRule.pillarThresholds     (JSONB object, key = pillarId)
--   9. RecommendationRule.questionConditions   (JSONB; conservative regex replace)
--
-- Strategy for JSONB columns: cast → text, regexp_replace with word-boundary
-- guards on quoted literals, cast back. Bounded to the four old IDs; no
-- false positives possible because the regex requires the surrounding
-- double-quotes characteristic of JSON string literals.
--
-- NOT touched:
--   • prisma/migrations/* — historical UPDATE statements keep old IDs.
--   • AssessmentRecommendation.triggerReason — denormalized snapshot of
--     why a recommendation was created at the time. Renaming would lose
--     audit fidelity; the field is rendered as advisor copy, not used as
--     a join key.

-- ── 1. AssessmentBankQuestion.riskAreaId ─────────────────────────────────
UPDATE "AssessmentBankQuestion"
   SET "riskAreaId" = 'cyber-digital'
 WHERE "riskAreaId" = 'cybersecurity';

UPDATE "AssessmentBankQuestion"
   SET "riskAreaId" = 'insurance'
 WHERE "riskAreaId" = 'financial-asset-protection';

UPDATE "AssessmentBankQuestion"
   SET "riskAreaId" = 'geographic-environmental'
 WHERE "riskAreaId" = 'environmental-geographic-risk';

UPDATE "AssessmentBankQuestion"
   SET "riskAreaId" = 'reputational-social'
 WHERE "riskAreaId" = 'lifestyle-behavioral-risk';

-- ── 2. AssessmentResponse.pillar ────────────────────────────────────────
UPDATE "AssessmentResponse"
   SET "pillar" = 'cyber-digital'
 WHERE "pillar" = 'cybersecurity';

UPDATE "AssessmentResponse"
   SET "pillar" = 'insurance'
 WHERE "pillar" = 'financial-asset-protection';

UPDATE "AssessmentResponse"
   SET "pillar" = 'geographic-environmental'
 WHERE "pillar" = 'environmental-geographic-risk';

UPDATE "AssessmentResponse"
   SET "pillar" = 'reputational-social'
 WHERE "pillar" = 'lifestyle-behavioral-risk';

-- ── 3. AssessmentResponse.subCategory (mirrors riskAreaId for top-level rows) ──
UPDATE "AssessmentResponse"
   SET "subCategory" = 'cyber-digital'
 WHERE "subCategory" = 'cybersecurity';

UPDATE "AssessmentResponse"
   SET "subCategory" = 'insurance'
 WHERE "subCategory" = 'financial-asset-protection';

UPDATE "AssessmentResponse"
   SET "subCategory" = 'geographic-environmental'
 WHERE "subCategory" = 'environmental-geographic-risk';

UPDATE "AssessmentResponse"
   SET "subCategory" = 'reputational-social'
 WHERE "subCategory" = 'lifestyle-behavioral-risk';

-- ── 4. PillarScore.pillar ──────────────────────────────────────────────
UPDATE "PillarScore"
   SET "pillar" = 'cyber-digital'
 WHERE "pillar" = 'cybersecurity';

UPDATE "PillarScore"
   SET "pillar" = 'insurance'
 WHERE "pillar" = 'financial-asset-protection';

UPDATE "PillarScore"
   SET "pillar" = 'geographic-environmental'
 WHERE "pillar" = 'environmental-geographic-risk';

UPDATE "PillarScore"
   SET "pillar" = 'reputational-social'
 WHERE "pillar" = 'lifestyle-behavioral-risk';

-- ── 5. PillarConfiguration.pillarId ────────────────────────────────────
UPDATE "PillarConfiguration"
   SET "pillarId" = 'cyber-digital'
 WHERE "pillarId" = 'cybersecurity';

UPDATE "PillarConfiguration"
   SET "pillarId" = 'insurance'
 WHERE "pillarId" = 'financial-asset-protection';

UPDATE "PillarConfiguration"
   SET "pillarId" = 'geographic-environmental'
 WHERE "pillarId" = 'environmental-geographic-risk';

UPDATE "PillarConfiguration"
   SET "pillarId" = 'reputational-social'
 WHERE "pillarId" = 'lifestyle-behavioral-risk';

-- ── 6. SubCategoryConfiguration.pillarId ───────────────────────────────
UPDATE "SubCategoryConfiguration"
   SET "pillarId" = 'cyber-digital'
 WHERE "pillarId" = 'cybersecurity';

UPDATE "SubCategoryConfiguration"
   SET "pillarId" = 'insurance'
 WHERE "pillarId" = 'financial-asset-protection';

UPDATE "SubCategoryConfiguration"
   SET "pillarId" = 'geographic-environmental'
 WHERE "pillarId" = 'environmental-geographic-risk';

UPDATE "SubCategoryConfiguration"
   SET "pillarId" = 'reputational-social'
 WHERE "pillarId" = 'lifestyle-behavioral-risk';

-- ── 7+8+9. RecommendationRule JSONB columns ────────────────────────────
-- Cast JSONB → text → regex_replace → JSONB. The regex matches the OLD
-- id surrounded by JSON-string double-quotes, so we don't accidentally
-- mangle any prose stored in a description field. Idempotent: once the
-- old IDs are gone, the second run finds nothing to replace.
--
-- Each column is updated only when it actually contains one of the four
-- old IDs (the WHERE filter on the text cast keeps row counts honest in
-- migration logs).

UPDATE "RecommendationRule"
   SET "triggerConditions" =
       regexp_replace(
         regexp_replace(
           regexp_replace(
             regexp_replace(
               "triggerConditions"::text,
               '"cybersecurity"', '"cyber-digital"', 'g'
             ),
             '"financial-asset-protection"', '"insurance"', 'g'
           ),
           '"environmental-geographic-risk"', '"geographic-environmental"', 'g'
         ),
         '"lifestyle-behavioral-risk"', '"reputational-social"', 'g'
       )::jsonb
 WHERE "triggerConditions"::text ~
       '"(cybersecurity|financial-asset-protection|environmental-geographic-risk|lifestyle-behavioral-risk)"';

UPDATE "RecommendationRule"
   SET "pillarThresholds" =
       regexp_replace(
         regexp_replace(
           regexp_replace(
             regexp_replace(
               "pillarThresholds"::text,
               '"cybersecurity"', '"cyber-digital"', 'g'
             ),
             '"financial-asset-protection"', '"insurance"', 'g'
           ),
           '"environmental-geographic-risk"', '"geographic-environmental"', 'g'
         ),
         '"lifestyle-behavioral-risk"', '"reputational-social"', 'g'
       )::jsonb
 WHERE "pillarThresholds" IS NOT NULL
   AND "pillarThresholds"::text ~
       '"(cybersecurity|financial-asset-protection|environmental-geographic-risk|lifestyle-behavioral-risk)"';

UPDATE "RecommendationRule"
   SET "questionConditions" =
       regexp_replace(
         regexp_replace(
           regexp_replace(
             regexp_replace(
               "questionConditions"::text,
               '"cybersecurity"', '"cyber-digital"', 'g'
             ),
             '"financial-asset-protection"', '"insurance"', 'g'
           ),
           '"environmental-geographic-risk"', '"geographic-environmental"', 'g'
         ),
         '"lifestyle-behavioral-risk"', '"reputational-social"', 'g'
       )::jsonb
 WHERE "questionConditions" IS NOT NULL
   AND "questionConditions"::text ~
       '"(cybersecurity|financial-asset-protection|environmental-geographic-risk|lifestyle-behavioral-risk)"';
