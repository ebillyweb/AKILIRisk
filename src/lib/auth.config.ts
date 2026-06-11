import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import { findUserByEmail } from "@/lib/auth/user-email";
import { userNeedsPasswordChange, validatePasswordComplexity } from "@/lib/auth/password-policy";
import { getPasswordPolicy } from "@/lib/platform/password-policy-settings";
import {
  getUserAuthSnapshot,
  syncPasswordChangeRequired,
  syncPasswordPolicyRevision,
} from "@/lib/auth/user-auth-snapshot";

// Round-11 bug-hunt fix: normalize email casing so `findUserByEmail`
// (deterministic ciphertext, case-sensitive) hits the same row no
// matter what case the user typed. See commit A.
const credentialsSchema = z.object({
  email: z
    .string()
    .email()
    .transform((s) => s.trim().toLowerCase()),
  password: z.string().min(1),
});

/** Short, non-reversible identifier for an email so log lines preserve
 *  outcome breakdowns by user without exposing PII. 8 hex chars of
 *  sha256(lowercase email) — collision-tolerant for log grouping, not for
 *  joining to the user table. */
function emailHash(email: string): string {
  return createHash("sha256")
    .update(email.toLowerCase())
    .digest("hex")
    .slice(0, 8);
}

/** Bcrypt-compare timing fallback. We run a real `bcrypt.compare` against
 *  this hash whenever the user lookup misses, so response time for
 *  "no such email" matches "wrong password for that email" — the previous
 *  behavior returned null instantly and let an attacker enumerate
 *  registered emails by timing alone.
 *
 *  Generated once at module load via `hashSync`. The plaintext is a
 *  long random string committed alongside the hash; it is NOT a real
 *  password and has never been used as one. Cost factor matches the
 *  10 the rest of the codebase uses (search for `hashSync`).
 *
 *  Do NOT delete this constant — it's the only thing keeping the
 *  user-enumeration timing channel closed. */
const TIMING_FALLBACK_HASH = bcrypt.hashSync(
  "timing-fallback-not-a-real-password-2qN8vL3kP9wEr5yT",
  10
);

