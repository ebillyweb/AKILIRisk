import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DocumentUploadResponse } from './types';
import { sanitizeDocumentKeyFileName } from './validation';

function getDocumentsS3Region(): string {
  return (
    process.env.S3_DOCUMENTS_REGION?.trim() ||
    process.env.S3_BRANDING_REGION?.trim() ||
    process.env.AWS_REGION?.trim() ||
    'us-east-2'
  );
}

// Initialize S3 client lazily at runtime to avoid build errors when env vars missing
function createS3Client(): S3Client | null {
  const region = getDocumentsS3Region();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    console.warn("AWS credentials not configured - S3 operations will fail");
    return null;
  }

  return new S3Client({
    region,
    followRegionRedirects: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    // Default WHEN_SUPPORTED adds CRC32 query params to presigned PUTs; browsers cannot satisfy them → 403/400.
    // Align with branding uploads (src/lib/s3/branding-uploads.ts).
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
}

export async function generateUploadUrl(
  userId: string,
  requirementId: string,
  fileName: string,
  fileType: string
): Promise<DocumentUploadResponse> {
  const client = createS3Client();
  if (!client) {
    throw new Error("S3 client not configured - check AWS environment variables");
  }

  const bucketName = process.env.S3_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("S3_BUCKET_NAME environment variable not configured");
  }

  const safeSegment = sanitizeDocumentKeyFileName(fileName);
  const key = `documents/${userId}/${requirementId}/${Date.now()}-${safeSegment}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: fileType,
  });

  const signedUrl = await getSignedUrl(client, command, { expiresIn: 3600 }); // 1 hour expiry

  return { signedUrl, key };
}

export async function generateAssessmentQuestionUploadUrl(
  userId: string,
  assessmentId: string,
  questionId: string,
  fileName: string,
  fileType: string
): Promise<DocumentUploadResponse> {
  const client = createS3Client();
  if (!client) {
    throw new Error("S3 client not configured - check AWS environment variables");
  }

  const bucketName = process.env.S3_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("S3_BUCKET_NAME environment variable not configured");
  }

  const safeSegment = sanitizeDocumentKeyFileName(fileName);
  const key = `assessment-uploads/${userId}/${assessmentId}/${questionId}/${Date.now()}-${safeSegment}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: fileType,
  });

  const signedUrl = await getSignedUrl(client, command, { expiresIn: 3600 });

  return { signedUrl, key };
}

/**
 * Read S3 object metadata for a documents key. Used by the confirm route
 * to re-derive `Content-Type` and `Content-Length` from the actual S3
 * object instead of trusting client-supplied values in the confirm body —
 * the presigned PUT was signed by us with a validated MIME, so S3's
 * record of it is the authoritative one.
 *
 * Returns null when the object isn't found (caller treats as confirm
 * failure: client claims to have uploaded something we can't see).
 */
export async function headDocumentObject(
  key: string
): Promise<{ contentType: string | null; contentLength: number | null } | null> {
  const client = createS3Client();
  if (!client) {
    throw new Error("S3 client not configured - check AWS environment variables");
  }

  const bucketName = process.env.S3_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("S3_BUCKET_NAME environment variable not configured");
  }

  try {
    const head = await client.send(
      new HeadObjectCommand({ Bucket: bucketName, Key: key })
    );
    return {
      contentType: head.ContentType ?? null,
      contentLength: head.ContentLength ?? null,
    };
  } catch (err) {
    // NotFound on a missing object surfaces as a 404 from S3; that's the
    // case we care about — confirming a key the client never actually
    // uploaded to. Other errors propagate.
    const code = (err as { name?: string; $metadata?: { httpStatusCode?: number } })
      ?.$metadata?.httpStatusCode;
    if (code === 404) return null;
    throw err;
  }
}

export async function generateDownloadUrl(key: string): Promise<string> {
  const client = createS3Client();
  if (!client) {
    throw new Error("S3 client not configured - check AWS environment variables");
  }

  const bucketName = process.env.S3_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("S3_BUCKET_NAME environment variable not configured");
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn: 3600 }); // 1 hour expiry
}