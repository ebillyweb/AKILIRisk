-- Round-11 session 2 / commit 2.1 (BRD §5.1 amendment): drop the
-- contact + address + DOB fields from ClientProfile.
--
-- Per the round-11 §5.1 amendment, the only client identity field the
-- platform stores is User.email. ClientProfile is reduced to a near-stub
-- (id + userId + timestamps) — kept for now as the FK target for future
-- per-client metadata, removable entirely in a follow-up.
--
-- Subtractive migration: 8 columns dropped. Existing data in those
-- columns is permanently lost (acceptable per round-11 sign-off
-- question 1: "just drop"). Code paths reading these columns are
-- updated in the same commit; the reads no longer compile against the
-- regenerated client.

ALTER TABLE "ClientProfile"
  DROP COLUMN "phone",
  DROP COLUMN "addressLine1",
  DROP COLUMN "addressLine2",
  DROP COLUMN "city",
  DROP COLUMN "state",
  DROP COLUMN "postalCode",
  DROP COLUMN "country",
  DROP COLUMN "dateOfBirth";
