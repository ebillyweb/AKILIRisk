import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { prisma } from '@/lib/db';
import { resolveAwsCredentials } from '@/lib/s3/aws-credentials';
import { s3EncryptionParams } from '@/lib/s3/encryption-params';
import { LOGO_MAX_BYTES } from '@/lib/validation/branding';

// Must match the bucket’s actual region (see `aws s3api head-bucket --bucket ...` → x-amz-bucket-region).
// Wrong region → PermanentRedirect, presigned host mismatch, or OPTIONS 500 on the wrong regional endpoint.
// Prefer S3_BRANDING_REGION when other AWS calls use a different AWS_REGION.
const BRANDING_S3_REGION =
  process.env.S3_BRANDING_REGION?.trim() ||
  process.env.AWS_REGION?.trim() ||
  'us-east-2';

function requireBrandingBucket(): string {
  const bucket = process.env.S3_BRANDING_BUCKET?.trim();
  if (!bucket) {
    throw new Error("S3_BRANDING_BUCKET is required for advisor branding uploads.");
  }
  return bucket;
}

// Initialize S3 client (WHEN_REQUIRED avoids default CRC checksum params on presigned PUTs that break browser uploads)
// `credentials: undefined` lets the SDK use its default credential provider chain
// (IAM role on Vercel/ECS/EC2). resolveAwsCredentials() only returns explicit keys
// when both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set.
const s3Client = new S3Client({
  region: BRANDING_S3_REGION,
  followRegionRedirects: true,
  credentials: resolveAwsCredentials(),
  requestChecksumCalculation: 'WHEN_REQUIRED',
});

const BUCKET_NAME = requireBrandingBucket();
const CDN_BASE_URL =
  process.env.CLOUDFRONT_BASE_URL ||
  `https://${BUCKET_NAME}.s3.${BRANDING_S3_REGION}.amazonaws.com`;

interface UploadUrlRequest {
  advisorId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

interface UploadResponse {
  signedUrl: string;
  s3Key: string;
  uploadId: string;
  expiresIn: number;
}

interface ConfirmUploadRequest {
  uploadId: string;
  s3Key: string;
  originalFileName: string;
}

interface ConfirmUploadResponse {
  logoUrl: string;
  s3Key: string;
}

// Upload tracking storage (in production, use Redis or database)
const uploadTracking = new Map<string, {
  advisorId: string;
  s3Key: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  createdAt: Date;
}>();

/**
 * Validates file upload parameters
 */
function validateUploadRequest(request: UploadUrlRequest): void {
  const { fileName, fileType, fileSize } = request;

  // Validate file type
  const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml'];
  if (!allowedTypes.includes(fileType)) {
    throw new Error(`File type ${fileType} not allowed. Allowed types: PNG, JPEG, SVG`);
  }

  if (fileSize > LOGO_MAX_BYTES) {
    const maxMb = LOGO_MAX_BYTES / (1024 * 1024);
    throw new Error(
      `File size ${fileSize} exceeds maximum of ${LOGO_MAX_BYTES} bytes (${maxMb}MB)`
    );
  }

  // Validate file name
  if (!fileName || fileName.trim().length === 0) {
    throw new Error('File name is required');
  }

  // Check for suspicious file extensions
  const suspiciousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.com', '.pif'];
  const hasInvalidExtension = suspiciousExtensions.some(ext =>
    fileName.toLowerCase().includes(ext)
  );

  if (hasInvalidExtension) {
    throw new Error('File type not allowed');
  }
}

/**
 * Generates a unique S3 key for the upload
 */
function generateS3Key(advisorId: string, fileName: string): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const sanitizedFileName = fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase();

  return `advisors/${advisorId}/logos/${timestamp}-${randomSuffix}-${sanitizedFileName}`;
}

/**
 * Generates a unique upload tracking ID
 */
function generateUploadId(): string {
  return `upload_${Date.now()}_${Math.random().toString(36).substring(2)}`;
}

/**
 * Stores upload tracking information
 */
function storeUploadInfo(uploadId: string, info: {
  advisorId: string;
  s3Key: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}): void {
  uploadTracking.set(uploadId, {
    ...info,
    createdAt: new Date(),
  });

  // Cleanup expired tracking info (1 hour TTL)
  setTimeout(() => {
    uploadTracking.delete(uploadId);
  }, 60 * 60 * 1000);
}

/**
 * Retrieves upload tracking information
 */
function getUploadInfo(uploadId: string): {
  advisorId: string;
  s3Key: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  createdAt: Date;
} | null {
  return uploadTracking.get(uploadId) || null;
}

/**
 * Generates a presigned URL for logo upload
 */
