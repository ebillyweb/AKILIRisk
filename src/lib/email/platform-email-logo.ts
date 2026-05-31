import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { ResendEmailAttachment, ResendEmailPayload } from "@/lib/email/resend-payload";

/** CID referenced in platform email HTML (`<img src="cid:…">`). */
export const PLATFORM_EMAIL_LOGO_CID = "platform-akili-logo";

const LOGO_FILENAME = "akili-email-lockup.png";

let cachedLogoBase64: string | null | undefined;

function loadLogoBase64(): string | null {
  if (cachedLogoBase64 !== undefined) return cachedLogoBase64;
  try {
    const filePath = join(process.cwd(), "public", "brand", LOGO_FILENAME);
    cachedLogoBase64 = readFileSync(filePath).toString("base64");
  } catch (error) {
    console.error("platform-email-logo: failed to read lockup PNG", error);
    cachedLogoBase64 = null;
  }
  return cachedLogoBase64;
}

/** Resend inline attachment — embeds the AKILI lockup in the message body. */
export function getPlatformEmailLogoAttachment():
  | {
      content: string;
      filename: string;
      contentId: string;
    }
  | null {
  const content = loadLogoBase64();
  if (!content) return null;
  return {
    content,
    filename: LOGO_FILENAME,
    contentId: PLATFORM_EMAIL_LOGO_CID,
  };
}

/**
 * When HTML references the platform logo CID, attach the PNG so clients
 * (including Gmail) render it without fetching a public URL.
 */
export function withPlatformLogoAttachment<T extends ResendEmailPayload>(
  payload: T
): T {
  const cidRef = `cid:${PLATFORM_EMAIL_LOGO_CID}`;
  if (!payload.html?.includes(cidRef)) {
    return payload;
  }

  const logo = getPlatformEmailLogoAttachment();
  if (!logo) return payload;

  const attachments: ResendEmailAttachment[] = [...(payload.attachments ?? [])];
  if (attachments.some((a) => a.contentId === PLATFORM_EMAIL_LOGO_CID)) {
    return payload;
  }

  return {
    ...payload,
    attachments: [...attachments, logo],
  };
}
