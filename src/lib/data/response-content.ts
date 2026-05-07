/**
 * Round-11 commit 2.5 (BRD §5.1) — encryption helpers for two free-form
 * response columns:
 *
 *   • IntakeResponse.transcription (String?) — Whisper output and
 *     free-text answers.
 *   • AssessmentResponse.answer (Json) — survey answer payloads
 *     (numbers, enums, arrays, nested objects).
 *
 * Both use random-IV AES-256-GCM via the existing `encrypt`/`decrypt`
 * helpers in `@/lib/encryption`. Random-IV is correct here:
 *
 *   • Neither column is queried by content in production (the one
 *     filter that referenced transcription — pipeline's
 *     "is non-empty" check — is replaced by the denormalized
 *     `hasTranscription` boolean added in commit 2.5a's migration).
 *   • Random-IV ciphertext leaks nothing about content equality
 *     ("client A and client B answered Q12 the same way" → not
 *     visible to anyone with read-only DB access).
 *
 * No `server-only` import here so this module is reachable from CLI
 * scripts (the response-content backfill pulls in encryptTranscription
 * and encryptAnswer directly).
 */
import { decrypt, encrypt } from "@/lib/encryption";

/** Encrypt an IntakeResponse.transcription plaintext. Empty string is
 *  encrypted as-is (the caller is responsible for storing NULL when
 *  the user has cleared the field — see saveIntakeResponse). */
export function encryptTranscription(plaintext: string): string {
  return encrypt(plaintext);
}

/** Decrypt an IntakeResponse.transcription ciphertext back to its
 *  original UTF-8 plaintext. Throws on tampered ciphertext (AES-GCM
 *  authentication failure) or malformed input — the caller should
 *  treat that as an integrity error, not a missing value. */
export function decryptTranscription(ciphertext: string): string {
  return decrypt(ciphertext);
}

/** Encrypt an AssessmentResponse.answer payload. Serializes via
 *  JSON.stringify first so any JSON-compatible value (number, string,
 *  boolean, array, object, null) round-trips. `undefined` is rejected
 *  upstream (Prisma `Json` doesn't accept it either). */
export function encryptAnswer(answer: unknown): string {
  return encrypt(JSON.stringify(answer));
}

/** Decrypt an AssessmentResponse.answer ciphertext and JSON.parse the
 *  payload. Generic `T` is documentation-only — the caller asserts
 *  the shape. Throws on tampered ciphertext OR malformed JSON. */
export function decryptAnswer<T = unknown>(ciphertext: string): T {
  return JSON.parse(decrypt(ciphertext)) as T;
}
