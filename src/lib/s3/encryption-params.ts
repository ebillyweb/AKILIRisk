/**
 * S3 server-side encryption (SSE-KMS) parameter helper.
 *
 * Background. Every PutObjectCommand call site in this codebase uploads
 * client PII or advisor branding bytes to S3. Without an explicit
 * `ServerSideEncryption` parameter, S3 falls back to SSE-S3 (AES-256
 * with an AWS-managed key). Round-11 §5.1 (PII scope) calls for
 * SSE-KMS using a customer-managed CMK so we get:
 *
 *   • visibility into key usage via CloudTrail KMS data events,
 *   • independent control of the key's lifecycle (rotation, disable,
 *     deletion) separate from the bucket itself,
 *   • a fail-closed posture: if the key is disabled or its policy is
 *     misconfigured, decrypt fails — no silent fallback to plaintext.
 *
 * Opt-in semantics. The KMS key is configured via `S3_KMS_KEY_ID`
 * (alias or ARN). When unset — typical for local dev and CI — this
 * helper returns an empty object and the SDK omits both
 * `ServerSideEncryption` and `SSEKMSKeyId`. S3 then applies whatever
 * default the bucket has configured (SSE-S3 unless the bucket policy
 * specifies otherwise). This keeps `vitest run` and local Docker
 * Postgres flows working without a real KMS key.
 *
 * Production. Set `S3_KMS_KEY_ID` to a per-environment CMK alias
 * (recommended: `alias/akili-prod-s3`, `alias/akili-staging-s3`).
 * Pair with a bucket policy enforcing `aws:kms` on PutObject — see
 * `scripts/apply-s3-bucket-encryption.ts` and
 * `docs/operations/s3-sse-kms.md`.
 */
export function s3EncryptionParams(): {
  ServerSideEncryption?: "aws:kms";
  SSEKMSKeyId?: string;
} {
  const keyId = process.env.S3_KMS_KEY_ID?.trim();
  if (!keyId) return {};
  return { ServerSideEncryption: "aws:kms", SSEKMSKeyId: keyId };
}
