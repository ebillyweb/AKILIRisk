-- The family-governance-behavioral -> ai-emerging-tech pillar rename updated the
-- pillar/score/response tables but NOT the included_pillars scope arrays, so a
-- narrow-scope assessment that listed the old slug could no longer score the
-- renamed pillar (PILLAR_OUT_OF_SCOPE). Rewrite the stale slug everywhere pillar
-- scope is persisted. Idempotent: the WHERE clauses match nothing on re-run.

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

-- IntakeApproval.pillar_recommendations JSONB may key on the slug. Rewrite the
-- quoted token precisely (same quote-guarded approach as the rename migration).
UPDATE "IntakeApproval"
SET "pillar_recommendations" = regexp_replace(
  "pillar_recommendations"::text, '"family-governance-behavioral"', '"ai-emerging-tech"', 'g'
)::jsonb
WHERE "pillar_recommendations" IS NOT NULL
  AND "pillar_recommendations"::text LIKE '%family-governance-behavioral%';
