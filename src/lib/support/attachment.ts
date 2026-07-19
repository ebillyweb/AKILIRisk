/** Max raw image bytes for a support ticket attachment (before base64). */
export const SUPPORT_ATTACHMENT_MAX_BYTES = 4 * 1024 * 1024;

export const SUPPORT_ATTACHMENT_ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export type SupportAttachmentContentType =
  (typeof SUPPORT_ATTACHMENT_ALLOWED_TYPES)[number];

export type SupportTicketAttachmentInput = {
  filename: string;
  contentType: string;
  /** Raw base64 (no data: URL prefix). */
  contentBase64: string;
};

const EXT_BY_TYPE: Record<SupportAttachmentContentType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function isSupportAttachmentContentType(
  value: string
): value is SupportAttachmentContentType {
  return (SUPPORT_ATTACHMENT_ALLOWED_TYPES as readonly string[]).includes(
    value
  );
}

export function sanitizeSupportAttachmentFilename(
  filename: string,
  contentType: SupportAttachmentContentType
): string {
  const base = filename
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 120);
  const hasExt = /\.[a-z0-9]{2,5}$/i.test(base);
  if (hasExt && base.length > 0) return base;
  return `support-attachment.${EXT_BY_TYPE[contentType]}`;
}

export function validateSupportTicketAttachment(
  attachment: SupportTicketAttachmentInput
):
  | { ok: true; filename: string; contentType: SupportAttachmentContentType; contentBase64: string }
  | { ok: false; error: string } {
  if (!isSupportAttachmentContentType(attachment.contentType)) {
    return {
      ok: false,
      error: "Attachment must be a PNG, JPEG, WebP, or GIF image.",
    };
  }

  const contentBase64 = attachment.contentBase64.trim();
  if (!contentBase64 || !/^[A-Za-z0-9+/]+=*$/.test(contentBase64)) {
    return { ok: false, error: "Attachment data is invalid." };
  }

  // Approximate decoded size from base64 length (ignore padding).
  const padding = contentBase64.endsWith("==")
    ? 2
    : contentBase64.endsWith("=")
      ? 1
      : 0;
  const approxBytes = Math.floor((contentBase64.length * 3) / 4) - padding;
  if (approxBytes <= 0) {
    return { ok: false, error: "Attachment is empty." };
  }
  if (approxBytes > SUPPORT_ATTACHMENT_MAX_BYTES) {
    return {
      ok: false,
      error: "Attachment must be 4 MB or smaller.",
    };
  }

  return {
    ok: true,
    filename: sanitizeSupportAttachmentFilename(
      attachment.filename,
      attachment.contentType
    ),
    contentType: attachment.contentType,
    contentBase64,
  };
}