export default {
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);

        if (!parsed.success) {
          console.warn("Credentials authorize rejected invalid payload");
          return null;
        }

        const { email, password } = parsed.data;
        const hashedEmail = emailHash(email);

        // Round-11 commit 2.3 (BRD §5.1.AUTH / phase A): dual-read.
        const user = await findUserByEmail(email, {
          select: {
            id: true,
            password: true,
            role: true,
            deletedAt: true,
            emailCiphertext: true,
            name: true,
            image: true,
          },
        });

        // Always run a real bcrypt.compare so the response time for
        // "no such email" looks identical to "wrong password for that email".
        // Without this, an attacker could enumerate registered emails by
        // measuring how fast we return null.
        const passwordHashToCompare = user?.password ?? TIMING_FALLBACK_HASH;
        const isValidPassword = await bcrypt.compare(
          password,
          passwordHashToCompare
        );

        // Round-7 timing note: every authorize-failure path writes exactly one
        // audit row before returning null. Combined with the TIMING_FALLBACK_HASH
        // bcrypt above, this keeps response-shape identical across the
        // user-not-found, invalid-password, and deactivated branches — no
        // signal an attacker can use to enumerate registered emails.
        // The success path defers its audit row to the signIn callback in
        // src/lib/auth.ts so we don't double-count successful logins.

        if (!user || !user.password) {
          console.warn("Credentials authorize failed: user not found", {
            emailHash: hashedEmail,
          });
          await writeAudit({
            actor: { userId: null, email },
            action: AUDIT_ACTIONS.AUTH_SIGNIN_FAILURE,
            entityType: "User",
            entityId: null,
            metadata: { reason: "user_not_found" },
          });
          return null;
        }

        if (!isValidPassword) {
          console.warn("Credentials authorize failed: invalid password", {
            userId: user.id,
            emailHash: hashedEmail,
          });
          await writeAudit({
            // Round-11 commit 2.4a: switch from plaintext email to
            // ciphertext — writeAudit decrypts internally to compute
            // the hash. Survives the 2.4b column drop.
            actor: { userId: user.id, role: user.role, emailCiphertext: user.emailCiphertext },
            action: AUDIT_ACTIONS.AUTH_SIGNIN_FAILURE,
            entityType: "User",
            entityId: user.id,
            metadata: { reason: "invalid_password" },
          });
          return null;
        }

        if (user.deletedAt) {
          console.warn("Credentials authorize failed: account deactivated", {
            userId: user.id,
            emailHash: hashedEmail,
          });
          await writeAudit({
            // Round-11 commit 2.4a: switch from plaintext email to
            // ciphertext — writeAudit decrypts internally to compute
            // the hash. Survives the 2.4b column drop.
            actor: { userId: user.id, role: user.role, emailCiphertext: user.emailCiphertext },
            action: AUDIT_ACTIONS.AUTH_SIGNIN_FAILURE,
            entityType: "User",
            entityId: user.id,
            metadata: { reason: "account_deactivated" },
          });
          return null;
        }

        // Round-11 commit 3 (BRD §5.1.AUTH): clients (role=USER) can only
        // sign in via magic link. Refuse credentials sign-in for clients
        // even if they happen to have a non-null password (e.g. legacy
        // pre-round-11 accounts or test fixtures). Advisor + admin
        // accounts continue to use credentials.
        if (user.role === "USER") {
          console.warn("Credentials authorize failed: client role blocked", {
            userId: user.id,
            emailHash: hashedEmail,
          });
          await writeAudit({
            // Round-11 commit 2.4a: switch from plaintext email to
            // ciphertext — writeAudit decrypts internally to compute
            // the hash. Survives the 2.4b column drop.
            actor: { userId: user.id, role: user.role, emailCiphertext: user.emailCiphertext },
            action: AUDIT_ACTIONS.AUTH_SIGNIN_FAILURE,
            entityType: "User",
            entityId: user.id,
            metadata: { reason: "client_role_blocked" },
          });
          return null;
        }

        console.info("Credentials authorize succeeded", {
          userId: user.id,
          emailHash: hashedEmail,
        });

        const policy = await getPasswordPolicy();
        const compliance = await getUserAuthSnapshot(user.id);
        const storedFlag = compliance?.passwordChangeRequired ?? false;
        const storedRevision = compliance?.passwordPolicyRevision ?? 0;

        let needsPasswordChange = userNeedsPasswordChange({
          password,
          passwordChangeRequired: storedFlag,
          passwordPolicyRevision: storedRevision,
          policy,
        });

        // Password already meets policy; only the stored revision is behind.
        // Acknowledge the revision without forcing another rotation (e.g. seeded accounts).
        if (
          needsPasswordChange &&
          !storedFlag &&
          validatePasswordComplexity(password, policy).ok &&
          storedRevision < policy.revision
        ) {
          await syncPasswordPolicyRevision(user.id, policy.revision);
          needsPasswordChange = false;
        } else if (needsPasswordChange !== storedFlag) {
          await syncPasswordChangeRequired(user.id, needsPasswordChange);
        }

        return {
          id: user.id,
          email,
          name: user.name,
          image: user.image,
          passwordChangeRequired: needsPasswordChange,
        };
      },
    }),
    /**
     * Round-11 commit 2 (BRD §5.1.AUTH): magic-link auth for client users.
     *
     * Wraps the validate + consume helpers from src/lib/auth/magic-link.ts.
     * Caller drives this provider via NextAuth's signIn("magic-link", { token })
     * after the verify page has already validated the raw token; the
     * provider re-validates + atomically consumes (so a crash between
     * validate and consume can't sign in twice).
     *
     * id="magic-link" distinguishes this from the email/password
     * Credentials provider above. Auth.js v5 routes signIn calls to the
     * provider with the matching id.
     *
     * Role gating (USER-only for magic-link, ADVISOR/ADMIN-only for
     * credentials) lands in commit 3. This commit leaves the magic-link
     * provider open to any role so the auth primitive can be exercised
     * before the lockdown lands.
     */
    Credentials({
      id: "magic-link",
      name: "Magic Link",
      credentials: { token: { label: "Token", type: "text" } },
      async authorize(credentials) {
        const tokenInput = credentials?.token;
        if (typeof tokenInput !== "string" || tokenInput.length === 0) {
          await writeAudit({
            actor: { userId: null, email: null },
            action: AUDIT_ACTIONS.AUTH_MAGIC_LINK_FAILURE,
            entityType: "User",
            entityId: null,
            metadata: { reason: "not_found" },
          });
          return null;
        }

        // Lazy-import the helper to avoid pulling server-only modules into
        // the auth.config.ts edge surface (NextAuth's adapter ships a
        // light-weight bundle here; keep heavy imports lazy).
        const { validateMagicLinkToken, consumeMagicLinkToken } = await import(
          "@/lib/auth/magic-link"
        );

        const validation = await validateMagicLinkToken(tokenInput);
        if (!validation.success) {
          await writeAudit({
            actor: { userId: null, email: null },
            action: AUDIT_ACTIONS.AUTH_MAGIC_LINK_FAILURE,
            entityType: "User",
            entityId: null,
            metadata: { reason: validation.reason },
          });
          return null;
        }

        // Atomic consume — flips used=true. Race-safe under double-click
        // because consumeMagicLinkToken uses updateMany with a where:
        // { used: false } predicate.
        const consumption = await consumeMagicLinkToken(tokenInput);
        if (!consumption.success) {
          await writeAudit({
            actor: { userId: null, email: validation.email },
            action: AUDIT_ACTIONS.AUTH_MAGIC_LINK_FAILURE,
            entityType: "User",
            entityId: null,
            metadata: { reason: consumption.reason },
          });
          return null;
        }

        // Resolve the User. For invitation-flow tokens the User may not
        // exist yet — commit 4 wires User-creation here. For now we look
        // up an existing User; if the token is invitation-only and the
        // User hasn't been created, we audit + reject (commit 4 will
        // change this branch).
        // Round-11 commit 2.3 (BRD §5.1.AUTH / phase A): dual-read.
        let user = await findUserByEmail(validation.email, {
          where: { deletedAt: null },
          // Round-11 commit 2.4b: email column is gone; ciphertext is
          // the only stored form. The JWT email field comes from
          // validation.email (form-input plaintext) — see provider
          // return below.
          select: { id: true, emailCiphertext: true, name: true, image: true, role: true },
        });

        if (!user && validation.inviteCodeId) {
          const { provisionClientFromInviteCode } = await import(
            "@/lib/invitations/provision-client"
          );
          const provisioned = await provisionClientFromInviteCode(
            validation.inviteCodeId,
            validation.email,
          );
          if (provisioned.ok) {
            user = await findUserByEmail(validation.email, {
              where: { deletedAt: null },
              select: {
                id: true,
                emailCiphertext: true,
                name: true,
                image: true,
                role: true,
              },
            });
          }
        } else if (user && validation.inviteCodeId) {
          const { provisionClientFromInviteCode } = await import(
            "@/lib/invitations/provision-client"
          );
          await provisionClientFromInviteCode(
            validation.inviteCodeId,
            validation.email,
          );
        }

        if (!user) {
          await writeAudit({
            actor: { userId: null, email: validation.email },
            action: AUDIT_ACTIONS.AUTH_MAGIC_LINK_FAILURE,
            entityType: "User",
            entityId: null,
            metadata: { reason: "user_inactive", inviteCodeId: validation.inviteCodeId },
          });
          return null;
        }

        // Round-11 commit 3 (BRD §5.1.AUTH): magic-link is for clients
        // only. Refuse advisors + admins so the role split is symmetric
        // (credentials → ADVISOR/ADMIN, magic-link → USER).
        if (user.role !== "USER") {
          await writeAudit({
            // Round-11 commit 2.4a: switch from plaintext email to
            // ciphertext — writeAudit decrypts internally to compute
            // the hash. Survives the 2.4b column drop.
            actor: { userId: user.id, role: user.role, emailCiphertext: user.emailCiphertext },
            action: AUDIT_ACTIONS.AUTH_MAGIC_LINK_FAILURE,
            entityType: "User",
            entityId: user.id,
            metadata: { reason: "non_client_role_blocked", inviteCodeId: validation.inviteCodeId },
          });
          return null;
        }

        await writeAudit({
          // Round-11 commit 2.4a: ciphertext-keyed actor (writeAudit
          // decrypts internally to compute the hash).
          actor: { userId: user.id, role: user.role, emailCiphertext: user.emailCiphertext },
          action: AUDIT_ACTIONS.AUTH_MAGIC_LINK_SUCCESS,
          entityType: "User",
          entityId: user.id,
          metadata: { inviteCodeId: validation.inviteCodeId },
        });

        // Round-11 commit 2.4a: JWT email from validation.email
        // (token-decoded plaintext) rather than User.email — same
        // rationale as the credentials provider above.
        return {
          id: user.id,
          email: validation.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  pages: {
    signIn: "/signin",
    error: "/signin",
  },
} satisfies NextAuthConfig;