export async function generateLogoUploadUrl(request: UploadUrlRequest): Promise<UploadResponse> {
  validateUploadRequest(request);

  const { advisorId, fileName, fileType, fileSize } = request;

  // Generate unique S3 key
  const s3Key = generateS3Key(advisorId, fileName);

  // Create presigned PUT URL. SSE-KMS params (when S3_KMS_KEY_ID is set) become
  // signed headers the browser must echo back; the upload-form layer handles
  // x-amz-server-side-encryption / x-amz-server-side-encryption-aws-kms-key-id
  // forwarding, otherwise S3 returns SignatureDoesNotMatch.
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    ContentType: fileType,
    ContentLength: fileSize,
    Metadata: {
      'advisor-id': advisorId,
      'original-filename': fileName,
      'upload-timestamp': Date.now().toString(),
    },
    ...s3EncryptionParams(),
  });

  const expiresIn = 3600; // 1 hour
  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });

  // Generate tracking ID
  const uploadId = generateUploadId();

  // Store upload info for confirmation
  storeUploadInfo(uploadId, {
    advisorId,
    s3Key,
    fileName,
    fileType,
    fileSize,
  });

  return {
    signedUrl,
    s3Key,
    uploadId,
    expiresIn,
  };
}

/**
 * Persists logo metadata after a successful S3 object write (browser presign or server PutObject).
 */
async function persistAdvisorLogo(
  advisorId: string,
  s3Key: string,
  actualType: string,
  actualSize: number
): Promise<ConfirmUploadResponse> {
  const logoUrl = `${CDN_BASE_URL}/${s3Key}`;

  const advisor = await prisma.advisorProfile.findUnique({
    where: { id: advisorId },
    select: { logoS3Key: true },
  });

  if (!advisor) {
    throw new Error('Advisor profile not found');
  }

  await prisma.advisorProfile.update({
    where: { id: advisorId },
    data: {
      logoS3Key: s3Key,
      logoContentType: actualType,
      logoFileSize: actualSize,
      logoUploadedAt: new Date(),
      logoUrl: logoUrl,
    },
  });

  if (advisor.logoS3Key && advisor.logoS3Key !== s3Key) {
    try {
      await deleteS3Object(advisor.logoS3Key);
    } catch (error) {
      console.error('Failed to delete old logo:', error);
    }
  }

  return { logoUrl, s3Key };
}

/**
 * Upload logo bytes from the app server (avoids browser → S3 CORS on presigned PUT).
 */
export async function uploadLogoFromBuffer(
  advisorId: string,
  fileName: string,
  fileType: string,
  body: Uint8Array
): Promise<ConfirmUploadResponse> {
  const fileSize = body.byteLength;
  validateUploadRequest({ advisorId, fileName, fileType, fileSize });
  const s3Key = generateS3Key(advisorId, fileName);

  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: body,
        ContentType: fileType,
        ContentLength: fileSize,
        Metadata: {
          'advisor-id': advisorId,
          'original-filename': fileName,
          'upload-timestamp': Date.now().toString(),
        },
        ...s3EncryptionParams(),
      })
    );

    return await persistAdvisorLogo(advisorId, s3Key, fileType, fileSize);
  } catch (error) {
    try {
      await deleteS3Object(s3Key);
    } catch (cleanupError) {
      console.error('Failed to cleanup failed upload:', cleanupError);
    }
    throw error instanceof Error ? error : new Error('Logo upload failed');
  }
}

/**
 * Confirms successful S3 upload and updates database
 */
