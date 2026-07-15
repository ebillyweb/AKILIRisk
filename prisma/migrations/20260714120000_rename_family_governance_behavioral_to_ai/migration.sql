-- Rename the repurposed pillar's internal identifiers to match its product name.
--   pillar slug:   family-governance-behavioral -> ai-emerging-tech
--   category code: 10_family_governance         -> 10_ai
--
-- The pillar was renamed "AI & Emerging Tech Risk" in the catalog; this migration
-- brings the persisted identifiers in line. It mirrors the pattern in
-- 20260521120000_rename_risk_area_ids_to_brd_naming: direct scalar UPDATEs plus
-- quote-guarded regexp_replace on JSON columns that embed the slug as a value or
-- object key. Every statement is gated by a WHERE on the old value, so it is
-- idempotent (a second run finds nothing) and keeps migration row counts honest.

-- ── Scalar columns: pillar slug ──────────────────────────────────────────────
UPDATE "pillars"
   SET "slug" = 'ai-emerging-tech'
 WHERE "slug" = 'family-governance-behavioral';

UPDATE "PillarScore"
   SET "pillar" = 'ai-emerging-tech'
 WHERE "pillar" = 'family-governance-behavioral';

UPDATE "AssessmentResponse"
   SET "pillar" = 'ai-emerging-tech'
 WHERE "pillar" = 'family-governance-behavioral';

UPDATE "AssessmentResponse"
   SET "subCategory" = 'ai-emerging-tech'
 WHERE "subCategory" = 'family-governance-behavioral';

UPDATE "Assessment"
   SET "currentPillar" = 'ai-emerging-tech'
 WHERE "currentPillar" = 'family-governance-behavioral';

-- ── Scalar column: category code ─────────────────────────────────────────────
-- The code lives only in categories.code; sections/questions FK by UUID.
UPDATE "categories"
   SET "code" = '10_ai'
 WHERE "code" = '10_family_governance';

-- ── JSON columns embedding the slug (quote-guarded so prose is untouched) ─────
-- Platform recommendation rules (triggerConditions/pillarThresholds/questionConditions).
UPDATE "RecommendationRule"
   SET "triggerConditions" =
       regexp_replace("triggerConditions"::text,
         '"family-governance-behavioral"', '"ai-emerging-tech"', 'g')::jsonb
 WHERE "triggerConditions"::text ~ '"family-governance-behavioral"';

UPDATE "RecommendationRule"
   SET "pillarThresholds" =
       regexp_replace("pillarThresholds"::text,
         '"family-governance-behavioral"', '"ai-emerging-tech"', 'g')::jsonb
 WHERE "pillarThresholds" IS NOT NULL
   AND "pillarThresholds"::text ~ '"family-governance-behavioral"';

UPDATE "RecommendationRule"
   SET "questionConditions" =
       regexp_replace("questionConditions"::text,
         '"family-governance-behavioral"', '"ai-emerging-tech"', 'g')::jsonb
 WHERE "questionConditions" IS NOT NULL
   AND "questionConditions"::text ~ '"family-governance-behavioral"';

-- Advisor- and enterprise-cloned rules copy triggerConditions verbatim.
UPDATE "advisor_recommendation_rules"
   SET "trigger_conditions" =
       regexp_replace("trigger_conditions"::text,
         '"family-governance-behavioral"', '"ai-emerging-tech"', 'g')::jsonb
 WHERE "trigger_conditions"::text ~ '"family-governance-behavioral"';

UPDATE "enterprise_recommendation_rules"
   SET "trigger_conditions" =
       regexp_replace("trigger_conditions"::text,
         '"family-governance-behavioral"', '"ai-emerging-tech"', 'g')::jsonb
 WHERE "trigger_conditions"::text ~ '"family-governance-behavioral"';

-- Frozen intake snapshots embed the slug as both JSON values AND object keys
-- (assessmentQuestions / pillarNarratives). A quote-guarded text replace on the
-- serialized blob catches both. snapshot_hash is intentionally left as-is: it is
-- written at snapshot creation and never validated on read, so staleness is inert.
UPDATE "intake_snapshots"
   SET "snapshot_blob" =
       regexp_replace("snapshot_blob"::text,
         '"family-governance-behavioral"', '"ai-emerging-tech"', 'g')::jsonb
 WHERE "snapshot_blob"::text ~ '"family-governance-behavioral"';

-- Frozen report snapshots keyed by pillar slug.
UPDATE "Report"
   SET "snapshotData" =
       regexp_replace("snapshotData"::text,
         '"family-governance-behavioral"', '"ai-emerging-tech"', 'g')::jsonb
 WHERE "snapshotData" IS NOT NULL
   AND "snapshotData"::text ~ '"family-governance-behavioral"';

UPDATE "Report"
   SET "queuedPillarActions" =
       regexp_replace("queuedPillarActions"::text,
         '"family-governance-behavioral"', '"ai-emerging-tech"', 'g')::jsonb
 WHERE "queuedPillarActions" IS NOT NULL
   AND "queuedPillarActions"::text ~ '"family-governance-behavioral"';

UPDATE "ExecutiveReport"
   SET "executiveSnapshotData" =
       regexp_replace("executiveSnapshotData"::text,
         '"family-governance-behavioral"', '"ai-emerging-tech"', 'g')::jsonb
 WHERE "executiveSnapshotData" IS NOT NULL
   AND "executiveSnapshotData"::text ~ '"family-governance-behavioral"';

-- Assessment upsell triggers may encode the slug in a code string.
UPDATE "Assessment"
   SET "upsellTriggersFired" =
       regexp_replace("upsellTriggersFired"::text,
         '"family-governance-behavioral"', '"ai-emerging-tech"', 'g')::jsonb
 WHERE "upsellTriggersFired" IS NOT NULL
   AND "upsellTriggersFired"::text ~ '"family-governance-behavioral"';

-- Advisor signals (regenerable display payloads) and solution activity details.
UPDATE "AdvisorSignal"
   SET "payload" =
       regexp_replace("payload"::text,
         '"family-governance-behavioral"', '"ai-emerging-tech"', 'g')::jsonb
 WHERE "payload" IS NOT NULL
   AND "payload"::text ~ '"family-governance-behavioral"';

UPDATE "solution_activities"
   SET "detail" =
       regexp_replace("detail"::text,
         '"family-governance-behavioral"', '"ai-emerging-tech"', 'g')::jsonb
 WHERE "detail" IS NOT NULL
   AND "detail"::text ~ '"family-governance-behavioral"';
