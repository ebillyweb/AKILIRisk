import { randomInt } from "node:crypto";

const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Generate a Desirae-style client reference, e.g. CL-8F3K-29QX. */
export function generateClientReferenceCode(): string {
  const segment = () =>
    Array.from(
      { length: 4 },
      () => REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)]!,
    ).join("");
  return `CL-${segment()}-${segment()}`;
}

/** Advisor-facing label for a client reference code, e.g. Client CL-8F3K-29QX. */
export function formatClientReferenceLabel(clientReferenceCode: string): string {
  const code = clientReferenceCode.trim();
  if (!code) {
    throw new Error("clientReferenceCode is required");
  }
  return `Client ${code}`;
}