export async function confirmLogoUpload(request: ConfirmUploadRequest): Promise<ConfirmUploadResponse> {
  const { uploadId, s3Key } = request;

  // Retrieve upload info
  const uploadInfo = getUploadInfo(uploadId);
  if (!uploadInfo || uploadInfo.s3Key !== s3Key) {
    throw new Error('Invalid upload confirmation - upload not found or key mismatch');
  }

  try {
    // Verify file exists in S3 and get metadata
    const headCommand = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });

    const s3Response = await s3Client.send(headCommand);
    const actualSize = s3Response.ContentLength || 0;
    const actualType = s3Response.ContentType || uploadInfo.fileType;

    // Validate file was uploaded correctly
    if (Math.abs(actualSize - uploadInfo.fileSize) > 1000) { // Allow 1KB difference for metadata
      throw new Error('Uploaded file size does not match expected size');
    }

    const result = await persistAdvisorLogo(
      uploadInfo.advisorId,
      s3Key,
      actualType,
      actualSize
    );

    uploadTracking.delete(uploadId);

    return result;
  } catch (error) {
    // Clean up failed upload
    try {
      await deleteS3Object(s3Key);
    } catch (cleanupError) {
      console.error('Failed to cleanup failed upload:', cleanupError);
    }

    uploadTracking.delete(uploadId);

    throw new Error(`Upload confirmation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Deletes a logo from S3 and updates database
 */
export async function deleteLogo(advisorId: string): Promise<void> {
  const advisor = await prisma.advisorProfile.findUnique({
    where: { id: advisorId },
    select: { logoS3Key: true },
  });

  if (!advisor || !advisor.logoS3Key) {
    throw new Error('No logo found to delete');
  }

  // Delete from S3
  await deleteS3Object(advisor.logoS3Key);

  // Update database
  await prisma.advisorProfile.update({
    where: { id: advisorId },
    data: {
      logoS3Key: null,
      logoContentType: null,
      logoFileSize: null,
      logoUploadedAt: null,
      logoUrl: null, // Also clear legacy field
    },
  });
}

/**
 * Deletes an S3 object
 */
async function deleteS3Object(s3Key: string): Promise<void> {
  try {
    const deleteCommand = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });

    await s3Client.send(deleteCommand);
  } catch (error) {
    console.error('Failed to delete S3 object:', s3Key, error);
    throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generates a public URL for an S3 object
 */
export function generateAssetUrl(s3Key: string): string {
  return `${CDN_BASE_URL}/${s3Key}`;
}

/**
 * Fetch logo bytes from S3 (for authenticated app proxy when objects are not public-read).
 */
export async function getBrandingLogoObjectBytes(
  s3Key: string
): Promise<{ data: Uint8Array; contentType: string }> {
  const obj = await s3Client.send(
    new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    })
  );

  if (!obj.Body) {
    throw new Error('Empty S3 object body');
  }

  const data = await obj.Body.transformToByteArray();
  return {
    data,
    contentType: obj.ContentType || 'application/octet-stream',
  };
}

/**
 * Validates image content for security (basic checks)
 */
export async function validateImageContent(file: ArrayBuffer, mimeType: string): Promise<void> {
  // Convert to Uint8Array for easier processing
  const bytes = new Uint8Array(file);

  // Check file headers for common image formats
  const signatures = {
    'image/png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
    'image/jpeg': [0xFF, 0xD8, 0xFF],
    'image/svg+xml': [0x3C], // '<' character for XML/SVG
  };

  const signature = signatures[mimeType as keyof typeof signatures];
  if (signature) {
    const fileHeader = Array.from(bytes.slice(0, signature.length));
    const isValid = signature.every((byte, index) => fileHeader[index] === byte);

    if (!isValid) {
      throw new Error('File header does not match declared MIME type');
    }
  }

  // For SVG files, perform additional security checks
  if (mimeType === 'image/svg+xml') {
    const content = new TextDecoder().decode(bytes);

    // Check for potentially dangerous SVG content
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i, // Event handlers like onclick, onload, etc.
      /<iframe/i,
      /<object/i,
      /<embed/i,
      /<link/i,
      /<meta/i,
      /<style[^>]*>[\s\S]*<\/style>/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        throw new Error('SVG contains potentially malicious content');
      }
    }

    // Ensure it's actually an SVG
    if (!content.includes('<svg')) {
      throw new Error('File does not appear to be a valid SVG');
    }
  }
}

/**
 * Get upload statistics for an advisor
 */
export async function getUploadStatistics(advisorId: string): Promise<{
  totalUploads: number;
  totalSize: number;
  currentLogo: {
    fileName: string;
    fileSize: number;
    contentType: string;
    uploadedAt: Date;
  } | null;
}> {
  // Get current logo info
  const advisor = await prisma.advisorProfile.findUnique({
    where: { id: advisorId },
    select: {
      logoS3Key: true,
      logoContentType: true,
      logoFileSize: true,
      logoUploadedAt: true,
    },
  });

  // Get upload history from audit logs
  const uploadLogs = await prisma.advisorBrandingAuditLog.findMany({
    where: {
      advisorId,
      action: 'UPLOAD_LOGO',
    },
    select: {
      newValues: true,
    },
  });

  const totalUploads = uploadLogs.length;
  const totalSize = uploadLogs.reduce((sum, log) => {
    const fileSize = (log.newValues as any)?.fileSize || 0;
    return sum + fileSize;
  }, 0);

  const currentLogo = advisor?.logoS3Key ? {
    fileName: advisor.logoS3Key.split('/').pop() || 'unknown',
    fileSize: advisor.logoFileSize || 0,
    contentType: advisor.logoContentType || 'unknown',
    uploadedAt: advisor.logoUploadedAt || new Date(),
  } : null;

  return {
    totalUploads,
    totalSize,
    currentLogo,
  };
}