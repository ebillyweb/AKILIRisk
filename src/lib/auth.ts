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

      // Create a database session on sign-in for MFA tracking
      if (user.id) {
        // Use Web Crypto API for Edge Runtime compatibility
        const randomBytes = new Uint8Array(32);
        crypto.getRandomValues(randomBytes);
        const sessionToken = Array.from(randomBytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        // Check if user has MFA enabled
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { mfaEnabled: true, role: true },
        });

        // Create session with mfaVerified=false if MFA is enabled, true otherwise
        await prisma.session.create({
          data: {
            sessionToken,
            userId: user.id,
            expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            mfaVerified: !dbUser?.mfaEnabled, // Auto-verify if MFA not enabled
          },
        });

        console.info("Auth signIn callback created session", {
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
        if (token.mfaEnabled) {
          const [session] = await prisma.session.findMany({
            where: {
              userId,
              expires: { gt: new Date() },
            },
            orderBy: { expires: "desc" },
            take: 1,
            select: { mfaVerified: true },
          });
          token.mfaVerified = session?.mfaVerified ?? false;
        } else {
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
  ...authConfig,
});
