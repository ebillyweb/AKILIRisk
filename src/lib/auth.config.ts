import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";

const credentialsSchema = z.object({
  email: z.string().email(),
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

        const user = await prisma.user.findUnique({
          where: { email },
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
            actor: { userId: user.id, role: user.role, email: user.email },
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
            actor: { userId: user.id, role: user.role, email: user.email },
            action: AUDIT_ACTIONS.AUTH_SIGNIN_FAILURE,
            entityType: "User",
            entityId: user.id,
            metadata: { reason: "account_deactivated" },
          });
          return null;
        }

        console.info("Credentials authorize succeeded", {
          userId: user.id,
          emailHash: hashedEmail,
        });

        return {
          id: user.id,
          email: user.email,
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
