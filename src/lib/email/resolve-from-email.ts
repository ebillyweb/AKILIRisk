import "server-only";

/**
 * Resend sender address. When outbound mail is configured (RESEND_API_KEY),
 * FROM_EMAIL must be set — no silent fallback to Resend's sandbox domain.
 */
export function resolveFromEmail(): string {
  const from = process.env.FROM_EMAIL?.trim();
  if (from) return from;

  if (process.env.RESEND_API_KEY?.trim()) {
    throw new Error("FROM_EMAIL is required when RESEND_API_KEY is set.");
  }

  return "onboarding@resend.dev";
}
