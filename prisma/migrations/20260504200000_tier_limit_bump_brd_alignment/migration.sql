-- Round-9 / A1: align Subscription.clientLimit with BRD §10.1 (25/50/100).
-- Previous values from STRIPE-SPEC.md's original rollout were 10/25/75. The
-- code constant TIER_LIMITS was bumped in the same commit; this migration
-- bumps existing denormalized rows so the row column matches the constant.
--
-- Audit trail: each bumped row produces one SubscriptionAuditLog entry with
-- action='tier_limit_bump'. Action surfaces in the round-8 unified audit
-- view as `subscription.tier_limit_bump`. Synthetic id `mig-tier-bump-<sub>`
-- is greppable AND deterministic — re-running the migration after a partial
-- replay never double-writes audit rows because the WHERE guard on the
-- UPDATE produces zero rows in the snapshot, so the INSERT inserts zero.
--
-- Idempotent: the WHERE guard on the snapshot only captures rows whose
-- current clientLimit doesn't match the new mapping. A re-run after full
-- success is a no-op.

-- 1. Snapshot the rows that will change, with their old and new limits,
--    into a transient temp table so steps 2 + 3 share a single view.
CREATE TEMP TABLE _tier_limit_audit_snapshot AS
SELECT
  s.id AS subscription_id,
  s.tier AS tier,
  s."clientLimit" AS old_limit,
  CASE s.tier
    WHEN 'ESSENTIALS'      THEN 25
    WHEN 'PROFESSIONAL'       THEN 50
    WHEN 'BUSINESS' THEN 100
  END AS new_limit
FROM "Subscription" s
WHERE s."clientLimit" != CASE s.tier
    WHEN 'ESSENTIALS'      THEN 25
    WHEN 'PROFESSIONAL'       THEN 50
    WHEN 'BUSINESS' THEN 100
  END;

-- 2. Apply the bump.
UPDATE "Subscription"
SET "clientLimit" = CASE tier
    WHEN 'ESSENTIALS'      THEN 25
    WHEN 'PROFESSIONAL'       THEN 50
    WHEN 'BUSINESS' THEN 100
  END
WHERE id IN (SELECT subscription_id FROM _tier_limit_audit_snapshot);

-- 3. One audit row per bumped subscription.
--    `previousTier == newTier` because the tier itself didn't change — only
--    the limit. The interesting before/after lives in metadata.
--    Synthetic id format `mig-tier-bump-<subscriptionId>` is unique
--    (one bump per subscription, ever) and stable across replays.
INSERT INTO "SubscriptionAuditLog" (
  id,
  "subscriptionId",
  action,
  "previousTier",
  "newTier",
  metadata,
  timestamp
)
SELECT
  'mig-tier-bump-' || subscription_id,
  subscription_id,
  'tier_limit_bump',
  tier,
  tier,
  jsonb_build_object(
    'previousLimit', old_limit,
    'newLimit', new_limit,
    'source', 'brd_alignment_migration_20260504'
  ),
  NOW()
FROM _tier_limit_audit_snapshot;

DROP TABLE _tier_limit_audit_snapshot;
