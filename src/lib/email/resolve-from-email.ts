import "server-only";

/**
 * Resend sender address. When outbound mail is configured (RESEND_API_KEY),
 * FROM_EMAIL must be set — no silent fallback to Resend's sandbox domain.
 *
 * Resend deliverability guidance rejects no-reply / noreply local parts
 * ("Don't use no-reply"). Those are rewritten to the configured local part
 * (default: "notifications") on the same domain.
 */
export function resolveFromEmail(): string {
  const from = process.env.FROM_EMAIL?.trim();
  if (from) return sanitizeFromEmailAvoidingNoReply(from);

  if (process.env.RESEND_API_KEY?.trim()) {
    throw new Error("FROM_EMAIL is required when RESEND_API_KEY is set.");
  }

  return "onboarding@resend.dev";
}

/**
 * Resolve a branded sender address with firm/advisor display name.
 * Returns a formatted email like "Belvedere Risk <notifications@akilirisk.com>".
 */
export function resolveFromEmailWithName(displayName: string): string {
  const baseEmail = resolveFromEmail();
  const sanitizedName = displayName.replace(/[<>"]/g, '').trim();
  
  if (!sanitizedName) {
    return baseEmail;
  }

  const withDisplay = baseEmail.match(
    /^(.*?)<\s*([^@\s<>]+@[^>\s]+)\s*>\s*$/
  );
  if (withDisplay) {
    const [, , email] = withDisplay;
    return `${sanitizedName} <${email}>`;
  }

  return `${sanitizedName} <${baseEmail}>`;
}

/**
 * Replace no-reply / noreply local parts with a friendlier default.
 * Supports plain addresses and `Display Name <local@domain>` forms.
 */
export function sanitizeFromEmailAvoidingNoReply(from: string): string {
  const trimmed = from.trim();
  const replacementLocal = "notifications";
  
  const withDisplay = trimmed.match(
    /^(.*?)<\s*([^@\s<>]+)@([^>\s]+)\s*>\s*$/
  );
  if (withDisplay) {
    const [, displayRaw, local, domain] = withDisplay;
    if (!/no-?reply/i.test(local)) return trimmed;
    const display = displayRaw.trim();
    return display
      ? `${display} <${replacementLocal}@${domain}>`
      : `${replacementLocal}@${domain}`;
  }

  const plain = trimmed.match(/^([^@\s]+)@([^@\s]+)$/);
  if (plain && /no-?reply/i.test(plain[1])) {
    return `${replacementLocal}@${plain[2]}`;
  }

  return trimmed;
}
