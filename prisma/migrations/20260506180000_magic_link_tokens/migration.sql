-- Round-11 commit 2 (BRD §5.1.AUTH): magic-link auth for client users.
--
-- New MagicLinkToken table holds single-use, time-limited authentication
-- tokens. Sibling to NextAuth's VerificationToken (which currently holds
-- password-reset tokens for advisor accounts). Kept separate so:
--   1. NextAuth's adapter never reads our magic-link rows during its own
--      flows.
--   2. Schema migrations of NextAuth's table don't pull our column shape
--      along with them.
--   3. Distinct purpose is greppable in code (no `purpose` enum on
--      VerificationToken needed).
--
-- Token storage mirrors the existing forgot-password pattern: raw token
-- hashed via SHA-256 before persistence, lookup by hash, single-use via
-- `used` flag, 15-minute default expiry enforced at issuance.

CREATE TABLE "MagicLinkToken" (
  "id"           TEXT      NOT NULL,
  "tokenHash"    TEXT      NOT NULL,
  "email"        TEXT      NOT NULL,
  "inviteCodeId" TEXT,
  "expires"      TIMESTAMP(3) NOT NULL,
  "used"         BOOLEAN   NOT NULL DEFAULT false,
  "consumedAt"   TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MagicLinkToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MagicLinkToken_tokenHash_key" ON "MagicLinkToken"("tokenHash");
CREATE INDEX "MagicLinkToken_email_idx" ON "MagicLinkToken"("email");
CREATE INDEX "MagicLinkToken_expires_idx" ON "MagicLinkToken"("expires");

ALTER TABLE "MagicLinkToken"
  ADD CONSTRAINT "MagicLinkToken_inviteCodeId_fkey"
  FOREIGN KEY ("inviteCodeId") REFERENCES "InviteCode"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
