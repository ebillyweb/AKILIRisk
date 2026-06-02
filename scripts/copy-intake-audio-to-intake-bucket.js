#!/usr/bin/env node
/**
 * One-off: copy `intake/` objects from S3_BRANDING_BUCKET into S3_INTAKE_BUCKET.
 *
 * Use when recordings were uploaded before S3_INTAKE_BUCKET was set (they landed
 * in the branding bucket) but playback now reads S3_INTAKE_BUCKET.
 *
 * Usage:
 *   node scripts/copy-intake-audio-to-intake-bucket.js
 *   DRY_RUN=1 node scripts/copy-intake-audio-to-intake-bucket.js
 *
 * Requires in `.env.local`: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
 * S3_BRANDING_BUCKET, S3_INTAKE_BUCKET, and optional S3_*_REGION.
 */

const path = require("path");
const repoRoot = path.resolve(__dirname, "..");
require("dotenv").config({
  path: path.join(repoRoot, ".env.local"),
  quiet: true,
});

const {
  S3Client,
  ListObjectsV2Command,
  CopyObjectCommand,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");

const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
const region =
  process.env.S3_INTAKE_REGION?.trim() ||
  process.env.S3_BRANDING_REGION?.trim() ||
  process.env.AWS_REGION?.trim() ||
  "us-east-2";
const source = process.env.S3_BRANDING_BUCKET?.trim();
const dest = process.env.S3_INTAKE_BUCKET?.trim();
const prefix = "intake/";

if (!source || !dest) {
  console.error("Set S3_BRANDING_BUCKET and S3_INTAKE_BUCKET in .env.local");
  process.exit(1);
}
if (source === dest) {
  console.error("Source and destination buckets are the same; nothing to copy.");
  process.exit(1);
}
if (!process.env.AWS_ACCESS_KEY_ID?.trim() || !process.env.AWS_SECRET_ACCESS_KEY?.trim()) {
  console.error("Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env.local");
  process.exit(1);
}

const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function listAllKeys() {
  const keys = [];
  let token;
  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: source,
        Prefix: prefix,
        ContinuationToken: token,
      })
    );
    for (const o of res.Contents || []) {
      if (o.Key) keys.push(o.Key);
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function existsInDest(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: dest, Key: key }));
    return true;
  } catch (e) {
    if (e.name === "NotFound" || e.$metadata?.httpStatusCode === 404) return false;
    throw e;
  }
}

async function main() {
  console.log(dryRun ? "--- DRY RUN ---" : "--- APPLY ---");
  console.log({ source, dest, region, prefix });

  const keys = await listAllKeys();
  console.log(`Found ${keys.length} object(s) under ${prefix} in ${source}`);

  let copied = 0;
  let skipped = 0;

  for (const key of keys) {
    if (await existsInDest(key)) {
      skipped++;
      continue;
    }
    if (dryRun) {
      console.log(`would copy: ${key}`);
      copied++;
      continue;
    }
    await s3.send(
      new CopyObjectCommand({
        Bucket: dest,
        Key: key,
        CopySource: encodeURIComponent(`${source}/${key}`),
      })
    );
    copied++;
  }

  console.log({ copied, skipped, total: keys.length });
  if (dryRun) {
    console.log("Re-run without DRY_RUN=1 to apply.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
