# S3 SSE-KMS

Operational notes for S3 server-side encryption on the branding and
intake-audio buckets. Round-11 commit 2.7. Cross-references BRD §5.1
(PII scope, round 11).

## Why SSE-KMS, not SSE-S3

Both modes encrypt object bytes with AES-256 server-side. The
difference is who controls the key.

- **SSE-S3** uses an AWS-managed key. There is no per-key audit trail,
  no ability to disable the key independently of the bucket, and no
  cross-account key-policy boundary. It is the AWS default if no
  encryption is configured.
- **SSE-KMS** uses a KMS CMK that we manage. Every encrypt/decrypt
  emits a CloudTrail KMS data event we can alert on. The CMK has its
  own IAM-style key policy and lifecycle (rotation, disable, schedule
  deletion). Disabling the key fail-closes every read on the bucket.

The customer-managed CMK costs ~\$1/month per key plus per-request
fees, mitigated by `BucketKeyEnabled: true` (a per-bucket data key
cached for 24h that drops KMS request volume by ~99%).

## Provisioning sequence

One key per environment. Aliases follow `alias/akili-<env>-s3`.

1. Create the CMK in KMS: customer-managed, symmetric, encrypt/decrypt
   usage, automatic yearly rotation enabled.
2. Attach a key policy granting:
   - the AWS account root admin permissions (default),
   - the app's IAM principal `kms:GenerateDataKey` and `kms:Decrypt`
     conditioned on `kms:ViaService = s3.<region>.amazonaws.com`,
   - the operator/break-glass role admin permissions.
3. Set `S3_KMS_KEY_ID` in the environment (Vercel envs for prod /
   staging / preview; `.env.local` for dev — leave unset locally if
   you don't have a key, app falls back to whatever the bucket
   default is).
4. Run `npx tsx scripts/apply-s3-bucket-encryption.ts` once per env to
   set the bucket-default encryption rule.
5. Run `npx tsx scripts/reencrypt-s3-bucket-with-kms.ts <bucket>` to
   rewrite legacy SSE-S3 objects in place. Idempotent.
6. Optional but recommended: add a bucket policy that denies any
   `s3:PutObject` whose `s3:x-amz-server-side-encryption` is not
   `aws:kms`, so a future helper bug can't downgrade silently.

## Key rotation

KMS automatic rotation is enabled at CMK creation. AWS rotates the
underlying backing key yearly; the CMK ID stays the same and previously
encrypted objects continue to decrypt with the old backing key. No
application action needed.

To rotate the *CMK itself* (e.g., after a perceived compromise):
provision a new CMK, point `S3_KMS_KEY_ID` at the new alias, run the
re-encrypt sweep, then schedule the old key for deletion (30-day
window) once CloudTrail shows zero traffic on it.

## IAM requirements

The app principal (Vercel deploy role / local dev IAM user) needs, on
the bucket: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`,
`s3:ListBucket`. On the CMK: `kms:GenerateDataKey` (for PutObject) and
`kms:Decrypt` (for GetObject / proxy streaming). Operators running the
provisioning scripts additionally need `s3:PutBucketEncryption`.

## Fail-closed semantics

The application sends `ServerSideEncryption: "aws:kms"` and
`SSEKMSKeyId: <id>` on every PutObject when `S3_KMS_KEY_ID` is set
(`s3EncryptionParams()` in `src/lib/s3/encryption-params.ts`). If KMS
is unavailable or the key policy blocks the principal, PutObject
fails with `KMS.AccessDeniedException` — uploads return 5xx, no
plaintext is written, no silent fallback to SSE-S3.

When `S3_KMS_KEY_ID` is unset (dev / CI), the app omits the params and
S3 applies whatever default the bucket has configured. This is
intentional: it lets `vitest run` and local Docker flows work without
provisioning a real KMS key.

## Verifying

```sh
aws s3api get-bucket-encryption --bucket <bucket>
# expect: ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault.SSEAlgorithm == "aws:kms"

aws s3api head-object --bucket <bucket> --key <key>
# expect: ServerSideEncryption: "aws:kms" + SSEKMSKeyId pointing at the alias
```
