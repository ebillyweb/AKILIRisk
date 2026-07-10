import "server-only";

import {
  ADVISOR_EMAIL_VERIFY_TTL_MS,
  buildAdvisorEmailVerifyUrl,
  issueAdvisorEmailVerificationToken,
} from "@/lib/auth/advisor-email-verification";
import {
  sendAdvisorSignupVerificationEmail,
  type AdvisorSignupVerificationContext,
} from "@/lib/email/advisor-signup-verification";
import { resolvePublicAppUrl } from "@/lib/public-app-url";

export type SendAdvisorEmailVerificationInviteResult = {
  sent: boolean;
  verifyUrl: string;
  verifyUrlForDev?: string;
};

export async function sendAdvisorEmailVerificationInvite(opts: {
  email: string;
  displayName: string;
  checkoutPlan?: string;
  checkoutCycle?: string;
  context?: AdvisorSignupVerificationContext;
}): Promise<SendAdvisorEmailVerificationInviteResult> {
  const issued = await issueAdvisorEmailVerificationToken(opts.email);
  const base = (await resolvePublicAppUrl()).replace(/\/$/, "");
  const verifyUrl = buildAdvisorEmailVerifyUrl(base, issued.rawToken, {
    checkoutPlan: opts.checkoutPlan,
    checkoutCycle: opts.checkoutCycle,
  });

  const emailResult = await sendAdvisorSignupVerificationEmail({
    to: opts.email,
    displayName: opts.displayName,
    verifyUrl,
    expiresHours: Math.round(ADVISOR_EMAIL_VERIFY_TTL_MS / (60 * 60 * 1000)),
    context: opts.context,
  });

  return {
    sent: emailResult.sent,
    verifyUrl,
    verifyUrlForDev:
      process.env.NODE_ENV !== "production" && !emailResult.sent
        ? verifyUrl
        : undefined,
  };
}
