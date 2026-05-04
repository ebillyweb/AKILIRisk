import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import authConfig from "@/lib/auth.config";
import { applyAdminDemotion } from "@/lib/auth-shared";

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
          select: { deletedAt: true },
        });
        if (active?.deletedAt) {
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
          select: { mfaEnabled: true },
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
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      // Store MFA fields in JWT so middleware (Edge) can read them without Prisma
      const userId = token.id as string;
      if (userId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { mfaEnabled: true, role: true, firstName: true, deletedAt: true },
        });
        token.mfaEnabled = dbUser?.mfaEnabled ?? false;
        token.role = (dbUser?.role ?? "USER").toString().toUpperCase();
        token.firstName = dbUser?.firstName ?? undefined;
        token.accountDeactivated = Boolean(dbUser?.deletedAt);
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
        session.user.mfaEnabled = Boolean(token.mfaEnabled);
        session.user.mfaVerified = Boolean(token.mfaVerified);
        session.user.firstName = (token.firstName as string) ?? undefined;
        session.user.accountDeactivated = Boolean(
          (token as { accountDeactivated?: boolean }).accountDeactivated
        );
        // ADMIN is only valid for the designated admin account.
        // Same guard runs in auth-edge.ts via the shared helper.
        session.user.role = applyAdminDemotion(
          token.role as string | undefined,
          session.user.email
        );
      }
      return session;
    },
  },
  ...authConfig,
});
