import "server-only";

import {
  looksLikeAdvisorBrandingS3Url,
  resolveBrandingLogoS3Key,
} from "@/lib/branding/advisor-logo-display";
import { getBrandingLogoObjectBytes } from "@/lib/s3/branding-uploads";

/** CID referenced in advisor-branded invitation HTML (`<img src="cid:…">`). */
export const ADVISOR_EMAIL_LOGO_CID = "advisor-brand-logo";

export type AdvisorEmailLogoInput = {
  logoS3Key?: string | null;
  logoUrl?: string | null;
};

export type AdvisorEmailLogoAttachment = {
  content: string;
  filename: string;
  contentId: string;
};

function isPublicHttpsLogoUrl(url: string): boolean {
  try {
    return new URL(url.trim()).protocol === "https:";
  } catch {
    return false;
  }
}

export function hasAdvisorEmailLogo(input: AdvisorEmailLogoInput): boolean {
  if (resolveBrandingLogoS3Key(input)) return true;
  const url = input.logoUrl?.trim();
  return Boolean(
    url && isPublicHttpsLogoUrl(url) && !looksLikeAdvisorBrandingS3Url(url)
  );
}

async function buildAdvisorEmailLogoAttachment(
  s3Key: string
): Promise<AdvisorEmailLogoAttachment> {
  const { data, contentType } = await getBrandingLogoObjectBytes(s3Key);
  const ext = contentType.includes("jpeg")
    ? "jpg"
    : contentType.includes("svg")
      ? "svg"
      : "png";

  return {
    content: Buffer.from(data).toString("base64"),
    filename: `advisor-logo.${ext}`,
    contentId: ADVISOR_EMAIL_LOGO_CID,
  };
}

/**
 * Resolves the img src for invitation email HTML. Private S3 logos use a CID
 * so the bytes must be attached when sending via Resend.
 */
export async function resolveAdvisorEmailLogo(
  input: AdvisorEmailLogoInput
): Promise<
  | { src: string; attachment: AdvisorEmailLogoAttachment }
  | { src: string; attachment: null }
  | null
> {
  const s3Key = resolveBrandingLogoS3Key(input);
  if (s3Key) {
    try {
      const attachment = await buildAdvisorEmailLogoAttachment(s3Key);
      return { src: `cid:${ADVISOR_EMAIL_LOGO_CID}`, attachment };
    } catch (error) {
      console.error("advisor-email-logo: failed to fetch S3 logo for email", error);
      return null;
    }
  }

  const url = input.logoUrl?.trim();
  if (url && isPublicHttpsLogoUrl(url) && !looksLikeAdvisorBrandingS3Url(url)) {
    return { src: url, attachment: null };
  }

  return null;
}

export function appendAdvisorLogoAttachment<
  T extends { attachments?: Array<Record<string, unknown>> },
>(payload: T, attachment: AdvisorEmailLogoAttachment | null): T {
  if (!attachment) return payload;

  const attachments = payload.attachments ?? [];
  if (attachments.some((a) => a.contentId === ADVISOR_EMAIL_LOGO_CID)) {
    return payload;
  }

  return {
    ...payload,
    attachments: [...attachments, attachment],
  };
}
