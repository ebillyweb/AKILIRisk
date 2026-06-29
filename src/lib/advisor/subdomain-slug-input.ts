/** DNS host-label rules for advisor / enterprise portal subdomains. */

export const SUBDOMAIN_SLUG_MIN_LENGTH = 3;
export const SUBDOMAIN_SLUG_MAX_LENGTH = 20;

/** Lowercase alphanumeric with internal hyphens only (not at start/end). */
export const SUBDOMAIN_SLUG_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/** HTML `pattern` for progressive enhancement; sanitization is the primary guard. */
export const SUBDOMAIN_SLUG_INPUT_PATTERN = "[a-z0-9-]*";

export const SUBDOMAIN_SLUG_VALIDATION_MESSAGE =
  "Use 3–20 lowercase letters, numbers, and hyphens (not at the start or end).";

/**
 * Restrict live typing/paste to valid subdomain label characters.
 * Strips spaces, uppercase, and symbols; collapses repeated hyphens.
 */
export function sanitizeSubdomainSlugInput(
  raw: string,
  maxLength: number = SUBDOMAIN_SLUG_MAX_LENGTH,
): string {
  const stripped = raw.toLowerCase().replace(/[^a-z0-9-]/g, "");
  const collapsed = stripped.replace(/-+/g, "-");
  const trimmed = collapsed.replace(/^-+|-+$/g, "");
  return trimmed.slice(0, maxLength);
}
