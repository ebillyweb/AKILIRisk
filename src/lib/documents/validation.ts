import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from "./types";

/** Safe file name segment inside S3 keys — avoids `/`, `#`, spaces, and Unicode breaking presigned URLs. */
export function sanitizeDocumentKeyFileName(fileName: string): string {
  const base = (fileName || "upload").trim() || "upload";
  return base
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 180);
}

/**
 * Maps browser/file metadata + extension to an allowed MIME type.
 * Handles empty types, application/octet-stream, and misreported MIME (common on Windows).
 */
export function resolveAllowedMimeType(
  fileName: string,
  fileType: string,
): string | null {
  const t = (fileType || "").trim().toLowerCase();
  if (t === "image/jpg") {
    return "image/jpeg";
  }
  if (t && Object.keys(ALLOWED_FILE_TYPES).includes(t)) {
    return t;
  }

  const ext = fileName.includes(".")
    ? fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase()
    : "";
  const extToMime: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
  };
  const fromExt = extToMime[ext];
  if (!fromExt) return null;

  if (
    !t ||
    t === "application/octet-stream" ||
    !Object.keys(ALLOWED_FILE_TYPES).includes(t)
  ) {
    return fromExt;
  }

  return null;
}

export function validateFileUpload(
  fileName: string,
  fileType: string,
  fileSize: number,
):
  | { valid: true; mimeType: string }
  | { valid: false; error: string } {
  const mimeType = resolveAllowedMimeType(fileName, fileType);
  if (!mimeType) {
    const allowedTypes = Object.keys(ALLOWED_FILE_TYPES).join(", ");
    return {
      valid: false,
      error: `File type not allowed or could not be determined from the file. Allowed types: ${allowedTypes}`,
    };
  }

  if (fileSize > MAX_FILE_SIZE) {
    const maxSizeMB = Math.round(MAX_FILE_SIZE / (1024 * 1024));
    return {
      valid: false,
      error: `File size ${fileSize} bytes exceeds maximum allowed size of ${maxSizeMB}MB`,
    };
  }

  return { valid: true, mimeType };
}

/** Validates MIME returned from S3 HEAD after upload (defense in depth). */
export function validateStoredDocumentMime(
  contentType: string | null,
):
  | { valid: true; mimeType: string }
  | { valid: false; error: string } {
  const normalized = (contentType ?? "").trim().toLowerCase();
  const mimeType =
    normalized === "image/jpg"
      ? "image/jpeg"
      : normalized;

  if (!mimeType || !Object.keys(ALLOWED_FILE_TYPES).includes(mimeType)) {
    return {
      valid: false,
      error: `Stored file type is not allowed: ${contentType ?? "unknown"}`,
    };
  }

  return { valid: true, mimeType };
}
