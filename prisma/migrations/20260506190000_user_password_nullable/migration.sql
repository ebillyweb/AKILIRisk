-- Round-11 commit 3 (BRD §5.1.AUTH): make User.password nullable so
-- client (role=USER) accounts can exist without a password hash.
--
-- Pre-this-migration the column is NOT NULL. Clients were required to
-- set a password at signup; round-11's magic-link flow eliminates that
-- requirement. Advisor + admin accounts still write a real bcrypt hash;
-- the column is just permissive enough for clients to store NULL.
--
-- Defensive: the existing credentials provider already handles null via
-- `user?.password ?? TIMING_FALLBACK_HASH` (the constant-time guard so
-- response shape stays identical between "no such email" and "user with
-- null password"). The lockdown in this same commit also refuses role=
-- USER callers at the credentials provider, so a null-password USER row
-- can't sign in via credentials regardless.

ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL;
