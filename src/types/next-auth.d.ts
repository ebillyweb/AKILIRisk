import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      mfaEnabled?: boolean;
      mfaVerified?: boolean;
      mfaEnrollmentRequired?: boolean;
      passwordChangeRequired?: boolean;
      role?: "USER" | "ADVISOR" | "ADMIN" | "SUPER_ADMIN" | string;
      firstName?: string | null;
      accountDeactivated?: boolean;
    };
  }

  interface User {
    mfaEnabled?: boolean;
    mfaVerified?: boolean;
    mfaEnrollmentRequired?: boolean;
    passwordChangeRequired?: boolean;
    role?: "USER" | "ADVISOR" | "ADMIN" | "SUPER_ADMIN" | string;
    firstName?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email?: string;
    /** DB Session.sessionToken bound to this login; tracks MFA verification. */
    sessionToken?: string;
    mfaEnabled?: boolean;
    mfaVerified?: boolean;
    mfaEnrollmentRequired?: boolean;
    passwordChangeRequired?: boolean;
    role?: "USER" | "ADVISOR" | "ADMIN" | "SUPER_ADMIN" | string;
    firstName?: string | null;
    accountDeactivated?: boolean;
  }
}
