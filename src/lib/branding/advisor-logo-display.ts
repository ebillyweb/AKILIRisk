/**
 * Client-safe helpers: advisor logos are often stored as direct S3 URLs while the bucket
 * is private. Browsers cannot load those in <img>; use the authenticated view route instead.
 */
export function looksLikeAdvisorBrandingS3Url(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const path = u.pathname.toLowerCase();
    const s3VirtualHost = host.includes('.s3.') && host.endsWith('.amazonaws.com');
    const pathOk = path.includes('/advisors/') && path.includes('/logos/');
    return s3VirtualHost && pathOk;
  } catch {
    return false;
  }
}

/** Same-origin URL that streams the current advisor logo (session required). */
export const ADVISOR_LOGO_VIEW_PATH = '/api/advisor/branding/logo/view';

/** S3 object key for an advisor logo row (logoS3Key preferred; else parse private logoUrl). */
export function resolveBrandingLogoS3Key(advisor: {
  logoS3Key?: string | null;
  logoUrl?: string | null;
}): string | null {
  const key = advisor.logoS3Key?.trim();
  if (key) return key;

  const url = advisor.logoUrl?.trim();
  if (!url || !looksLikeAdvisorBrandingS3Url(url)) return null;

  try {
    const path = new URL(url).pathname;
    return path.startsWith('/') ? path.slice(1) : path;
  } catch {
    return null;
  }
}

export function isS3ObjectNotFound(error: unknown): boolean {
  const e = error as {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    e?.name === 'NoSuchKey' ||
    e?.Code === 'NoSuchKey' ||
    e?.name === 'NotFound' ||
    e?.$metadata?.httpStatusCode === 404
  );
}

export function resolveAdvisorLogoSrcForPreview(storedLogoUrl: string | null | undefined): string {
  if (!storedLogoUrl?.trim()) return '';
  const trimmed = storedLogoUrl.trim();
  if (looksLikeAdvisorBrandingS3Url(trimmed)) {
    return ADVISOR_LOGO_VIEW_PATH;
  }
  return trimmed;
}
