import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { resolveAwsCredentials } from "@/lib/s3/aws-credentials";

/**
 * Intake voice-response storage on S3.
 *
 * Mirrors the shape of `src/lib/s3/branding-uploads.ts` deliberately:
 * server-side buffered upload (no presigned PUT, no browser CORS), proxied
 * playback (no presigned GET, no public-read on the bucket). The streaming
 * route at `/api/intake/[interviewId]/audio/[questionId]` is the only path
 * that authorizes byte access.
 *
 * Region/bucket env conventions match the branding module so a single
 * `AWS_REGION` + bucket can serve both. Set `S3_INTAKE_BUCKET` to isolate.
 */

// Wrong region → PermanentRedirect or signed-host mismatch. Prefer the
// intake-specific override; fall through to whatever the branding region is
// (these typically share a bucket).
const INTAKE_AUDIO_S3_REGION =
  process.env.S3_INTAKE_REGION?.trim() ||
  process.env.S3_BRANDING_REGION?.trim() ||
  process.env.AWS_REGION?.trim() ||
  "us-east-2";

// `credentials: undefined` lets the SDK use its default credential provider chain
// (IAM role on Vercel/ECS/EC2). resolveAwsCredentials() only returns explicit keys
// when both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set — matches the
// branding-uploads helper this module was modeled on.
const s3Client = new S3Client({
  region: INTAKE_AUDIO_S3_REGION,
  followRegionRedirects: true,
  credentials: resolveAwsCredentials(),
  requestChecksumCalculation: "WHEN_REQUIRED",
});

const BUCKET_NAME =
  process.env.S3_INTAKE_BUCKET ||
  process.env.S3_BRANDING_BUCKET ||
  "akili-advisor-assets";

/** Tight allowlist on the path components we interpolate into the S3 key.
 *  Matches the upload-route allowlist so cross-validation lines up. */
const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function assertId(label: string, value: string): void {
  if (!ID_PATTERN.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
}

/**
 * Build a deterministic-prefix S3 key with a timestamp+random suffix so a
 * re-recorded answer doesn't overwrite the previous object atomically (we
 * want to delete the old key only after the new one writes successfully).
 */
function generateIntakeAudioKey(
  interviewId: string,
  questionId: string
): string {
  assertId("interviewId", interviewId);
  assertId("questionId", questionId);
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `intake/${interviewId}/${questionId}-${timestamp}-${randomSuffix}.webm`;
}

export interface UploadIntakeAudioResult {
  s3Key: string;
  contentType: string;
  size: number;
}

/**
 * Upload audio bytes for a single intake response. Returns the S3 key for
 * persistence on the IntakeResponse row. On error, attempts to clean up the
 * partial object so we don't leave orphans.
 */
export async function uploadIntakeAudioFromBuffer(
  interviewId: string,
  questionId: string,
  contentType: string,
  body: Uint8Array
): Promise<UploadIntakeAudioResult> {
  const s3Key = generateIntakeAudioKey(interviewId, questionId);
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: body,
        ContentType: contentType,
        ContentLength: body.byteLength,
        Metadata: {
          "interview-id": interviewId,
          "question-id": questionId,
          "upload-timestamp": Date.now().toString(),
        },
      })
    );
    return { s3Key, contentType, size: body.byteLength };
  } catch (error) {
    try {
      await deleteIntakeAudioObject(s3Key);
    } catch (cleanupError) {
      console.error(
        "Failed to cleanup partial intake audio upload:",
        cleanupError
      );
    }
    throw error instanceof Error
      ? error
      : new Error("Intake audio upload failed");
  }
}

/**
 * Stream the bytes back through. The streaming route wraps this in a
 * NextResponse with the same Content-Type + `Cache-Control: private, no-store`
 * the admin advisor-logo proxy uses.
 */
export async function getIntakeAudioObjectBytes(
  s3Key: string
): Promise<{ data: Uint8Array; contentType: string }> {
  const obj = await s3Client.send(
    new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    })
  );

  if (!obj.Body) {
    throw new Error("Empty S3 object body");
  }

  const data = await obj.Body.transformToByteArray();
  return {
    data,
    contentType: obj.ContentType || "application/octet-stream",
  };
}

/**
 * Best-effort cleanup. Used when a re-recording supersedes an earlier
 * answer (delete previous S3 object after the replacement persists), or
 * when an upload fails partway through.
 */
export async function deleteIntakeAudioObject(s3Key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    })
  );
}
