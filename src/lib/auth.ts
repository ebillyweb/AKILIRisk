import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import authConfig from "@/lib/auth.config";
import { normalizeUserRoleString } from "@/lib/auth-roles";
import { verifyAdminEmailOnFirstSignIn } from "@/lib/auth/verify-admin-on-sign-in";
import { recordUserLogin } from "@/lib/auth/record-login";
import { getUserAuthSnapshot } from "@/lib/auth/user-auth-snapshot";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";

/** Short, non-reversible identifier for an email so log lines stay
 *  observable without exposing PII. Mirrors `emailHash` in
 *  `@/lib/auth.config`. */
function emailHash(email: string | null | undefined): string | undefined {
  if (!email) return undefined;
  return createHash("sha256")
    .update(email.toLowerCase())
    .digest("hex")
    .slice(0, 8);
}

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Edge-safe random session token (Web Crypto, no Node `crypto` dependency). */
function generateSessionToken(): string {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ user }) {
      if (user.id) {
        const active = await prisma.user.findUnique({
          where: { id: user.id },
          select: { deletedAt: true, role: true },
        });
        if (active?.deletedAt) {
          // Defense-in-depth: authorize already checks deletedAt, but if a
          // future provider (OAuth) bypasses that check, this still rejects
          // and audits the rejection.
          await writeAudit({
            actor: { userId: user.id, role: active.role, email: user.email },
            action: AUDIT_ACTIONS.AUTH_SIGNIN_FAILURE,
            entityType: "User",
            entityId: user.id,
            metadata: { reason: "account_deactivated_at_session_create" },
          });
          return false;
        }
      }

      // Audit + login bookkeeping on sign-in. The DB session row that tracks
      // MFA verification is created in the `jwt` callback below, where we can
      // bind its sessionToken to the JWT (see jwt() for the rationale).
      if (user.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { mfaEnabled: true, role: true },
        });

        console.info("Auth signIn callback", {
          userId: user.id,
          emailHash: emailHash(user.email),
          mfaEnabled: Boolean(dbUser?.mfaEnabled),
        });

        // Audit row for the success path. Counterpart to the AUTH_SIGNIN_FAILURE
        // rows written by the credentials authorize callback in auth.config.ts.
        // Note: the raw sessionToken is NEVER logged (the redactor would strip
        // it via the /token/i key match anyway).
        await writeAudit({
          actor: { userId: user.id, role: dbUser?.role, email: user.email },
          action: AUDIT_ACTIONS.AUTH_SIGNIN_SUCCESS,
          entityType: "User",
          entityId: user.id,
          metadata: { mfaEnabled: Boolean(dbUser?.mfaEnabled) },
        });

        if (!dbUser?.mfaEnabled) {
          await recordUserLogin(user.id);
        }

        await verifyAdminEmailOnFirstSignIn(user.id);
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      if (user?.email) {
        token.email = user.email;
      }
      // Store MFA fields in JWT so middleware (Edge) can read them without Prisma
      const userId = token.id as string;
      if (userId) {
        const dbUser = await getUserAuthSnapshot(userId);
        token.mfaEnabled = dbUser?.mfaEnabled ?? false;
        token.role = dbUser?.role ?? "USER";
        token.firstName = dbUser?.firstName ?? undefined;
        token.accountDeactivated = Boolean(dbUser?.deletedAt);
        token.mfaEnrollmentRequired = false;
        token.passwordChangeRequired = Boolean(dbUser?.passwordChangeRequired);

        // Bind the JWT to a DB session row that tracks MFA verification for
        // THIS login. Binding is the fix for the spurious-TOTP bug: previously
        // `mfaVerified` was read from the single newest-expiring session row
        // regardless of which login it belonged to, so a stale or unrelated
        // row could re-trigger the challenge. Now the read (here) and the write
        // (markSessionMfaVerified) operate on the same bound row.
        //
        // We create the row when none is bound yet: on first sign-in (`user`
        // present) and also for legacy JWTs minted before this binding existed
        // (no `user`, no `sessionToken`). MFA-enabled users always start
        // UNVERIFIED — never seed verification from another (newest-expiring)
        // session row, or a second login could inherit a first login's
        // verification without completing TOTP. Worst case is one re-challenge
        // after the binding upgrade, which is the safe trade.
        if (userId && !token.sessionToken) {
          const seedVerified = !token.mfaEnabled;
          const sessionToken = generateSessionToken();
          await prisma.session.create({
            data: {
              sessionToken,
              userId,
              expires: new Date(Date.now() + SESSION_MAX_AGE_MS),
              mfaVerified: seedVerified,
            },
          });
          token.sessionToken = sessionToken;
        }

        if (token.mfaEnabled) {
          const boundToken =
            typeof token.sessionToken === "string" ? token.sessionToken : null;
          let verified = false;
          if (boundToken) {
            const session = await prisma.session.findUnique({
              where: { sessionToken: boundToken },
              select: { mfaVerified: true, expires: true },
            });
            verified =
              Boolean(session?.mfaVerified) &&
              session!.expires.getTime() > Date.now();
          }
          token.mfaVerified = verified;
        } else {
          // MFA disabled: never challenge, and clear any stale binding so a
          // re-enable starts a fresh, unverified session row.
          token.mfaVerified = true;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        if (typeof token.email === "string" && token.email.length > 0) {
          session.user.email = token.email;
        }
        session.user.mfaEnabled = Boolean(token.mfaEnabled);
        session.user.mfaVerified = Boolean(token.mfaVerified);
        session.user.mfaEnrollmentRequired = Boolean(
          (token as { mfaEnrollmentRequired?: boolean }).mfaEnrollmentRequired
        );
        session.user.passwordChangeRequired = Boolean(
          (token as { passwordChangeRequired?: boolean }).passwordChangeRequired
        );
        session.user.firstName = (token.firstName as string) ?? undefined;
        session.user.accountDeactivated = Boolean(
          (token as { accountDeactivated?: boolean }).accountDeactivated
        );
        session.user.role = normalizeUserRoleString(
          token.role as string | undefined
        );
      }
      return session;
    },
  },
  events: {
    // JWT-strategy sign-out does not call the adapter's deleteSession, so the
    // per-login DB row (created in jwt()) would otherwise linger for 30 days.
    // Delete the bound row here to keep the Session table clean and prevent
    // stale mfaVerified state from ever being read again.
    async signOut(message) {
      const token = (message as { token?: { sessionToken?: unknown } }).token;
      const sessionToken =
        typeof token?.sessionToken === "string" ? token.sessionToken : null;
      if (sessionToken) {
        await prisma.session
          .deleteMany({ where: { sessionToken } })
          .catch(() => {});
      }
    },
  },
  ...authConfig,
});
