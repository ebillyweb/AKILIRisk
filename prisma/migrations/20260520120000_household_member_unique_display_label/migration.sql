-- Round-11 cleanup pass (NIT 2): unique constraint on
-- (userId, displayLabel) for HouseholdMember. Closes a race where
-- two concurrent createHouseholdMemberRecord calls for the same
-- household both compute the same "Member C" label and both succeed.
--
-- Idempotent via IF NOT EXISTS — Neon / pooler can leave the index
-- applied while Prisma marks the migration failed; re-deploy must
-- not error on duplicate-object.
--
-- The application layer (createHouseholdMemberRecord in
-- src/lib/data/household-members.ts) catches Prisma's P2002 unique-
-- violation and retries with the next unused letter, so a real
-- concurrent create resolves cleanly to two distinct labels (A + B
-- if both were the first creates; C + D if A + B were taken).

CREATE UNIQUE INDEX IF NOT EXISTS "HouseholdMember_userId_displayLabel_key"
  ON "HouseholdMember"("userId", "displayLabel");
