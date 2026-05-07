/**
 * Apply default SSE-KMS encryption to the branding + intake S3 buckets.
 *
 * Idempotent. Safe to re-run. Usage:
 *
 *   npx tsx scripts/apply-s3-bucket-encryption.ts
 *
 * Required env (loaded from .env.local / .env via load-repo-env):
 *
 *   • S3_KMS_KEY_ID         — CMK alias or ARN (REQUIRED — fails fast if unset)
 *   • S3_BRANDING_BUCKET    — branding/logos bucket
 *   • S3_INTAKE_BUCKET      — intake-audio bucket (falls back to branding)
 *   • S3_BRANDING_REGION / S3_INTAKE_REGION / AWS_REGION — region resolution
 *
 * What it does. For each bucket, calls PutBucketEncryption with a
 * single rule: aws:kms + the configured KMS key + BucketKeyEnabled
 * (S3 Bucket Keys reduce KMS API calls and cost by ~99% on hot
 * objects). New PutObject calls without explicit SSE params will then
 * have aws:kms applied automatically — `s3EncryptionParams()` makes
 * the application send the params explicitly anyway, which keeps the
 * fail-closed semantics on bucket-policy enforcement (see
 * docs/operations/s3-sse-kms.md §"Fail-closed").
 *
 * Existing objects keep whatever encryption they were written with.
 * Run scripts/reencrypt-s3-bucket-with-kms.ts after this to rewrite
 * legacy SSE-S3 objects in place.
 */
import "./load-repo-env";
import {
  S3Client,
  PutBucketEncryptionCommand,
  type ServerSideEncryptionRule,
} from "@aws-sdk/client-s3";
import { resolveAwsCredentials } from "../src/lib/s3/aws-credentials";

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return v;
}

async function applyEncryption(
  client: S3Client,
  bucket: string,
  kmsKeyId: string
): Promise<void> {
  const rule: ServerSideEncryptionRule = {
    ApplyServerSideEncryptionByDefault: {
      SSEAlgorithm: "aws:kms",
      KMSMasterKeyID: kmsKeyId,
    },
    BucketKeyEnabled: true,
  };
  await client.send(
    new PutBucketEncryptionCommand({
      Bucket: bucket,
      ServerSideEncryptionConfiguration: { Rules: [rule] },
    })
  );
  console.log(`✓ ${bucket}: aws:kms (${kmsKeyId}), BucketKeyEnabled=true`);
}

async function main(): Promise<void> {
  const kmsKeyId = requireEnv("S3_KMS_KEY_ID");
  const brandingBucket = requireEnv("S3_BRANDING_BUCKET");
  const intakeBucket =
    process.env.S3_INTAKE_BUCKET?.trim() || brandingBucket;

  const brandingRegion =
    process.env.S3_BRANDING_REGION?.trim() ||
    process.env.AWS_REGION?.trim() ||
    "us-east-2";
  const intakeRegion =
    process.env.S3_INTAKE_REGION?.trim() || brandingRegion;

  const brandingClient = new S3Client({
    region: brandingRegion,
    followRegionRedirects: true,
    credentials: resolveAwsCredentials(),
  });
  await applyEncryption(brandingClient, brandingBucket, kmsKeyId);

  if (intakeBucket !== brandingBucket) {
    const intakeClient = new S3Client({
      region: intakeRegion,
      followRegionRedirects: true,
      credentials: resolveAwsCredentials(),
    });
    await applyEncryption(intakeClient, intakeBucket, kmsKeyId);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
