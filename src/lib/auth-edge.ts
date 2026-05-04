/**
 * Edge-safe auth for middleware. No Prisma or Node-only modules.
 * Use this in middleware.ts; use @/lib/auth everywhere else.
 */
import NextAuth from "next-auth";
import { applyAdminDemotion } from "@/lib/auth-shared";

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
        // ADMIN is only valid for the designated admin account. Same guard
        // runs in auth.ts via the shared helper — without this, middleware
        // would see ADMIN for any user with role=ADMIN in the DB while
        // page handlers (auth.ts) would demote to USER.
        session.user.role = applyAdminDemotion(
          token.role as string | undefined,
          session.user.email
        );
      }
      return session;
    },
  },
});
