import { randomInt } from "node:crypto";

const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Default length for auto-generated client reference codes (5 characters). */
const DEFAULT_CODE_LENGTH = 5;

/** Minimum length for custom client reference codes. */
export const MIN_CUSTOM_CODE_LENGTH = 3;

/** Maximum length for custom client reference codes. */
export const MAX_CUSTOM_CODE_LENGTH = 20;

/** Pattern for valid custom codes: alphanumeric, dashes, underscores. */
const CUSTOM_CODE_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * Generate a short client reference code, e.g. Y47KX.
 * Uses 5 characters from the reference alphabet (excludes ambiguous chars).
 * ~33^5 = ~39M combinations provides sufficient uniqueness.
 */
export function generateClientReferenceCode(): string {
  return Array.from(
    { length: DEFAULT_CODE_LENGTH },
    () => REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)]!,
  ).join("");
}

/**
 * Validates a custom client reference code.
 * Returns an error message if invalid, or null if valid.
 */
export function validateCustomClientReferenceCode(code: string): string | null {
  const trimmed = code.trim();
  
  if (!trimmed) {
    return "Client ID is required";
  }
  
  if (trimmed.length < MIN_CUSTOM_CODE_LENGTH) {
    return `Client ID must be at least ${MIN_CUSTOM_CODE_LENGTH} characters`;
  }
  
  if (trimmed.length > MAX_CUSTOM_CODE_LENGTH) {
    return `Client ID must be at most ${MAX_CUSTOM_CODE_LENGTH} characters`;
  }
  
  if (!CUSTOM_CODE_PATTERN.test(trimmed)) {
    return "Client ID can only contain letters, numbers, dashes, and underscores";
  }
  
  return null;
}

/**
 * Normalize a custom client reference code for storage.
 * Uppercase for consistency with auto-generated codes.
 */
export function normalizeCustomClientReferenceCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Advisor-facing label for a client reference code, e.g. Client Y47KX. */
export function formatClientReferenceLabel(clientReferenceCode: string): string {
  const code = clientReferenceCode.trim();
  if (!code) {
    throw new Error("clientReferenceCode is required");
  }
  return `Client ${code}`;
}
