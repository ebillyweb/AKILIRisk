import { CredentialsSignin } from "next-auth";

/** Returned to the client via `signIn(..., { redirect: false })` → `result.code`. */
export const ADVISOR_EMAIL_NOT_VERIFIED_CODE = "email_not_verified";

export class AdvisorEmailNotVerified extends CredentialsSignin {
  code = ADVISOR_EMAIL_NOT_VERIFIED_CODE;
}
