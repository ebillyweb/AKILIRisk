/**
 * Re-encrypt every object in an S3 bucket with SSE-KMS.
 *
 * One-shot sweep used after enabling default SSE-KMS on the bucket
 * (scripts/apply-s3-bucket-encryption.ts). Existing objects keep
 * whatever encryption they were written with (typically SSE-S3) until
 * they're rewritten — this script does the rewrite by issuing a
 * server-side CopyObject to each object's own key with
 * ServerSideEncryption: "aws:kms".
 *
 *   npx tsx scripts/reencrypt-s3-bucket-with-kms.ts <bucket-name>
 *
 * Required env:
 *
 *   • S3_KMS_KEY_ID  — CMK alias or ARN (REQUIRED — fails fast if unset)
 *   • S3_BRANDING_REGION / S3_INTAKE_REGION / AWS_REGION — region
 *
 * Notes.
 *
 *   • Idempotent at the object level (CopyObject with SSE-KMS on an
 *     already-KMS object is a no-op effect even though it rewrites).
 *   • MetadataDirective: "COPY" preserves user-defined metadata
 *     (advisor-id, interview-id, etc.).
 *   • The script does NOT preserve object ACLs/storage class — both
 *     buckets are private + STANDARD, so this is intentional.
 *   • Pages via ContinuationToken; logs progress every 100 objects.
 *   • For very large buckets (>1M objects) consider running in chunks
 *     by prefix instead.
 */
import "./load-repo-env";
import {
  S3Client,
  ListObjectsV2Command,
  CopyObjectCommand,
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

async function main(): Promise<void> {
  const bucket = process.argv[2]?.trim();
  if (!bucket) {
    console.error("Usage: tsx scripts/reencrypt-s3-bucket-with-kms.ts <bucket>");
    process.exit(1);
  }

  const kmsKeyId = requireEnv("S3_KMS_KEY_ID");
  const region =
    process.env.S3_BRANDING_REGION?.trim() ||
    process.env.S3_INTAKE_REGION?.trim() ||
    process.env.AWS_REGION?.trim() ||
    "us-east-2";

  const client = new S3Client({
    region,
    followRegionRedirects: true,
    credentials: resolveAwsCredentials(),
  });

  let continuationToken: string | undefined;
  let processed = 0;
  let failures = 0;

  do {
    const list = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      })
    );

    for (const obj of list.Contents ?? []) {
      if (!obj.Key) continue;
      try {
        await client.send(
          new CopyObjectCommand({
            Bucket: bucket,
            Key: obj.Key,
            // CopySource is bucket/key URL-encoded; the SDK handles encoding
            // when the value is plain "bucket/key" with no spaces. Our keys
            // come from generateS3Key() which sanitizes filenames, so this
            // is safe; if you change key generation, revisit.
            CopySource: `${bucket}/${encodeURIComponent(obj.Key).replace(
              /%2F/g,
              "/"
            )}`,
            ServerSideEncryption: "aws:kms",
            SSEKMSKeyId: kmsKeyId,
            MetadataDirective: "COPY",
          })
        );
        processed += 1;
        if (processed % 100 === 0) {
          console.log(`  …rewrote ${processed} objects`);
        }
      } catch (err) {
        failures += 1;
        console.error(`✗ ${obj.Key}:`, err instanceof Error ? err.message : err);
      }
    }

    continuationToken = list.IsTruncated
      ? list.NextContinuationToken
      : undefined;
  } while (continuationToken);

  console.log(
    `Done. Rewrote ${processed} objects in ${bucket} (${failures} failures).`
  );
  if (failures > 0) process.exit(2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
