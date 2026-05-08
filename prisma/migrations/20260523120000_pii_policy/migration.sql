-- Option D session 1 commit 1 (BRD §5.1 amendment) — additive schema for
-- advisor-configured PII policy + per-assignment field visibility.
--
-- Five eligible PII fields are gated by AdvisorProfile.piiPolicy. Default
-- policy is opt-out (all 5 enabled) per round-12 Option D sign-off; the
-- advisor edits at /advisor/settings/pii-policy in commit 1.3.
--
-- This migration is purely additive:
--   • No DROPs.
--   • No enum changes.
--   • No FK changes.
--   • Five new columns; one JSONB default; one backfill UPDATE.
--
-- Encryption integration is intentionally NOT in this commit. Three of
-- the five new TEXT columns (HouseholdMember.fullName/phone/notes,
-- ClientProfile.phone) are net-new and start empty, so there's no
-- data-at-rest concern at migration time. The fifth (User.name) already
-- exists plaintext at HEAD; commit 1.2 introduces helpers that
-- transparently coexist plaintext + ciphertext during the rollout
-- window (writes-over-time strategy; isCiphertext sniff at read).
--
-- Rollback: dropping any of these columns is an additive operation in
-- reverse, but the fieldVisibility backfill is not reversible (we
-- can't tell a backfilled snapshot from a freshly-written one). If you
-- need to roll back, accept that the column data is best preserved.

-- 1. AdvisorProfile.piiPolicy — JSONB with default = all 5 enabled.
ALTER TABLE "AdvisorProfile"
ADD COLUMN "piiPolicy" JSONB NOT NULL DEFAULT
  '{"schemaVersion":1,"fields":{"User.name":true,"ClientProfile.phone":true,"HouseholdMember.fullName":true,"HouseholdMember.phone":true,"HouseholdMember.notes":true}}'::jsonb;

-- 2. ClientProfile.phone — re-add the column dropped in round-11.
ALTER TABLE "ClientProfile"
ADD COLUMN "phone" TEXT;

-- 3. HouseholdMember — re-add the three columns dropped in round-11
--    commit 2.2 (schema.prisma + migration 20260507120000).
ALTER TABLE "HouseholdMember"
ADD COLUMN "fullName" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "notes" TEXT;

-- 4. ClientAdvisorAssignment.fieldVisibility — per-assignment snapshot.
ALTER TABLE "ClientAdvisorAssignment"
ADD COLUMN "fieldVisibility" JSONB;

-- 5. Backfill: every existing assignment gets a snapshot of its
--    advisor's piiPolicy. After this UPDATE, null fieldVisibility only
--    happens for races (a new assignment created mid-migration); the
--    application layer handles that case defensively (treat null as
--    advisor's current policy + snapshot lazily on next read).
UPDATE "ClientAdvisorAssignment"
SET "fieldVisibility" = (
  SELECT "piiPolicy"
  FROM "AdvisorProfile"
  WHERE "AdvisorProfile"."id" = "ClientAdvisorAssignment"."advisorId"
)
WHERE "fieldVisibility" IS NULL;
