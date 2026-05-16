/**
 * Edge-safe auth for middleware. No Prisma or Node-only modules.
 * Use this in middleware.ts; use @/lib/auth everywhere else.
 */
import NextAuth from "next-auth";
import { normalizeUserRoleString } from "@/lib/auth-roles";

export const { auth } = NextAuth({
  providers: [], // Not used in middleware; only JWT decode runs
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days, must match auth.ts
  },
  pages: {
    signIn: "/signin",
    error: "/signin",
  },
  callbacks: {
    jwt: ({ token }) => token,
    session: ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.mfaEnabled = Boolean(token.mfaEnabled);
        session.user.mfaVerified = Boolean(token.mfaVerified);
        session.user.role = normalizeUserRoleString(
          token.role as string | undefined
        );
      }
      return session;
    },
  },
});
