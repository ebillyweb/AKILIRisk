import crypto from "crypto";

import { prisma } from "@/lib/db";

const ADVISOR_EMAIL_VERIFY_PREFIX = "advisor-email-verify:";

/** Email verification links stay valid longer than password-reset tokens. */
export const ADVISOR_EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

export type IssuedAdvisorEmailVerificationToken = {
  rawToken: string;
  expires: Date;
  email: string;
};

export function advisorEmailVerifyIdentifier(email: string): string {
  return `${ADVISOR_EMAIL_VERIFY_PREFIX}${email.trim().toLowerCase()}`;
}

export function emailFromAdvisorVerifyIdentifier(identifier: string): string | null {
  if (!identifier.startsWith(ADVISOR_EMAIL_VERIFY_PREFIX)) return null;
  const email = identifier.slice(ADVISOR_EMAIL_VERIFY_PREFIX.length).trim();
  return email.length > 0 ? email : null;
}

function hashAdvisorEmailVerifyToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export async function issueAdvisorEmailVerificationToken(
  email: string
): Promise<IssuedAdvisorEmailVerificationToken> {
  const normalizedEmail = email.trim().toLowerCase();
  const identifier = advisorEmailVerifyIdentifier(normalizedEmail);

  await prisma.verificationToken.deleteMany({
    where: {
      identifier,
      expires: { gt: new Date() },
    },
  });

  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = hashAdvisorEmailVerifyToken(rawToken);
  const expires = new Date(Date.now() + ADVISOR_EMAIL_VERIFY_TTL_MS);

  await prisma.verificationToken.create({
    data: {
      identifier,
      token: hashedToken,
      expires,
    },
  });

  return { rawToken, expires, email: normalizedEmail };
}

export type AdvisorEmailVerificationValidation =
  | { success: true; email: string }
  | { success: false; reason: "not_found" | "expired" | "used" };

export async function validateAdvisorEmailVerificationToken(
  rawToken: string
): Promise<AdvisorEmailVerificationValidation> {
  if (!rawToken.trim()) {
    return { success: false, reason: "not_found" };
  }

  const hashedToken = hashAdvisorEmailVerifyToken(rawToken);
  const row = await prisma.verificationToken.findFirst({
    where: {
      token: hashedToken,
      identifier: { startsWith: ADVISOR_EMAIL_VERIFY_PREFIX },
    },
  });

  if (!row) {
    return { success: false, reason: "not_found" };
  }

  if (row.used) {
    return { success: false, reason: "used" };
  }

  if (row.expires < new Date()) {
    return { success: false, reason: "expired" };
  }

  const email = emailFromAdvisorVerifyIdentifier(row.identifier);
  if (!email) {
    return { success: false, reason: "not_found" };
  }

  return { success: true, email };
}

export async function consumeAdvisorEmailVerificationToken(
  rawToken: string
): Promise<AdvisorEmailVerificationValidation> {
  const validation = await validateAdvisorEmailVerificationToken(rawToken);
  if (!validation.success) {
    return validation;
  }

  const hashedToken = hashAdvisorEmailVerifyToken(rawToken);
  const deleted = await prisma.verificationToken.deleteMany({
    where: {
      token: hashedToken,
      identifier: advisorEmailVerifyIdentifier(validation.email),
      used: false,
      expires: { gt: new Date() },
    },
  });

  if (deleted.count === 0) {
    return { success: false, reason: "used" };
  }

  return validation;
}

export function buildAdvisorEmailVerifyUrl(
  baseUrl: string,
  rawToken: string,
  opts?: { checkoutPlan?: string; checkoutCycle?: string }
): string {
  const origin = baseUrl.replace(/\/$/, "");
  const url = new URL(`${origin}/auth/advisor/verify-email`);
  url.searchParams.set("token", rawToken);
  if (opts?.checkoutPlan) {
    url.searchParams.set("checkout_plan", opts.checkoutPlan);
  }
  if (opts?.checkoutCycle) {
    url.searchParams.set("checkout_cycle", opts.checkoutCycle);
  }
  return url.toString();
}
